// /ui/src/routes/connections/+page.server.ts
import { redirect } from '@sveltejs/kit';

export const load = async () => {
  throw redirect(302, '/connections/people');
};
