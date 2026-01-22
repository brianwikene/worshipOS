// /ui/src/routes/api/gatherings/[id]/songs/+server.ts
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

type SongShape = {
	title: string;
	artist: string | null;
	key: string | null;
	bpm: number | null;
};

type SongJoin = SongShape | null | SongShape[];

type ServiceInstanceSongRow = {
	id: string;
	song_id: string;
	display_order: number;
	key: string | null;
	notes: string | null;
	song: SongJoin;
};

type GatheringSongItem = {
	id: string;
	song_id: string;
	title: string;
	artist: string | null;
	key: string | null;
	bpm: number | null;
	display_order: number;
	notes: string | null;
};

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

	// ✅ Map goes HERE (transform DB rows → API response shape)
	const songs: GatheringSongItem[] = (data ?? []).map((item: ServiceInstanceSongRow) => {
		const song = Array.isArray(item.song) ? item.song[0] : item.song;

		return {
			id: item.id,
			song_id: item.song_id,
			title: song?.title ?? 'Unknown',
			artist: song?.artist ?? null,
			key: item.key ?? song?.key ?? null,
			bpm: song?.bpm ?? null,
			display_order: item.display_order,
			notes: item.notes
		};
	});

	return json(songs, {
		headers: { 'x-served-by': 'sveltekit' }
	});
};

export const POST: RequestHandler = async (event) => {
	// 1. Setup & Input Extraction
	const churchId = event.locals.churchId;
	if (!churchId) throw error(400, 'Active church is required');

	const { id: instanceId } = event.params;
	const body = (await event.request.json()) as Partial<{
		song_id: string;
		display_order: number;
		key: string | null;
		notes: string | null;
	}>;
	const { song_id, display_order, key, notes } = body;

	// 2. Validation
	if (!song_id) throw error(400, 'song_id is required');

	// Instance existence check
	const { count, error: instErr } = await event.locals.supabase
		.from('service_instances')
		.select('id', { count: 'exact', head: true })
		.eq('id', instanceId)
		.eq('church_id', churchId);

	if (instErr) {
		console.error('POST /api/gatherings/[id]/songs instance check failed:', instErr);
		throw error(500, 'Database error');
	}

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
		.select(
			`
        id,
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
		.single();

	if (dbError) {
		console.error('POST /api/gatherings/[id]/songs failed:', dbError);
		throw error(500, 'Failed to add song to gathering');
	}
	if (!songInsert) throw error(500, 'Failed to add song to gathering');

	const song = Array.isArray(songInsert.song) ? songInsert.song[0] : songInsert.song;

	const shaped: GatheringSongItem = {
		id: songInsert.id,
		song_id: songInsert.song_id,
		title: song?.title ?? 'Unknown',
		artist: song?.artist ?? null,
		key: songInsert.key ?? song?.key ?? null,
		bpm: song?.bpm ?? null,
		display_order: songInsert.display_order,
		notes: songInsert.notes
	};

	return json(shaped, { status: 201, headers: { 'x-served-by': 'sveltekit' } });
};
