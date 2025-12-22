// ui/src/lib/api.ts

import { getActiveChurchId } from '$lib/tenant';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const churchId = getActiveChurchId();
  if (!churchId) {
    throw new Error('No active church selected (X-Church-Id missing).');
  }

  const headers = new Headers(init.headers ?? {});
  headers.set('X-Church-Id', churchId);

  // Only set Content-Type when sending a body
  if (!headers.has('Content-Type') && init.body != null) {
    headers.set('Content-Type', 'application/json');
  }

  const urlPath = path.startsWith('/') ? path : `/${path}`;

  const res = await fetch(`${API_BASE}${urlPath}`, {
    ...init,
    headers
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }

  return res;
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    throw new Error(`Expected JSON but got "${contentType}". Body starts: ${text.slice(0, 80)}`);
  }

  return res.json() as Promise<T>;
}

//export async function apiJson<T>(
//  path: string,
//  init: RequestInit = {}
//): Promise<T> {
//  const res = await apiFetch(path, init);
//  return res.json() as Promise<T>;
//}
