import { db } from '$lib/server/db';
import { people, plan_people, plans, team_members, teams } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

// --- TYPE DEFINITION ---
type ActivityItem = {
	type: 'join' | 'signup';
	personFirst: string | null;
	personLast: string | null;
	targetName: string | null;
	targetType?: string | null;
	date: Date | null;
};

// --- LOAD FUNCTION ---
export const load: PageServerLoad = async ({ locals }) => {
	// 1. Guard Clause (Tenant Isolation)
	if (!locals.church) {
		throw error(404, 'Church not found');
	}
	const { church } = locals;

	// 2. Resolve Current User
	let currentUser = await db.query.people.findFirst({
		where: (p, { and, eq }) => and(eq(p.church_id, church.id), eq(p.role, 'admin'))
	});

	if (!currentUser) {
		currentUser = await db.query.people.findFirst({
			where: (p, { eq }) => eq(p.church_id, church.id)
		});
	}

	if (!currentUser) return { currentUser: null };

	// Check if user is a leader (using valid role values from schema)
	const isLeader = ['admin', 'staff', 'coordinator', 'org_owner'].includes(currentUser.role);

	// --- 3. PERSONAL DASHBOARD DATA ---

	// A. Serving Schedule (Future only) - using plans directly
	const upcomingServings = await db
		.select({
			date: plans.date,
			title: plans.name,
			role_name: plan_people.role_name
		})
		.from(plan_people)
		.innerJoin(plans, eq(plan_people.plan_id, plans.id))
		.where(and(eq(plan_people.person_id, currentUser.id), gte(plans.date, new Date())))
		.orderBy(plans.date)
		.limit(5);

	// B. My Groups
	const myGroups = await db
		.select({
			id: teams.id,
			name: teams.name,
			type: teams.type,
			description: teams.description
		})
		.from(team_members)
		.innerJoin(teams, eq(team_members.team_id, teams.id))
		.where(
			and(
				eq(team_members.person_id, currentUser.id),
				inArray(teams.type, ['small_group', 'kinship', 'outreach', 'demographic'])
			)
		);

	// --- 4. LEADER PULSE DATA ---
	let activityFeed: ActivityItem[] = [];

	if (isLeader) {
		// A. New Team Joins
		const rawJoins = await db
			.select({
				personFirst: people.first_name,
				personLast: people.last_name,
				targetName: teams.name,
				targetType: teams.type,
				date: team_members.created_at
			})
			.from(team_members)
			.innerJoin(people, eq(team_members.person_id, people.id))
			.innerJoin(teams, eq(team_members.team_id, teams.id))
			.where(
				and(
					eq(people.church_id, church.id),
					inArray(teams.type, ['kinship', 'small_group', 'outreach', 'ministry'])
				)
			)
			.orderBy(desc(team_members.created_at))
			.limit(10);

		activityFeed = rawJoins.map((j) => ({
			type: 'join' as const,
			...j
		}));
	}

	return {
		currentUser,
		isLeader,
		personal: { upcomingServings, myGroups },
		leader: { activityFeed }
	};
};
