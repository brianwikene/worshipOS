import { db } from '$lib/server/db';
import {
	care_notes,
	families,
	people,
	person_capabilities, // <--- ADDED
	team_members, // <--- ADDED
	teams
} from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { church } = locals;
	if (!church) error(404, 'Church not found');

	// 1. Fetch Person (Existing)
	const person = await db.query.people.findFirst({
		where: (people, { and, eq }) => and(eq(people.id, params.id), eq(people.church_id, church.id)),
		with: {
			family: { with: { members: true } },
			teamMemberships: { with: { team: true } },
			capabilities: true,
			relationships: { with: { relatedPerson: true } },
			careNotes: true
		}
	});

	if (!person) error(404, 'Person not found');

	// 2. Fetch Families (Existing)
	const allFamilies = await db.query.families.findMany({
		where: (f, { eq }) => eq(f.church_id, church.id),
		columns: { id: true, name: true, address_city: true }
	});

	// 3. FETCH TEAMS (NEW)
	const allTeams = await db.query.teams.findMany({
		where: (t, { eq }) => eq(t.church_id, church.id),
		orderBy: (teams, { asc }) => [asc(teams.name)]
	});

	return { person, allFamilies, allTeams };
};

export const actions: Actions = {
	// 1. UPDATE PROFILE (Bio, Phone, Season/Capacity)
	updateProfile: async ({ request, params, locals }) => {
		const { church } = locals;
		if (!church) return fail(401);

		const data = await request.formData();
		const first_name = data.get('first_name') as string;
		const last_name = data.get('last_name') as string;
		const email = data.get('email') as string;
		const phone = data.get('phone') as string;
		const bio = data.get('bio') as string;

		const capacity_note = data.get('capacity_note') as string;

		await db
			.update(people)
			.set({
				first_name,
				last_name,
				email,
				phone,
				bio,
				capacity_note,
				updated_at: new Date()
			})
			.where(and(eq(people.id, params.id), eq(people.church_id, church.id)));

		return { success: true };
	},

	// 2. CONNECT EXISTING FAMILY
	connectFamily: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const family_id = data.get('family_id') as string;

		await db
			.update(people)
			.set({ family_id })
			.where(and(eq(people.id, params.id), eq(people.church_id, church.id)));

		return { success: true };
	},

	// 3. CREATE & CONNECT NEW FAMILY
	createFamily: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const name = data.get('name') as string;
		const address_city = data.get('city') as string;

		const newFamilyId = uuidv4();

		await db.transaction(async (tx) => {
			await tx.insert(families).values({
				id: newFamilyId,
				church_id: church.id,
				name,
				address_city
			});

			await tx
				.update(people)
				.set({ family_id: newFamilyId })
				.where(and(eq(people.id, params.id), eq(people.church_id, church.id)));
		});

		return { success: true };
	},

	// 4. ADD CAPABILITY
	addCapability: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const capability = data.get('capability') as string;
		const rating = parseInt(data.get('rating') as string) || 3;
		const notes = data.get('notes') as string;

		await db.insert(person_capabilities).values({
			church_id: church.id,
			person_id: params.id,
			capability,
			rating,
			notes
		});

		return { success: true };
	},

	// 5. REMOVE CAPABILITY
	removeCapability: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const capability_id = data.get('capability_id') as string;

		await db
			.delete(person_capabilities)
			.where(
				and(eq(person_capabilities.id, capability_id), eq(person_capabilities.church_id, church.id))
			);

		return { success: true };
	},

	// 6. UPDATE HOUSEHOLD DETAILS (Renumbered from 5)
	updateHouseholdDetails: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();

		const family_name = data.get('family_name') as string;
		const household_role = data.get('household_role') as string;
		const is_household_primary = data.get('is_household_primary') === 'on';

		const personRecord = await db.query.people.findFirst({
			where: (p, { and, eq }) => and(eq(p.id, params.id), eq(p.church_id, church.id)),
			columns: { family_id: true }
		});

		if (!personRecord) return fail(404, { message: 'Person not found' });

		await db.transaction(async (tx) => {
			if (personRecord.family_id && family_name) {
				await tx
					.update(families)
					.set({ name: family_name })
					.where(eq(families.id, personRecord.family_id));
			}

			await tx
				.update(people)
				.set({
					household_role,
					is_household_primary,
					updated_at: new Date()
				})
				.where(and(eq(people.id, params.id), eq(people.church_id, church.id)));
		});

		return { success: true };
	},

	// 7. CREATE TEAM (New)
	createTeam: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const name = data.get('name') as string;

		await db.insert(teams).values({
			church_id: church.id,
			name,
			is_secure: false
		});

		return { success: true };
	},

	// 8. JOIN TEAM (Updated for Multi-Role)
	joinTeam: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const team_id = data.get('team_id') as string;

		// Default to 'Member' if blank, but usually they will type 'Nursery', 'Guitar', etc.
		const role = (data.get('role') as string) || 'Member';

		// CHECK: Allow same team, but block EXACT duplicate role
		const existing = await db.query.team_members.findFirst({
			where: (tm, { and, eq }) =>
				and(
					eq(tm.person_id, params.id),
					eq(tm.team_id, team_id),
					eq(tm.role, role) // <--- NEW: Only block if Role matches too
				)
		});

		if (!existing) {
			await db.insert(team_members).values({
				church_id: church.id,
				person_id: params.id,
				team_id,
				role,
				status: 'active'
			});
		}

		return { success: true };
	},

	// 9. ARCHIVE TEAM MEMBERSHIP (End Season)
	archiveTeamMembership: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const membership_id = data.get('membership_id') as string;

		await db
			.update(team_members)
			.set({ status: 'inactive' }) // <--- Mark as inactive, don't delete
			.where(and(eq(team_members.id, membership_id), eq(team_members.church_id, church.id)));

		return { success: true };
	},

	// 10. RESTORE TEAM MEMBERSHIP (Re-activate)
	restoreTeamMembership: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const membership_id = data.get('membership_id') as string;

		await db
			.update(team_members)
			.set({ status: 'active' })
			.where(and(eq(team_members.id, membership_id), eq(team_members.church_id, church.id)));

		return { success: true };
	},

	// 11. DELETE PERMANENTLY (For mistakes only)
	deleteTeamMembership: async ({ request, locals }) => {
		// ... implementation if needed, but 'archive' is usually enough
		const { church } = locals;
		const data = await request.formData();
		const membership_id = data.get('membership_id') as string;

		await db
			.delete(team_members)
			.where(and(eq(team_members.id, membership_id), eq(team_members.church_id, church.id)));

		return { success: true };
	},

	// 9. LEAVE TEAM (New)
	leaveTeam: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const membership_id = data.get('membership_id') as string;

		await db
			.delete(team_members)
			.where(and(eq(team_members.id, membership_id), eq(team_members.church_id, church.id)));

		return { success: true };
	},
	// 10. ADD CARE NOTE
	addCareNote: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const content = data.get('content') as string;
		const category = (data.get('category') as string) || 'General';

		await db.insert(care_notes).values({
			church_id: church.id,
			person_id: params.id,
			content,
			category,
			visibility: 'admin_only' // Default safe visibility
		});

		return { success: true };
	}
};
