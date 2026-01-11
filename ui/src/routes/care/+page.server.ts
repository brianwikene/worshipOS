import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, user } }) => {
	console.log('------------------------------------------');
	console.log('🔍 DEBUG: Care Page Load Started');
	console.log('User:', user?.email ?? 'No User Logged In');

	// 1. Check if Supabase client exists
	if (!supabase) {
		console.error('❌ CRITICAL: locals.supabase is undefined!');
		return { error: 'Supabase client missing' };
	}

	// 2. Attempt the Query
	console.log('Attempting to fetch care_cases...');
	const { data: cases, error: dbError } = await supabase
		.from('care_cases')
		.select(
			`
      *,
      origin:source_signal_id (
        signal_type,
        data
      )
    `
		)
		.order('created_at', { ascending: false });

	// 3. Handle Errors Loudly
	if (dbError) {
		console.error('❌ SUPABASE ERROR DETAILS:', JSON.stringify(dbError, null, 2));

		// Return the error to the UI so we can see it
		return {
			cases: [],
			error: dbError
		};
	}

	console.log(`✅ Success. Found ${cases?.length ?? 0} cases.`);
	console.log('------------------------------------------');

	return {
		cases: cases ?? [],
		user: user,
		error: null
	};
};
