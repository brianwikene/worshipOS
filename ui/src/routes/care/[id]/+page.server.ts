// ui/src/routes/care/[id]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const supabase = locals.supabase;
	const user = locals.user;

	if (!user) throw error(401, 'Please sign in.');

	const userId = user.id;
	const caseId = params.id;

	// Prefer cookie church context; fallback to first membership
	let churchId = locals.churchId;

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

	const { data: careCase, error: caseErr } = await supabase
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
		.eq('id', caseId)
		.maybeSingle();

	if (caseErr) throw error(500, caseErr.message);
	if (!careCase) throw error(404, 'Care case not found (or you do not have access).');

	return {
		user,
		role,
		churchId,
		careCase
	};
};
