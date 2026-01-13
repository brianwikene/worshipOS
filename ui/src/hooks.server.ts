import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
import { createServerClient } from '@supabase/ssr'
import { type Handle } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Initialize Supabase Client (This reads the cookies)
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' })
        })
      },
    },
  })

  // 2. GET THE USER (This is the missing step!)
  // We ask Supabase: "Who does this cookie belong to?"
  const {
    data: { user },
  } = await event.locals.supabase.auth.getUser()

  // 3. Attach User to the Server Request
  event.locals.user = user

  // 4. Get Church Context
  event.locals.churchId = event.cookies.get('church_id') || null;

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version'
    },
  })
}
