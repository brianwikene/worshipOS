// src/lib/client/error-capture.ts
// Client-side error capture for uncaught exceptions and promise rejections

type ClientErrorPayload = {
	kind: 'window.onerror' | 'unhandledrejection' | 'manual';
	message: string;
	stack?: string;
	url?: string;
	extra?: Record<string, unknown>;
};

function shouldClientLog(): boolean {
	// Use import.meta.env for Vite compatibility (optional env var)
	return import.meta.env.PUBLIC_CLIENT_LOG === '1';
}

async function postClientError(payload: ClientErrorPayload): Promise<void> {
	// Default endpoint if env var not set
	const endpoint =
		(import.meta.env.PUBLIC_CLIENT_ERROR_ENDPOINT as string) || '/api/_diag/client-error';

	try {
		await fetch(endpoint, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload)
		});
	} catch {
		// Swallow - this is best-effort
	}
}

/**
 * Install global error handlers to capture uncaught errors and
 * unhandled promise rejections. Call this once in your root layout.
 */
export function installClientErrorCapture(): void {
	// Uncaught errors
	window.addEventListener('error', (ev) => {
		const payload: ClientErrorPayload = {
			kind: 'window.onerror',
			message: ev.message || 'Unknown window error',
			stack: (ev.error && (ev.error as Error).stack) || undefined,
			url: location.pathname + location.search
		};

		if (shouldClientLog()) console.error('[CLIENT ERR]', payload);
		void postClientError(payload);
	});

	// Unhandled promise rejections
	window.addEventListener('unhandledrejection', (ev) => {
		const reason = ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason));

		const payload: ClientErrorPayload = {
			kind: 'unhandledrejection',
			message: reason.message,
			stack: reason.stack,
			url: location.pathname + location.search
		};

		if (shouldClientLog()) console.error('[CLIENT ERR]', payload);
		void postClientError(payload);
	});
}

/**
 * Manually capture and report an exception.
 * Use this in catch blocks for important errors that should be tracked.
 */
export function captureClientException(
	message: string,
	err?: unknown,
	extra?: Record<string, unknown>
): void {
	const e = err instanceof Error ? err : new Error(String(err ?? message));

	const payload: ClientErrorPayload = {
		kind: 'manual',
		message: e.message || message,
		stack: e.stack,
		url: location.pathname + location.search,
		extra
	};

	if (shouldClientLog()) console.error('[CLIENT ERR]', payload);
	void postClientError(payload);
}
