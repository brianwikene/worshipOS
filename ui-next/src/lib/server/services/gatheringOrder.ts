// src/lib/server/services/gatheringOrder.ts
// Service for gathering order/flow data (read-only)

import { db } from '$lib/server/db';
import { gatherings, plan_items, plans } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { format } from 'date-fns';
import { and, asc, eq, isNull } from 'drizzle-orm';

// ----- Types -----

export interface OrderItem {
	id: string;
	title: string;
	segment: 'pre' | 'core' | 'post';
	position: number;
	duration: number | null;
	description: string | null;
	isAudible: boolean;
	song: {
		id: string;
		title: string;
		artist: string | null;
		key: string | null;
	} | null;
}

export interface OrderPlan {
	id: string;
	title: string;
	date: Date;
	status: 'draft' | 'locked' | 'completed';
	items: OrderItem[];
}

export interface GatheringOrderResult {
	gathering: {
		id: string;
		title: string;
		date: Date;
		campus: { id: string; name: string } | null;
	};
	plans: OrderPlan[];
}

// ----- Service Functions -----

/**
 * Get gathering with plans and ordered items for the flow/order view.
 * Read-only - does not mutate anything.
 * Throws 404 if gathering not found.
 */
export async function getGatheringOrder(
	churchId: string,
	gatheringId: string
): Promise<GatheringOrderResult> {
	// 1) Get gathering with campus
	const gathering = await db.query.gatherings.findFirst({
		where: and(eq(gatherings.church_id, churchId), eq(gatherings.id, gatheringId)),
		with: {
			campus: true
		}
	});

	if (!gathering) throw error(404, 'Gathering not found');

	// 2) Get plans for this gathering
	const plansRows = await db.query.plans.findMany({
		where: and(
			eq(plans.church_id, churchId),
			eq(plans.gathering_id, gatheringId),
			isNull(plans.deleted_at)
		),
		orderBy: asc(plans.date),
		with: {
			items: {
				orderBy: asc(plan_items.order),
				with: {
					song: {
						columns: {
							id: true,
							title: true,
							artist: true,
							original_key: true
						}
					}
				}
			}
		}
	});

	// 3) Shape for UI
	const shapedPlans: OrderPlan[] = plansRows.map((p) => ({
		id: p.id,
		title: p.name ?? format(new Date(p.date), 'h:mm a'),
		date: p.date,
		status: p.status,
		items: p.items.map((item) => ({
			id: item.id,
			title: item.title,
			segment: item.segment,
			position: item.order,
			duration: item.duration,
			description: item.description,
			isAudible: item.is_audible,
			song: item.song
				? {
						id: item.song.id,
						title: item.song.title,
						artist: item.song.artist,
						key: item.song.original_key
					}
				: null
		}))
	}));

	return {
		gathering: {
			id: gathering.id,
			title: gathering.title,
			date: gathering.date,
			campus: gathering.campus
				? {
						id: gathering.campus.id,
						name: gathering.campus.name
					}
				: null
		},
		plans: shapedPlans
	};
}
