import type { PageLoad } from './$types';
import { apiFetch } from '$lib/api';

export const load: PageLoad = async () => {
	   const res = await apiFetch('/services');
       const services = await res.json();
       return { services };
};