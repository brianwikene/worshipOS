// @ts-nocheck
import { db } from '$lib/server/db';
import {
	instances,
	people, // <--- Ensure 'people' is imported
	plan_items,
	songs,
	template_items,
	templates
} from '$lib/server/db/schema';
import { fail } from '@sveltejs/kit'; // <--- THIS WAS MISSING
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// 1. Fetch current items (Now with Song AND Person details)
	const items = await db.query.plan_items.findMany({
		where: and(eq(plan_items.instance_id, params.instance_id), isNull(plan_items.deleted_at)),
		orderBy: [asc(plan_items.sequence)],
		with: {
			song: true,
			person: true // <--- Fetch linked person
		}
	});

	// 2. Fetch available templates
	const availableTemplates = await db.select().from(templates);

	// 3. Fetch Song Library (for the picker)
	const songLibrary = await db.query.songs.findMany({
		columns: {
			id: true,
			title: true,
			author: true,
			bpm: true,
			original_key: true
		},
		orderBy: [asc(songs.title)]
	});

	// 4. Fetch People Directory (for the picker)
	const peopleDirectory = await db.query.people.findMany({
		columns: {
			id: true,
			first_name: true,
			last_name: true,
			nickname: true,
			avatar_url: true
		},
		orderBy: [asc(people.first_name)]
	});

	return {
		items,
		availableTemplates,
		songLibrary,
		peopleDirectory
	};
};

