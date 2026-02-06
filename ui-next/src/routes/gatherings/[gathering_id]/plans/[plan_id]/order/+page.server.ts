// src/routes/gatherings/[gathering_id]/plans/[plan_id]/order/+page.server.ts
import { requirePermission } from '$lib/auth/guards';
import { db } from '$lib/server/db';
import { people, plan_items, plans, songs } from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

type SegmentKey = 'pre' | 'core' | 'post';
type ItemType = 'header' | 'song' | 'sermon' | 'announcement' | 'prayer' | 'reading' | 'media' | 'offering' | 'communion' | 'baptism' | 'dedication' | 'other';

const VALID_ITEM_TYPES: ItemType[] = ['header', 'song', 'sermon', 'announcement', 'prayer', 'reading', 'media', 'offering', 'communion', 'baptism', 'dedication', 'other'];

function normalizeSegment(raw: FormDataEntryValue | null): SegmentKey {
	const s = String(raw ?? 'core').toLowerCase();
	if (s === 'pre' || s === 'core' || s === 'post') return s;
	return 'core';
}

function normalizeItemType(raw: FormDataEntryValue | null): ItemType {
	const t = String(raw ?? 'other').toLowerCase() as ItemType;
	if (VALID_ITEM_TYPES.includes(t)) return t;
	return 'other';
}

function toInt(raw: FormDataEntryValue | null, fallback = 0) {
	const n = Number.parseInt(String(raw ?? ''), 10);
	return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
	return Math.max(min, Math.min(max, n));
}

function parseDurationSeconds(data: FormData, segment: SegmentKey): number {
	const direct = data.get('duration');
	if (direct != null && String(direct).trim() !== '') {
		return clamp(toInt(direct, 0), 0, 24 * 60 * 60);
	}

	const fallback = segment === 'core' ? 300 : 60;
	return fallback;
}

async function requirePlanForRoute(params: { plan_id: string }, churchId: string) {
	const plan = await db.query.plans.findFirst({
		where: and(eq(plans.id, params.plan_id), eq(plans.church_id, churchId))
	});

	if (!plan) throw error(404, 'Plan not found');
	return plan;
}

async function nextOrderForSegment(planId: string, segment: SegmentKey) {
	const last = await db.query.plan_items.findFirst({
		where: and(eq(plan_items.plan_id, planId), eq(plan_items.segment, segment)),
		orderBy: [desc(plan_items.order)]
	});
	return (last?.order ?? 0) + 1;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const churchId = locals.church?.id;
	if (!churchId) throw error(401, 'Unauthorized');

	const plan = await requirePlanForRoute(params, churchId);

	// Load items with song and leader relations
	const items = await db.query.plan_items.findMany({
		where: eq(plan_items.plan_id, params.plan_id),
		orderBy: [asc(plan_items.segment), asc(plan_items.order)],
		with: { song: true, leader: true }
	});

	// Load songs for autocomplete (active songs only)
	const allSongs = await db.query.songs.findMany({
		where: eq(songs.church_id, churchId),
		columns: { id: true, title: true, artist: true, original_key: true },
		orderBy: [asc(songs.title)]
	});

	// Load people for leader picker (active people only)
	const allPeople = await db.query.people.findMany({
		where: and(eq(people.church_id, churchId), isNull(people.deleted_at)),
		columns: { id: true, first_name: true, last_name: true },
		orderBy: [asc(people.first_name), asc(people.last_name)]
	});

	return { plan, items, songs: allSongs, people: allPeople };
};

export const actions: Actions = {
	createItem: async ({ request, params, locals, url }) => {
		requirePermission({ locals, url }, 'plans:edit');
		const churchId = locals.church?.id;
		if (!churchId) return fail(401, { error: 'Unauthorized' });

		await requirePlanForRoute(params, churchId);

		const data = await request.formData();
		const title = String(data.get('title') ?? '').trim();
		const segment = normalizeSegment(data.get('segment'));
		const type = normalizeItemType(data.get('type'));
		const duration = parseDurationSeconds(data, segment);
		const songIdRaw = String(data.get('song_id') ?? '').trim();
		const song_id = songIdRaw ? songIdRaw : null;
		const leaderIdRaw = String(data.get('leader_id') ?? '').trim();
		const leader_id = leaderIdRaw ? leaderIdRaw : null;
		const is_audible = data.get('is_audible') === 'on' || type === 'song';
		const offsetRaw = data.get('offset_minutes');
		const offset_minutes = offsetRaw != null && String(offsetRaw).trim() !== ''
			? toInt(offsetRaw, 0)
			: null;

		if (!title) return fail(400, { missing: true });

		const order = await nextOrderForSegment(params.plan_id, segment);

		const [item] = await db
			.insert(plan_items)
			.values({
				church_id: churchId,
				plan_id: params.plan_id,
				title,
				segment,
				type,
				duration,
				order,
				song_id,
				leader_id,
				is_audible,
				offset_minutes
			})
			.returning();

		return { success: true, item };
	},

	reorderItems: async ({ request, params, locals, url }) => {
		requirePermission({ locals, url }, 'plans:edit');
		const churchId = locals.church?.id;
		if (!churchId) return fail(401, { error: 'Unauthorized' });

		await requirePlanForRoute(params, churchId);

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

		await db.transaction(async (tx) => {
			for (let i = 0; i < itemIds.length; i++) {
				await tx
					.update(plan_items)
					.set({ order: i + 1, segment })
					.where(and(eq(plan_items.id, itemIds[i]), eq(plan_items.plan_id, params.plan_id)));
			}
		});

		return { success: true };
	},

	editItem: async ({ request, params, locals, url }) => {
		requirePermission({ locals, url }, 'plans:edit');
		const churchId = locals.church?.id;
		if (!churchId) return fail(401, { error: 'Unauthorized' });

		await requirePlanForRoute(params, churchId);

		const data = await request.formData();
		const id = String(data.get('id') ?? '').trim();
		const title = String(data.get('title') ?? '').trim();
		const segment = normalizeSegment(data.get('segment'));
		const type = normalizeItemType(data.get('type'));
		const duration = parseDurationSeconds(data, segment);
		const songIdRaw = String(data.get('song_id') ?? '').trim();
		const song_id = songIdRaw ? songIdRaw : null;
		const leaderIdRaw = String(data.get('leader_id') ?? '').trim();
		const leader_id = leaderIdRaw ? leaderIdRaw : null;
		const is_audible = data.get('is_audible') === 'on' || type === 'song';
		const offsetRaw = data.get('offset_minutes');
		const offset_minutes = offsetRaw != null && String(offsetRaw).trim() !== ''
			? toInt(offsetRaw, 0)
			: null;

		if (!id) return fail(400, { missing: true });
		if (!title) return fail(400, { missing: true });

		const [item] = await db
			.update(plan_items)
			.set({
				title,
				segment,
				type,
				duration,
				song_id,
				leader_id,
				is_audible,
				offset_minutes
			})
			.where(and(eq(plan_items.id, id), eq(plan_items.plan_id, params.plan_id)))
			.returning();

		return { success: true, item };
	}
};
