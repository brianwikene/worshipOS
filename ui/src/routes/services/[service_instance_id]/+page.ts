import { redirect } from '@sveltejs/kit';

export const load = ({ params }) => {
  throw redirect(307, `/service-instances/${params.service_instance_id}`);
};
