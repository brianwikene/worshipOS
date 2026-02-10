<!-- src/routes/songs/[id]/+page.svelte -->
<script lang="ts">
	import '$lib/styles/song-print.css';
	import AuthorInput from '$lib/components/AuthorInput.svelte';
	import { ArrowLeft, Pencil, Save } from '@lucide/svelte';

	import {
		KEYS,
		generateSongMap,
		groupIntoSegments,
		paginateSegments,
		parseChart
	} from '$lib/songs/parser';

	// --- PROPS ---
	let { data } = $props();
	interface Author {
		id?: string;
		name: string;
	}

	// --- STATE ---
	// Use data.song directly instead of duplicating to local state
	let song = $derived(data.song);
	let churchName = $derived(data.churchName ?? null);

	// Track song ID to detect navigation changes (non-reactive to avoid effect loops)
	let lastSongId: string | null = null;
	let selectedKey = $state('C');
	let localAuthors = $state<Author[]>([]);

	let isEditing = $state(false);
	let showHelp = $state(false);
	let isSaveVersionOpen = $state(false);
	let loading = $state(false);

	// View Preferences
	let notation = $state<'chords' | 'numbers'>('chords');
	let showChords = $state(true);
	let columnCount = $state(1);
	let showSongMap = $state(true);
	let currentArrangementId = $state<string | null>(null);
	let showCopyrightLine = $state(true);

	// Initialize/reset local editing state when song changes
	$effect(() => {
		const newSong = data.song;
		if (!newSong) return;
		const newSongId = newSong.id;
		if (newSongId === lastSongId) return;
		lastSongId = newSongId;

		selectedKey = newSong.original_key || 'C';
		localAuthors = (newSong.authors || []).map((rel) => ({
			id: rel.author.id,
			name: rel.author.name
		}));

		showCopyrightLine = true;
	});

	// --- DERIVED VALUES ---
	let displayAuthors = $derived(
		song?.authors?.length ? song.authors.map((rel) => rel.author.name).join(', ') : 'Unknown Author'
	);

	let currentArrangement = $derived(
		song && currentArrangementId
			? song.arrangements.find((a) => a.id === currentArrangementId)
			: null
	);

	let displayKey = $derived(currentArrangement?.original_key || song?.original_key || 'C');
	let displayTempo = $derived(currentArrangement?.tempo || song?.tempo || null);
	let displayContent = $derived(currentArrangement?.content || song?.content || '');
	let displayNotes = $derived(song?.performance_notes);
	let songMap = $derived(generateSongMap(displayContent));
	let displayArtist = $derived(currentArrangement?.artist || song?.artist || '');
	let isPublicDomain = $derived(
		(song?.ccli_number && song.ccli_number.toLowerCase() === 'public domain') ||
			(song?.copyright && song.copyright.toLowerCase().includes('public domain'))
	);

	let displayTimeSignature = $derived.by(() => {
		const raw = currentArrangement?.time_signature || song?.time_signature || '4/4';
		return raw.replace(/\s+/g, '').replace(/(\d)[.,](\d)/, '$1/$2');
	});

	let displayBpm = $derived(currentArrangement?.bpm ?? song?.bpm ?? null);

	const buildMetaLine = (
		key: string,
		bpm: number | null,
		tempo: string | null,
		timeSig: string
	) => {
		const parts: string[] = [`Key: ${key}`];
		if (bpm) parts.push(`BPM: ${bpm}`);
		else if (tempo) parts.push(`Tempo: ${tempo}`);
		parts.push(`Time: ${timeSig}`);
		return parts.join(' | ');
	};

	let metaLine = $derived(
		buildMetaLine(displayKey, displayBpm, displayTempo, displayTimeSignature)
	);

	let parsedLines = $derived(parseChart(displayContent, displayKey, selectedKey, notation));
	let parsedSegments = $derived(groupIntoSegments(parsedLines));

	// Pagination for screen browsing
	let currentPageIndex = $state(0);
	let pages = $derived(paginateSegments(parsedSegments, showChords, columnCount));
	let totalPages = $derived(pages.length);
</script>

