// ui/src/routes/gatherings/+page.ts
export const ssr = false;

import { apiJson } from '$lib/api';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const groups = await apiJson(fetch, '/api/gatherings');
  return { groups };
};
