// /ui/src/routes/api/people/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**************************************************************
 * GET /api/people
 * List people using Supabase RLS
 **************************************************************/
export const GET: RequestHandler = async ({ locals, url }) => {
  // 1. Get Search/Sort params
  const search = url.searchParams.get('search');
  const sort = url.searchParams.get('sort') ?? 'display_name';
  const dir = url.searchParams.get('dir') ?? 'asc';
  const isAscending = dir.toLowerCase() !== 'desc';

  // 2. Map sort keys to actual column names
  const sortMap: Record<string, string> = {
    display_name: 'display_name',
    first_name: 'first_name',
    last_name: 'last_name',
    created_at: 'created_at'
  };
  const sortCol = sortMap[sort] ?? 'display_name';

  // 3. Build the Supabase Query
  let query = locals.supabase
    .from('people')
    .select('*')
    .eq('is_active', true);

  // OPTIONAL: If the church picker is active, filter by it.
  // If not, RLS will handle security (or show nothing safe).
  if (locals.churchId) {
    query = query.eq('church_id', locals.churchId);
  }

  // 4. Handle Search (ILIKE)
  if (search) {
    // Search across multiple columns using "or" syntax
    const term = `%${search}%`;
    query = query.or(`display_name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`);
  }

  // 5. Apply Sorting
  query = query.order(sortCol, { ascending: isAscending, nullsFirst: false });
  // Secondary sort by display_name
  if (sortCol !== 'display_name') {
    query = query.order('display_name', { ascending: true });
  }

  // 6. Execute
  const { data, error: dbError } = await query;

  if (dbError) {
    console.error('GET /api/people failed:', dbError);
    throw error(500, 'Failed to load people');
  }

  // 7. Transform Data (Re-add has_contact_info stub)
  // Note: To truly fetch "has_contact_info", we would need to join the contact_methods table.
  // For now, we default to false to prevent UI errors while migrating.
  const people = (data ?? []).map(p => ({
    ...p,
    has_contact_info: false
  }));

  return json(people, { headers: { 'x-served-by': 'sveltekit' } });
};

/**************************************************************
 * POST /api/people
 * Create a new person using Supabase
 **************************************************************/
export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await request.json();
  const { first_name, last_name, goes_by } = body;

  // Validation
  if (!first_name && !last_name) {
    throw error(400, 'At least first_name or last_name is required');
  }

  // SOFT CHECK: Fallback to Test Church if picker is empty
  const churchId = locals.churchId || '84c66cbb-1f13-4ed2-8416-076755b5dc49';

  const { data, error: dbError } = await locals.supabase
    .from('people')
    .insert({
      church_id: churchId,
      first_name: first_name?.trim() || null,
      last_name: last_name?.trim() || null,
      goes_by: goes_by?.trim() || null,
      display_name: '' // Database trigger will likely populate this
    })
    .select()
    .single();

  if (dbError) {
    console.error('POST /api/people failed:', dbError);
    throw error(500, 'Failed to create person');
  }

  return json(data, {
    status: 201,
    headers: { 'x-served-by': 'sveltekit' }
  });
};
