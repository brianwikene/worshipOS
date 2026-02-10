<!-- src/routes/gatherings/[gathering_id]/rehearse/+page.svelte -->
<!-- Read-only rehearse view - songs only, musician-focused -->
<script lang="ts">
	import { parseChart } from '$lib/songs/parser';
	import '$lib/styles/song-print.css';
	import { ArrowLeft, List, Music } from '@lucide/svelte';

	let { data } = $props();

	let expandedSongIds = $state<string[]>([]);

	function toggleSong(songId: string) {
		expandedSongIds = expandedSongIds.includes(songId)
			? expandedSongIds.filter((id) => id !== songId)
			: [...expandedSongIds, songId];
	}

	function formatDate(v: unknown): string {
		const d = v instanceof Date ? v : new Date(String(v));
		if (Number.isNaN(d.getTime())) return 'Invalid date';
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '';
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins} min`;
	}
</script>

<div class="min-h-screen bg-stone-50 pb-20">
	<!-- Header -->
	<header class="border-b border-stone-200 bg-white px-4 pt-4 shadow-sm">
		<div class="mx-auto max-w-2xl">
			<a
				href="/gatherings/{data.rehearse.gathering.id}"
				class="mb-3 inline-flex items-center gap-2 text-sm text-stone-500 transition hover:text-stone-900"
			>
				<ArrowLeft size={16} />
				Back to Gathering
			</a>

			<h1 class="text-2xl font-bold text-stone-900">{data.rehearse.gathering.title}</h1>
			<p class="mt-1 text-stone-500">{formatDate(data.rehearse.gathering.date)}</p>

			<!-- Simple Tab Navigation -->
			<div class="mt-6 flex gap-6">
				<a
					href="/gatherings/{data.rehearse.gathering.id}/order"
					class="border-b-2 border-transparent pb-3 text-sm font-medium text-stone-500 transition hover:text-stone-900"
				>
					<div class="flex items-center gap-2">
						<List size={16} />
						Service Flow
					</div>
				</a>
				<a
					href="/gatherings/{data.rehearse.gathering.id}/rehearse"
					class="border-b-2 border-stone-900 pb-3 text-sm font-bold text-stone-900"
				>
					<div class="flex items-center gap-2">
						<Music size={16} />
						Songs & Rehearsal
					</div>
				</a>
			</div>
		</div>
	</header>

	<!-- Song List -->
	<main class="mx-auto max-w-2xl px-4 py-8">
		{#if data.rehearse.songs.length === 0}
			<div
				class="rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center shadow-sm"
			>
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-50"
				>
					<Music size={32} class="text-stone-300" />
				</div>
				<h3 class="text-lg font-bold text-stone-900">The setlist is still taking shape</h3>
				<p class="mx-auto mt-2 max-w-xs text-stone-500">
					Songs will appear here once they are added to the service flow. Check back soon as we
					prepare for this gathering.
				</p>
			</div>
		{:else}
			<div class="mb-6 flex items-center justify-between">
				<span class="text-sm font-medium text-stone-500">
					{data.rehearse.songs.length} song{data.rehearse.songs.length !== 1 ? 's' : ''}
				</span>
			</div>

			<div class="space-y-3">
				{#each data.rehearse.songs as song}
					<div
						class="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:border-stone-300 hover:shadow"
					>
						<div class="flex items-start gap-4 p-5">
							<!-- Song number -->
							<div
								class="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-lg font-bold text-purple-600"
							>
								{song.position}
							</div>

							<!-- Song info -->
							<div class="min-w-0 flex-1">
								<h2 class="text-xl font-bold text-stone-900">{song.title}</h2>

								{#if song.artist}
									<p class="mt-0.5 text-stone-500">{song.artist}</p>
								{/if}

								<div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
									<button
										type="button"
										onclick={() => toggleSong(song.id)}
										class="rounded-lg border border-stone-200 bg-white px-3 py-1.5 font-medium text-stone-700 hover:border-stone-300 hover:bg-stone-50"
									>
										{expandedSongIds.includes(song.id) ? 'Hide Chart' : 'Show Chart'}
									</button>

									<a
										href={`/songs/${song.id}`}
										class="rounded-lg border border-stone-200 px-3 py-1.5 font-medium text-stone-700 hover:border-stone-300 hover:bg-stone-50"
									>
										Open Song
									</a>

									{#if song.spotifyUrl}
										<a
											href={song.spotifyUrl}
											target="_blank"
											rel="noreferrer"
											class="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 font-medium text-green-700 hover:border-green-300"
										>
											Spotify
										</a>
									{/if}

									{#if song.youtubeUrl}
										<a
											href={song.youtubeUrl}
											target="_blank"
											rel="noreferrer"
											class="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:border-red-300"
										>
											YouTube
										</a>
									{/if}
								</div>
							</div>

							<!-- Key badge -->
							{#if song.key}
								<div
									class="shrink-0 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 text-center"
								>
									<div class="text-xs font-medium text-purple-600 uppercase">Key</div>
									<div class="text-lg font-bold text-purple-700">{song.key}</div>
								</div>
							{/if}
						</div>

						{#if song.duration}
							<div class="border-t border-stone-100 bg-stone-50 px-5 py-2">
								<span class="text-sm text-stone-400">{formatDuration(song.duration)}</span>
							</div>
						{/if}

						{#if expandedSongIds.includes(song.id)}
							{@const lines = parseChart(
								song.content ?? '',
								song.key ?? 'C',
								song.key ?? 'C',
								'chords'
							)}
							<div class="border-t border-stone-100 bg-stone-50 px-5 py-4">
								{#if song.content}
									<div class="song-body text-sm">
										{#each lines as line}
											{#if line.type === 'section'}
												<h3 class="section-label">{line.content}</h3>
											{:else if line.type === 'lyric'}
												<div class="song-line flex flex-wrap items-end gap-x-1">
													{#each line.pairs as pair}
														<div class="chord-pair">
															{#if pair.chord}
																<span class="chord">{pair.chord}</span>
															{/if}
															<span class="lyric">{pair.lyric || ' '}</span>
														</div>
													{/each}
												</div>
											{:else if line.type === 'comment'}
												<div class="song-comment text-stone-500">{line.content}</div>
											{/if}
										{/each}
									</div>
								{:else}
									<div class="text-sm text-stone-500">No chart content for this song yet.</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>
