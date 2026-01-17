import { redirect } from '@sveltejs/kit';

export const load = async ({ params }) => {
  throw redirect(302, `/gatherings/${params.id}/order`);
};
