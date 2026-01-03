import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	return { gathering_id: params.id };
};
