<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		ChevronDown,
		ChevronUp,
		Download,
		Hash,
		LayoutGrid,
		List,
		Music,
		Plus,
		RotateCcw,
		Search,
		Trash2
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchTerm = $state('');
	let viewMode = $state<'card' | 'table'>('card');
	let sortColumn = $state('title');
	let sortDirection = $state<'asc' | 'desc'>('asc');

	function toggleSort(column: string) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	function getAuthorNames(song: any): string {
		if (!song.authors || song.authors.length === 0) return '';
		return song.authors.map((a: any) => a.author?.name || '').join(', ');
	}

	let filteredSongs = $derived(
		(data.songs || []).filter((s: any) => {
			const term = searchTerm.toLowerCase();
			if (!term) return true;
			return (
				s.title.toLowerCase().includes(term) ||
				(s.artist && s.artist.toLowerCase().includes(term)) ||
				getAuthorNames(s).toLowerCase().includes(term)
			);
		})
	);

	let sortedSongs = $derived(
		[...filteredSongs].sort((a: any, b: any) => {
			let aVal = '';
			let bVal = '';
			if (sortColumn === 'title') {
				aVal = a.title?.toLowerCase() || '';
				bVal = b.title?.toLowerCase() || '';
			} else if (sortColumn === 'author') {
				aVal = getAuthorNames(a).toLowerCase();
				bVal = getAuthorNames(b).toLowerCase();
			} else if (sortColumn === 'artist') {
				aVal = a.artist?.toLowerCase() || '';
				bVal = b.artist?.toLowerCase() || '';
			} else if (sortColumn === 'key') {
				aVal = a.original_key?.toLowerCase() || '';
				bVal = b.original_key?.toLowerCase() || '';
			} else if (sortColumn === 'tempo') {
				aVal = a.tempo || '';
				bVal = b.tempo || '';
			}
			if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		})
	);

	function setFilter(f: string) {
		const url = new URL($page.url);
		if (f === 'active') {
			url.searchParams.delete('filter');
		} else {
			url.searchParams.set('filter', f);
		}
		goto(url.toString(), { replaceState: true, invalidateAll: true });
	}

	let currentFilter = $derived(data.filter || 'active');
	let canDelete = $derived(data.canDelete || false);
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

	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="relative flex-1">
			<label for="song-search" class="sr-only">Search songs by title, artist, or author</label>
			<div
				class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"
			>
				<Search size={20} />
			</div>
			<input
				id="song-search"
				type="text"
				bind:value={searchTerm}
				placeholder="Search by title, artist, or author..."
				class="w-full rounded-xl border border-slate-200 px-4 py-3 pl-10 text-base shadow-sm transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
			/>
		</div>

		<div class="flex items-center gap-2">
			{#if canDelete}
				<div class="flex rounded-lg border border-slate-200 bg-white shadow-sm" role="group" aria-label="Filter songs">
					<button
						type="button"
						onclick={() => setFilter('active')}
						class="rounded-l-lg px-3 py-2 text-xs font-bold transition {currentFilter === 'active' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}"
					>Active</button>
					<button
						type="button"
						onclick={() => setFilter('archived')}
						class="border-x border-slate-200 px-3 py-2 text-xs font-bold transition {currentFilter === 'archived' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}"
					>Archived</button>
					<button
						type="button"
						onclick={() => setFilter('all')}
						class="rounded-r-lg px-3 py-2 text-xs font-bold transition {currentFilter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}"
					>All</button>
				</div>
			{/if}

			<div class="flex rounded-lg border border-slate-200 bg-white shadow-sm" role="group" aria-label="View mode">
				<button
					type="button"
					onclick={() => (viewMode = 'card')}
					class="rounded-l-lg p-2 transition {viewMode === 'card' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}"
					aria-label="Card view"
				>
					<LayoutGrid size={18} />
				</button>
				<button
					type="button"
					onclick={() => (viewMode = 'table')}
					class="rounded-r-lg border-l border-slate-200 p-2 transition {viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}"
					aria-label="Table view"
				>
					<List size={18} />
				</button>
			</div>
		</div>
	</div>
</div>

{#if viewMode === 'card'}
	<div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each sortedSongs as song}
				{@const isArchived = !!song.deleted_at}
				<div class="relative rounded-xl border border-slate-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-md {isArchived ? 'opacity-50' : ''}">
					<a href="/songs/{song.id}" class="absolute inset-0 rounded-xl" aria-label="View {song.title}"></a>
					<div class="relative mb-2 flex items-start justify-between">
						<div class="flex items-center gap-3">
							<div class="rounded-lg bg-blue-50 p-2 text-blue-600">
								<Music size={20} />
							</div>
							<div>
								<h3 class="leading-tight font-bold text-slate-900">{song.title}</h3>
								{#if song.ccli_number && song.ccli_number !== 'Public Domain'}
									<span class="mt-0.5 flex items-center gap-0.5 font-mono text-[10px] text-slate-400">
										<Hash size={10} />
										{song.ccli_number}
									</span>
								{/if}
							</div>
						</div>
						{#if isArchived && canDelete}
							<form method="POST" action="?/restoreSong" use:enhance class="relative z-10">
								<input type="hidden" name="song_id" value={song.id} />
								<button
									type="submit"
									class="flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100"
								>
									<RotateCcw size={12} /> Restore
								</button>
							</form>
						{/if}
					</div>

					{#if getAuthorNames(song)}
						<p class="mb-1 line-clamp-1 text-xs text-slate-400">{getAuthorNames(song)}</p>
					{/if}

					{#if song.artist}
						<p class="mb-4 line-clamp-1 text-sm text-slate-500">{song.artist}</p>
					{:else}
						<div class="mb-4"></div>
					{/if}

					<div class="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs font-medium text-slate-600">
						<div class="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 shadow-sm">
							<span class="text-slate-400">Key</span>
							<span class="font-bold text-slate-900">{song.original_key || '-'}</span>
						</div>
						<div class="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 shadow-sm">
							<span class="text-slate-400">BPM</span>
							<span class="font-bold text-slate-900">{song.tempo || '-'}</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
{:else}
	<div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			<table class="min-w-full divide-y divide-slate-200">
				<thead class="bg-slate-50">
					<tr>
						{#each [
							{ key: 'title', label: 'Title' },
							{ key: 'author', label: 'Author(s)' },
							{ key: 'artist', label: 'Artist' },
							{ key: 'key', label: 'Key' },
							{ key: 'tempo', label: 'Tempo' }
						] as col}
							<th
								class="cursor-pointer px-4 py-3 text-left text-xs font-bold tracking-wide text-slate-500 uppercase select-none hover:text-slate-700"
							>
								<button type="button" class="flex items-center gap-1" onclick={() => toggleSort(col.key)}>
									{col.label}
									{#if sortColumn === col.key}
										{#if sortDirection === 'asc'}
											<ChevronUp size={14} />
										{:else}
											<ChevronDown size={14} />
										{/if}
									{/if}
								</button>
							</th>
						{/each}
						{#if canDelete && currentFilter !== 'active'}
							<th class="px-4 py-3 text-right text-xs font-bold tracking-wide text-slate-500 uppercase">
								<span class="sr-only">Actions</span>
							</th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each sortedSongs as song}
						{@const isArchived = !!song.deleted_at}
						<tr class="transition-colors hover:bg-slate-50 {isArchived ? 'opacity-50' : ''}">
							<td class="px-4 py-3">
								<a href="/songs/{song.id}" class="font-medium text-slate-900 hover:text-blue-600">
									{song.title}
								</a>
							</td>
							<td class="px-4 py-3 text-sm text-slate-500">{getAuthorNames(song) || '-'}</td>
							<td class="px-4 py-3 text-sm text-slate-500">{song.artist || '-'}</td>
							<td class="px-4 py-3 text-sm font-medium text-slate-700">{song.original_key || '-'}</td>
							<td class="px-4 py-3 text-sm text-slate-500">{song.tempo || '-'}</td>
							{#if canDelete && currentFilter !== 'active'}
								<td class="px-4 py-3 text-right">
									{#if isArchived}
										<form method="POST" action="?/restoreSong" use:enhance class="inline">
											<input type="hidden" name="song_id" value={song.id} />
											<button
												type="submit"
												class="flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-100"
											>
												<RotateCcw size={12} /> Restore
											</button>
										</form>
									{:else}
										<form method="POST" action="?/archiveSong" use:enhance class="inline">
											<input type="hidden" name="song_id" value={song.id} />
											<button
												type="submit"
												class="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100"
											>
												<Trash2 size={12} /> Archive
											</button>
										</form>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}

{#if sortedSongs.length === 0}
	<div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
		<div class="py-20 text-center">
			<div class="mb-4 inline-flex rounded-full bg-slate-100 p-4 text-slate-400">
				<Music size={48} strokeWidth={1.5} />
			</div>

			{#if searchTerm}
				<h3 class="text-lg font-medium text-slate-900">No songs found</h3>
				<p class="mx-auto mt-1 max-w-sm text-slate-500">
					We couldn't find anything matching "{searchTerm}".
				</p>
			{:else if currentFilter === 'archived'}
				<h3 class="text-lg font-medium text-slate-900">No archived songs</h3>
				<p class="mx-auto mt-1 max-w-sm text-slate-500">
					Songs you archive will appear here.
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
	</div>
{/if}
