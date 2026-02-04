// src/routes/gatherings/[gathering_id]/plans/[plan_id]/order/+page.server.ts
import { requirePermission } from '$lib/auth/guards';
import { db } from '$lib/server/db';
import { plan_items, plans } from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
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

function parseDurationSeconds(data: FormData, segment: SegmentKey): number {
	const direct = data.get('duration');
	if (direct != null && String(direct).trim() !== '') {
		return clamp(toInt(direct, 0), 0, 24 * 60 * 60);
	}

	const fallback = segment === 'core' ? 300 : 60;
	return fallback;
}

async function requirePlanForRoute(
	params: { plan_id: string },
	churchId: string
) {
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

	const items = await db.query.plan_items.findMany({
		where: eq(plan_items.plan_id, params.plan_id),
		orderBy: [asc(plan_items.segment), asc(plan_items.order)],
		with: { song: true }
	});

	return { plan, items };
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
		const duration = parseDurationSeconds(data, segment);
		const songIdRaw = String(data.get('song_id') ?? '').trim();
		const song_id = songIdRaw ? songIdRaw : null;
		const is_audible = data.get('is_audible') === 'on';

		if (!title) return fail(400, { missing: true });

		const order = await nextOrderForSegment(params.plan_id, segment);

		const [item] = await db
			.insert(plan_items)
			.values({
				plan_id: params.plan_id,
				title,
				segment,
				duration,
				order,
				song_id,
				is_audible
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
		const duration = parseDurationSeconds(data, segment);
		const songIdRaw = String(data.get('song_id') ?? '').trim();
		const song_id = songIdRaw ? songIdRaw : null;
		const is_audible = data.get('is_audible') === 'on';

		if (!id) return fail(400, { missing: true });
		if (!title) return fail(400, { missing: true });

		const [item] = await db
			.update(plan_items)
			.set({
				title,
				segment,
				duration,
				song_id,
				is_audible
			})
			.where(and(eq(plan_items.id, id), eq(plan_items.plan_id, params.plan_id)))
			.returning();

		return { success: true, item };
	}
};
