// ui/src/routes/care/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const supabase = locals.supabase;
	const user = locals.user;

	if (!user) throw error(401, 'Please sign in.');

	const userId = user.id;

	// Church context:
	// Prefer cookie-based locals.churchId; fallback to first membership (dev-friendly).
	let churchId: string | undefined = locals.churchId;
	let role: string | null = null;

	if (!churchId) {
		const { data: memberships, error: memErr } = await supabase
			.from('church_memberships')
			.select('church_id, role')
			.eq('user_id', userId)
			.order('created_at', { ascending: true })
			.limit(1);

		if (memErr) throw error(500, memErr.message);
		if (!memberships || memberships.length === 0) throw error(403, 'No church membership found.');

		churchId = memberships[0].church_id;
		role = memberships[0].role;
	} else {
		const { data: membership, error: memErr } = await supabase
			.from('church_memberships')
			.select('role')
			.eq('church_id', churchId)
			.eq('user_id', userId)
			.maybeSingle();

		if (memErr) throw error(500, memErr.message);
		if (!membership) throw error(403, 'Not a member of this church.');

		role = membership.role;
	}

	// Optional toggle:
	// - default shows only cases assigned to me
	// - /care?all=1 shows all cases I'm allowed to see (RLS still applies)
	const canSeeAll = role === 'pastor' || role === 'admin' || role === 'care';
	const showAll = canSeeAll && url.searchParams.get('all') === '1';

	let q = supabase
		.from('v_care_cases')
		.select(
			[
				'id',
				'title',
				'status',
				'sensitivity_level',
				'created_at',
				'person_id',
				'subject_name',
				'assigned_to',
				'assigned_to_name'
			].join(',')
		)
		.eq('church_id', churchId)
		.neq('status', 'closed')
		.order('created_at', { ascending: false });

	if (!showAll) {
		q = q.eq('assigned_to', userId);
	}

	const { data: cases, error: casesErr } = await q;

	if (casesErr) throw error(500, casesErr.message);

	return {
		user,
		role,
		churchId,
		showAll,
		cases: cases ?? []
	};
};
