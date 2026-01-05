import { pool } from '$lib/server/db';
import type { ParsedSong, SongSourceFormat } from '$lib/songs/types';

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

export const SONG_SELECT = `
SELECT
  s.id,
  s.title,
  s.artist,
  s.key,
  s.bpm,
  s.ccli_number,
  s.notes,
  s.source_format,
  s.raw_text,
  s.parsed_json,
  s.created_at,
  s.updated_at,
  COALESCE(arr.arrangement_count, 0) AS arrangement_count
FROM songs s
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int AS arrangement_count
  FROM song_arrangements sa
  WHERE sa.song_id = s.id AND sa.church_id = s.church_id
) arr ON TRUE
`;

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

export async function fetchSongById(churchId: string, songId: string): Promise<SongResponse | null> {
	const result = await pool.query<SongRow>(`${SONG_SELECT} WHERE s.church_id = $1 AND s.id = $2`, [
		churchId,
		songId
	]);

	const row = result.rows[0];
	return row ? mapSongRow(row) : null;
}
