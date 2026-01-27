<script lang="ts">
	import { FileMusic, Hash, Music, Plus, Search } from '@lucide/svelte';

	let { data } = $props();
	let searchTerm = $state('');

	// Client-side search (Fast enough for < 1000 songs)
	let filteredSongs = $derived(
		data.songs.filter(
			(s) =>
				s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
				(s.author && s.author.toLowerCase().includes(searchTerm.toLowerCase()))
		)
	);
</script>

<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-gray-900">Song Library</h1>
			<p class="mt-1 text-gray-500">Manage your repertoire and arrangements.</p>
		</div>
		<button
			class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 font-bold text-white shadow-sm transition hover:bg-gray-800"
		>
			<Plus size={18} />
			Add Song
		</button>
	</div>

	<div class="relative mb-6">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
			<Search size={20} />
		</div>
		<input
			type="text"
			bind:value={searchTerm}
			placeholder="Search by title, lyrics, or author..."
			class="w-full rounded-xl border border-gray-300 px-4 py-3 pl-10 text-base shadow-sm transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
		/>
	</div>

	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
		{#each filteredSongs as song}
			<a
				href="/songs/{song.id}"
				class="group block rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-md"
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
								class="leading-tight font-bold text-gray-900 transition-colors group-hover:text-blue-600"
							>
								{song.title}
							</h3>
							{#if song.ccli_number}
								<span class="mt-0.5 flex items-center gap-0.5 font-mono text-[10px] text-gray-400">
									<Hash size={10} />
									{song.ccli_number}
								</span>
							{/if}
						</div>
					</div>
				</div>

				{#if song.author}
					<p class="mb-4 line-clamp-1 text-sm text-gray-500">{song.author}</p>
				{/if}

				<div
					class="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs font-medium text-gray-600"
				>
					<div
						class="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 shadow-sm"
					>
						<span class="text-gray-400">Key</span>
						<span class="font-bold text-gray-900">{song.original_key || '-'}</span>
					</div>
					<div
						class="flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 shadow-sm"
					>
						<span class="text-gray-400">BPM</span>
						<span class="font-bold text-gray-900">{song.bpm || '-'}</span>
					</div>
					{#if song.arrangements && song.arrangements.length > 0}
						<div class="ml-auto flex items-center gap-1 text-gray-400">
							<FileMusic size={14} />
							<span>{song.arrangements.length}</span>
						</div>
					{/if}
				</div>
			</a>
		{/each}
	</div>

	{#if filteredSongs.length === 0}
		<div class="py-20 text-center">
			<div class="mb-4 inline-flex rounded-full bg-gray-100 p-4 text-gray-400">
				<Music size={48} strokeWidth={1.5} />
			</div>
			<h3 class="text-lg font-medium text-gray-900">No songs found</h3>
			<p class="mx-auto mt-1 max-w-sm text-gray-500">
				Try adjusting your search terms or add a new song to your library.
			</p>
		</div>
	{/if}
</div>
