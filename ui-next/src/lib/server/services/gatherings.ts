// src/lib/server/services/gatherings.ts
// Service layer for gathering-related business logic

import { db } from '$lib/server/db';
import { campuses, gatherings, plans } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { format } from 'date-fns';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';

// ----- Types -----

export interface GatheringPlanSummary {
	id: string;
	title: string;
}

export interface GatheringListItem {
	id: string;
	church_id: string;
	campus_id: string | null;
	title: string;
	date: Date;
	created_at: Date | null;
	plans: { id: string; title: string }[];
}

export interface GatheringsListResult {
	campuses: (typeof campuses.$inferSelect)[];
	gatherings: GatheringListItem[];
}

// ----- Service Functions -----

/**
 * List all gatherings for a church with their associated plans.
 * Returns campuses for filtering and gatherings with nested plan summaries.
 */
export async function listGatherings(churchId: string): Promise<GatheringsListResult> {
	// 1) Campuses for dropdown
	const allCampuses = await db.query.campuses.findMany({
		where: and(eq(campuses.church_id, churchId), isNull(campuses.deleted_at)),
		orderBy: asc(campuses.name)
	});

	// 2) Gatherings (date buckets)
	const gRows = await db
		.select({
			id: gatherings.id,
			church_id: gatherings.church_id,
			campus_id: gatherings.campus_id,
			title: gatherings.title,
			date: gatherings.date,
			created_at: gatherings.created_at
		})
		.from(gatherings)
		.where(eq(gatherings.church_id, churchId))
		.orderBy(desc(gatherings.date));

	const gatheringIds = gRows.map((g) => g.id);

	// 3) Plans for those gatherings
	const pRows =
		gatheringIds.length === 0
			? []
			: await db
					.select({
						id: plans.id,
						gathering_id: plans.gathering_id,
						name: plans.name,
						date: plans.date,
						status: plans.status
					})
					.from(plans)
					.where(
						and(
							eq(plans.church_id, churchId),
							inArray(plans.gathering_id, gatheringIds),
							isNull(plans.deleted_at)
						)
					)
					.orderBy(asc(plans.date));

	// 4) Group plans by gathering_id
	const plansByGatheringId = new Map<string, { id: string; title: string }[]>();
	for (const p of pRows) {
		const key = p.gathering_id;
		const arr = plansByGatheringId.get(key) ?? [];
		arr.push({
			id: p.id,
			// UI expects plan.title; DB column is plans.name
			title: p.name ?? format(new Date(p.date), 'h:mm a')
		});
		plansByGatheringId.set(key, arr);
	}

	// 5) Shape for UI
	const gatheringsForUi: GatheringListItem[] = gRows.map((g) => ({
		...g,
		plans: plansByGatheringId.get(g.id) ?? []
	}));

	return {
		campuses: allCampuses,
		gatherings: gatheringsForUi
	};
}

/**
 * Get a single gathering by ID with its plans and plan items.
 * Throws 404 if not found.
 */
export async function getGatheringById(churchId: string, gatheringId: string) {
	const row = await db.query.gatherings.findFirst({
		where: and(eq(gatherings.church_id, churchId), eq(gatherings.id, gatheringId)),
		with: {
			campus: true,
			plans: {
				where: isNull(plans.deleted_at),
				orderBy: asc(plans.date),
				with: {
					items: {
						columns: { id: true }
					}
				}
			}
		}
	});

	if (!row) throw error(404, 'Gathering not found');

	// Shape plans for UI: include title from name or formatted date
	const shapedPlans = row.plans.map((p) => ({
		id: p.id,
		title: p.name ?? format(new Date(p.date), 'h:mm a'),
		date: p.date,
		status: p.status,
		items: p.items
	}));

	return {
		...row,
		plans: shapedPlans
	};
}
