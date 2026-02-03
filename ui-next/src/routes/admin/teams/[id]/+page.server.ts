// src/routes/admin/teams/[id]/+page.server.ts

import { db } from '$lib/server/db';
import { people, team_members, teams } from '$lib/server/db/schema';
import { error, fail, type Actions } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { church } = locals;
	if (!church) throw error(404, 'Church not found');

	// 1. Get Team & Active Members (Filtered by deleted_at IS NULL)
	const teamData = await db.query.teams.findFirst({
		where: and(eq(teams.id, params.id), eq(teams.church_id, church.id)),
		with: {
			members: {
				where: isNull(team_members.deleted_at),
				with: {
					person: true
				}
			}
		}
	});

	if (!teamData) throw error(404, 'Team not found');

	// 2. GROUPING LOGIC: Transform raw rows into grouped people
	// Map<PersonID, { person: PersonData, roles: Array<MemberRow> }>
	type MemberRow = (typeof teamData.members)[number];

	type RosterRole = {
		id: string;
		role: MemberRow['role'];
		status: MemberRow['status'];
	};

	type RosterEntry = {
		person: MemberRow['person'];
		roles: RosterRole[];
	};

	const groupedMembers = new Map<string, RosterEntry>();

	for (const row of teamData.members) {
		if (!row.person) continue;

		const pId = row.person.id;

		let entry = groupedMembers.get(pId);

		if (!entry) {
			entry = {
				person: row.person,
				roles: []
			};
			groupedMembers.set(pId, entry);
		}

		entry.roles.push({
			id: row.id,
			role: row.role,
			status: row.status
		});
	}

	// Convert Map to Array for the UI
	const roster = Array.from(groupedMembers.values());

	// 3. Get Available People for dropdown
	const allPeople = await db.query.people.findMany({
		where: eq(people.church_id, church.id),
		orderBy: (p, { asc }) => [asc(p.first_name)]
	});

	return {
		team: teamData,
		roster, // The grouped list
		allPeople
	};
};

export const actions = {
	// Rename / Update Team Details
	updateTeam: async ({ request, locals, params }) => {
		const { church } = locals;
		if (!church) return fail(401);
		if (!params.id) return fail(400, { error: 'Team ID missing' });

		const data = await request.formData();
		const name = data.get('name') as string;
		const description = data.get('description') as string;

		try {
			await db
				.update(teams)
				.set({ name, description })
				.where(and(eq(teams.id, params.id), eq(teams.church_id, church.id)));
			return { success: true };
		} catch {
			return fail(500, { error: 'Failed to update team.' });
		}
	},

	addMember: async ({ request, locals, params }) => {
		const { church } = locals;
		if (!church) return fail(401);
		if (!params.id) return fail(400, { error: 'Team ID is missing' });

		const data = await request.formData();
		const personId = data.get('person_id') as string;
		const role = data.get('role') as string;

		try {
			await db.insert(team_members).values({
				church_id: church.id,
				team_id: params.id,
				person_id: personId,
				role: role || 'Member'
			});
		} catch {
			return fail(500, { error: 'Failed to add member' });
		}
		return { success: true };
	},

	// Soft Delete (Archive)
	removeMember: async ({ request }) => {
		const data = await request.formData();
		const membershipId = data.get('membership_id') as string;

		try {
			// SOFT DELETE: Just set the date. The loader filters these out.
			await db
				.update(team_members)
				.set({
					status: 'inactive',
					deleted_at: new Date()
				})
				.where(eq(team_members.id, membershipId));
		} catch {
			return fail(500, { error: 'Failed to archive member' });
		}
	}
} satisfies Actions;
