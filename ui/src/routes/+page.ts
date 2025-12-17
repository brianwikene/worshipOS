import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const church_id =
		typeof localStorage !== 'undefined' ? localStorage.getItem('dev_church_id') : null;

	if (!church_id) {
		return { services: [], church_id: null };
	}

	const res = await fetch(`http://localhost:3000/services?church_id=${church_id}`);

	return {
		church_id,
		services: await res.json()
	};
};
