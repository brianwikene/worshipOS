// /ui/src/lib/server/songs/parser.test.ts
import { describe, expect, it } from 'vitest';
import { detectSourceFormat, parseSongText } from './parser';

describe('song parser', () => {
	it('detects chordpro format when chord markers exist', () => {
		const format = detectSourceFormat('[C]You are here');
		expect(format).toBe('chordpro');
	});

	it('parses chordpro lines with chord placement', () => {
		const result = parseSongText('[C]You are [G/B]here', { formatHint: 'chordpro' });
		expect(result.format).toBe('chordpro');
		expect(result.sections).toHaveLength(1);
		const [firstLine] = result.sections[0].lines;
		expect(firstLine.lyrics).toBe('You are here');
		expect(firstLine.chords).toEqual([
			{ chord: 'C', position: 0 },
			{ chord: 'G/B', position: 'You are '.length }
		]);
	});

	it('splits sections based on headings', () => {
		const text = `Verse 1
Line one

Chorus
Line two`;
		const result = parseSongText(text, { formatHint: 'plain_text' });
		expect(result.sections).toHaveLength(2);
		expect(result.sections[0].label).toBe('Verse 1');
		expect(result.sections[1].label).toBe('Chorus');
	});

	it('warns when no lyrics provided', () => {
		const result = parseSongText('', { formatHint: 'plain_text' });
		expect(result.sections).toHaveLength(1);
		expect(result.warnings.some((w) => w.includes('No lyrics'))).toBe(true);
	});

	it('treats ChordPro comment headings (# Verse) as section boundaries', () => {
		const text = `{title: Test Song}
# Verse
Hello world

# Chorus
[C]Sing it out`;
		const result = parseSongText(text, { formatHint: 'chordpro' });

		expect(result.format).toBe('chordpro');
		expect(result.sections).toHaveLength(2);
		expect(result.sections[0].label).toBe('Verse');
		expect(result.sections[1].label).toBe('Chorus');

		// Ensure the chorded line got parsed and chords were extracted
		const chorusFirstLine = result.sections[1].lines[0];
		expect(chorusFirstLine.lyrics).toBe('Sing it out');
		expect(chorusFirstLine.chords).toEqual([{ chord: 'C', position: 0 }]);
	});

	it('handles ChordPro section directives (soc/eoc) and skips directives as content', () => {
		const text = `{soc}
[C]This is the chorus
{eoc}

Verse
Just lyrics`;
		const result = parseSongText(text, { formatHint: 'chordpro' });

		expect(result.format).toBe('chordpro');
		expect(result.sections).toHaveLength(2);

		// From {soc} ... {eoc}
		expect(result.sections[0].label).toBe('Chorus');
		expect(result.sections[0].lines[0].lyrics).toBe('This is the chorus');

		// Heading-based split after directives
		expect(result.sections[1].label).toBe('Verse');
		expect(result.sections[1].lines.some((l) => l.lyrics.includes('{soc}'))).toBe(false);
		expect(result.sections[1].lines.some((l) => l.lyrics.includes('{eoc}'))).toBe(false);
	});

	it('warns when ChordPro is detected but no chord markers exist', () => {
		// ChordPro is implied by directives, but there are no [C] style chords anywhere.
		const text = `{title: No Chords Here}
Verse
Hello world`;
		const result = parseSongText(text); // let detection happen

		expect(result.format).toBe('chordpro');
		expect(result.warnings.some((w) => w.includes('Detected ChordPro but no chord markers'))).toBe(true);
	});

	it('falls back to a single section when only directives/comments exist', () => {
		// Non-empty input, but the parser will skip directives/comments as meaningful lines,
		// triggering the "No content lines were parsed" fallback.
		const text = `{title: Metadata Only}
{comment: just a comment}
# another comment`;
		const result = parseSongText(text); // let detection happen

		expect(result.format).toBe('chordpro');
		expect(result.sections).toHaveLength(1);

		expect(result.warnings.some((w) => w.includes('No content lines were parsed'))).toBe(true);
		expect(result.warnings.some((w) => w.includes('No lyrics provided'))).toBe(true);
	});
});
