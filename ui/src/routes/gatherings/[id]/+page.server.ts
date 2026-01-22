// /ui/src/routes/gatherings/[id]/+page.server.ts
import { redirect } from '@sveltejs/kit';

export const load = async ({ params }) => {
  throw redirect(302, `/gatherings/${params.id}/order`);
};
