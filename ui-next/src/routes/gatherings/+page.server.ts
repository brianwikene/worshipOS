// src/routes/gatherings/%2Bpage.server.ts
import { db } from '$lib/server/db';
import { campuses, gatherings, plans } from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { addDays, format, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz'; // Ensure you are on date-fns-tz v3
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const { church } = locals;
	if (!church) throw error(400, 'Active church is required');

	// 1. Fetch ALL active campuses for the dropdown
	const allCampuses = await db.query.campuses.findMany({
		where: and(eq(campuses.church_id, church.id), isNull(campuses.deleted_at)),
		orderBy: asc(campuses.name)
	});

	// 2. Fetch Gatherings (Newest First)
	const data = await db.query.gatherings.findMany({
		where: eq(gatherings.church_id, church.id),
		orderBy: [desc(gatherings.date)],
		with: {
			campus: true,
			plans: {
				// Ensure your schema relations define 'items' on the 'plans' table
				with: {
					items: { columns: { id: true } }
				}
			}
		}
	});

	return {
		campuses: allCampuses,
		gatherings: data
	};
};

export const actions: Actions = {
	createGathering: async ({ request, locals }) => {
		const { church } = locals;
		if (!church) throw error(400, 'Active church is required');

		const data = await request.formData();
		const baseTitle = (data.get('title') as string) || '';
		const startDateStr = (data.get('start_date') as string) || '';
		const timeStr = (data.get('time') as string) || '10:00';
		const isSeries = data.get('is_series') === 'on';
		const weekCount = isSeries ? parseInt((data.get('week_count') as string) || '1', 10) : 1;

		if (!baseTitle || !startDateStr) {
			return fail(400, { missing: true });
		}

		// --- 1. RESOLVE CAMPUS & TIMEZONE ---
		let targetCampusId = (data.get('campus_id') as string) || null;
		let timezone = 'America/Los_Angeles';

		if (targetCampusId) {
			// A. Specific Campus Selected
			const c = await db.query.campuses.findFirst({
				where: eq(campuses.id, targetCampusId)
			});
			if (c) timezone = c.timezone;
		} else {
			// B. No selection? Find existing OR Create "Main Campus"
			const existing = await db.query.campuses.findFirst({
				where: eq(campuses.church_id, church.id)
			});

			if (existing) {
				targetCampusId = existing.id;
				timezone = existing.timezone;
			} else {
				// C. "Just-in-Time" Creation for Single-Site Churches
				const [newCampus] = await db
					.insert(campuses)
					.values({
						church_id: church.id,
						name: 'Main Campus',
						// Fallback to church timezone or LA default
						timezone: (church as { timezone?: string }).timezone || 'America/Los_Angeles'
					})
					.returning();

				targetCampusId = newCampus.id;
				timezone = newCampus.timezone;
			}
		}

		// --- 2. GENERATE GATHERINGS & PLANS ---
		await db.transaction(async (tx) => {
			const baseDate = parseISO(startDateStr);

			for (let i = 0; i < weekCount; i++) {
				// A. Calculate Local Strings
				const currentWeekDate = addDays(baseDate, i * 7);
				const dateString = format(currentWeekDate, 'yyyy-MM-dd');
				const dateTimeString = `${dateString} ${timeStr}`;

				// B. Calculate UTC Timestamps (The Logic Split)

				// 1. Gathering Anchor: Midnight in Campus Timezone
				// This answers "What Day?"
				const gatheringDateUTC = fromZonedTime(dateString, timezone);

				// 2. Plan Start: Execution Time in Campus Timezone
				// This answers "What Time?" (e.g., 10:00 AM)
				const planStartUTC = fromZonedTime(dateTimeString, timezone);

				const title = isSeries ? `${baseTitle} (Week ${i + 1})` : baseTitle;

				// C. Create Gathering (The Bucket)
				const [newGathering] = await tx
					.insert(gatherings)
					.values({
						church_id: church.id,
						campus_id: targetCampusId,
						title,
						date: gatheringDateUTC
					})
					.returning();

				// D. Create Plan (The Execution)
				await tx.insert(plans).values({
					church_id: church.id,
					gathering_id: newGathering.id,
					campus_id: targetCampusId,
					// RECOMMENDATION: Use 'Main' instead of repeating baseTitle
					title: baseTitle || 'Main',
					starts_at: planStartUTC
				});
			}
		});

		return { success: true };
	}
};