<div class="min-h-screen bg-stone-50 pb-20 print:bg-white print:pb-0">
	{#if song}
		{@const s = song}

		<div class="sticky top-0 z-10 border-b border-stone-200 bg-white shadow-sm print:hidden">
			<div class="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<a
							href="/songs"
							class="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold text-stone-600 hover:bg-stone-100"
						>
							<ArrowLeft size={16} /> Back
						</a>
						<div class="text-sm font-semibold text-stone-400">/</div>
						<div class="text-sm font-semibold text-stone-900">{s.title}</div>
					</div>

					<div class="flex items-center gap-2">
						<button
							type="button"
							class="btn-secondary print:hidden"
							onclick={() => (isSaveVersionOpen = true)}
							disabled={loading}
						>
							<Save size={16} /> Save Version
						</button>
						<button
							type="button"
							class="btn-primary"
							onclick={() => (isEditing = !isEditing)}
							disabled={loading}
						>
							<Pencil size={16} />
							{isEditing ? 'Done' : 'Edit'}
						</button>
					</div>
				</div>
			</div>
		</div>

		<div class="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-3 lg:px-8">
			{#if isEditing}
				<div class="lg:col-span-3">
					<form
						method="POST"
						action="?/updateSong"
						class="grid gap-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm lg:grid-cols-2"
					>
						<div class="space-y-4">
							<div>
								<label for="title" class="mb-1 block text-sm font-semibold text-stone-700">Title</label>
								<input
									id="title"
									name="title"
									type="text"
									required
									value={s.title}
									class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="artist" class="mb-1 block text-sm font-semibold text-stone-700">Artist</label>
								<input
									id="artist"
									name="artist"
									type="text"
									value={s.artist ?? ''}
									class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="author-input" class="mb-1 block text-sm font-semibold text-stone-700"
									>Authors</label
								>
								<AuthorInput bind:selectedAuthors={localAuthors} />
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div>
									<label for="key" class="mb-1 block text-sm font-semibold text-stone-700">Key</label>
									<select
										id="key"
										name="key"
										class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
									>
										{#each KEYS as k}
											<option value={k} selected={k === (s.original_key || 'C')}>{k}</option>
										{/each}
									</select>
								</div>
								<div>
									<label for="bpm" class="mb-1 block text-sm font-semibold text-stone-700">BPM</label>
									<input
										id="bpm"
										name="bpm"
										type="number"
										min="1"
										value={s.bpm ?? ''}
										class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
									/>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-3">
								<div>
									<label for="tempo" class="mb-1 block text-sm font-semibold text-stone-700">Tempo</label>
									<input
										id="tempo"
										name="tempo"
										type="text"
										value={s.tempo ?? ''}
										class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
									/>
								</div>
								<div>
									<label for="time_signature" class="mb-1 block text-sm font-semibold text-stone-700"
										>Time Signature</label
									>
									<input
										id="time_signature"
										name="time_signature"
										type="text"
										value={s.time_signature ?? '4/4'}
										class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
									/>
								</div>
							</div>
						</div>

						<div class="space-y-4">
							<div>
								<label for="ccli" class="mb-1 block text-sm font-semibold text-stone-700"
									>CCLI Number</label
								>
								<input
									id="ccli"
									name="ccli"
									type="text"
									value={s.ccli_number ?? ''}
									class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="copyright" class="mb-1 block text-sm font-semibold text-stone-700"
									>Copyright</label
								>
								<input
									id="copyright"
									name="copyright"
									type="text"
									value={s.copyright ?? ''}
									class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
								/>
							</div>

							<div>
								<label for="performance_notes" class="mb-1 block text-sm font-semibold text-stone-700"
									>Performance Notes</label
								>
								<textarea
									id="performance_notes"
									name="performance_notes"
									rows="3"
									class="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
								>{s.performance_notes ?? ''}</textarea>
							</div>

							<div>
								<label for="content" class="mb-1 block text-sm font-semibold text-stone-700"
									>Chord Chart (ChordPro)</label
								>
								<textarea
									id="content"
									name="content"
									rows="16"
									class="w-full rounded-md border border-stone-300 px-3 py-2 font-mono text-sm"
								>{s.content ?? ''}</textarea>
							</div>

							<input type="hidden" name="lyrics" value={s.lyrics ?? ''} />
							<input type="hidden" name="youtube_url" value={s.youtube_url ?? ''} />
							<input type="hidden" name="spotify_url" value={s.spotify_url ?? ''} />

							<div class="flex justify-end gap-2">
								<button
									type="button"
									class="rounded-md border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100"
									onclick={() => (isEditing = false)}
								>
									Cancel
								</button>
								<button
									type="submit"
									class="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
								>
									Save Changes
								</button>
							</div>
						</div>
					</form>
				</div>
			{:else}
				<div class="grid gap-6 lg:col-span-3 lg:grid-cols-3">
					<aside class="lg:col-span-1 print:hidden">
						<div class="rounded-xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
							<div class="mb-4 grid grid-cols-2 gap-2">
								<select
									bind:value={selectedKey}
									class="rounded-md border-stone-400 text-sm font-bold"
								>
									{#each KEYS as k}<option value={k}>{k}</option>{/each}
								</select>

								<div class="flex rounded-md shadow-sm">
									<button
										type="button"
										onclick={() => (notation = 'chords')}
										class="flex-1 border p-2 {notation === 'chords'
											? 'bg-slate-900 text-white'
											: 'bg-white'}"
									>
										A
									</button>
									<button
										type="button"
										onclick={() => (notation = 'numbers')}
										class="flex-1 border p-2 {notation === 'numbers'
											? 'bg-slate-900 text-white'
											: 'bg-white'}"
									>
										1
									</button>
								</div>
							</div>

							<button
								type="button"
								onclick={() => (showChords = !showChords)}
								class="w-full border bg-white py-1.5 text-xs font-bold"
							>
								{!showChords ? 'Lyrics Only' : 'Showing Chords'}
							</button>

							<div class="mt-3 grid grid-cols-2 gap-2">
								<button
									type="button"
									onclick={() => (columnCount = 1)}
									class="rounded-md border px-3 py-1 text-xs font-bold {columnCount === 1
										? 'bg-slate-900 text-white'
										: 'bg-white'}"
								>
									1 Column
								</button>
								<button
									type="button"
									onclick={() => (columnCount = 2)}
									class="rounded-md border px-3 py-1 text-xs font-bold {columnCount === 2
										? 'bg-slate-900 text-white'
										: 'bg-white'}"
								>
									2 Columns
								</button>
							</div>

							{#if songMap.length > 0}
								<button
									type="button"
									onclick={() => (showSongMap = !showSongMap)}
									class="mt-3 w-full border bg-white py-1.5 text-xs font-bold"
								>
									{showSongMap ? 'Hide Song Map' : 'Show Song Map'}
								</button>
							{/if}

							{#if isPublicDomain}
								<label class="mt-3 flex items-center gap-2 text-xs font-semibold text-stone-500">
									<input type="checkbox" bind:checked={showCopyrightLine} />
									Show Public Domain line
								</label>
							{/if}
						</div>

						{#if displayNotes}
							<div class="song-notes">{displayNotes}</div>
						{/if}
					</aside>

					<div class="lg:col-span-2">
						<div class="song-print-container">
							<div class="print:hidden">
								<header class="song-header">
									<div class="flex flex-col gap-1">
										<h1 class="song-title uppercase">{s.title}</h1>
										<p class="song-subtitle">
											{#if displayAuthors && displayAuthors !== 'Unknown Author'}
												Words / Music: {displayAuthors}
											{:else}
												{displayAuthors}
											{/if}
											{#if displayArtist}
												| Artist: {displayArtist}
											{/if}
										</p>

										<div class="song-meta song-meta-strong">{metaLine}</div>

										{#if showSongMap && songMap.length > 0}
											<div class="song-map song-map--header">
												<span class="song-map-label">Flow</span>
												{#each songMap as item}
													<span class="song-map-item">{item}</span>
												{/each}
											</div>
										{/if}

										<div class="song-header-divider"></div>
									</div>
								</header>

								<main class="song-body" class:two-column={columnCount === 2}>
									{#each parsedSegments as segment}
										<section class="song-section">
											{#each segment.lines as line}
												{#if line.type === 'section'}
													<h2 class="section-label">{line.content}</h2>
												{:else if line.type === 'lyric'}
														<div class="song-line">
															{#each line.pairs as pair}
																{@const hasLyric = pair.lyric.length > 0}
																{#if hasLyric || (showChords && pair.chord)}
																	<div class="chord-pair" class:chord-only={!hasLyric}>
																		{#if showChords && pair.chord}
																			<span class="chord">{pair.chord}</span>
																		{/if}
																		{#if hasLyric}
																			<span class="lyric">{pair.lyric}</span>
																		{/if}
																	</div>
																{/if}
															{/each}
														</div>
												{/if}
											{/each}
										</section>
									{/each}
								</main>

								<footer class="song-footer">
									<div class="song-footer-line">
										{#if showCopyrightLine}
											<div>
												{#if isPublicDomain}
													Public Domain
												{:else if s.copyright}
													© {s.copyright}
												{:else}
													© {displayAuthors}
												{/if}
											</div>
										{/if}
										{#if totalPages > 1}
											<div class="page-count"></div>
										{/if}
									</div>
									<div class="song-footer-line">
										<div class="print-attribution">
											Generated by WorshipOS for {churchName ?? 'Your Church'}
										</div>
										{#if s.ccli_number && !isPublicDomain}
											<div>CCLI #{s.ccli_number}</div>
										{/if}
									</div>
								</footer>
							</div>

							<div class="hidden print:block">
								{#each pages as page, pageIndex}
									<section class="print-page">
										<header class="print-page-header">
											{#if pageIndex === 0}
												<h1 class="print-page-title uppercase">{s.title}</h1>
												<p class="print-page-subtitle">
													{#if displayAuthors && displayAuthors !== 'Unknown Author'}
														Words / Music: {displayAuthors}
													{:else}
														{displayAuthors}
													{/if}
													{#if displayArtist}
														| Artist: {displayArtist}
													{/if}
												</p>

												<div class="print-page-meta">{metaLine}</div>

												{#if showSongMap && songMap.length > 0}
													<div class="song-map song-map--header">
														<span class="song-map-label">Flow</span>
														{#each songMap as item}
															<span class="song-map-item">{item}</span>
														{/each}
													</div>
												{/if}

												<div class="print-header-divider"></div>
											{:else}
												<div class="print-page-contd">{s.title} - cont'd</div>
												<div class="print-header-divider"></div>
											{/if}
										</header>

										<main class="song-body" class:two-column={columnCount === 2}>
											{#each page as segment}
												<section class="song-section">
													{#each segment.lines as line}
														{#if line.type === 'section'}
															<h2 class="section-label">{line.content}</h2>
														{:else if line.type === 'lyric'}
																<div class="song-line">
																	{#each line.pairs as pair}
																		{@const hasLyric = pair.lyric.length > 0}
																		{#if hasLyric || (showChords && pair.chord)}
																			<div class="chord-pair" class:chord-only={!hasLyric}>
																				{#if showChords && pair.chord}
																					<span class="chord">{pair.chord}</span>
																				{/if}
																				{#if hasLyric}
																					<span class="lyric">{pair.lyric}</span>
																				{/if}
																			</div>
																		{/if}
																	{/each}
																</div>
														{/if}
													{/each}
												</section>
											{/each}
										</main>

										<footer class="print-page-footer">
											<div class="print-footer-row">
												<div>
													{#if showCopyrightLine}
														{#if isPublicDomain}
															Public Domain
														{:else if s.copyright}
															© {s.copyright}
														{:else}
															© {displayAuthors}
														{/if}
													{/if}
												</div>
												<div class="print-page-count">p. {pageIndex + 1} / {totalPages}</div>
											</div>

											<div class="print-footer-row">
												<div>Generated by WorshipOS for {churchName ?? 'Your Church'}</div>
												<div class="print-footer-right">
													{#if s.ccli_number && !isPublicDomain}
														<div>CCLI #{s.ccli_number}</div>
													{/if}
												</div>
											</div>
										</footer>
									</section>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
