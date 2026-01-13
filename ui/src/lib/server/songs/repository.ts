import type { ParsedSong, SongSourceFormat } from '$lib/songs/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SongRow {
	id: string;
	title: string;
	artist: string | null;
	key: string | null;
	bpm: number | null;
	ccli_number: string | null;
	notes: string | null;
	source_format: SongSourceFormat;
	raw_text: string | null;
	parsed_json: ParsedSong | null;
	created_at: string;
	updated_at: string;
	arrangement_count: number;
}

export interface SongResponse extends SongRow {
	parser_warnings: string[];
}

export function mapSongRow(row: SongRow): SongResponse {
	const parsed = row.parsed_json ?? null;
	const warnings = Array.isArray(parsed?.warnings)
		? parsed.warnings.map((warning) => String(warning))
		: [];

	return {
		...row,
		parsed_json: parsed,
		parser_warnings: warnings
	};
}

export async function fetchSongById(supabase: SupabaseClient, churchId: string, songId: string): Promise<SongResponse | null> {
  const { data: song, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', songId)
    .eq('church_id', churchId)
    .single();

  if (error || !song) return null;

  // Get arrangement count
  const { count } = await supabase
    .from('song_arrangements')
    .select('*', { count: 'exact', head: true })
    .eq('song_id', songId)
    .eq('church_id', churchId);

  return mapSongRow({
    ...song,
    arrangement_count: count ?? 0
  });
}
