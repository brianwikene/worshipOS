// /ui/src/hooks.server.ts
// src/hooks.server.ts
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const { pathname } = event.url;

  // Redirect legacy routes to new paths
  if (pathname === '/people') {
    return Response.redirect(new URL('/connections/people', event.url), 308);
  }
  if (pathname === '/families') {
    return Response.redirect(new URL('/connections/families', event.url), 308);
  }

  // Supabase SSR client
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' });
        });
      },
    },
  });

  // Auth user (safe to be null)
  const {
    data: { user },
  } = await event.locals.supabase.auth.getUser();
  event.locals.user = user;

  // Church Context (cookie-based)
  event.locals.churchId = event.cookies.get('active_church_id') ?? null;

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    },
  });
};
