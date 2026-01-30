<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthorInput from '$lib/components/AuthorInput.svelte';
	import { ArrowLeft, Copy, Edit3, Eye, Save } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	// TYPES
	type Arrangement = {
		id: string;
		name: string;
		key: string | null;
		bpm: string | null;
		content: string | null;
	};

	type AuthorRelation = { author: { name: string } };
	type SongWithRelations = typeof data.song & {
		arrangements: Arrangement[];
		authors: AuthorRelation[];
	};

	// svelte-ignore state_referenced_locally
	let song = $state(data.song as SongWithRelations);

	$effect(() => {
		song = data.song as SongWithRelations;
	});

	let currentArrangementId = $state<string | null>(null);
	let currentArrangement = $derived(
		currentArrangementId
			? song.arrangements.find((a: Arrangement) => a.id === currentArrangementId)
			: null
	);

	// DYNAMIC DATA
	// Sort and join authors for the header
	let displayAuthors = $derived(
		song.authors && song.authors.length > 0
			? song.authors.map((a) => a.author.name).join(', ')
			: song.author || 'Unknown Author'
	);
	let displayTitle = $derived(
		currentArrangement ? `${song.title} (${currentArrangement.name})` : song.title
	);
	let displayContent = $derived(currentArrangement ? currentArrangement.content : song.content);
	let displayKey = $derived(currentArrangement ? currentArrangement.key : song.original_key);
	let displayTempo = $derived(currentArrangement ? currentArrangement.bpm : song.tempo);
	let displayNotes = $derived(song.performance_notes);

	// EDIT STATE
	// svelte-ignore state_referenced_locally
	let localAuthors = $state(
		((data.song as SongWithRelations).authors || [])
			.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
			.map((rel) => ({ id: rel.author.id, name: rel.author.name }))
	);

	// FIX: Sync BOTH song and authors when data changes (e.g. after save)
	$effect(() => {
		localAuthors = (song.authors || [])
			.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
			.map((rel) => ({ id: rel.author.id, name: rel.author.name }));
	});

	let isEditing = $state(false);
	let loading = $state(false);
	let isSaveVersionOpen = $state(false);

	// TRANSPOSITION LOGIC
	const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
	let selectedKey = $state('C');
	$effect(() => {
		selectedKey = displayKey || 'C';
	});

	function getSemitoneShift(original: string, target: string) {
		if (!original || !target) return 0;
		const oIndex = KEYS.indexOf(normalizeKey(original));
		const tIndex = KEYS.indexOf(normalizeKey(target));
		if (oIndex === -1 || tIndex === -1) return 0;
		return tIndex - oIndex;
	}
	function normalizeKey(k: string) {
		return k
			.replace('Db', 'C#')
			.replace('D#', 'Eb')
			.replace('Gb', 'F#')
			.replace('G#', 'Ab')
			.replace('A#', 'Bb');
	}
	function transposeChord(chord: string, semitones: number) {
		const match = chord.match(/^([A-G][#b]?)(.*)$/);
		if (!match) return chord;
		const root = normalizeKey(match[1]);
		const quality = match[2];
		const currentIndex = KEYS.indexOf(root);
		if (currentIndex === -1) return chord;
		let newIndex = (currentIndex + semitones) % 12;
		if (newIndex < 0) newIndex += 12;
		return KEYS[newIndex] + quality;
	}

	// --- UPDATED PARSER ---
	// Now handles directives like {cb:Capo 1}
	type ChartLine = {
		type: 'section' | 'lyric' | 'empty' | 'directive' | 'comment';
		content?: string;
		label?: string;
		value?: string;
		pairs?: { chord: string | null; lyric: string }[];
	};

	function parseChart(text: string | null, targetKey: string): ChartLine[] {
		if (!text) return [];
		const original = displayKey || 'C';
		const semitones = getSemitoneShift(original, targetKey);

		const SECTION_REGEX = /^(Verse|Chorus|Bridge|Pre-Chorus|Intro|Outro|V\d|C\d|B\d|Tag)/i;
		const DIRECTIVE_REGEX = /^\{(.*?)(?::\s*(.*?))?\}$/;

		return text.split('\n').map((line) => {
			const trimmed = line.trim();
			if (!trimmed) return { type: 'empty' };

			// 1. DIRECTIVES ({c:}, {cb:}, {capo:})
			const dirMatch = trimmed.match(DIRECTIVE_REGEX);
			if (dirMatch) {
				const label = dirMatch[1].toLowerCase();
				const value = dirMatch[2] || '';

				if (['c', 'comment', 'cb'].includes(label)) {
					return { type: 'comment', content: value };
				}
				return { type: 'directive', label: label, value: value };
			}

			// 2. SECTIONS ([Chorus])
			const bracketMatch = trimmed.match(/^\[(.*?)\]$/);
			if (bracketMatch && SECTION_REGEX.test(bracketMatch[1])) {
				return { type: 'section', content: bracketMatch[1] };
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
						const displayChord = semitones !== 0 ? transposeChord(rawChord, semitones) : rawChord;
						pairs.push({ chord: displayChord, lyric: lyric });
					} else {
						pairs.push({ chord: null, lyric: '[' + chunk });
					}
				}
			});
			return { type: 'lyric', pairs };
		});
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
						onclick={() => (isSaveVersionOpen = true)}
						class="flex items-center gap-2 rounded-md border border-dashed border-stone-300 px-3 py-1.5 text-xs font-bold text-stone-500 hover:bg-stone-50"
					>
						<Copy size={14} /> Save Version
					</button>
					<button
						onclick={() => (isEditing = !isEditing)}
						class="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
					>
						{#if isEditing}
							<Eye size={14} /> View
						{:else}
							<Edit3 size={14} /> Edit
						{/if}
					</button>
					{#if isEditing}
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
				onclick={() => (currentArrangementId = null)}
				class={`rounded-full border px-3 py-1.5 text-xs font-bold ${currentArrangementId === null ? 'border-slate-800 bg-slate-800 text-white' : 'border-stone-200 bg-white text-stone-500'}`}
				>Master Chart</button
			>
			{#if song.arrangements}
				{#each song.arrangements as version}
					<button
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
						<div class="mb-6 rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
							<label
								for="transpose-select"
								class="mb-1 block text-xs font-bold text-stone-400 uppercase">Current Key</label
							>
							<select
								id="transpose-select"
								bind:value={selectedKey}
								class="block w-full rounded-md border-stone-200 text-sm font-bold text-slate-900 focus:border-blue-500 focus:ring-blue-500"
								>{#each KEYS as k}<option value={k}>{k}</option>{/each}</select
							>
						</div>
					</div>
				</div>

				<div class="lg:col-span-2">
					<div
						class="relative min-h-[800px] rounded-xl border border-stone-200 bg-white px-12 py-10 font-mono leading-none shadow-sm print:border-0 print:p-0 print:shadow-none"
					>
						<div
							class="absolute top-6 right-8 font-mono text-xs text-stone-400 print:text-slate-500"
						>
							1 / 1
						</div>

						<div class="mb-8 border-b-2 border-slate-900 pb-4">
							<div class="flex items-start justify-between">
								<h1 class="mb-2 text-3xl font-bold tracking-tight text-slate-900 uppercase">
									{song.title}
								</h1>
							</div>
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-center gap-6">
									<div class="font-medium text-slate-600">{displayAuthors}</div>
									{#if song.ccli_number}
										<div class="text-xs text-stone-400">CCLI: {song.ccli_number}</div>
									{/if}
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
							{#if displayNotes}
								<div
									class="mt-3 rounded border-l-4 border-stone-300 bg-stone-50 p-2 text-sm text-slate-600 italic"
								>
									Note: {displayNotes}
								</div>
							{/if}
						</div>

						{#if displayContent}
							{#each parseChart(displayContent, selectedKey) as line}
								{#if line.type === 'section'}
									<h3
										class="mt-8 mb-4 inline-block rounded-sm bg-slate-900 px-2 py-0.5 text-sm font-bold tracking-wider text-white uppercase print:border print:border-slate-900 print:bg-transparent print:text-slate-900"
									>
										{line.content}
									</h3>
								{:else if line.type === 'comment'}
									<div
										class="my-3 inline-block rounded border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-800 italic print:border-stone-300 print:bg-stone-50 print:text-stone-800"
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
									<div class="h-6"></div>
								{:else if line.pairs}
									<div class="mb-2 flex break-inside-avoid flex-wrap items-end gap-0.5">
										{#each line.pairs as pair}
											<div class="flex flex-col">
												<div
													class="h-5 text-sm font-bold text-slate-900 select-none print:text-black"
												>
													{pair.chord || '\u00A0'}
												</div>
												<div class="text-base whitespace-pre text-slate-800 print:text-black">
													{pair.lyric}
												</div>
											</div>
										{/each}
									</div>
								{/if}
							{/each}
						{:else}
							<div class="flex h-64 flex-col items-center justify-center text-stone-400">
								<p>No chart content.</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

{#if isSaveVersionOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div
			class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
			onclick={() => (isSaveVersionOpen = false)}
			aria-hidden="true"
		></div>
		<div class="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
			<h3 class="mb-4 text-lg font-bold text-slate-900">Save New Version</h3>
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
