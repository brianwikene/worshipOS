// src/lib/server/log.ts
// Structured logging utilities for server-side code

import type { RequestEvent } from '@sveltejs/kit';
import { getDiagContext, isDebugEnabled } from './diag';

/**
 * Log an incoming request (only when debug enabled)
 */
export function logRequest(event: RequestEvent, label: string, extra?: Record<string, unknown>) {
	if (!isDebugEnabled(event)) return;

	const ctx = getDiagContext(event);
	console.log(`[RID:${ctx.rid}] [REQ] ${label}`, { ...ctx, ...extra });
}

/**
 * Log a step within request processing (only when debug enabled)
 */
export function logStep(event: RequestEvent, label: string, extra?: Record<string, unknown>) {
	if (!isDebugEnabled(event)) return;

	const ctx = getDiagContext(event);
	console.log(`[RID:${ctx.rid}] [STEP] ${label}`, { ...ctx, ...extra });
}

/**
 * Log server errors - ALWAYS logs (not gated by debug flag)
 * because errors are high-signal and needed in production
 */
export function logServerError(
	event: RequestEvent,
	status: number,
	err: unknown,
	extra?: Record<string, unknown>
) {
	const ctx = getDiagContext(event);

	const payload = {
		...ctx,
		status,
		...extra,
		error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err
	};

	console.error(`[RID:${ctx.rid}] [ERR] ${ctx.method} ${ctx.path} -> ${status}`, payload);
}

/**
 * Log a successful operation (only when debug enabled)
 */
export function logSuccess(event: RequestEvent, label: string, extra?: Record<string, unknown>) {
	if (!isDebugEnabled(event)) return;

	const ctx = getDiagContext(event);
	console.log(`[RID:${ctx.rid}] [OK] ${label}`, { ...ctx, ...extra });
}
