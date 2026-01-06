import type {
	ParsedChordPlacement,
	ParsedLyricLine,
	ParsedSection,
	ParsedSectionKind,
	ParsedSong,
	SongSourceFormat
} from '$lib/songs/types';

export interface ParseSongOptions {
	formatHint?: SongSourceFormat;
}

interface Heading {
	label: string;
	type: ParsedSectionKind;
}

const CHORD_MARKER = /\[([A-G](?:#|b)?[^\]]*)\]|\{[cC]:([^}]+)\}/g;

const SECTION_PATTERNS: Array<{ type: ParsedSectionKind; match: RegExp }> = [
	{ type: 'verse', match: /^verse\b/i },
	{ type: 'chorus', match: /^chorus\b/i },
	{ type: 'bridge', match: /^bridge\b/i },
	{ type: 'tag', match: /^tag\b/i },
	{ type: 'intro', match: /^intro\b/i },
	{ type: 'outro', match: /^outro\b/i },
	{ type: 'pre_chorus', match: /^(pre[-\s]?chorus|prechorus)\b/i },
	{ type: 'section', match: /^section\b/i }
];

const CHORDPRO_SECTION_DIRECTIVES: Record<string, Heading> = {
	'{soc}': { label: 'Chorus', type: 'chorus' },
	'{start_of_chorus}': { label: 'Chorus', type: 'chorus' },
	'{sov}': { label: 'Verse', type: 'verse' },
	'{start_of_verse}': { label: 'Verse', type: 'verse' },
	'{sob}': { label: 'Bridge', type: 'bridge' },
	'{start_of_bridge}': { label: 'Bridge', type: 'bridge' },
	'{sot}': { label: 'Tag', type: 'tag' },
	'{start_of_tag}': { label: 'Tag', type: 'tag' },
	'{soi}': { label: 'Intro', type: 'intro' },
	'{start_of_intro}': { label: 'Intro', type: 'intro' }
};

const CHORDPRO_END_DIRECTIVES = new Set([
	'{eov}',
	'{end_of_verse}',
	'{eoc}',
	'{end_of_chorus}',
	'{eob}',
	'{end_of_bridge}',
	'{eot}',
	'{end_of_tag}',
	'{eoi}',
	'{end_of_intro}'
]);

export function detectSourceFormat(rawText: string): SongSourceFormat {
	return /\[[A-G](?:#|b)?[^\]]*\]/.test(rawText) || /\{[cC]:[^}]+\}/.test(rawText) ? 'chordpro' : 'plain_text';
}

export function parseSongText(
	rawText: string | null | undefined,
	options: ParseSongOptions = {}
): ParsedSong {
	const normalized = (rawText ?? '').replace(/\r\n/g, '\n');
	const trimmed = normalized.trim();
	const format = options.formatHint ?? detectSourceFormat(normalized);

	const warnings: string[] = [];
	const sections: ParsedSection[] = [];
	let currentSection = createSection('Section 1', 'section');
	sections.push(currentSection);

	let headingCount = 0;
	let chordTokenCount = 0;

	const lines = normalized.split('\n');
	for (const rawLine of lines) {
		const trimmedLine = rawLine.trim();
		if (format === 'chordpro') {
			const lower = trimmedLine.toLowerCase();
			if (CHORDPRO_END_DIRECTIVES.has(lower)) {
				continue;
			}
			if (CHORDPRO_SECTION_DIRECTIVES[lower]) {
				currentSection = beginSection(sections, currentSection, CHORDPRO_SECTION_DIRECTIVES[lower]);
				headingCount += 1;
				continue;
			}
			if (lower.startsWith('{') && lower.endsWith('}')) {
				// Non-structural directive - skip but don't warn
				continue;
			}
		}

		const heading = extractHeading(rawLine);
		if (heading) {
			currentSection = beginSection(sections, currentSection, heading);
			headingCount += 1;
			continue;
		}

		if (format === 'chordpro' && trimmedLine.startsWith('#')) {
			const headingFromComment = extractHeading(trimmedLine.replace(/^#+/, '').trim());
			if (headingFromComment) {
				currentSection = beginSection(sections, currentSection, headingFromComment);
				headingCount += 1;
				continue;
			}
			// Otherwise treat as comment and skip
			continue;
		}

		if (!trimmedLine && currentSection.lines.length === 0) {
			// Skip leading blank lines in a section
			continue;
		}

		const parsedLine =
			format === 'chordpro' ? parseChordProLine(rawLine) : ({ lyrics: rawLine, chords: [] } satisfies ParsedLyricLine);

		if (format === 'chordpro') {
			chordTokenCount += parsedLine.chords.length;
		}

		if (!parsedLine.lyrics && parsedLine.chords.length === 0 && !trimmedLine) {
			// preserve intentional spacing between sections
			if (currentSection.lines.length > 0) {
				currentSection.lines.push(parsedLine);
			}
		} else {
			currentSection.lines.push(parsedLine);
		}
	}

	const meaningfulSections = sections.filter((section) => section.lines.length > 0);
	if (meaningfulSections.length === 0) {
		if (trimmed.length === 0) {
			warnings.push('No lyrics were provided; saved an empty placeholder.');
			meaningfulSections.push({
				label: 'Section 1',
				type: 'section',
				lines: [{ lyrics: '', chords: [] }]
			});
		} else {
			warnings.push('Unable to detect sections; storing the entire song as a single section.');
			meaningfulSections.push({
				label: 'Section 1',
				type: 'section',
				lines: normalized.split('\n').map((line) => ({ lyrics: line, chords: [] }))
			});
		}
	} else if (headingCount === 0) {
		warnings.push('No section headings detected; everything is stored under "Section 1".');
	}

	if (format === 'chordpro' && trimmed && chordTokenCount === 0) {
		warnings.push('ChordPro format detected but no chord markers like [C] or {c:C} were found.');
	}

	return {
		format,
		sections: meaningfulSections,
		warnings,
		generated_at: new Date().toISOString()
	};
}

function parseChordProLine(line: string): ParsedLyricLine {
	const chords: ParsedChordPlacement[] = [];
	let lyrics = '';
	let cursor = 0;

	for (const match of line.matchAll(CHORD_MARKER)) {
		const matchIndex = match.index ?? 0;
		if (matchIndex > cursor) {
			lyrics += line.slice(cursor, matchIndex);
		}
		const chordText = (match[1] ?? match[2] ?? '').trim();
		chords.push({ position: lyrics.length, chord: chordText });
		cursor = matchIndex + match[0].length;
	}

	if (cursor < line.length) {
		lyrics += line.slice(cursor);
	}

	return { lyrics, chords };
}

function extractHeading(line: string): Heading | null {
	let candidate = line.trim();
	if (!candidate) return null;

	if (candidate.startsWith('[') && candidate.endsWith(']')) {
		candidate = candidate.slice(1, -1).trim();
	}

	candidate = candidate.replace(/[:.]+$/, '').trim();
	if (!candidate) return null;

	const lowered = candidate.toLowerCase();
	for (const pattern of SECTION_PATTERNS) {
		if (pattern.match.test(lowered)) {
			return {
				label: titleCase(candidate),
				type: pattern.type
			};
		}
	}

	return null;
}

function titleCase(input: string): string {
	return input
		.split(/\s+/)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(' ')
		.trim();
}

function createSection(label: string, type: ParsedSectionKind): ParsedSection {
	return { label, type, lines: [] };
}

function beginSection(
	sections: ParsedSection[],
	current: ParsedSection,
	heading: Heading
): ParsedSection {
	if (sections.length === 1 && current.lines.length === 0 && current.label === 'Section 1') {
		current.label = heading.label;
		current.type = heading.type;
		return current;
	}

	const next = createSection(heading.label, heading.type);
	sections.push(next);
	return next;
}
