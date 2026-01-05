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
});
