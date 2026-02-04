import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Note: Templates and gathering_types tables don't exist in current schema
// This is a stub that returns empty data

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.church) {
		throw error(404, 'Church not found');
	}

	// Return empty arrays since tables don't exist
	return {
		types: [],
		allTemplates: []
	};
};

// Actions are disabled until schema supports templates
export const actions = {};
