import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	return { service_instance_id: params.service_instance_id };
};
