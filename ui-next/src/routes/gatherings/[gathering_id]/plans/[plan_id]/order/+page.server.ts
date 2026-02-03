import { db } from '$lib/server/db';
import { people, plan_items, plans, songs, template_items, templates } from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

type SegmentKey = 'pre' | 'core' | 'post';

function normalizeSegment(raw: FormDataEntryValue | null): SegmentKey {
	const s = String(raw ?? 'core').toLowerCase();
	if (s === 'pre' || s === 'core' || s === 'post') return s;
	return 'core';
}

function toInt(raw: FormDataEntryValue | null, fallback = 0) {
	const n = Number.parseInt(String(raw ?? ''), 10);
	return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
	return Math.max(min, Math.min(max, n));
}

function parseDurationSeconds(data: FormData): number {
	// Preferred: explicit seconds (if you ever add it)
	const direct = data.get('duration_seconds');
	if (direct != null && String(direct).trim() !== '') {
		return clamp(toInt(direct, 0), 0, 24 * 60 * 60);
	}

	// Current UI: minute + second fields
	const durationMin = toInt(data.get('duration_min'), 0);
	const durationSec = toInt(data.get('duration_sec'), 0);
	const total = durationMin * 60 + durationSec;
	return clamp(total, 0, 24 * 60 * 60);
}

async function requirePlanForRoute(
	params: { gathering_id: string; plan_id: string },
	churchId: string
) {
	const plan = await db.query.plans.findFirst({
		where: and(
			eq(plans.id, params.plan_id),
			eq(plans.church_id, churchId),
			eq(plans.gathering_id, params.gathering_id)
		),
		with: {
			gathering: true
		}
	});

	if (!plan) throw error(404, 'Plan not found');
	return plan;
}

async function nextSequenceForSegment(planId: string, segment: SegmentKey) {
	const last = await db.query.plan_items.findFirst({
		where: and(
			eq(plan_items.plan_id, planId),
			eq(plan_items.segment, segment),
			isNull(plan_items.deleted_at)
		),
		orderBy: [desc(plan_items.sequence)]
	});
	return (last?.sequence ?? 0) + 1;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { church } = locals;
	if (!church) throw error(401, 'Unauthorized');

	// Ensure the plan belongs to this church + gathering
	const plan = await requirePlanForRoute(params, church.id);

	// Items for this plan
	const items = await db.query.plan_items.findMany({
		where: and(eq(plan_items.plan_id, params.plan_id), isNull(plan_items.deleted_at)),
		orderBy: [asc(plan_items.segment), asc(plan_items.sequence)],
		with: {
			song: true,
			person: true
		}
	});

	// Templates scoped to church
	const availableTemplates = await db
		.select()
		.from(templates)
		.where(eq(templates.church_id, church.id))
		.orderBy(asc(templates.name));

	// Song library scoped to church
	const songLibrary = await db.query.songs.findMany({
		where: eq(songs.church_id, church.id),
		columns: {
			id: true,
			title: true,
			original_key: true,
			tempo: true,
			time_signature: true
		},
		orderBy: [asc(songs.title)]
	});

	// People directory scoped to church
	const peopleDirectory = await db.query.people.findMany({
		where: eq(people.church_id, church.id),
		columns: {
			id: true,
			first_name: true,
			last_name: true,
			preferred_name: true,
			avatar_url: true
		},
		orderBy: [asc(people.first_name), asc(people.last_name)]
	});

	return {
		plan,
		items,
		availableTemplates,
		songLibrary,
		peopleDirectory
	};
};

