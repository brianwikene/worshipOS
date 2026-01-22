// /ui/src/routes/api/debug/care/+server.ts
// ui/src/routes/api/tenant/active-church/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const COOKIE_NAME = 'active_church_id';

export const GET: RequestHandler = async ({ cookies }) => {
  const churchId = cookies.get(COOKIE_NAME) ?? null;
  return json({ churchId });
};

export const POST: RequestHandler = async ({ request, cookies }) => {
  const body = await request.json().catch(() => ({}));
  const churchId = String(body?.churchId ?? '').trim();
  if (!churchId) throw error(400, 'churchId is required');

  cookies.set(COOKIE_NAME, churchId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365
  });

  return json({ ok: true, churchId });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
  cookies.delete(COOKIE_NAME, { path: '/' });
  return json({ ok: true });
};
