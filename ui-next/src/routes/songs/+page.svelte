<script lang="ts">
	import { enhance } from '$app/forms';
	import { Download, Hash, Music, Plus, Search } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchTerm = $state('');

	// Safe derivation with proper typing
	let filteredSongs = $derived(
		(data.songs || []).filter(
			(s) =>
				s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(s.author && s.author.toLowerCase().includes(searchTerm.toLowerCase()))
		)
	);
</script>

<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Song Library</h1>
			<p class="mt-1 text-slate-500">
				The central library of songs, keys, and arrangements used in your gatherings.
			</p>
		</div>

		<a
			href="/songs/new"
			class="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-slate-800"
		>
			<Plus size={18} />
			Add Song
		</a>
	</div>
</div>

<div class="relative mb-6">
	<label for="song-search" class="sr-only">Search songs by title, lyrics, or author</label>
	<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
		<Search size={20} />
	</div>
	<input
		id="song-search"
		type="text"
		bind:value={searchTerm}
		placeholder="Search by title, lyrics, or author..."
		class="w-full rounded-xl border border-slate-200 px-4 py-3 pl-10 text-base shadow-sm transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
	/>
</div>

<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
	{#each filteredSongs as song}
		<a
			href="/songs/{song.id}"
			class="group block rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-md"
		>
			<div class="mb-2 flex items-start justify-between">
				<div class="flex items-center gap-3">
					<div
						class="rounded-lg bg-blue-50 p-2 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white"
					>
						<Music size={20} />
					</div>
					<div>
						<h3
							class="leading-tight font-bold text-slate-900 transition-colors group-hover:text-blue-600"
						>
							{song.title}
						</h3>
						{#if song.ccli_number && song.ccli_number !== 'Public Domain'}
							<span class="mt-0.5 flex items-center gap-0.5 font-mono text-[10px] text-slate-400">
								<Hash size={10} />
								{song.ccli_number}
							</span>
						{/if}
					</div>
				</div>
			</div>

			{#if song.author}
				<p class="mb-4 line-clamp-1 text-sm text-slate-500">{song.author}</p>
			{/if}

			<div
				class="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs font-medium text-slate-600"
			>
				<div
					class="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 shadow-sm"
				>
					<span class="text-slate-400">Key</span>
					<span class="font-bold text-slate-900">{song.original_key || '-'}</span>
				</div>
				<div
					class="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 shadow-sm"
				>
					<span class="text-slate-400">BPM</span>
					<span class="font-bold text-slate-900">{song.tempo || '-'}</span>
				</div>
			</div>
		</a>
	{/each}
</div>

{#if filteredSongs.length === 0}
	<div class="py-20 text-center">
		<div class="mb-4 inline-flex rounded-full bg-slate-100 p-4 text-slate-400">
			<Music size={48} strokeWidth={1.5} />
		</div>

		{#if searchTerm}
			<h3 class="text-lg font-medium text-slate-900">No songs found</h3>
			<p class="mx-auto mt-1 max-w-sm text-slate-500">
				We couldn't find anything matching "{searchTerm}".
			</p>
		{:else}
			<h3 class="text-lg font-medium text-slate-900">Your library is empty</h3>
			<p class="mx-auto mt-1 max-w-sm text-slate-500">
				Get started by adding your own songs, or load our starter pack.
			</p>
			<div class="mt-6 flex justify-center gap-4">
				<button
					type="button"
					class="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
				>
					Create Manually
				</button>
				<form method="POST" action="?/seedLibrary" use:enhance>
					<button
						class="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
					>
						<Download size={16} /> Load Starter Library
					</button>
				</form>
			</div>
		{/if}
	</div>
{/if}