export const actions: Actions = {
	// CREATE ITEM
	addItem: async ({ request, params, locals }) => {
		const { church } = locals;
		if (!church) return fail(401, { error: 'Unauthorized' });

		// Validate plan ownership
		await requirePlanForRoute(params, church.id);

		const data = await request.formData();

		const title = String(data.get('title') ?? '').trim();
		const type = String(data.get('type') ?? 'element').trim();
		const segment = normalizeSegment(data.get('segment'));

		const songIdRaw = String(data.get('song_id') ?? '').trim();
		const song_id = songIdRaw ? songIdRaw : null;

		const personIdRaw = String(data.get('person_id') ?? '').trim();
		const person_id = personIdRaw ? personIdRaw : null;

		const duration_seconds = parseDurationSeconds(data);
		const description = String(data.get('notes') ?? data.get('description') ?? '').trim();

		if (!title) return fail(400, { missing: true });

		const sequence = await nextSequenceForSegment(params.plan_id, segment);

		await db.insert(plan_items).values({
			plan_id: params.plan_id,
			title,
			type,
			segment,
			song_id,
			person_id,
			duration_seconds,
			description,
			sequence
		});

		return { success: true };
	},

	// EDIT ITEM
	editItem: async ({ request, params, locals }) => {
		const { church } = locals;
		if (!church) return fail(401, { error: 'Unauthorized' });

		// Validate plan ownership
		await requirePlanForRoute(params, church.id);

		const data = await request.formData();

		const id = String(data.get('id') ?? '').trim();
		const title = String(data.get('title') ?? '').trim();
		const type = String(data.get('type') ?? 'element').trim();
		const segment = normalizeSegment(data.get('segment'));

		const songIdRaw = String(data.get('song_id') ?? '').trim();
		const song_id = songIdRaw ? songIdRaw : null;

		const personIdRaw = String(data.get('person_id') ?? '').trim();
		const person_id = personIdRaw ? personIdRaw : null;

		const duration_seconds = parseDurationSeconds(data);
		const description = String(data.get('notes') ?? data.get('description') ?? '').trim();

		if (!id) return fail(400, { missing: true });
		if (!title) return fail(400, { missing: true });

		await db
			.update(plan_items)
			.set({
				title,
				type,
				segment,
				song_id,
				person_id,
				duration_seconds,
				description
			})
			.where(and(eq(plan_items.id, id), eq(plan_items.plan_id, params.plan_id)));

		return { success: true };
	},

	// DELETE (soft delete + resequence within segment)
	deleteItem: async ({ request, params, locals }) => {
		const { church } = locals;
		if (!church) return fail(401, { error: 'Unauthorized' });

		await requirePlanForRoute(params, church.id);

		const data = await request.formData();
		const id = String(data.get('id') ?? '').trim();

		if (!id) return fail(400, { missing: true });

		// Find segment for this item (so we can resequence correctly)
		const item = await db.query.plan_items.findFirst({
			where: and(eq(plan_items.id, id), eq(plan_items.plan_id, params.plan_id))
		});
		if (!item) return fail(404, { error: 'Item not found' });

		await db
			.update(plan_items)
			.set({ deleted_at: new Date() })
			.where(and(eq(plan_items.id, id), eq(plan_items.plan_id, params.plan_id)));

		// Resequence remaining items in that segment
		const remaining = await db.query.plan_items.findMany({
			where: and(
				eq(plan_items.plan_id, params.plan_id),
				eq(plan_items.segment, item.segment as SegmentKey),
				isNull(plan_items.deleted_at)
			),
			orderBy: [asc(plan_items.sequence)]
		});

		await db.transaction(async (tx) => {
			for (let i = 0; i < remaining.length; i++) {
				await tx
					.update(plan_items)
					.set({ sequence: i + 1 })
					.where(eq(plan_items.id, remaining[i].id));
			}
		});

		return { success: true };
	},

	// REORDER (expects ids *within a segment*)
	reorderItems: async ({ request, params, locals }) => {
		const { church } = locals;
		if (!church) return fail(401, { error: 'Unauthorized' });

		await requirePlanForRoute(params, church.id);

		const data = await request.formData();
		const itemIdsJson = String(data.get('itemIds') ?? '').trim();
		const segment = normalizeSegment(data.get('segment'));

		if (!itemIdsJson) return fail(400, { missing: true });

		let itemIds: string[] = [];
		try {
			const parsed = JSON.parse(itemIdsJson);
			itemIds = Array.isArray(parsed) ? parsed.map(String) : [];
		} catch {
			return fail(400, { error: 'Invalid itemIds JSON' });
		}

		// Only update items that belong to this plan + segment
		await db.transaction(async (tx) => {
			for (let i = 0; i < itemIds.length; i++) {
				await tx
					.update(plan_items)
					.set({ sequence: i + 1, segment })
					.where(and(eq(plan_items.id, itemIds[i]), eq(plan_items.plan_id, params.plan_id)));
			}
		});

		return { success: true };
	},

	// SAVE AS TEMPLATE (stores JSON in templates.data)
	saveAsTemplate: async ({ request, params, locals }) => {
		const { church } = locals;
		if (!church) return fail(401, { error: 'Unauthorized' });

		await requirePlanForRoute(params, church.id);

		const data = await request.formData();
		const name = String(data.get('template_name') ?? '').trim();
		if (!name) return fail(400, { missing: true });

		const currentItems = await db.query.plan_items.findMany({
			where: and(eq(plan_items.plan_id, params.plan_id), isNull(plan_items.deleted_at)),
			orderBy: [asc(plan_items.segment), asc(plan_items.sequence)]
		});

		if (currentItems.length === 0) return fail(400, { empty: true });

		const payload = {
			version: 1,
			segments: ['pre', 'core', 'post'] as SegmentKey[],
			items: currentItems.map((i) => ({
				title: i.title,
				type: i.type,
				segment: (i.segment ?? 'core') as SegmentKey,
				duration_seconds: i.duration_seconds ?? 0,
				description: i.description ?? null,
				song_id: i.song_id ?? null,
				person_id: i.person_id ?? null,
				sequence: i.sequence
			}))
		};

		await db.insert(templates).values({
			church_id: church.id,
			name,
			data: JSON.stringify(payload),
			is_partial: false
		});

		return { success: true };
	},

	// APPLY TEMPLATE (reads templates.data JSON, appends to selected segment)
	applyTemplate: async ({ request, params }) => {
		const data = await request.formData();
		const templateId = data.get('template_id') as string;

		if (!templateId) return fail(400, { missing: true });

		// 1. Fetch items from the template (using the new table)
		const sourceItems = await db.query.template_items.findMany({
			where: eq(template_items.template_id, templateId),
			// Sort by 'sequence' to keep the order correct
			orderBy: (template_items, { asc }) => [asc(template_items.sequence)]
		});

		if (!sourceItems.length) return fail(400, { error: 'Template is empty' });

		// 2. Map 1-to-1 to the plan_items structure
		const itemsToInsert = sourceItems.map((item) => ({
			plan_id: params.plan_id,

			// Direct Copy
			segment: item.segment,
			type: item.type,
			title: item.title,
			duration_seconds: item.duration_seconds,
			description: item.description,
			sequence: item.sequence,

			// Relations (if they exist in the template)
			song_id: item.song_id || null,
			person_id: item.person_id || null
		}));

		// 3. Insert into the Plan
		// (We use 'plan_items' here - make sure your import matches your schema export name)
		await db.insert(plan_items).values(itemsToInsert);

		return { success: true };
	}
};
