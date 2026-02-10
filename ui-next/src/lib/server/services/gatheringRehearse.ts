// src/lib/server/services/gatheringRehearse.ts
// Service for gathering rehearse view (read-only, songs only)

import { db } from '$lib/server/db';
import { gatherings, plan_items, plans } from '$lib/server/db/schema';
import { error } from '@sveltejs/kit';
import { and, asc, eq, isNull } from 'drizzle-orm';

// ----- Types -----

export interface RehearseSong {
	id: string;
	title: string;
	artist: string | null;
	key: string | null;
	content: string | null;
	spotifyUrl: string | null;
	youtubeUrl: string | null;
	duration: number | null;
	position: number;
	planTitle: string;
}

export interface GatheringRehearseResult {
	gathering: {
		id: string;
		title: string;
		date: Date;
	};
	songs: RehearseSong[];
}

// ----- Service Functions -----

/**
 * Get gathering with songs only for the rehearse view.
 * Read-only - filters out non-song items.
 * Throws 404 if gathering not found.
 */
export async function getGatheringRehearse(
	churchId: string,
	gatheringId: string
): Promise<GatheringRehearseResult> {
	// 1) Get gathering
	const gathering = await db.query.gatherings.findFirst({
		where: and(eq(gatherings.church_id, churchId), eq(gatherings.id, gatheringId))
	});

	if (!gathering) throw error(404, 'Gathering not found');

	// 2) Get plans with items that have songs
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
							original_key: true,
							content: true,
							spotify_url: true,
							youtube_url: true
						}
					}
				}
			}
		}
	});

	// 3) Flatten and filter to songs only
	const songs: RehearseSong[] = [];
	let globalPosition = 0;

	for (const plan of plansRows) {
		const planTitle = plan.name ?? 'Service';

		for (const item of plan.items) {
			// Only include items that have a song attached
			if (item.song) {
				globalPosition++;
				songs.push({
					id: item.song.id,
					title: item.song.title,
					artist: item.song.artist,
					key: item.song.original_key,
					content: item.song.content,
					spotifyUrl: item.song.spotify_url,
					youtubeUrl: item.song.youtube_url,
					duration: item.duration,
					position: globalPosition,
					planTitle
				});
			}
		}
	}

	return {
		gathering: {
			id: gathering.id,
			title: gathering.title,
			date: gathering.date
		},
		songs
	};
}
