export type SongSourceFormat = 'plain_text' | 'chordpro';

export type ParsedSectionKind =
	| 'verse'
	| 'chorus'
	| 'bridge'
	| 'tag'
	| 'intro'
	| 'outro'
	| 'pre_chorus'
	| 'section';

export interface ParsedChordPlacement {
	position: number;
	chord: string;
}

export interface ParsedLyricLine {
	lyrics: string;
	chords: ParsedChordPlacement[];
}

export interface ParsedSection {
	label: string;
	type: ParsedSectionKind;
	lines: ParsedLyricLine[];
}

export interface ParsedSong {
	format: SongSourceFormat;
	sections: ParsedSection[];
	warnings: string[];
	generated_at: string;
}
