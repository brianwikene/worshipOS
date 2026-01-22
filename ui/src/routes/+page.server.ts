// /ui/src/routes/+page.server.ts
// src/routes/+page.server.ts
import { redirect } from '@sveltejs/kit';

export function load() {
  throw redirect(302, '/start');
}
