// src/routes/connections/[id]/+page.server.ts

import { db } from '$lib/server/db';
import {
	addressTypeEnum,
	addresses,
	care_logs,
	families,
	people,
	person_capabilities,
	plan_people,
	plans,
	team_members,
	teams
} from '$lib/server/db/schema';
import type { Actions } from '@sveltejs/kit';
import { error, fail } from '@sveltejs/kit';
import { and, desc, eq, gte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.church) throw error(404, 'Church not found');

	const { church } = locals;
	const { id } = params;

	// Person + relations (no careLogs here; loaded separately as "careNotes")
	const person = await db.query.people.findFirst({
		where: (p, { and, eq }) => and(eq(p.id, id), eq(p.church_id, church.id)),
		with: {
			family: {
				with: { addresses: true, members: true }
			},
			teamMemberships: {
				with: { team: true }
			},
			relationships: {
				with: { relatedPerson: true }
			},
			capabilities: {
				with: { capability: true }
			},
			preferredCampus: true,
			personalAddresses: true
		}
	});

	if (!person) throw error(404, 'Person not found');

	// Care Notes: schema has created_at, not date
	const careNotes = await db
		.select({
			id: care_logs.id,
			content: care_logs.content,
			type: care_logs.type,
			is_private: care_logs.is_private,
			created_at: care_logs.created_at,
			category: care_logs.type,
			authorFirstName: people.first_name,
			authorLastName: people.last_name
		})
		.from(care_logs)
		.leftJoin(people, eq(care_logs.author_id, people.id))
		.where(and(eq(care_logs.person_id, id), eq(care_logs.church_id, church.id)))
		.orderBy(desc(care_logs.created_at));

	// Teams this person is a member of (for drawer)
	const myTeams = await db
		.select({
			id: teams.id,
			name: teams.name,
			type: teams.type
		})
		.from(team_members)
		.innerJoin(teams, eq(team_members.team_id, teams.id))
		.where(and(eq(team_members.person_id, id), eq(team_members.church_id, church.id)));

	// Upcoming Schedule: plan_people has role_name (not role), no team_id join
	const schedule = await db
		.select({
			date: plans.date,
			title: plans.name,
			role_name: plan_people.role_name
		})
		.from(plan_people)
		.innerJoin(plans, eq(plan_people.plan_id, plans.id))
		.where(
			and(
				eq(plan_people.person_id, id),
				eq(plan_people.church_id, church.id),
				gte(plans.date, new Date())
			)
		)
		.orderBy(plans.date)
		.limit(5);

	// Drawer lists
	const allFamilies = await db.query.families.findMany({
		where: (f, { eq }) => eq(f.church_id, church.id)
	});

	const allTeams = await db.query.teams.findMany({
		where: (t, { eq }) => eq(t.church_id, church.id)
	});

	const allCampuses = await db.query.campuses.findMany({
		where: (c, { eq }) => eq(c.church_id, church.id)
	});

	const allCapabilities = await db.query.capabilities.findMany({
		where: (c, { eq }) => eq(c.church_id, church.id)
	});

	return {
		person,
		careNotes,
		myTeams,
		schedule,
		allFamilies,
		allTeams,
		allCampuses,
		allCapabilities
	};
};