export const actions: Actions = {
	// 1. CREATE ITEM (With Song & Person Linking)
	addItem: async ({ request, params }) => {
		const data = await request.formData();
		const title = data.get('title') as string;
		const type = data.get('type') as string;

		// CAPTURE SONG ID
		const songIdRaw = data.get('song_id') as string;
		const songId = songIdRaw ? songIdRaw : null;

		// CAPTURE PERSON ID
		const personIdRaw = data.get('person_id') as string;
		const personId = personIdRaw ? personIdRaw : null;

		const durationMin = parseInt((data.get('duration_min') as string) || '0');
		const durationSec = parseInt((data.get('duration_sec') as string) || '0');
		const notes = data.get('notes') as string;
		const leader = data.get('leader') as string; // Keep as fallback text

		if (!title) return fail(400, { missing: true });

		const totalSeconds = durationMin * 60 + durationSec;

		const lastItem = await db.query.plan_items.findFirst({
			where: and(eq(plan_items.instance_id, params.instance_id), isNull(plan_items.deleted_at)),
			orderBy: [desc(plan_items.sequence)]
		});
		const nextSequence = (lastItem?.sequence || 0) + 1;

		await db.insert(plan_items).values({
			instance_id: params.instance_id,
			title,
			type,
			song_id: songId,
			person_id: personId, // <--- Save Person Link
			duration_seconds: totalSeconds,
			sequence: nextSequence,
			private_notes: notes,
			leader_name: leader
		});

		return { success: true };
	},

	// 2. EDIT ITEM (With Song & Person Linking)
	editItem: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		const title = data.get('title') as string;
		const type = data.get('type') as string;

		// CAPTURE SONG ID
		const songIdRaw = data.get('song_id') as string;
		const songId = songIdRaw ? songIdRaw : null;

		// CAPTURE PERSON ID
		const personIdRaw = data.get('person_id') as string;
		const personId = personIdRaw ? personIdRaw : null;

		const durationMin = parseInt((data.get('duration_min') as string) || '0');
		const durationSec = parseInt((data.get('duration_sec') as string) || '0');
		const notes = data.get('notes') as string;
		const leader = data.get('leader') as string;

		const totalSeconds = durationMin * 60 + durationSec;

		await db
			.update(plan_items)
			.set({
				title,
				type,
				song_id: songId,
				person_id: personId, // <--- Update Person Link
				duration_seconds: totalSeconds,
				private_notes: notes,
				leader_name: leader,
				updated_at: new Date()
			})
			.where(eq(plan_items.id, id));

		return { success: true };
	},

	// 3. DELETE (With Re-Sequencing)
	deleteItem: async ({ request }) => {
		const data = await request.formData();
		const id = data.get('id') as string;
		const currentOrderJson = data.get('current_order') as string;

		if (!id) return fail(400, { missing: true });

		// Soft Delete
		await db.update(plan_items).set({ deleted_at: new Date() }).where(eq(plan_items.id, id));

		// Re-sequence remaining items
		if (currentOrderJson) {
			const allIds = JSON.parse(currentOrderJson) as string[];
			const remainingIds = allIds.filter((itemId) => itemId !== id);

			await db.transaction(async (tx) => {
				for (let i = 0; i < remainingIds.length; i++) {
					await tx
						.update(plan_items)
						.set({ sequence: i + 1 })
						.where(eq(plan_items.id, remainingIds[i]));
				}
			});
		}

		return { success: true };
	},

	// 4. REORDER (Drag and Drop)
	reorderItems: async ({ request }) => {
		const data = await request.formData();
		const itemIdsJson = data.get('itemIds') as string;

		if (!itemIdsJson) return fail(400, { missing: true });

		const itemIds = JSON.parse(itemIdsJson) as string[];

		await db.transaction(async (tx) => {
			for (let i = 0; i < itemIds.length; i++) {
				await tx
					.update(plan_items)
					.set({ sequence: i + 1 })
					.where(eq(plan_items.id, itemIds[i]));
			}
		});

		return { success: true };
	},

	// 5. SAVE AS TEMPLATE
	saveAsTemplate: async ({ request, params }) => {
		const data = await request.formData();
		const name = data.get('template_name') as string;

		if (!name) return fail(400, { missing: true });

		const currentItems = await db.query.plan_items.findMany({
			where: and(eq(plan_items.instance_id, params.instance_id), isNull(plan_items.deleted_at)),
			orderBy: [asc(plan_items.sequence)]
		});

		if (currentItems.length === 0) return fail(400, { empty: true });

		const instance = await db.query.instances.findFirst({
			where: eq(instances.id, params.instance_id),
			with: { gathering: { with: { campus: true } } }
		});

		if (!instance) return fail(404, { error: 'Instance not found' });

		const [newTemplate] = await db
			.insert(templates)
			.values({
				name,
				church_id: instance.gathering.campus.church_id
			})
			.returning();

		for (const item of currentItems) {
			await db.insert(template_items).values({
				template_id: newTemplate.id,
				title: item.title,
				type: item.type || 'element',
				duration_seconds: item.duration_seconds,
				sequence: item.sequence,
				private_notes: item.private_notes,
				leader_name: item.leader_name
			});
		}

		return { success: true };
	},

	// 6. APPLY TEMPLATE
	applyTemplate: async ({ request, params }) => {
		const data = await request.formData();
		const templateId = data.get('template_id') as string;

		if (!templateId) return fail(400, { missing: true });

		const tItems = await db.query.template_items.findMany({
			where: eq(template_items.template_id, templateId),
			orderBy: [asc(template_items.sequence)]
		});

		const existingItems = await db.query.plan_items.findFirst({
			where: and(eq(plan_items.instance_id, params.instance_id), isNull(plan_items.deleted_at)),
			orderBy: [desc(plan_items.sequence)]
		});

		let nextSeq = (existingItems?.sequence || 0) + 1;

		await db.transaction(async (tx) => {
			for (const tItem of tItems) {
				await tx.insert(plan_items).values({
					instance_id: params.instance_id,
					title: tItem.title,
					type: tItem.type,
					duration_seconds: tItem.duration_seconds,
					sequence: nextSeq,
					private_notes: tItem.private_notes,
					leader_name: tItem.leader_name
				});
				nextSeq++;
			}
		});

		return { success: true };
	}
};
