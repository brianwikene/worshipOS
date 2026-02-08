/**
 * Song Parser & Transposition Engine
 *
 * Parses ChordPro-formatted song text into structured data for rendering,
 * handles chord transposition and Nashville number notation, and provides
 * pagination helpers for print layout.
 */

// ─── Constants ───────────────────────────────────────────────────────

/** Regex matching recognized section keywords in ChordPro charts. */
export const SECTION_KEYWORDS =
	/^(Verse|Chorus|Bridge|Pre-Chorus|PreChorus|Pre Chorus|Intro|Outro|Tag|Interlude|Instrumental|Hook|Ending|V\d|C\d|B\d)/i;

/** Chromatic scale using sharps/flats matching common worship charts. */
export const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Maps every enharmonic note name to its semitone index (0–11). */
export const NOTE_TO_SEMITONE: Record<string, number> = {
	C: 0,
	'B#': 0,
	'C#': 1,
	Db: 1,
	D: 2,
	'D#': 3,
	Eb: 3,
	E: 4,
	Fb: 4,
	F: 5,
	'E#': 5,
	'F#': 6,
	Gb: 6,
	G: 7,
	'G#': 8,
	Ab: 8,
	A: 9,
	'A#': 10,
	Bb: 10,
	B: 11,
	Cb: 11
};

// ─── Types ───────────────────────────────────────────────────────────

/** A chord paired with its following lyric text. */
export type ChordPair = {
	chord: string | null;
	lyric: string;
};

/** A single parsed line from a ChordPro chart. */
export type ParsedLine =
	| { type: 'empty' }
	| { type: 'section'; content: string }
	| { type: 'lyric'; pairs: ChordPair[] }
	| { type: 'comment'; content: string }
	| { type: 'directive'; label: string; value: string };

/** A group of consecutive lines under one section header. */
export type Segment = {
	label: string | null;
	lines: ParsedLine[];
};

// ─── Key / Transposition Helpers ─────────────────────────────────────

/** Normalize fancy Unicode sharps/flats to ASCII equivalents. */
export function normalizeKey(k: string): string {
	return k.replace('♯', '#').replace('♭', 'b');
}

/** Calculate the semitone distance from `original` key to `target` key. */
export function getSemitoneShift(original: string, target: string): number {
	const idx1 = NOTE_TO_SEMITONE[normalizeKey(original)];
	const idx2 = NOTE_TO_SEMITONE[normalizeKey(target)];
	if (idx1 === undefined || idx2 === undefined) return 0;
	return idx2 - idx1;
}

