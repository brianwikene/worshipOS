// src/routes/gatherings/+page.server.ts
import { db } from '$lib/server/db';
import { campuses, plans } from '$lib/server/db/schema';
import { error, fail } from '@sveltejs/kit';
import { addDays, format, parseISO } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
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

	// 2. Fetch Plans (Newest First) - Plans now serve as gatherings
	const data = await db.query.plans.findMany({
		where: and(eq(plans.church_id, church.id), isNull(plans.deleted_at)),
		orderBy: [desc(plans.date)],
		with: {
			campus: true,
			items: {
				columns: { id: true }
			}
		}
	});

	return {
		campuses: allCampuses,
		plans: data
	};
};

export const actions: Actions = {
	createPlan: async ({ request, locals }) => {
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
			const c = await db.query.campuses.findFirst({
				where: eq(campuses.id, targetCampusId)
			});
			if (c) timezone = c.timezone;
		} else {
			const existing = await db.query.campuses.findFirst({
				where: eq(campuses.church_id, church.id)
			});

			if (existing) {
				targetCampusId = existing.id;
				timezone = existing.timezone;
			} else {
				const [newCampus] = await db
					.insert(campuses)
					.values({
						church_id: church.id,
						name: 'Main Campus',
						timezone: church.timezone || 'America/Los_Angeles'
					})
					.returning();

				targetCampusId = newCampus.id;
				timezone = newCampus.timezone;
			}
		}

		// --- 2. GENERATE PLANS ---
		await db.transaction(async (tx) => {
			const baseDate = parseISO(startDateStr);

			for (let i = 0; i < weekCount; i++) {
				const currentWeekDate = addDays(baseDate, i * 7);
				const dateString = format(currentWeekDate, 'yyyy-MM-dd');
				const dateTimeString = `${dateString} ${timeStr}`;

				// Plan date in campus timezone
				const planDateUTC = fromZonedTime(dateTimeString, timezone);

				const title = isSeries ? `${baseTitle} (Week ${i + 1})` : baseTitle;

				await tx.insert(plans).values({
					church_id: church.id,
					campus_id: targetCampusId,
					name: title,
					date: planDateUTC,
					status: 'draft'
				});
			}
		});

		return { success: true };
	}
};
