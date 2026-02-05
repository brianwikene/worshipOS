<!-- src/routes/gatherings/[gathering_id]/rehearse/+page.svelte -->
<!-- Read-only rehearse view - songs only, musician-focused -->
<script lang="ts">
	import { ArrowLeft, Music } from '@lucide/svelte';

	let { data } = $props();

	function formatDate(v: unknown): string {
		const d = v instanceof Date ? v : new Date(String(v));
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '';
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins}:00`;
	}
</script>

<div class="min-h-screen bg-stone-50">
	<!-- Header -->
	<header class="border-b border-stone-200 bg-white px-4 py-4 shadow-sm">
		<div class="mx-auto max-w-2xl">
			<a
				href="/gatherings/{data.rehearse.gathering.id}"
				class="mb-3 inline-flex items-center gap-2 text-sm text-stone-500 transition hover:text-stone-900"
			>
				<ArrowLeft size={16} />
				Back
			</a>

			<h1 class="text-2xl font-bold text-stone-900">{data.rehearse.gathering.title}</h1>
			<p class="mt-1 text-stone-500">{formatDate(data.rehearse.gathering.date)}</p>
		</div>
	</header>

	<!-- Song List -->
	<main class="mx-auto max-w-2xl px-4 py-8">
		{#if data.rehearse.songs.length === 0}
			<div class="rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center">
				<Music size={48} class="mx-auto mb-4 text-stone-300" />
				<p class="text-lg text-stone-500">No songs in this gathering yet</p>
				<p class="mt-1 text-sm text-stone-400">Songs will appear here once added to the flow</p>
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
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>
