// src/routes/api/gatherings/[id]/songs/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  const churchId = event.locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const { id: instanceId } = event.params;

  // Fetch songs for this gathering instance
  const { data, error: dbError } = await event.locals.supabase
    .from('service_instance_songs')
    .select(
      `
      id,
      service_instance_id,
      song_id,
      display_order,
      key,
      notes,
      song:songs(
        id,
        title,
        artist,
        key,
        bpm
      )
    `
    )
    .eq('church_id', churchId)
    .eq('service_instance_id', instanceId)
    .order('display_order', { ascending: true });

  if (dbError) {
    console.error('GET /api/gatherings/[id]/songs failed:', dbError);
    throw error(500, 'Failed to load setlist');
  }

  // Transform to match expected interface
  const songs = (data ?? []).map(item => ({
    id: item.id,
    song_id: item.song_id,
    title: item.song?.title ?? 'Unknown',
    artist: item.song?.artist ?? null,
    key: item.key ?? item.song?.key ?? null,
    bpm: item.song?.bpm ?? null,
    display_order: item.display_order,
    notes: item.notes
  }));

  return json(songs, {
    headers: { 'x-served-by': 'sveltekit' }
  });
};

export const POST: RequestHandler = async (event) => {
	// 1. Setup & Input Extraction
	const churchId = event.locals.churchId;
	if (!churchId) throw error(400, 'Active church is required');

	const { id: instanceId } = event.params;
	const body = await event.request.json();
	const { song_id, display_order, key, notes } = body;

	// 2. Validation
	if (!song_id) throw error(400, 'song_id is required');

    // Instance existence check
	const { count } = await event.locals.supabase
      .from('service_instances')
      .select('id', { count: 'exact', head: true })
      .eq('id', instanceId)
      .eq('church_id', churchId);

	if (!count) throw error(404, 'Gathering instance not found');

	// 3. Execution (The Single Insert)
    const { data: songInsert, error: dbError } = await event.locals.supabase
        .from('service_instance_songs')
        .insert({
            church_id: churchId,
            service_instance_id: instanceId,
            song_id,
            display_order: display_order ?? 0,
            key: key ?? null,
            notes: notes ?? null
        })
        .select()
        .single();

    if (dbError) {
        console.error('POST /api/gatherings/[id]/songs failed:', dbError);
        throw error(500, 'Failed to add song to gathering');
    }

	return json(songInsert, {
		status: 201,
		headers: { 'x-served-by': 'sveltekit' }
	});
};
