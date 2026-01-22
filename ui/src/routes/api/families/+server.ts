// /ui/src/routes/api/families/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**************************************************************
 * GET /api/families
 * List families (with search)
 **************************************************************/
export const GET: RequestHandler = async ({ locals, url }) => {
  const search = url.searchParams.get('search');

  // Start Query
  let query = locals.supabase
    .from('families')
    .select('*')
    .order('name', { ascending: true });

  // Soft Context Check
  if (locals.churchId) {
    query = query.eq('church_id', locals.churchId);
  }

  // Search Filter
  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    console.error('GET /api/families failed:', dbError);
    throw error(500, 'Failed to list families');
  }

  return json(data);
};

/**************************************************************
 * POST /api/families
 * Create a new family
 **************************************************************/
export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== 'string') {
    throw error(400, 'Family name is required');
  }

  // Soft Context Check (Fallback to Test Church if empty)
  const churchId = locals.churchId || '84c66cbb-1f13-4ed2-8416-076755b5dc49';

  const { data, error: dbError } = await locals.supabase
    .from('families')
    .insert({
      church_id: churchId,
      name: name.trim()
    })
    .select()
    .single();

  if (dbError) {
    console.error('POST /api/families failed:', dbError);
    throw error(500, 'Failed to create family');
  }

  return json(data, { status: 201 });
};
