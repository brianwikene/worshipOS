// src/routes/api/_diag/client-error/+server.ts
// Receives client-side errors for server-side logging

import { logRequest } from '$lib/server/log';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface ClientErrorPayload {
	kind: 'window.onerror' | 'unhandledrejection' | 'manual';
	message: string;
	stack?: string;
	url?: string;
	extra?: Record<string, unknown>;
}

export const POST: RequestHandler = async (event) => {
	logRequest(event, 'diag.client-error');

	const body = (await event.request.json().catch(() => null)) as ClientErrorPayload | null;

	// Log to terminal so silent client errors become visible
	// Later: store in a table (error_events) or forward to external service
	console.error('[CLIENT ERROR INGEST]', {
		rid: event.locals.rid ?? 'no-rid',
		churchId: event.locals.church?.id ?? 'none',
		actorId: event.locals.actor?.id ?? 'anon',
		body
	});

	return json({ ok: true });
};
