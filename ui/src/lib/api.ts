// ui/src/lib/api.ts

import { getActiveChurchId } from '$lib/tenant';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const churchId = getActiveChurchId();

  const headers = new Headers(init.headers ?? {});
  headers.set('X-Church-Id', churchId);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `API ${res.status} ${res.statusText}: ${text}`
    );
  }

  return res;
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await apiFetch(path, init);
  return res.json() as Promise<T>;
}
