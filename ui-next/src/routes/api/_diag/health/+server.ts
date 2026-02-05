// src/routes/api/_diag/health/+server.ts
// Basic health check endpoint

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({
		ok: true,
		ts: new Date().toISOString()
	});
};
