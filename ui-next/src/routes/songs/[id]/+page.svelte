<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import AuthorInput from '$lib/components/AuthorInput.svelte';
	import {
		ArrowLeft,
		ChevronLeft,
		ChevronRight,
		CircleQuestionMark,
		Copy,
		ExternalLink,
		Eye,
		Pencil,
		Save,
		Trash2,
		X
	} from '@lucide/svelte';

	import {
		KEYS,
		generateSongMap,
		parseChart,
		groupIntoSegments,
		paginateSegments,
		type ParsedLine,
		type Segment
	} from '$lib/songs/parser';

	// --- TYPES ---
	type Arrangement = {
		id: string;
		arrangement_name: string | null;
		original_key: string | null;
		bpm: number | null;
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

	let displayKey = $derived(currentArrangement?.original_key || song.original_key || 'C');

	// Sync dropdown when arrangement changes
	$effect(() => {
		if (currentArrangement?.original_key) {
			selectedKey = currentArrangement.original_key;
		} else {
			selectedKey = song.original_key || 'C';
		}
	});

	let displayTempo = $derived(currentArrangement?.bpm || song.tempo);

	let displayAuthors = $derived(
		song.authors && song.authors.length > 0
			? song.authors.map((rel) => rel.author.name).join(', ')
			: 'Unknown Author'
	);

	let displayContent = $derived(currentArrangement?.content || song.content);
	let displayNotes = $derived(song.performance_notes);

	// Derived Parsing
	let songMap = $derived(generateSongMap(displayContent));
	let parsedLines = $derived(parseChart(displayContent, displayKey, selectedKey, notation));

	let currentPageIndex = $state(0);
	let parsedSegments = $derived(groupIntoSegments(parsedLines));
	let pages = $derived(paginateSegments(parsedSegments, showChords, columnCount));
	let totalPages = $derived(pages.length);

	// Reset page when content/view changes
	$effect(() => {
		// Access dependencies to track them
		pages;
		currentPageIndex = 0;
	});

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
									/ {currentArrangement.arrangement_name}</span
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
							<CircleQuestionMark size={14} /> Syntax
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
						>{version.arrangement_name}</button
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
									<input type="hidden" name="authors_json" value={JSON.stringify(localAuthors)} />
									<p class="mt-1 text-[10px] text-stone-400">
										Songwriters for copyright. Type to search. Enter to create.
									</p>
								</div>
								<div>
									<label for="artist" class="block text-xs font-medium text-slate-700"
										>Recording Artist</label
									>
									<input
										type="text"
										id="artist"
										name="artist"
										bind:value={song.artist}
										placeholder="e.g. Hillsong Worship"
										class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
									/>
									<p class="mt-1 text-[10px] text-stone-400">Reference recording (optional).</p>
								</div>
								<div class="grid grid-cols-3 gap-4">
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
									<div>
										<label for="time_signature" class="block text-xs font-medium text-slate-700"
											>Time Sig.</label
										>
										<select
											name="time_signature"
											id="time_signature"
											bind:value={song.time_signature}
											class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
										>
											<option value="4/4">4/4</option>
											<option value="3/4">3/4</option>
											<option value="6/8">6/8</option>
											<option value="2/4">2/4</option>
											<option value="9/8">9/8</option>
											<option value="12/8">12/8</option>
										</select>
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
								<div>
									<label for="copyright" class="block text-xs font-medium text-slate-700"
										>Copyright</label
									>
									<input
										type="text"
										id="copyright"
										name="copyright"
										bind:value={song.copyright}
										placeholder="e.g. © 1998 Vineyard Songs"
										class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
									/>
								</div>
								<div>
									<label for="youtube_url" class="block text-xs font-medium text-slate-700"
										>YouTube URL</label
									>
									<input
										type="url"
										id="youtube_url"
										name="youtube_url"
										bind:value={song.youtube_url}
										placeholder="https://youtube.com/watch?v=..."
										class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
									/>
								</div>
								<div>
									<label for="spotify_url" class="block text-xs font-medium text-slate-700"
										>Spotify URL</label
									>
									<input
										type="url"
										id="spotify_url"
										name="spotify_url"
										bind:value={song.spotify_url}
										placeholder="https://open.spotify.com/track/..."
										class="mt-1 block w-full rounded-md border-stone-300 text-sm shadow-sm"
									/>
								</div>
								<div class="mt-2 border-t border-stone-100 pt-4">
									<button
										type="submit"
										formaction="?/archiveSong"
										onclick={(e) => {
											if (!confirm('Archive this song? It can be restored later.')) {
												e.preventDefault();
											}
										}}
										class="flex w-full items-center justify-center gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
									>
										<Trash2 size={14} /> Archive Song
									</button>
								</div>
							{:else}
								<div>
									<label for="version_name_edit" class="block text-xs font-medium text-slate-700"
										>Version Name</label
									><input
										type="text"
										id="version_name_edit"
										name="name"
										bind:value={currentArrangement.arrangement_name}
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

						{#if song.youtube_url || song.spotify_url}
							<div class="mt-4 space-y-2 border-t border-blue-100 pt-4">
								<span class="block text-xs font-bold text-stone-400 uppercase">Links</span>
								{#if song.youtube_url}
									<a
										href={song.youtube_url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
									>
										<ExternalLink size={14} />
										YouTube
									</a>
								{/if}
								{#if song.spotify_url}
									<a
										href={song.spotify_url}
										target="_blank"
										rel="noopener noreferrer"
										class="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:border-green-200 hover:bg-green-50 hover:text-green-700"
									>
										<ExternalLink size={14} />
										Spotify
									</a>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<div class="lg:col-span-2">
					<div
						class="relative flex min-h-[1056px] flex-col rounded-xl border border-stone-200 bg-white px-12 py-10 shadow-sm print:hidden"
					>
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

						<div
							class={`song-content-columns flex-grow ${columnCount === 2 ? 'columns-1 gap-12 md:columns-2' : ''}`}
						>
							{#if displayContent}
								{#each pages[currentPageIndex] as segment}
									{#each segment.lines as line}
										<div class="lyric-line mb-2 break-inside-avoid">
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
												<div class="mt-3 mb-1 flex flex-wrap items-end gap-0.5">
													{#each line.pairs as pair}
														<div class="flex flex-col">
															{#if showChords}
																{@const hasChord = pair.chord && pair.chord.trim() !== ''}
																{#if hasChord}
																	<div class="h-5 font-mono text-sm font-bold text-black">
																		{pair.chord}
																	</div>
																{:else if line.pairs.some((p) => p.chord && p.chord.trim() !== '')}
																	<div class="h-5">&nbsp;</div>
																{/if}
															{/if}
															<div class="font-sans text-base">{pair.lyric}</div>
														</div>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								{/each}
							{:else}
								<div class="flex h-64 flex-col items-center justify-center text-stone-400">
									<p>No chart content.</p>
								</div>
							{/if}
						</div>

						{#if totalPages > 1}
							<div class="mt-6 flex items-center justify-center gap-4 print:hidden">
								<button
									type="button"
									disabled={currentPageIndex === 0}
									onclick={() => (currentPageIndex = Math.max(0, currentPageIndex - 1))}
									class="rounded-md border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50 disabled:opacity-30"
									aria-label="Previous page"
								>
									<ChevronLeft size={18} />
								</button>
								<span class="text-xs font-bold text-stone-500">
									Page {currentPageIndex + 1} of {totalPages}
								</span>
								<button
									type="button"
									disabled={currentPageIndex >= totalPages - 1}
									onclick={() =>
										(currentPageIndex = Math.min(totalPages - 1, currentPageIndex + 1))}
									class="rounded-md border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50 disabled:opacity-30"
									aria-label="Next page"
								>
									<ChevronRight size={18} />
								</button>
							</div>
						{/if}

						<div
							class="mt-8 flex items-end justify-between border-t border-stone-200 pt-4 text-[10px] text-stone-400 print:text-stone-500"
						>
							<div>
								<p>
									{#if song.copyright}{song.copyright}{:else}© {displayAuthors}{/if}. {#if song.ccli_number}CCLI
										#{song.ccli_number}{/if}.
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

					<!-- Print: single continuous flow – browser handles page breaks -->
					<div class="hidden print:block">
						{#each pages as pageSegments, pageIdx}
							<div
								class="relative flex min-h-[100vh] flex-col p-0"
								style={pageIdx > 0 ? 'page-break-before: always' : ''}
							>
								{#if pageIdx === 0}
									<div class="mb-6 border-b-2 border-slate-900 pb-4">
										<h1 class="mb-1 text-3xl font-bold tracking-tight text-slate-900 uppercase">
											{song.title}
										</h1>
										<div class="flex items-center justify-between text-sm">
											<div class="font-medium text-slate-600">{displayAuthors}</div>
											<div class="flex items-center gap-4 font-bold text-slate-900">
												<span class="text-xs font-normal text-stone-400 uppercase">Key</span>
												{selectedKey}
												{#if displayTempo}
													<span class="text-xs font-normal text-stone-400 uppercase">BPM</span>
													{displayTempo}
												{/if}
												<span class="text-xs font-normal text-stone-400 uppercase">Time</span>
												{song.time_signature || '4/4'}
											</div>
										</div>
									</div>
								{:else}
									<div
										class="mb-4 flex items-center justify-between border-b border-stone-300 pb-2"
									>
										<h2 class="text-sm font-bold text-slate-900 uppercase">
											{song.title} — Continued
										</h2>
										<div class="flex items-center gap-3 text-xs text-stone-500 italic">
											<span>{selectedKey}</span>
											<span>p. {pageIdx + 1} / {totalPages}</span>
										</div>
									</div>
								{/if}

								<div class="song-content-columns flex-grow">
									{#each pageSegments as segment}
										<section class="song-segment">
											{#if segment.label}
												<header class="section-header-compact">{segment.label}</header>
											{/if}

											{#each segment.lines as line}
												<div class="mb-1 flex flex-wrap items-end">
													{#if line.type === 'lyric' && line.pairs}
														{#each line.pairs as pair}
															<span class="chord-wrapper">
																{#if showChords}
																	{@const hasChord = pair.chord && pair.chord.trim() !== ''}
																	{#if hasChord}
																		<strong class="chord-top">{pair.chord}</strong>
																	{:else if line.pairs.some((p: { chord: string | null }) => p.chord?.trim())}
																		<span class="chord-spacer">&nbsp;</span>
																	{/if}
																{/if}
																<span class="lyric-text">{pair.lyric || '\u00A0'}</span>
															</span>
														{/each}
													{/if}
												</div>
											{/each}
										</section>
									{/each}
								</div>

								<div
									class="mt-auto flex items-end justify-between border-t border-stone-200 pt-4 text-[10px] text-stone-500"
								>
									<div>
										<p>
											{#if song.copyright}{song.copyright}{:else}© {displayAuthors}{/if}.
											{#if song.ccli_number}CCLI #{song.ccli_number}{/if}.
										</p>
										<p class="mt-0.5">
											Generated by WorshipOS for {$page.data.church?.name || 'Your Church'}.
										</p>
									</div>
									<div class="text-right">
										<p>{pageIdx + 1} / {totalPages}</p>
									</div>
								</div>
							</div>
						{/each}
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
					<CircleQuestionMark size={20} class="text-blue-600" />
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

<style>
	/* Base Container */
	.song-content-columns {
		width: 100%;
		line-height: 1.1;
		font-family:
			ui-sans-serif,
			system-ui,
			-apple-system,
			sans-serif;
	}

	/* Segment Wrapper: Prevent Verse/Chorus from splitting across pages */
	.song-segment {
		break-inside: avoid;
		page-break-inside: avoid;
		margin-bottom: 1.5rem;
		display: block;
	}

	/* Section Headers: Small, bold, and clean */
	.section-header-compact {
		font-size: 0.8rem;
		font-weight: 800;
		text-transform: uppercase;
		color: #64748b; /* Slate 500 */
		border-bottom: 1px solid #e2e8f0;
		margin-bottom: 0.5rem;
		padding-bottom: 2px;
		display: block;
	}

	/* The "Chord-on-top" wrapper */
	.chord-wrapper {
		display: inline-flex;
		flex-direction: column;
		vertical-align: bottom;
		margin-right: 0.15rem;
	}

	.chord-top {
		font-weight: 700;
		font-size: 0.9em;
		color: #1e293b;
		height: 1.1em; /* Tight vertical gap */
		line-height: 1;
		display: block;
	}

	.chord-spacer {
		height: 1.1em;
		display: block;
	}

	.lyric-text {
		font-size: 1.15rem;
		line-height: 1.2;
		white-space: pre; /* Keeps word spacing perfect */
	}

	@media print {
		@page {
			margin: 0.75in;
		}

		.lyric-text {
			font-size: 13pt;
		}
		.chord-top {
			font-size: 10pt;
		}

		/* Ensure we stay 1-column for MVP stability */
		.song-content-columns {
			column-count: 1 !important;
			display: block !important;
		}
	}
</style>
