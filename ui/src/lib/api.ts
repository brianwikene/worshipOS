// src/lib/api.ts
import { getActiveChurchId } from '$lib/tenant';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function normalizePath(path: string) {
  return path.startsWith('/') ? path : `/${path}`;
}

function resolveArgs(
  a: string | FetchLike,
  b?: string,
  init: RequestInit = {}
): { fetchFn: FetchLike; path: string; init: RequestInit } {
  if (typeof a === 'function') {
    // Signature: (fetchFn, path, init)
    return { fetchFn: a, path: b ?? '', init };
  }
  // Signature: (path, init)
  return { fetchFn: fetch, path: a, init: (b as any) ?? init };
}

export async function apiFetch(a: string, init?: RequestInit): Promise<Response>;
export async function apiFetch(
  fetchFn: FetchLike,
  path: string,
  init?: RequestInit
): Promise<Response>;
export async function apiFetch(
  a: string | FetchLike,
  b?: string | RequestInit,
  c: RequestInit = {}
): Promise<Response> {
  const { fetchFn, path, init } = resolveArgs(
    a,
    typeof b === 'string' ? b : undefined,
    typeof b === 'object' ? b : c
  );

  if (typeof path !== 'string' || path.length === 0) {
    throw new TypeError(`apiFetch expected a path string but got: ${String(path)}`);
  }

  // Build headers first (so SSR can pass X-Church-Id in init.headers)
  const headers = new Headers(init.headers ?? {});

  // Prefer explicitly-provided header (SSR), otherwise fall back to browser state
  const explicitChurchId = headers.get('X-Church-Id');
  const churchId = explicitChurchId || getActiveChurchId();

  if (!churchId) throw new Error('No active church selected (X-Church-Id missing).');

  headers.set('X-Church-Id', churchId);

  // Only set Content-Type when sending a body
  if (!headers.has('Content-Type') && init.body != null) {
    headers.set('Content-Type', 'application/json');
  }

  const urlPath = normalizePath(path);
  const url = `${API_BASE}${urlPath}`;

  const res = await fetchFn(url, { ...init, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }

  return res;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T>;
export async function apiJson<T>(fetchFn: FetchLike, path: string, init?: RequestInit): Promise<T>;
export async function apiJson<T>(
  a: string | FetchLike,
  b?: string | RequestInit,
  c: RequestInit = {}
): Promise<T> {
  const res =
    typeof a === 'function'
      ? await apiFetch(a, b as string, c)
      : await apiFetch(a, b as RequestInit);

  // NOTE: Don't read res.headers.get('content-type') here.
  // During SvelteKit hydration replay, headers are restricted unless whitelisted,
  // which causes hard-refresh 500s on routes like /gatherings.
  try {
    const json = await res.json();

    if (json && typeof json === 'object' && !Array.isArray(json)) {
      const obj = json as Record<string, unknown>;

      const hasData = 'data' in obj;
      const looksLikeEnvelope = 'meta' in obj || 'error' in obj || 'ok' in obj;

      if (hasData && looksLikeEnvelope) {
        return obj.data as T;
      }
    }

    return json as T;
  } catch {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Expected JSON but response was not JSON. Body starts: ${text.slice(0, 200)}`
    );
  }
}
