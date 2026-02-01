import { db } from '$lib/server/db';
import {
	gatherings,
	people,
	plan_people,
	plans,
	prayer_requests,
	team_members,
	teams
} from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

// Define the shape of our Activity Feed items strictly
type ActivityItem = {
	type: 'join' | 'prayer' | 'signup';
	personFirst: string | null;
	personLast: string | null;
	targetName: string | null;
	targetType?: string | null;
	date: Date | null;
};

export const load: PageServerLoad = async ({ locals }) => {
	const { church } = locals;
	if (!church) error(404, 'Church not found');

	// --- AUTH MOCK (Replace with real session in prod) ---
	let currentUser = await db.query.people.findFirst({
		where: (p, { and, eq }) => and(eq(p.church_id, church.id), eq(p.role, 'admin'))
	});
	if (!currentUser) {
		currentUser = await db.query.people.findFirst({
			where: (p, { eq }) => eq(p.church_id, church.id)
		});
	}
	if (!currentUser) return { currentUser: null };

	const isLeader = ['admin', 'pastor', 'leader', 'care_team'].includes(currentUser.role);

	// --- 1. PERSONAL DASHBOARD ---

	// A. Serving Schedule
	// We use "gte" (Greater Than or Equal) to show future servings only
	const upcomingServings = await db
		.select({
			date: gatherings.date,
			title: gatherings.title,
			role: plan_people.role,
			team: teams.name
		})
		.from(plan_people)
		.innerJoin(plans, eq(plan_people.plan_id, plans.id))
		.innerJoin(gatherings, eq(plans.gathering_id, gatherings.id))
		.leftJoin(teams, eq(plan_people.team_id, teams.id))
		.where(and(eq(plan_people.person_id, currentUser.id), gte(gatherings.date, new Date())))
		.orderBy(gatherings.date)
		.limit(5);

	// B. My Groups (Kinship, Small Group, Outreach)
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

	// --- 2. LEADER PULSE ---
	let activityFeed: ActivityItem[] = [];
	let prayerWall: (typeof prayer_requests.$inferSelect)[] = [];

	if (isLeader) {
		// A. New Joins (People joining Groups)
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
					inArray(teams.type, ['kinship', 'small_group', 'outreach'])
				)
			)
			.orderBy(desc(team_members.created_at))
			.limit(5);

		// B. New Prayers
		const rawPrayers = await db
			.select({
				personFirst: people.first_name,
				personLast: people.last_name,
				date: prayer_requests.created_at
			})
			.from(prayer_requests)
			.leftJoin(people, eq(prayer_requests.person_id, people.id))
			.where(eq(prayer_requests.church_id, church.id))
			.orderBy(desc(prayer_requests.created_at))
			.limit(5);

		// Process & Merge in JS (Avoids SQL Type Errors)
		const joinsMapped: ActivityItem[] = rawJoins.map((j) => ({
			type: 'join',
			...j
		}));

		const prayersMapped: ActivityItem[] = rawPrayers.map((p) => ({
			type: 'prayer',
			personFirst: p.personFirst,
			personLast: p.personLast,
			targetName: 'Prayer Wall',
			targetType: 'prayer',
			date: p.date
		}));

		// Sort merged list by date descending
		activityFeed = [...joinsMapped, ...prayersMapped]
			.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
			.slice(0, 10);

		// C. Open Prayer Requests
		prayerWall = await db
			.select()
			.from(prayer_requests)
			.where(and(eq(prayer_requests.church_id, church.id), eq(prayer_requests.status, 'open')))
			.orderBy(desc(prayer_requests.created_at))
			.limit(5);
	}

	return {
		currentUser,
		isLeader,
		personal: { upcomingServings, myGroups },
		leader: { activityFeed, prayerWall }
	};
};
