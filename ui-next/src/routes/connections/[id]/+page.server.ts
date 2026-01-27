import { db } from '$lib/server/db';
import { families, people, person_capabilities } from '$lib/server/db/schema'; // Ensure paths are correct
import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { church } = locals;

	// DEBUG 1: Check the Tenant
	console.log('--- DEBUG: CONNECTION LOAD ---');
	console.log('1. URL Param ID:', params.id);

	if (!church) {
		console.error('❌ CRITICAL: No Church found in locals.');
		error(404, 'Church context missing');
	}
	console.log('2. Active Tenant (Church) ID:', church.id);

	// DEBUG 2: The "Blind" Check (Does the person exist at all?)
	// We query purely by ID, ignoring the church filter for a second.
	const rawPerson = await db.query.people.findFirst({
		where: (p, { eq }) => eq(p.id, params.id)
	});

	if (!rawPerson) {
		console.error('❌ CRITICAL: Person ID does not exist in the database.');
		console.log('   Are you pointing to the correct DB?');
		error(404, 'Person not found in DB');
	} else {
		console.log('3. Found Person in DB:', rawPerson.first_name, rawPerson.last_name);
		console.log('   Person church_id:', rawPerson.church_id);
		console.log('   Required church_id:', church.id);

		const isMatch = rawPerson.church_id === church.id;
		console.log(`4. MATCH RESULT: ${isMatch ? '✅ MATCH' : '❌ MISMATCH'}`);
	}

	// 3. The Real Query (Restoring the security filter)
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

	if (!person) {
		console.error('❌ QUERY FAILED: Security filter returned null.');
		error(404, 'Person not found (Security Filter)');
	}

	console.log('✅ SUCCESS: Returning person to UI');
	console.log('------------------------------');

	return { person };
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

		// The "Sacred Ground" logic: Capacity Note
		// If this is set, the UI renders the Shield.
		const capacity_note = data.get('capacity_note') as string;

		await db
			.update(people)
			.set({
				first_name,
				last_name,
				email,
				phone,
				bio,
				capacity_note, // <--- The Season Protector
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
		const name = data.get('name') as string; // e.g. "The Wikene Family"
		const address_city = data.get('city') as string;

		const newFamilyId = uuidv4();

		// Transaction: Create Family -> Link Person
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

	// 4. ADD CAPABILITY (De-gamified)
	addCapability: async ({ request, params, locals }) => {
		const { church } = locals;
		const data = await request.formData();
		const capability = data.get('capability') as string;
		// We cast to integer, but UI treats it as "Comfort Level"
		const rating = parseInt(data.get('rating') as string) || 1;
		const notes = data.get('notes') as string;

		await db.insert(person_capabilities).values({
			church_id: church.id,
			person_id: params.id,
			capability,
			rating,
			notes
		});

		return { success: true };
	}
};
