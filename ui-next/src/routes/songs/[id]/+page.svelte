<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import AuthorInput from '$lib/components/AuthorInput.svelte';
	import { ArrowLeft, CircleHelp, Copy, Eye, Pencil, Save, Trash2, X } from '@lucide/svelte';

	// --- CONSTANTS ---
	const SECTION_KEYWORDS =
		/^(Verse|Chorus|Bridge|Pre-Chorus|PreChorus|Intro|Outro|Tag|Interlude|Instrumental|Hook|Ending|V\d|C\d|B\d)/i;

	const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

	// --- TYPES ---
	type Arrangement = {
		id: string;
		name: string;
		key: string | null;
		bpm: string | null;
		content: string | null;
	};

	type AuthorRelation = {
		sequence: number | null;
		author: { id: string; name: string };
	};

	type SongWithRelations = typeof data.song & {
		arrangements: Arrangement[];
		authors: AuthorRelation[];
	};

	// --- PROPS ---
	let { data } = $props();

	// --- STATE ---
	// svelte-ignore state_referenced_locally
	let song = $state(data.song as SongWithRelations);

	// UI State
	let isEditing = $state(false);
	let showHelp = $state(false);
	let isSaveVersionOpen = $state(false);
	let loading = $state(false);

	// View Preferences
	// svelte-ignore state_referenced_locally
	let selectedKey = $state(song.original_key || 'C');
	let notation = $state<'chords' | 'numbers'>('chords');
	let showChords = $state(true);
	let columnCount = $state(1);
	let showSongMap = $state(true);

	// Editing State
	let currentArrangementId = $state<string | null>(null);

	// svelte-ignore state_referenced_locally
	let localAuthors = $state(
		(song.authors || [])
			.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
			.map((rel) => ({ id: rel.author.id, name: rel.author.name }))
	);

	// --- SYNC EFFECT ---
	$effect(() => {
		song = data.song as SongWithRelations;
		localAuthors = (data.song.authors || [])
			.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
			.map((rel) => ({ id: rel.author.id, name: rel.author.name }));
	});

	// --- DERIVED VALUES ---
	let currentArrangement = $derived(
		currentArrangementId ? song.arrangements.find((a) => a.id === currentArrangementId) : null
	);

	let displayKey = $derived(currentArrangement?.key || song.original_key || 'C');

	// Sync dropdown when arrangement changes
	$effect(() => {
		if (currentArrangement?.key) {
			selectedKey = currentArrangement.key;
		} else {
			selectedKey = song.original_key || 'C';
		}
	});

	let displayTempo = $derived(currentArrangement?.bpm || song.tempo);

	let displayAuthors = $derived(
		song.authors && song.authors.length > 0
			? song.authors.map((rel) => rel.author.name).join(', ')
			: song.authors || 'Unknown Author'
	);

	let displayContent = $derived(currentArrangement?.content || song.content);
	let displayNotes = $derived(song.performance_notes);

	// Derived Parsing
	let songMap = $derived(generateSongMap(displayContent));
	let parsedLines = $derived(parseChart(displayContent, selectedKey, notation));

	// --- HELPERS ---

	function normalizeKey(k: string) {
		return k.replace('♯', '#').replace('♭', 'b');
	}

	function getSemitoneShift(original: string, target: string) {
		const idx1 = KEYS.indexOf(normalizeKey(original));
		const idx2 = KEYS.indexOf(normalizeKey(target));
		if (idx1 === -1 || idx2 === -1) return 0;
		return idx2 - idx1;
	}

	function transposeChord(chord: string, semitones: number) {
		const match = chord.match(/^([A-G][#b]?)(.*)$/);
		if (!match) return chord;

		const root = normalizeKey(match[1]);
		const quality = match[2];
		const rootIndex = KEYS.indexOf(root);

		if (rootIndex === -1) return chord;

		let newIndex = (rootIndex + semitones) % 12;
		if (newIndex < 0) newIndex += 12;

		return KEYS[newIndex] + quality;
	}

	function noteToNumber(chord: string, key: string) {
		const match = chord.match(/^([A-G][#b]?)(.*)$/);
		if (!match) return chord;

		const root = normalizeKey(match[1]);
		const quality = match[2];

		const keyIndex = KEYS.indexOf(normalizeKey(key));
		const rootIndex = KEYS.indexOf(root);
		if (keyIndex === -1 || rootIndex === -1) return chord;

		let interval = (rootIndex - keyIndex + 12) % 12;
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
		return (degrees[interval] || '?') + quality;
	}

	// --- SMART LABELING (Verse -> Verse 1) ---
	function smartLabel(raw: string, counters: Record<string, number>) {
		let label = raw.trim();
		const lower = label.toLowerCase();

		// 1. If it already has a number ("Verse 2", "V3"), keep it.
		if (/\d/.test(label)) return label;

		// 2. Normalize common types for counting
		let type = '';
		if (lower.startsWith('verse') || lower.startsWith('v')) type = 'Verse';
		else if (lower.startsWith('chorus') || lower.startsWith('c')) type = 'Chorus';
		else if (lower.startsWith('bridge') || lower.startsWith('b')) type = 'Bridge';

		// 3. Auto-increment
		if (type) {
			counters[type] = (counters[type] || 0) + 1;
			// Only append number for Verses by default
			if (type === 'Verse') return `${type} ${counters[type]}`;
		}

		return label;
	}

	// --- PARSERS ---

	function generateSongMap(content: string | null) {
		if (!content) return [];

		// 1. Check for explicit Manual Flow
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
			const bracketMatch = trim.match(/^\[([^\[\]]+)\]\s*$/);
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

	function parseChart(
		text: string | null,
		targetKey: string,
		currentNotation: 'chords' | 'numbers'
	) {
		if (!text) return [];
		const original = displayKey || 'C';
		const semitones = getSemitoneShift(original, targetKey);
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
				if (['eoc', 'end_of_chorus', 'eov', 'end_of_verse', 'flow', 'order'].includes(tag))
					return { type: 'empty' as const };

				if (SECTION_KEYWORDS.test(dirMatch[1])) {
					return {
						type: 'section' as const,
						content: smartLabel(dirMatch[1] + (value ? ' ' + value : ''), counters)
					};
				}

				if (['c', 'comment', 'cb'].includes(tag))
					return { type: 'comment' as const, content: value };

				return { type: 'directive' as const, label: tag, value: value };
			}

			// 2. HEADERS [Verse]
			const bracketMatch = trimmed.match(/^\[([^\[\]]+)\]\s*$/);
			if (bracketMatch && SECTION_KEYWORDS.test(bracketMatch[1])) {
				return { type: 'section' as const, content: smartLabel(bracketMatch[1], counters) };
			}

			// 3. LYRICS/CHORDS
			const rawChunks = line.split('[');
			const pairs: { chord: string | null; lyric: string }[] = [];
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

	// --- ACTIONS ---
	// (Your save logic usually lives here, but it's handled by form actions in SvelteKit usually)
	// We'll keep the simple 'saveChanges' function stub if you had one, or rely on the form action.
	function saveChanges() {
		loading = true;
		// The form submission is handled by the browser's default <form> action or use:enhance
		// This is just a UI toggle state if you need it.
		// If you are using the hidden form approach, you might need to submit it manually here:
		// document.getElementById('editForm')?.requestSubmit();
	}
</script>

<div class="min-h-screen bg-stone-50 pb-20 print:bg-white print:pb-0">
	<div class="sticky top-0 z-10 border-b border-stone-200 bg-white shadow-sm print:hidden">
		<div class="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-4">
					<a href="/songs" class="text-stone-400 transition-colors hover:text-slate-900">
						<ArrowLeft size={20} />
					</a>
					<div>
						<h1 class="text-xl font-bold text-slate-900">
							{song.title}
							{#if currentArrangement}
								<span class="text-base font-normal text-stone-400">
									/ {currentArrangement.name}</span
								>
							{/if}
						</h1>
					</div>
				</div>

				<div class="flex gap-2">
					<button
						type="button"
						onclick={() => (isSaveVersionOpen = true)}
						class="flex items-center gap-2 rounded-md border border-dashed border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-500 hover:bg-stone-50"
					>
						<Copy size={14} /> Save Version
					</button>

					<button
						type="button"
						onclick={() => (isEditing = !isEditing)}
						class="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
					>
						{#if isEditing}
							<Eye size={14} /> View
						{:else}
							<Pencil size={14} /> Edit
						{/if}
					</button>

					{#if isEditing}
						<button
							type="button"
							onclick={() => (showHelp = true)}
							class="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
						>
							<CircleHelp size={14} /> Syntax
						</button>

						<button
							form="editForm"
							disabled={loading}
							class="flex items-center gap-2 rounded-md bg-slate-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
						>
							<Save size={14} /> Save
						</button>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 print:max-w-none print:p-0">
		<div class="mb-6 flex gap-2 overflow-x-auto pb-2 print:hidden">
			<button
				type="button"
				onclick={() => (currentArrangementId = null)}
				class={`rounded-full border px-3 py-1.5 text-xs font-bold ${currentArrangementId === null ? 'border-slate-800 bg-slate-800 text-white' : 'border-stone-200 bg-white text-stone-500'}`}
				>Master Chart</button
			>
			{#if song.arrangements}
				{#each song.arrangements as version}
					<button
						type="button"
						onclick={() => (currentArrangementId = version.id)}
						class={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${currentArrangementId === version.id ? 'border-slate-800 bg-slate-800 text-white' : 'border-stone-200 bg-white text-stone-500'}`}
						>{version.name}</button
					>
				{/each}
			{/if}
		</div>

		{#if isEditing}
			<form
				id="editForm"
				method="POST"
				action={currentArrangement ? '?/updateArrangement' : '?/updateSong'}
				use:enhance={() => {
					loading = true;
					return async ({ update, result }) => {
						await update();
						loading = false;
						if (result.type === 'success') isEditing = false;
					};
				}}
				class="grid grid-cols-1 gap-8 lg:grid-cols-3"
			>
				{#if currentArrangement}
					<input type="hidden" name="arrangement_id" value={currentArrangement.id} />
				{/if}
				<div class="space-y-6">
					<div class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
						<h3 class="mb-4 text-xs font-bold tracking-wide text-stone-400 uppercase">
							{currentArrangement ? 'Version Details' : 'Song Details'}
						</h3>
						<div class="space-y-4">
							{#if !currentArrangement}
								<div>
									<label for="title" class="block text-xs font-medium text-slate-700">Title</label
									><input
										type="text"
										id="title"
										name="title"
										bind:value={song.title}
										class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
									/>
								</div>
								<div>
									<span class="mb-1 block text-xs font-medium text-slate-700">Author(s)</span>
									<AuthorInput bind:selectedAuthors={localAuthors} />
									<p class="mt-1 text-[10px] text-stone-400">
										Type to search. Enter to create. Order matters.
									</p>
								</div>
								<div class="grid grid-cols-2 gap-4">
									<div>
										<label for="key" class="block text-xs font-medium text-slate-700">Key</label
										><select
											name="key"
											id="key"
											bind:value={song.original_key}
											class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
											>{#each KEYS as k}<option value={k}>{k}</option>{/each}</select
										>
									</div>
									<div>
										<label for="tempo" class="block text-xs font-medium text-slate-700"
											>Tempo (BPM)</label
										><input
											type="text"
											id="tempo"
											name="tempo"
											bind:value={song.tempo}
											class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
										/>
									</div>
								</div>
								<div>
									<label for="performance_notes" class="block text-xs font-medium text-slate-700"
										>Performance Notes</label
									><input
										type="text"
										id="performance_notes"
										name="performance_notes"
										bind:value={song.performance_notes}
										placeholder="e.g. Light swing, building..."
										class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
									/>
								</div>
								<div>
									<label for="ccli" class="block text-xs font-medium text-slate-700">CCLI #</label
									><input
										type="text"
										id="ccli"
										name="ccli"
										bind:value={song.ccli_number}
										class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
									/>
								</div>
							{:else}
								<div>
									<label for="version_name_edit" class="block text-xs font-medium text-slate-700"
										>Version Name</label
									><input
										type="text"
										id="version_name_edit"
										name="name"
										bind:value={currentArrangement.name}
										class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
									/>
								</div>

								<div class="mt-6 border-t border-stone-100 pt-4">
									<button
										type="submit"
										formaction="?/deleteArrangement"
										onclick={(e) => {
											if (
												!confirm(
													'Are you sure you want to delete this version? This cannot be undone.'
												)
											) {
												e.preventDefault();
											}
										}}
										class="flex w-full items-center justify-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
									>
										<Trash2 size={14} /> Delete Version
									</button>
								</div>
							{/if}
						</div>
					</div>
				</div>
				<div class="lg:col-span-2">
					<div
						class="flex h-[600px] flex-col rounded-xl border border-stone-200 bg-white shadow-sm"
					>
						<textarea
							name="content"
							value={displayContent}
							class="w-full flex-1 resize-none border-0 p-6 font-mono text-sm leading-loose focus:ring-0"
						></textarea>
					</div>
				</div>
			</form>
		{:else}
			<div class="grid grid-cols-1 gap-8 lg:grid-cols-3 print:block">
				<div class="space-y-6 print:hidden">
					<div class="rounded-xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
						<div class="mb-6 space-y-4">
							<div class="grid grid-cols-2 gap-2">
								<div>
									<label
										for="transpose"
										class="mb-1 block text-xs font-bold text-stone-400 uppercase">Key</label
									>
									<select
										id="transpose"
										bind:value={selectedKey}
										class="block w-full rounded-md border-stone-200 text-sm font-bold text-slate-900 focus:border-slate-500 focus:ring-slate-500"
									>
										{#each KEYS as k}
											<option value={k}>{k}</option>
										{/each}
									</select>
								</div>
								<div>
									<label
										for="notation"
										class="mb-1 block text-xs font-bold text-stone-400 uppercase">Notation</label
									>
									<div class="flex rounded-md shadow-sm" role="group" aria-label="Notation style">
										<button
											type="button"
											onclick={() => (notation = 'chords')}
											class={`flex-1 rounded-l-md border px-2 py-2 text-xs font-bold ${notation === 'chords' ? 'border-slate-900 bg-slate-900 text-white' : 'border-stone-200 bg-white text-stone-500'}`}
										>
											A
										</button>
										<button
											type="button"
											onclick={() => (notation = 'numbers')}
											class={`flex-1 rounded-r-md border px-2 py-2 text-xs font-bold ${notation === 'numbers' ? 'border-slate-900 bg-slate-900 text-white' : 'border-stone-200 bg-white text-stone-500'}`}
										>
											1
										</button>
									</div>
								</div>
							</div>

							<div>
								<span class="mb-2 block text-xs font-bold text-stone-400 uppercase"
									>View Options</span
								>
								<div class="flex flex-col gap-2">
									<div class="flex gap-2">
										<button
											type="button"
											onclick={() => (columnCount = 1)}
											class={`flex-1 rounded border py-1.5 text-xs font-bold ${columnCount === 1 ? 'border-blue-500 bg-white text-blue-700 shadow-sm' : 'border-transparent bg-stone-100 text-stone-500'}`}
											>1 Col</button
										>
										<button
											type="button"
											onclick={() => (columnCount = 2)}
											class={`flex-1 rounded border py-1.5 text-xs font-bold ${columnCount === 2 ? 'border-blue-500 bg-white text-blue-700 shadow-sm' : 'border-transparent bg-stone-100 text-stone-500'}`}
											>2 Cols</button
										>
									</div>

									<button
										type="button"
										onclick={() => (showChords = !showChords)}
										class={`flex w-full items-center justify-center gap-2 rounded border py-1.5 text-xs font-bold ${!showChords ? 'border-purple-200 bg-purple-50 text-purple-700' : 'border-stone-200 bg-white text-stone-500'}`}
									>
										{#if !showChords}
											<span>🎤 Lyrics Only Mode</span>
										{:else}
											<span>Showing Chords</span>
										{/if}
									</button>
								</div>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-y-4 border-t border-blue-100 pt-4 text-sm">
							<div>
								<span class="block text-xs font-bold text-stone-400 uppercase">Original</span>
								<span class="font-bold text-slate-800">{displayKey || '-'}</span>
							</div>
							<div>
								<span class="block text-xs font-bold text-stone-400 uppercase">BPM</span>
								<span class="font-bold text-slate-800">{displayTempo || '-'}</span>
							</div>
							<div>
								<span class="block text-xs font-bold text-stone-400 uppercase">Time</span>
								<span class="font-bold text-slate-800">{song.time_signature || '4/4'}</span>
							</div>
							<div>
								<span class="block text-xs font-bold text-stone-400 uppercase">CCLI</span>
								<span class="font-mono text-xs text-slate-600">{song.ccli_number || '-'}</span>
							</div>
						</div>
					</div>
				</div>

				<div class="lg:col-span-2">
					<div
						class="relative flex min-h-[1056px] flex-col rounded-xl border border-stone-200 bg-white px-12 py-10 shadow-sm print:min-h-[100vh] print:border-0 print:p-0 print:shadow-none"
					>
						<div
							class="absolute top-6 right-8 rounded border border-stone-200 px-2 py-0.5 text-xs font-bold text-stone-300 print:border-stone-400 print:text-stone-500"
						>
							1 / 1
						</div>

						<div class="mb-6 border-b-2 border-slate-900 pb-4">
							<div class="flex items-start justify-between">
								<h1 class="mb-1 text-3xl font-bold tracking-tight text-slate-900 uppercase">
									{song.title}
								</h1>
							</div>
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-center gap-6">
									<div class="font-medium text-slate-600">{displayAuthors}</div>
								</div>
								<div class="flex items-center gap-4 font-bold text-slate-900">
									<div class="flex items-center gap-1">
										<span class="text-xs font-normal text-stone-400 uppercase">Key</span>
										{selectedKey}
									</div>
									{#if displayTempo}
										<div class="flex items-center gap-1">
											<span class="text-xs font-normal text-stone-400 uppercase">BPM</span>
											{displayTempo}
										</div>
									{/if}
									<div class="flex items-center gap-1">
										<span class="text-xs font-normal text-stone-400 uppercase">Time</span>
										{song.time_signature || '4/4'}
									</div>
								</div>
							</div>

							{#if showSongMap && songMap.length > 0}
								<div class="mt-4 flex flex-wrap items-center gap-1">
									<span class="mr-1 text-[10px] font-bold text-stone-400 uppercase">Map:</span>
									{#each songMap as section, i}
										<span
											class="rounded-sm border border-stone-200 bg-stone-100 px-1.5 py-0.5 text-xs font-bold text-slate-700"
										>
											{section.replace(/\d/g, '')}
										</span>
										{#if i < songMap.length - 1}
											<span class="text-stone-300">→</span>
										{/if}
									{/each}
								</div>
							{/if}

							{#if displayNotes}
								<div
									class="mt-3 rounded border-l-4 border-stone-300 bg-stone-50 p-2 text-sm text-slate-600 italic"
								>
									Note: {displayNotes}
								</div>
							{/if}
						</div>

						<div class={`flex-grow ${columnCount === 2 ? 'columns-1 gap-12 md:columns-2' : ''}`}>
							{#if displayContent}
								{#each parsedLines as line}
									<div class="mb-2 break-inside-avoid">
										{#if line.type === 'section'}
											<h3
												class="mt-4 mb-2 inline-block rounded-sm bg-slate-900 px-2 py-0.5 text-sm font-bold tracking-wider text-white uppercase print:border print:border-slate-900 print:bg-transparent print:text-slate-900"
											>
												{line.content}
											</h3>
										{:else if line.type === 'comment'}
											<div
												class="my-2 inline-block rounded border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-800 italic print:border-stone-300 print:bg-transparent print:text-stone-600 print:italic"
											>
												{line.content}
											</div>
										{:else if line.type === 'directive'}
											<div class="my-2 flex items-center gap-2 font-sans text-sm">
												<span
													class="rounded border border-stone-200 bg-stone-100 px-2 py-0.5 text-xs font-bold tracking-wide text-stone-500 uppercase"
												>
													{line.label}
												</span>
												<span class="font-bold text-slate-900">{line.value}</span>
											</div>
										{:else if line.type === 'empty'}
											<div class="h-4"></div>
										{:else if line.pairs}
											<div class="mb-1 flex flex-wrap items-end gap-0.5">
												{#each line.pairs as pair}
													<div class="flex flex-col">
														{#if showChords}
															<div
																class="h-5 font-mono text-sm leading-none font-bold text-slate-900 select-none print:text-black"
															>
																{pair.chord || '\u00A0'}
															</div>
														{/if}
														<div
															class="font-sans text-base leading-normal font-medium whitespace-pre text-slate-800 print:text-black"
														>
															{pair.lyric}
														</div>
													</div>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							{:else}
								<div class="flex h-64 flex-col items-center justify-center text-stone-400">
									<p>No chart content.</p>
								</div>
							{/if}
						</div>

						<div
							class="mt-8 flex items-end justify-between border-t border-stone-200 pt-4 text-[10px] text-stone-400 print:text-stone-500"
						>
							<div>
								<p>
									© {song.authors || 'Copyright Holder'}. {#if song.ccli_number}CCLI #{song.ccli_number}{/if}.
								</p>
								<p class="mt-0.5">
									Generated by WorshipOS for <span class="font-bold text-stone-600"
										>{$page.data.church?.name || 'Your Church'}</span
									>.
								</p>
							</div>
							<div class="text-right">
								<p>
									Last Updated:
									{new Date(song.updated_at || song.created_at || new Date()).toLocaleDateString(
										'en-US',
										{
											year: 'numeric',
											month: 'short',
											day: 'numeric'
										}
									)}
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

{#if isSaveVersionOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-slate-900/40 backdrop-blur-sm"
			onclick={() => (isSaveVersionOpen = false)}
			aria-label="Close save version modal"
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="save-version-title"
			class="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
		>
			<h3 id="save-version-title" class="mb-4 text-lg font-bold text-slate-900">
				Save New Version
			</h3>
			<form
				method="POST"
				action="?/createArrangement"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						isSaveVersionOpen = false;
					};
				}}
			>
				<div class="space-y-4">
					<div>
						<label for="version_name" class="mb-1 block text-xs font-bold text-stone-500 uppercase"
							>Version Name</label
						>
						<input
							type="text"
							id="version_name"
							name="version_name"
							placeholder="e.g. Jimmy's Key"
							required
							class="w-full rounded-md border-stone-300"
						/>
					</div>
					<input type="hidden" name="key" value={selectedKey} />
					<input type="hidden" name="content" value={displayContent || ''} />
					<button
						class="w-full rounded-md bg-slate-900 py-2 text-sm font-bold text-white hover:bg-slate-800"
						>Create Version</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
{#if showHelp}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
	>
		<div
			class="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl duration-200"
		>
			<div
				class="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-6 py-4"
			>
				<h3 class="flex items-center gap-2 text-lg font-bold text-slate-900">
					<CircleHelp size={20} class="text-blue-600" />
					Formatting Guide
				</h3>
				<button
					onclick={() => (showHelp = false)}
					class="text-stone-400 transition-colors hover:text-stone-600"
				>
					<X size={20} />
				</button>
			</div>

			<div class="max-h-[70vh] space-y-6 overflow-y-auto p-6">
				<div>
					<h4 class="mb-2 text-xs font-bold text-stone-400 uppercase">Sections</h4>
					<p class="mb-2 text-sm text-stone-600">Use square brackets to define song sections.</p>
					<div
						class="rounded-lg border border-stone-200 bg-stone-100 p-3 font-mono text-xs text-slate-700"
					>
						[Verse]<br />
						[Chorus]<br />
						[Bridge]<br />
						[Tag]
					</div>
				</div>

				<div>
					<h4 class="mb-2 text-xs font-bold text-stone-400 uppercase">Chords & Lyrics</h4>
					<p class="mb-2 text-sm text-stone-600">
						Place chords in brackets exactly where they change.
					</p>
					<div
						class="rounded-lg border border-stone-200 bg-stone-100 p-3 font-mono text-xs text-slate-700"
					>
						Amazing [C]grace how [F]sweet the [C]sound
					</div>
				</div>

				<div>
					<h4 class="mb-2 text-xs font-bold text-stone-400 uppercase">Notes & Comments</h4>
					<p class="mb-2 text-sm text-stone-600">
						Use curly braces for instructions or tempo notes.
					</p>
					<div
						class="rounded-lg border border-stone-200 bg-stone-100 p-3 font-mono text-xs text-slate-700"
					>
						&#123;c: Build Intensity&#125;<br />
						&#123;comment: Repeat 2x&#125;
					</div>
				</div>

				<div>
					<h4 class="mb-2 text-xs font-bold text-blue-600 uppercase">Advanced: Custom Map</h4>
					<p class="mb-2 text-sm text-stone-600">
						Define the song order manually to update the top navigation bar.
					</p>
					<div
						class="rounded-lg border border-blue-100 bg-blue-50 p-3 font-mono text-xs text-blue-900"
					>
						&#123;flow: Verse 1, Chorus, Verse 2, Chorus, Tag&#125;
					</div>
				</div>
			</div>

			<div class="border-t border-stone-200 bg-stone-50 px-6 py-4 text-right">
				<button
					onclick={() => (showHelp = false)}
					class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
				>
					Got it
				</button>
			</div>
		</div>
	</div>
{/if}
