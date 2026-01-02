// import type { PageLoad } from './$types';
// import { apiJson } from '$lib/api';
// 
// export const load: PageLoad = async ({ fetch }) => {
//   const services = await apiJson(fetch, '/api/services');
//   return { services };
// };

// src/routes/services/+page.ts
import type { PageLoad } from './$types';
import { apiJson } from '$lib/api';

export const load: PageLoad = async ({ fetch }) => {
  const groups = await apiJson(fetch, '/api/services');
  return { groups };
};