import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// 1. Auth Guard (Standard)
	// In the future, this comes from Supabase Auth
	// const session = await locals.getSession();
	// if (!session) throw error(401, 'Unauthorized');

	try {
		// 2. Query the View (Not the raw tables)
		// We filter for "unhealthy" signals to keep the dashboard focused
		const signals = await db.query(`
            SELECT
                person_id,
                display_name,
                last_30_days_count,
                last_served_date,
                status_signal
            FROM v_tend_burnout_signals
            WHERE status_signal != 'healthy'
            ORDER BY last_30_days_count DESC
        `);

		return {
			signals: signals.rows
		};
	} catch (err) {
		console.error('Tend Load Error:', err);
		return { signals: [] };
	}
};
