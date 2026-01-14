// ui/src/routes/api/tenant/active-church/+server.ts

import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const COOKIE_NAME = 'active_church_id';

// ✅ GET: read current active church from cookie
export const GET: RequestHandler = async ({ cookies }) => {
  return json({ churchId: cookies.get(COOKIE_NAME) ?? null });
};

// ✅ POST: set active church in cookie
export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const churchId = String(body?.churchId ?? '').trim();

  if (!churchId) throw error(400, 'churchId is required');

  cookies.set(COOKIE_NAME, churchId, {
    path: '/',
    httpOnly: true,          // server-readable, not JS-readable
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365 // 1 year
  });

  return json({ ok: true });
};

// ✅ DELETE: remove active church from cookie
export const DELETE: RequestHandler = async ({ cookies }) => {
  cookies.delete(COOKIE_NAME, { path: '/' });
  return json({ ok: true });
};