/** Transpose a single root+quality chord by `semitones`. */
function transposeChordSingle(chord: string, semitones: number): string {
	const match = chord.match(/^([A-G][#b]?)(.*)$/);
	if (!match) return chord;

	const root = normalizeKey(match[1]);
	const quality = match[2];
	const rootIndex = NOTE_TO_SEMITONE[root];

	if (rootIndex === undefined) return chord;

	let newIndex = (rootIndex + semitones) % 12;
	if (newIndex < 0) newIndex += 12;

	return KEYS[newIndex] + quality;
}

/** Transpose a chord (handles slash chords like G/B). */
export function transposeChord(chord: string, semitones: number): string {
	if (chord.includes('/')) {
		const [main, bass] = chord.split('/');
		return transposeChordSingle(main, semitones) + '/' + transposeChordSingle(bass, semitones);
	}
	return transposeChordSingle(chord, semitones);
}

// ─── Nashville Number Notation ───────────────────────────────────────

/** Convert a single root+quality chord to Nashville number relative to `key`. */
function noteToNumberSingle(chord: string, key: string): string {
	const match = chord.match(/^([A-G][#b]?)(.*)$/);
	if (!match) return chord;

	const root = normalizeKey(match[1]);
	const quality = match[2];

	const keyIndex = NOTE_TO_SEMITONE[normalizeKey(key)];
	const rootIndex = NOTE_TO_SEMITONE[root];
	if (keyIndex === undefined || rootIndex === undefined) return chord;

	const interval = (rootIndex - keyIndex + 12) % 12;
	const degrees: Record<number, string> = {
		0: '1',
		1: '1#',
		2: '2',
		3: 'b3',
		4: '3',
		5: '4',
		6: 'b5',
		7: '5',
		8: 'b6',
		9: '6',
		10: 'b7',
		11: '7'
	};
	const degree = degrees[interval] || '?';
	if (quality && /^\d/.test(quality)) {
		return degree + '(' + quality + ')';
	}
	return degree + quality;
}

/** Convert a chord to Nashville number notation (handles slash chords). */
export function noteToNumber(chord: string, key: string): string {
	if (chord.includes('/')) {
		const [main, bass] = chord.split('/');
		return noteToNumberSingle(main, key) + '/' + noteToNumberSingle(bass, key);
	}
	return noteToNumberSingle(chord, key);
}

// ─── Smart Labeling ──────────────────────────────────────────────────

/**
 * Auto-number bare section labels (e.g. "Verse" → "Verse 1").
 * Labels that already contain a number are returned as-is.
 */
export function smartLabel(raw: string, counters: Record<string, number>): string {
	const label = raw.trim();
	const lower = label.toLowerCase();

	// If it already has a number ("Verse 2", "V3"), keep it.
	if (/\d/.test(label)) return label;

	// Normalize common types for counting
	let type = '';
	if (lower.startsWith('verse') || lower.startsWith('v')) type = 'Verse';
	else if (lower.startsWith('chorus') || lower.startsWith('c')) type = 'Chorus';
	else if (lower.startsWith('bridge') || lower.startsWith('b')) type = 'Bridge';

	// Auto-increment (only append number for Verses by default)
	if (type) {
		counters[type] = (counters[type] || 0) + 1;
		if (type === 'Verse') return `${type} ${counters[type]}`;
	}

	return label;
}

// ─── Parsers ─────────────────────────────────────────────────────────

/**
 * Generate a song map (ordered list of section labels) from ChordPro content.
 * Respects explicit `{flow: ...}` directives if present.
 */
export function generateSongMap(content: string | null): string[] {
	if (!content) return [];

	// Check for explicit Manual Flow
	const flowMatch = content.match(/\{(?:flow|order|sequence):\s*(.*?)\}/i);
	if (flowMatch) {
		return flowMatch[1].split(',').map((s) => s.trim());
	}

	const map: string[] = [];
	const counters: Record<string, number> = {};
	const lines = content.split('\n');

	for (const line of lines) {
		const trim = line.trim();
		if (!trim) continue;

		// [Verse]
		const bracketMatch = trim.match(/^\[([^\]]+)\]\s*$/);
		if (bracketMatch && SECTION_KEYWORDS.test(bracketMatch[1])) {
			map.push(smartLabel(bracketMatch[1], counters));
		}

		// {Verse} or {soc}
		const braceMatch = trim.match(/^\{(.*?)(?::\s*(.*?))?\}$/);
		if (braceMatch) {
			const tag = braceMatch[1].toLowerCase();
			const value = braceMatch[2];

			if (['soc', 'start_of_chorus', 'chorus'].includes(tag))
				map.push(smartLabel('Chorus', counters));
			else if (['sov', 'start_of_verse'].includes(tag)) map.push(smartLabel('Verse', counters));
			else if (SECTION_KEYWORDS.test(tag))
				map.push(smartLabel(tag + (value ? ' ' + value : ''), counters));
		}
	}
	return map;
}

/**
 * Parse a ChordPro chart into an array of typed lines, applying
 * transposition and notation conversion.
 *
 * @param text       - Raw ChordPro content
 * @param originalKey - The song's original key (used as transposition base)
 * @param targetKey  - The key to transpose to
 * @param currentNotation - 'chords' for standard notation, 'numbers' for Nashville
 */
export function parseChart(
	text: string | null,
	originalKey: string,
	targetKey: string,
	currentNotation: 'chords' | 'numbers'
): ParsedLine[] {
	if (!text) return [];
	const semitones = getSemitoneShift(originalKey, targetKey);
	const counters: Record<string, number> = {};

	return text.split('\n').map((line) => {
		const trimmed = line.trim();
		if (!trimmed) return { type: 'empty' as const };

		// 1. DIRECTIVES
		const dirMatch = trimmed.match(/^\{(.*?)(?::\s*(.*?))?\}$/);
		if (dirMatch) {
			const tag = dirMatch[1].toLowerCase();
			const value = dirMatch[2] || '';

			if (['soc', 'start_of_chorus', 'chorus'].includes(tag))
				return { type: 'section' as const, content: smartLabel('Chorus', counters) };
			if (['sov', 'start_of_verse'].includes(tag))
				return { type: 'section' as const, content: smartLabel('Verse', counters) };
			if (
				[
					'eoc',
					'end_of_chorus',
					'eov',
					'end_of_verse',
					'flow',
					'order',
					'copyright',
					'time',
					'time_signature'
				].includes(tag)
			)
				return { type: 'empty' as const };

			if (SECTION_KEYWORDS.test(dirMatch[1])) {
				return {
					type: 'section' as const,
					content: smartLabel(dirMatch[1] + (value ? ' ' + value : ''), counters)
				};
			}

			if (['c', 'comment', 'cb'].includes(tag)) return { type: 'comment' as const, content: value };

			return { type: 'directive' as const, label: tag, value: value };
		}

		// 2. HEADERS [Verse]
		const bracketMatch = trimmed.match(/^\[([^\]]+)\]\s*$/);
		if (bracketMatch && SECTION_KEYWORDS.test(bracketMatch[1])) {
			return { type: 'section' as const, content: smartLabel(bracketMatch[1], counters) };
		}

		// 3. LYRICS/CHORDS
		const rawChunks = line.split('[');
		const pairs: ChordPair[] = [];
		rawChunks.forEach((chunk, index) => {
			if (index === 0) {
				if (chunk) pairs.push({ chord: null, lyric: chunk });
			} else {
				const parts = chunk.split(']');
				if (parts.length === 2) {
					const rawChord = parts[0];
					const lyric = parts[1];
					let finalChord = rawChord;

					if (semitones !== 0) finalChord = transposeChord(rawChord, semitones);
					if (currentNotation === 'numbers') finalChord = noteToNumber(finalChord, targetKey);

					pairs.push({ chord: finalChord, lyric: lyric });
				} else {
					pairs.push({ chord: null, lyric: '[' + chunk });
				}
			}
		});
		return { type: 'lyric' as const, pairs };
	});
}

// ─── Pagination ──────────────────────────────────────────────────────

/** Group flat parsed lines into segments split at section headers. */
export function groupIntoSegments(lines: ParsedLine[]): Segment[] {
	const segments: Segment[] = [];
	let current: Segment = { label: null, lines: [] };

	for (const line of lines) {
		if (line.type === 'section') {
			if (current.lines.length > 0) segments.push(current);
			current = { label: (line as { content: string }).content, lines: [line] };
		} else {
			current.lines.push(line);
		}
	}
	if (current.lines.length > 0) segments.push(current);
	return segments;
}

/** Estimate the rendered pixel height of a single parsed line. */
export function estimateHeight(line: ParsedLine, chordsVisible: boolean): number {
	if (line.type === 'section') return 30;
	if (line.type === 'empty') return 12;

	const hasChords = line.type === 'lyric' && line.pairs?.some((p) => p.chord?.trim());

	// Compact spacing: 38px for chords+lyrics, 20px for lyrics only
	if (chordsVisible && hasChords) return 38;
	return 20;
}

/** Total estimated pixel height of a segment. */
export function segmentHeight(segment: Segment, chordsVisible: boolean): number {
	return segment.lines.reduce((sum, l) => sum + estimateHeight(l, chordsVisible), 0);
}

/**
 * Distribute segments across pages based on estimated heights.
 * Used for on-screen pagination (print uses CSS page breaks instead).
 */
export function paginateSegments(
	segments: Segment[],
	chordsVisible: boolean,
	cols: number
): Segment[][] {
	const PAGE1_BUDGET = 640;
	const PAGEN_BUDGET = 850;
	const multiplier = cols === 2 ? 2 : 1;

	const pages: Segment[][] = [];
	let currentPage: Segment[] = [];
	let usedHeight = 0;
	let budget = PAGE1_BUDGET * multiplier;

	for (const seg of segments) {
		const h = segmentHeight(seg, chordsVisible);

		if (currentPage.length > 0 && usedHeight + h > budget) {
			pages.push(currentPage);
			currentPage = [seg];
			usedHeight = h;
			budget = PAGEN_BUDGET * multiplier;
		} else {
			currentPage.push(seg);
			usedHeight += h;
		}
	}

	if (currentPage.length > 0) pages.push(currentPage);
	return pages.length > 0 ? pages : [[]];
}
