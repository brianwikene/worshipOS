// ui/src/routes/api/debug/care/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.user;
	if (!user) return json({ ok: false, error: 'not_logged_in' }, { status: 401 });

	const supabase = locals.supabase;

	// Determine churchId: cookie first, fallback to first membership
	let churchId = locals.churchId ?? null;

	if (!churchId || churchId === 'null') {
		const { data: memberships, error: memErr } = await supabase
			.from('church_memberships')
			.select('church_id')
			.eq('user_id', user.id)
			.order('created_at', { ascending: true })
			.limit(1);

		if (memErr) {
			return json({ ok: false, user_id: user.id, error: memErr }, { status: 500 });
		}

		if (!memberships || memberships.length === 0) {
			return json(
				{ ok: false, user_id: user.id, error: { message: 'No church membership found' } },
				{ status: 403 }
			);
		}

		churchId = memberships[0].church_id;
	}

	// Intentionally DO NOT filter by assigned_to → we are testing RLS
	const { data, error } = await supabase
		.from('v_care_cases')
		.select('id,title,assigned_to,sensitivity_level,subject_name,assigned_to_name')
		.eq('church_id', churchId);

	return json({
		ok: !error,
		user_id: user.id,
		church_id: churchId,
		data,
		error
	});
};
