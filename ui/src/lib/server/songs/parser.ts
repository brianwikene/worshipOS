// /ui/src/lib/server/songs/parser.ts
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
  // 1) Strong signal: chord markers
  const hasChordMarkers =
    /\[[A-G](?:#|b)?[^\]]*\]/.test(rawText) || /\{[cC]:[^}]+\}/.test(rawText);
  if (hasChordMarkers) return 'chordpro';

  // 2) ChordPro directives (structural or metadata)
  // Examples: {title:...}, {t:...}, {subtitle:...}, {comment:...}, {soc}/{eoc}, {sov}/{eov}, etc.
  const hasChordProDirectives =
    /\{(title|t|subtitle|st|comment|c)\s*:[^}]*\}/i.test(rawText) ||
    /\{(soc|eoc|sov|eov|sob|eob|sot|eot|soi|eoi)\}/i.test(rawText) ||
    /\{(start_of_|end_of_)[a-z_]+\}/i.test(rawText);

  if (hasChordProDirectives) return 'chordpro';

  // 3) ChordPro-style comment headings: "# Verse", "# Chorus", etc.
  const hasChordProCommentHeadings =
    /(^|\n)\s*#+\s*(verse|chorus|bridge|tag|intro|outro|pre[-\s]?chorus|section)\b/i.test(rawText);

  if (hasChordProCommentHeadings) return 'chordpro';

  return 'plain_text';
}

export function parseSongText(input: string, options: ParseSongOptions = {}): ParsedSong {
	const normalized = normalizeInput(input);
	const trimmed = normalized.trim();

	const warnings: string[] = [];
	const format = options.formatHint ?? detectSourceFormat(normalized);
		// Empty input: store a minimal placeholder + warning
	if (trimmed.length === 0) {
		warnings.push('No lyrics provided; saved an empty placeholder.');

		return {
			format,
			sections: [
				{
					label: 'Section 1',
					type: 'section',
					lines: [{ lyrics: '', chords: [] }]
				}
			],
			warnings,
			generated_at: new Date().toISOString()
		};
	}

	const sections: ParsedSection[] = [createSection('Section 1', 'section')];
	let currentSection = sections[0];

	let headingCount = 0;
	let chordTokenCount = 0;

	// Counts only “real” content lines (lyrics and/or chords), not headings/directives/comments.
	let contentLineCount = 0;

	for (const rawLine of normalized.split('\n')) {
		const line = rawLine.trimEnd();

		// Plain text mode
		if (format === 'plain_text') {
			const heading = extractHeading(line);
			if (heading) {
				headingCount += 1;
				currentSection = beginSection(sections, currentSection, heading);
				continue;
			}

			// preserve blank lines (don’t count as content)
			if (line.trim().length === 0) {
				currentSection.lines.push({ lyrics: '', chords: [] });
				continue;
			}

			contentLineCount += 1;
			currentSection.lines.push({ lyrics: line, chords: [] });
			continue;
		}

		// ChordPro mode
// Handle ChordPro directives
const directive = line.trim().toLowerCase();
if (directive.startsWith('{') && directive.endsWith('}')) {
	// Section-start directives become section boundaries
	const start = CHORDPRO_SECTION_DIRECTIVES[directive];
	if (start) {
		headingCount += 1;
		currentSection = beginSection(sections, currentSection, start);
		continue;
	}

	// End directives are ignored (don’t become content)
	if (CHORDPRO_END_DIRECTIVES.has(directive)) {
		continue;
	}

	// Other directives (title/subtitle/comment/metadata) are ignored as content
	continue;
}


		// Treat ChordPro comment headings (# Verse) as section boundaries
		if (/^\s*#/.test(line)) {
			const comment = line.replace(/^\s*#\s*/, '').trim();
			const heading = extractHeading(comment);
			if (heading) {
				headingCount += 1;
				currentSection = beginSection(sections, currentSection, heading);
			}
			continue;
		}

		const heading = extractHeading(line);
		if (heading) {
			headingCount += 1;
			currentSection = beginSection(sections, currentSection, heading);
			continue;
		}

		// preserve blank lines (don’t count as content)
		if (line.trim().length === 0) {
			currentSection.lines.push({ lyrics: '', chords: [] });
			continue;
		}

		const parsed = parseChordProLine(line);
		chordTokenCount += parsed.chords.length;

		// Count only meaningful content
		if (parsed.chords.length > 0 || parsed.lyrics.trim().length > 0) {
			contentLineCount += 1;
		}

		currentSection.lines.push(parsed);
	}

	// Filter out totally empty sections
	const meaningfulSections = sections.filter((section) => section.lines.length > 0);

	// ✅ NEW: ChordPro input that contained ONLY directives/comments (no parseable content)
	if (format === 'chordpro' && trimmed.length > 0 && contentLineCount === 0) {
		warnings.push('No content lines were parsed; only ChordPro directives/comments were found.');
		warnings.push('No lyrics provided; saved an empty placeholder.');

		return {
			format,
			sections: [
				{
					label: 'Section 1',
					type: 'section',
					lines: [{ lyrics: '', chords: [] }]
				}
			],
			warnings,
			generated_at: new Date().toISOString()
		};
	}

	if (meaningfulSections.length === 0) {
		if (trimmed.length === 0) {
			warnings.push('No lyrics provided; saved an empty placeholder.');
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
				lines: normalized.split('\n').map((l) => ({ lyrics: l, chords: [] }))
			});
		}
	} else if (headingCount === 0) {
		warnings.push('No section headings detected; everything is stored under "Section 1".');
	}

	if (format === 'chordpro' && trimmed && chordTokenCount === 0) {
		warnings.push('Detected ChordPro but no chord markers like [C] or {c:C} were found.');
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
function normalizeInput(input: string): string {
	// normalize line endings + strip BOM if present
	return input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}
