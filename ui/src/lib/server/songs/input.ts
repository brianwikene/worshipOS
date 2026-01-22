// /ui/src/lib/server/songs/input.ts
import type { SongSourceFormat } from '$lib/songs/types';

export interface SanitizedSongInput {
	title: string | null;
	artist: string | null;
	key: string | null;
	bpm: number | null;
	ccli_number: string | null;
	notes: string | null;
	raw_text: string | null;
	source_format: SongSourceFormat;
}

type IncomingValue = Record<string, unknown> | null | undefined;

export function sanitizeSongPayload(payload: IncomingValue): SanitizedSongInput {
	const body = payload ?? {};

	return {
		title: coerceTitle(body.title),
		artist: toNullableString(body.artist),
		key: toNullableString(body.key),
		bpm: toNullableNumber(body.bpm),
		ccli_number: toNullableString(body.ccli_number),
		notes: toNullableString(body.notes),
		raw_text: normalizeRawText(body.raw_text),
		source_format: normalizeSourceFormat(body.source_format)
	};
}

export function normalizeSourceFormat(value: unknown): SongSourceFormat {
	return value === 'chordpro' ? 'chordpro' : 'plain_text';
}

export function toNullableString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
}

export function normalizeRawText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.replace(/\r\n/g, '\n');
	return normalized.length ? normalized : null;
}

export function toNullableNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const num = Number(value);
	return Number.isFinite(num) ? Math.round(num) : null;
}

export function coerceTitle(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
}
