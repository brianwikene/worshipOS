import { db } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// 1. Secure Context: Get the current App User & Permissions
	// (This relies on the "app_users" table we just created)

	// MOCK: For local dev, we assume the "admin" user ID we created.
	// In prod, this comes from: locals.user.id
	const currentUserId = '00000000-0000-0000-0000-000000000000';

	const currentUser = await db.query(
		`SELECT role, can_view_care_notes FROM app_users WHERE id = $1`,
		[currentUserId]
	);

	const permissions = currentUser.rows[0];

	// 2. The "Software Firewall"
	// We block access here to save a DB trip, but RLS is the ultimate backup.
	if (!permissions || !permissions.can_view_care_notes) {
		// If they don't have the badge, they don't get in.
		throw error(403, 'Access Denied: You do not have Care permissions.');
	}

	// 3. Fetch the Cases (Stories)
	// We JOIN with people to get the names, but we DO NOT join the notes content yet.
	// That should be a separate load on the individual [id] page for security.
	const cases = await db.query(`
        SELECT
            c.id,
            c.title,
            c.status,
            c.sensitivity_level,
            c.updated_at,
            p.display_name as person_name,
            p.avatar_url as person_avatar,
            (SELECT COUNT(*) FROM care_notes WHERE case_id = c.id) as note_count
        FROM care_cases c
        JOIN people p ON c.person_id = p.id
        WHERE c.status != 'closed' -- Default to active cases
        ORDER BY c.updated_at DESC
    `);

	return {
		cases: cases.rows,
		userPermissions: permissions
	};
};