export const actions: Actions = {
	addCareNote: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Person ID required');

		const { church } = locals;
		const personId = params.id;
		const formData = await request.formData();

		// Temporary author selection: first admin person in this church
		const author = await db.query.people.findFirst({
			where: (p, { and, eq }) => and(eq(p.church_id, church.id), eq(p.role, 'admin'))
		});

		if (!author) return { success: false, error: 'No author found' };

		await db.insert(care_logs).values({
			church_id: church.id,
			person_id: personId,
			author_id: author.id,
			type: (formData.get('category') as string) || 'General',
			content: (formData.get('content') as string) || '',
			is_private: true
			// NOTE: no "date" column; created_at should be defaulted by DB
		});

		return { success: true };
	},

	updateProfile: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Person ID required');

		const { church } = locals;
		const personId = params.id;
		const data = await request.formData();

		const first_name = (data.get('first_name') as string)?.trim();
		const last_name = (data.get('last_name') as string)?.trim();
		const email = (data.get('email') as string) || null;
		const phone = (data.get('phone') as string) || null;
		const bio = (data.get('bio') as string) || null;
		const occupation = (data.get('occupation') as string) || null;
		const capacity_note = (data.get('capacity_note') as string) || null;
		const rawCampusId = data.get('preferred_campus_id') as string;
		const preferred_campus_id = rawCampusId ? rawCampusId : null;

		if (!first_name || !last_name) {
			return fail(400, { error: 'First and last name are required' });
		}

		await db
			.update(people)
			.set({
				first_name,
				last_name,
				email,
				phone,
				bio,
				occupation,
				capacity_note,
				preferred_campus_id,
				updated_at: new Date()
			})
			.where(and(eq(people.id, personId), eq(people.church_id, church.id)));

		return { success: true };
	},

	connectFamily: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Person ID required');

		const { church } = locals;
		const personId = params.id;
		const data = await request.formData();
		const family_id = data.get('family_id') as string;

		await db
			.update(people)
			.set({ family_id })
			.where(and(eq(people.id, personId), eq(people.church_id, church.id)));

		return { success: true };
	},

	createFamily: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Person ID required');

		const { church } = locals;
		const personId = params.id;
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();

		if (!name) return fail(400, { error: 'Family name is required' });

		const newFamilyId = uuidv4();

		await db.transaction(async (tx) => {
			await tx.insert(families).values({
				id: newFamilyId,
				church_id: church.id,
				name
				// NOTE: no address_city
			});

			await tx
				.update(people)
				.set({ family_id: newFamilyId })
				.where(and(eq(people.id, personId), eq(people.church_id, church.id)));
		});

		return { success: true };
	},

	updateHouseholdDetails: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Person ID required');

		const { church } = locals;
		const personId = params.id;
		const data = await request.formData();

		const family_name = data.get('family_name') as string;
		const household_role = data.get('household_role') as string;
		const is_household_primary = data.get('is_household_primary') === 'on';

		const personRecord = await db.query.people.findFirst({
			where: (p, { and, eq }) => and(eq(p.id, personId), eq(p.church_id, church.id)),
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
				.where(and(eq(people.id, personId), eq(people.church_id, church.id)));
		});

		return { success: true };
	},

	addCapability: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Person ID required');

		const { church } = locals;
		const personId = params.id;

		const data = await request.formData();
		const capability_id = data.get('capability_id') as string;
		const rating = parseInt((data.get('rating') as string) || '3', 10) || 3;
		const preference = parseInt((data.get('preference') as string) || '3', 10) || 3;

		if (!capability_id) return fail(400, { error: 'Capability is required' });

		await db.insert(person_capabilities).values({
			church_id: church.id,
			person_id: personId,
			capability_id,
			rating,
			preference
		});

		return { success: true };
	},

	removeCapability: async ({ request, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		const { church } = locals;

		const data = await request.formData();
		const person_capability_id = data.get('person_capability_id') as string;

		if (!person_capability_id) throw error(400, 'Person capability ID required');

		await db
			.delete(person_capabilities)
			.where(
				and(
					eq(person_capabilities.id, person_capability_id),
					eq(person_capabilities.church_id, church.id)
				)
			);

		return { success: true };
	},

	createTeam: async ({ request, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		const { church } = locals;

		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();

		if (!name) return fail(400, { error: 'Team name is required' });

		await db.insert(teams).values({
			church_id: church.id,
			name,
			type: 'ministry'
		});

		return { success: true };
	},

	joinTeam: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Person ID required');

		const { church } = locals;
		const personId = params.id;

		const data = await request.formData();
		const team_id = data.get('team_id') as string;
		const role = (data.get('role') as string)?.trim() || 'Member';

		if (!team_id) return fail(400, { error: 'Please select a team' });

		const existing = await db.query.team_members.findFirst({
			where: (tm, { and, eq }) =>
				and(
					eq(tm.church_id, church.id),
					eq(tm.person_id, personId),
					eq(tm.team_id, team_id),
					eq(tm.role, role)
				)
		});

		if (!existing) {
			await db.insert(team_members).values({
				church_id: church.id,
				person_id: personId,
				team_id,
				role
				// NOTE: no "status" column
			});
		}

		return { success: true };
	},

	deleteTeamMembership: async ({ request, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		const { church } = locals;

		const data = await request.formData();
		const membership_id = data.get('membership_id') as string;

		if (!membership_id) throw error(400, 'Membership ID required');

		await db
			.delete(team_members)
			.where(and(eq(team_members.id, membership_id), eq(team_members.church_id, church.id)));

		return { success: true };
	},

	saveAddress: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Person ID required');

		const { church } = locals;
		const personId = params.id;
		const data = await request.formData();

		const addressId = (data.get('address_id') as string) || null;

		const street = (data.get('street') as string) || null;
		const city = (data.get('city') as string) || null;
		const state = (data.get('state') as string) || null;
		const zip = (data.get('zip') as string) || null;
		const country = (data.get('country') as string) || 'US';
		const description = (data.get('description') as string) || null;

		// ✅ enum-safe type
		type AddressType = (typeof addressTypeEnum.enumValues)[number];
		const rawType = ((data.get('type') as string) || 'home').toLowerCase();
		const isAddressType = (v: string): v is AddressType =>
			(addressTypeEnum.enumValues as readonly string[]).includes(v);
		const type: AddressType = isAddressType(rawType) ? rawType : 'home';

		const isPrimaryRaw = data.get('is_primary');
		const is_primary = isPrimaryRaw === 'true' || isPrimaryRaw === 'on' || isPrimaryRaw === '1';

		if (!street && !city && !state && !zip) {
			return fail(400, { message: 'Address is empty.' });
		}

		// Enforce only 1 primary per person
		if (is_primary) {
			await db
				.update(addresses)
				.set({ is_primary: false })
				.where(and(eq(addresses.church_id, church.id), eq(addresses.person_id, personId)));
		}

		if (addressId) {
			await db
				.update(addresses)
				.set({
					street,
					city,
					state,
					zip,
					country,
					type,
					description,
					is_primary
				})
				.where(
					and(
						eq(addresses.id, addressId),
						eq(addresses.church_id, church.id),
						eq(addresses.person_id, personId)
					)
				);

			return { success: true };
		}

		await db.insert(addresses).values({
			church_id: church.id,
			person_id: personId,
			street,
			city,
			state,
			zip,
			country,
			type,
			description,
			is_primary
		});

		return { success: true };
	},

	deleteAddress: async ({ request, params, locals }) => {
		if (!locals.church) throw error(401, 'Church not found');
		if (!params.id) throw error(400, 'Person ID required');

		const { church } = locals;
		const personId = params.id;
		const data = await request.formData();

		const addressId = data.get('address_id') as string;
		if (!addressId) throw error(400, 'Address ID required');

		await db
			.delete(addresses)
			.where(
				and(
					eq(addresses.id, addressId),
					eq(addresses.church_id, church.id),
					eq(addresses.person_id, personId)
				)
			);

		return { success: true };
	}
};
