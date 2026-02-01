import { db } from '$lib/server/db';
import {
	addresses,
	care_logs,
	families,
	gatherings,
	people,
	person_capabilities, // <--- ADDED THIS IMPORT
	plan_people,
	plans,
	team_members,
	teams
} from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { and, desc, eq, gte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { church } = locals;
	const { id } = params;

	// 1. Fetch Person Details WITH Relations
	const person = await db.query.people.findFirst({
		where: (p, { and, eq }) => and(eq(p.id, id), eq(p.church_id, church.id)),
		with: {
			family: {
				with: {
					members: true,
					addresses: true
				}
			},
			personalAddresses: true,
			teamMemberships: {
				with: {
					team: true
				}
			},
			relationships: {
				with: {
					relatedPerson: true
				}
			},
			capabilities: true
		}
	});

	if (!person) error(404, 'Person not found');

	// 2. Fetch Care Notes (History)
	const careNotes = await db
		.select({
			id: care_logs.id,
			content: care_logs.content,
			type: care_logs.type,
			date: care_logs.date,
			is_private: care_logs.is_private,
			created_at: care_logs.created_at,
			category: care_logs.type,
			authorFirstName: people.first_name,
			authorLastName: people.last_name
		})
		.from(care_logs)
		.leftJoin(people, eq(care_logs.author_id, people.id))
		.where(and(eq(care_logs.person_id, id), eq(care_logs.church_id, church.id)))
		.orderBy(desc(care_logs.date));

	// 3. Fetch Teams (for Drawer)
	const myTeams = await db
		.select({
			id: teams.id,
			name: teams.name,
			type: teams.type
		})
		.from(team_members)
		.innerJoin(teams, eq(team_members.team_id, teams.id))
		.where(eq(team_members.person_id, id));

	// 4. Fetch Upcoming Schedule
	const schedule = await db
		.select({
			date: gatherings.date,
			title: gatherings.title,
			role: plan_people.role,
			teamName: teams.name
		})
		.from(plan_people)
		.innerJoin(plans, eq(plan_people.plan_id, plans.id))
		.innerJoin(gatherings, eq(plans.gathering_id, gatherings.id))
		.leftJoin(teams, eq(plan_people.team_id, teams.id))
		.where(and(eq(plan_people.person_id, id), gte(gatherings.date, new Date())))
		.orderBy(gatherings.date)
		.limit(5);

	// 5. Fetch All Families (for Drawer)
	const allFamilies = await db.query.families.findMany({
		where: (f, { eq }) => eq(f.church_id, church.id)
	});

	// 6. Fetch All Teams (for Drawer)
	const allTeams = await db.query.teams.findMany({
		where: (t, { eq }) => eq(t.church_id, church.id)
	});

	// FIX: Return the ACTUAL fetched data variables, not empty placeholders
	return {
		person,
		careNotes, // <--- Used here
		myTeams, // <--- Used here
		schedule, // <--- Used here
		allFamilies,
		allTeams
	};
};

export const actions: Actions = {
	addCareNote: async ({ request, params, locals }) => {
		const { church } = locals;
		const formData = await request.formData();

		// We need the ID of the person WRITING the note.
		const author = await db.query.people.findFirst({
			where: (p, { and, eq }) => and(eq(p.church_id, church.id), eq(p.role, 'admin'))
		});

		if (!author) return { success: false, error: 'No author found' };

		await db.insert(care_logs).values({
			church_id: church.id,
			person_id: params.id,
			author_id: author.id,
			type: (formData.get('category') as string) || 'General',
			content: formData.get('content') as string,
			is_private: true,
			date: new Date()
		});

		return { success: true };
	},

	updateProfile: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const first_name = (data.get('first_name') as string)?.trim();
		const last_name = (data.get('last_name') as string)?.trim();
		const email = data.get('email') as string;
		const phone = data.get('phone') as string;
		const bio = data.get('bio') as string;
		const occupation = data.get('occupation') as string;
		const capacity_note = data.get('capacity_note') as string;

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
				updated_at: new Date()
			})
			.where(and(eq(people.id, params.id), eq(people.church_id, church.id)));

		return { success: true };
	},

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

	createFamily: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const name = (data.get('name') as string)?.trim();
		const address_city = data.get('city') as string;

		if (!name) {
			return fail(400, { error: 'Family name is required' });
		}

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

	addCapability: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const capability = (data.get('capability') as string)?.trim();
		const rating = parseInt(data.get('rating') as string) || 3;
		const notes = data.get('notes') as string;

		if (!capability) return fail(400, { error: 'Skill/Capability name is required' });

		await db.insert(person_capabilities).values({
			church_id: church.id,
			person_id: params.id,
			capability,
			rating,
			notes
		});

		return { success: true };
	},

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

	createTeam: async ({ request, locals }) => {
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
		const { church } = locals;
		const data = await request.formData();
		const team_id = data.get('team_id') as string;
		const role = (data.get('role') as string)?.trim() || 'Member';

		if (!team_id) return fail(400, { error: 'Please select a team' });

		const existing = await db.query.team_members.findFirst({
			where: (tm, { and, eq }) =>
				and(eq(tm.person_id, params.id), eq(tm.team_id, team_id), eq(tm.role, role))
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

	archiveTeamMembership: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const membership_id = data.get('membership_id') as string;

		await db
			.update(team_members)
			.set({ status: 'inactive' })
			.where(and(eq(team_members.id, membership_id), eq(team_members.church_id, church.id)));

		return { success: true };
	},

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

	deleteTeamMembership: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const membership_id = data.get('membership_id') as string;

		await db
			.delete(team_members)
			.where(and(eq(team_members.id, membership_id), eq(team_members.church_id, church.id)));

		return { success: true };
	},

	// FIX: Removed unused 'params' from destructuring here
	saveAddress: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();

		const id = data.get('address_id') as string;
		const family_id = data.get('family_id') as string;
		const person_id = data.get('person_id') as string;

		type AddressType =
			| 'home'
			| 'work'
			| 'mailing'
			| 'vacation'
			| 'school'
			| 'meeting'
			| 'business'
			| 'other';

		const payload = {
			church_id: church.id,
			// FIX: Cast to 'any' to allow Drizzle to accept the string as a valid Enum value
			type: (data.get('type') as AddressType) || 'home',
			street: data.get('street') as string,
			city: data.get('city') as string,
			state: data.get('state') as string,
			zip: data.get('zip') as string,
			country: (data.get('country') as string) || 'US',
			company_name: data.get('company_name') as string,
			description: data.get('description') as string,
			is_primary: data.get('is_primary') === 'on',
			start_date: data.get('start_date') ? new Date(data.get('start_date') as string) : null,
			end_date: data.get('end_date') ? new Date(data.get('end_date') as string) : null,
			family_id: family_id || null,
			person_id: person_id || null
		};

		if (id) {
			await db
				.update(addresses)
				.set(payload)
				.where(and(eq(addresses.id, id), eq(addresses.church_id, church.id)));
		} else {
			await db.insert(addresses).values(payload);
		}

		return { success: true };
	},

	deleteAddress: async ({ request, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const id = data.get('address_id') as string;

		await db.delete(addresses).where(and(eq(addresses.id, id), eq(addresses.church_id, church.id)));

		return { success: true };
	}
};
