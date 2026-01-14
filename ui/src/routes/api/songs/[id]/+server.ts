// ui/src/routes/api/songs/[id]/+server.ts
import { sanitizeSongPayload } from '$lib/server/songs/input';
import { parseSongText } from '$lib/server/songs/parser';
import { fetchSongById } from '$lib/server/songs/repository';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  try {
    const song = await fetchSongById(locals.supabase, churchId, params.id);
    if (!song) throw error(404, 'Song not found');

    return json(song, { headers: { 'x-served-by': 'sveltekit' } });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/songs/[id] GET', err);
    throw error(500, 'Database error');
  }
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  const rawBody = await request.json().catch(() => ({}));
  const payload = sanitizeSongPayload(rawBody);
  if (!payload.title) throw error(400, 'Title is required');

  const parserResult = parseSongText(payload.raw_text ?? '', {
    formatHint: payload.source_format
  });

  try {
    const { data: updated, error: updateError } = await locals.supabase
      .from('songs')
      .update({
        title: payload.title,
        artist: payload.artist ?? null,
        key: payload.key ?? null,
        bpm: payload.bpm ?? null,
        ccli_number: payload.ccli_number ?? null,
        notes: payload.notes ?? null,
        source_format: payload.source_format ?? null,
        raw_text: payload.raw_text ?? null,
        parsed_json: parserResult
      })
      .eq('church_id', churchId)
      .eq('id', params.id)
      .select('id')
      .single();

    if (updateError) {
      console.error('[API] /api/songs/[id] PUT update failed:', updateError);
      throw error(500, 'Failed to update song');
    }
    if (!updated?.id) throw error(404, 'Song not found');

    const song = await fetchSongById(locals.supabase, churchId, params.id);
    if (!song) throw error(500, 'Song updated but could not be loaded');

    return json(song, { headers: { 'x-served-by': 'sveltekit' } });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/songs/[id] PUT', err);
    throw error(500, 'Database error');
  }
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  const churchId = locals.churchId;
  if (!churchId) throw error(400, 'Active church is required');

  try {
    // Usage check 1: Music planning "Truth Table"
    // `service_instance_songs` links directly to `songs`.
    const { count: musicUsageCount, error: musicError } = await locals.supabase
      .from('service_instance_songs')
      .select('id', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('song_id', params.id);

    if (musicError) {
      console.error('[API] /api/songs/[id] DELETE music usage check failed:', musicError);
      throw error(500, 'Failed to check song usage');
    }

    // Usage check 2: Run-of-show "Playlist"
    // `service_items` links to `song_variants`, which links to `songs`.
    // We use an explicit alias `song_variant` for clarity and safety.
    const { count: itemUsageCount, error: itemError } = await locals.supabase
      .from('service_items')
      .select('id, song_variant:song_variants!inner(song_id)', { count: 'exact', head: true })
      .eq('church_id', churchId)
      .eq('song_variant.song_id', params.id);

    if (itemError) {
      console.error('[API] /api/songs/[id] DELETE item usage check failed:', itemError);
      throw error(500, 'Failed to check song usage in schedule');
    }

    const isUsed = (musicUsageCount ?? 0) > 0 || (itemUsageCount ?? 0) > 0;

    if (isUsed) {
      // Soft delete (archive)
      const { error: archiveError } = await locals.supabase
        .from('songs')
        .update({ archived_at: new Date().toISOString() })
        .eq('church_id', churchId)
        .eq('id', params.id);

      if (archiveError) {
        console.error('[API] /api/songs/[id] DELETE archive failed:', archiveError);
        throw error(500, 'Failed to archive song');
      }
    } else {
      // Hard delete
      const { error: deleteError } = await locals.supabase
        .from('songs')
        .delete()
        .eq('church_id', churchId)
        .eq('id', params.id);

      if (deleteError) {
        console.error('[API] /api/songs/[id] DELETE hard delete failed:', deleteError);
        throw error(500, 'Failed to delete song');
      }
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) throw err;
    console.error('[API] /api/songs/[id] DELETE', err);
    throw error(500, 'Database error');
  }
};
