// src/routes/gatherings/+page.ts
import type { PageLoad } from './$types';
import { apiJson } from '$lib/api';

export const load: PageLoad = async ({ fetch }) => {
  const groups = await apiJson(fetch, '/api/gatherings');
  return { groups };
};