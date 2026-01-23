<!-- /ui/src/routes/songs/+page.svelte -->
<!-- /src/routes/songs/+page.svelte -->

<script lang="ts">
	import { apiFetch, apiJson } from '$lib/api';
	import SongModal from '$lib/components/SongModal.svelte';
	import ObjectMark from '$lib/components/identity/ObjectMark.svelte';
	import { onMount } from 'svelte';

	// --- Interfaces ---
	interface Song {
		id: string;
		title: string;
		artist: string | null;
		key: string | null;
		ccli_number: string | null;
		bpm: number | null;
		notes: string | null;
		created_at: string;
	}

	// --- State ---
	let songs: Song[] = [];
	let loading = true;
	let error = '';
	let searchQuery = '';
	let viewMode: 'cards' | 'table' = 'cards';

	// Modal State
	let modalOpen = false;
	let editingSong: Song | null = null;
	let modalComponent: SongModal;

	onMount(() => {
		loadSongs();
	});

	async function loadSongs() {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (searchQuery) params.set('search', searchQuery);

			// Default Sort: Title ASC
			params.set('sort', 'title');
			params.set('dir', 'asc');

			songs = await apiJson<Song[]>(`/api/songs?${params.toString()}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load songs';
		} finally {
			loading = false;
		}
	}

	function handleSearch() {
		loadSongs();
	}

	// --- Actions ---

	function openAddModal() {
		editingSong = null;
		modalOpen = true;
	}

	function openEditModal(song: Song, e: Event) {
		// Prevent the click from triggering the card link
		e.preventDefault();
		e.stopPropagation();

		editingSong = song;
		modalOpen = true;
	}

	async function handleSave(e: CustomEvent<any>) {
		try {
			modalComponent.setSaving(true);

			if (editingSong?.id) {
				// Update
				await apiFetch(`/api/songs/${editingSong.id}`, {
					method: 'PUT',
					body: JSON.stringify(e.detail)
				});
			} else {
				// Create
				await apiFetch('/api/songs', {
					method: 'POST',
					body: JSON.stringify(e.detail)
				});
			}

			modalOpen = false;
			await loadSongs();
		} catch (err) {
			modalComponent.setError(err instanceof Error ? err.message : 'Failed to save');
		}
	}

	// Integrity: Archive, don't delete (This is just a quick action, Detail page has full logic)
	async function handleArchive(song: Song, e: Event) {
		e.preventDefault();
		e.stopPropagation();

		if (!confirm(`Archive "${song.title}"?`)) return;

		try {
			await apiFetch(`/api/songs/${song.id}`, { method: 'DELETE' });
			await loadSongs();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to archive');
		}
	}

	function getInitials(title: string) {
		return title ? title.substring(0, 2).toUpperCase() : '??';
	}
</script>

<div class="sys-page">
	<div class="sys-page-header">
		<div>
			<h1 class="sys-title">Songs</h1>
			<p class="sys-subtitle">Library and arrangements</p>
		</div>
		<button class="sys-btn sys-btn--primary" onclick={openAddModal}> + Add Song </button>
	</div>

	<div class="sys-toolbar" style="display: flex; justify-content: space-between;">
		<div style="display: flex; gap: 10px; flex: 1;">
			<input
				class="sys-input"
				type="text"
				placeholder="Search songs..."
				bind:value={searchQuery}
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
			<button class="sys-btn sys-btn--secondary" onclick={handleSearch}>Search</button>
		</div>

		<div class="sys-toggle" role="group">
			<button
				class="sys-toggle-btn"
				class:active={viewMode === 'cards'}
				onclick={() => (viewMode = 'cards')}
				aria-label="Card view"
				title="Card view"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
					><path
						fill="currentColor"
						d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"
					/></svg
				>
			</button>
			<button
				class="sys-toggle-btn"
				class:active={viewMode === 'table'}
				onclick={() => (viewMode = 'table')}
				aria-label="Table view"
				title="Table view"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"
					><path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" /></svg
				>
			</button>
		</div>
	</div>

	{#if loading}
		<div class="sys-state">Loading library...</div>
	{:else if error}
		<div class="sys-state sys-state--error">
			<p>{error}</p>
			<button class="sys-btn sys-btn--danger" onclick={loadSongs}>Retry</button>
		</div>
	{:else if songs.length === 0}
		<div class="sys-state sys-state--empty">
			<p>No songs found.</p>
			<button class="sys-btn sys-btn--primary" onclick={openAddModal}>Add your first song</button>
		</div>
	{:else if viewMode === 'cards'}
		<div class="sys-grid sys-grid--cards">
			{#each songs as song}
				<div class="sys-card song-card">
					<a href={`/songs/${song.id}`} class="song-link">
						<ObjectMark variant="songs" size="md" label={getInitials(song.title)} />
						<div class="song-info">
							<h2>{song.title}</h2>
							<div class="song-meta">
								{song.artist || 'Unknown Artist'}
								{#if song.key}
									• Key: {song.key}{/if}
							</div>
						</div>
					</a>

					<div class="card-actions">
						<button
							class="sys-icon-btn"
							onclick={(e) => openEditModal(song, e)}
							title="Edit Details"
						>
							✏️
						</button>
						<button
							class="sys-icon-btn sys-icon-btn--danger"
							onclick={(e) => handleArchive(song, e)}
							title="Archive"
						>
							🗑️
						</button>
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="sys-card" style="margin-top: 20px; padding: 0;">
			<div class="sys-table-wrap" style="border: none; margin: 0;">
				<table class="sys-table">
					<thead>
						<tr>
							<th style="width: 50px;"></th>
							<th>Title</th>
							<th>Artist</th>
							<th>Key</th>
							<th>BPM</th>
							<th class="col-actions">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each songs as song}
							<tr>
								<td>
									<a href={`/songs/${song.id}`} class="row-link">
										<ObjectMark variant="songs" size="sm" label={getInitials(song.title)} />
									</a>
								</td>
								<td>
									<a href={`/songs/${song.id}`} class="row-link">
										<span class="primary">{song.title}</span>
									</a>
								</td>
								<td><span class="muted">{song.artist || '—'}</span></td>
								<td><span class="badge">{song.key || '—'}</span></td>
								<td><span class="muted">{song.bpm || '—'}</span></td>
								<td class="col-actions">
									<button class="sys-icon-btn" onclick={(e) => openEditModal(song, e)}>✏️</button>
									<button
										class="sys-icon-btn sys-icon-btn--danger"
										onclick={(e) => handleArchive(song, e)}>🗑️</button
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<SongModal
		bind:this={modalComponent}
		bind:open={modalOpen}
		song={editingSong}
		on:close={() => (modalOpen = false)}
		on:save={handleSave}
	/>
</div>

<style>
	/* Local Styles */
	.song-card {
		display: flex;
		align-items: center;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
	}

	.song-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
	}

	.song-link {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		text-decoration: none;
		color: inherit;
	}

	.song-info {
		flex: 1;
		min-width: 0;
	}

	.song-info h2 {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		color: var(--sys-text);
	}

	.song-meta {
		font-size: 0.85rem;
		color: var(--sys-muted);
	}

	.card-actions {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		border-left: 1px solid var(--sys-border);
	}

	.row-link {
		color: inherit;
		text-decoration: none;
		display: block;
		height: 100%;
	}

	.primary {
		font-weight: 600;
	}
	.muted {
		color: var(--sys-muted);
		font-size: 0.9rem;
	}

	.badge {
		background: rgba(0, 0, 0, 0.05);
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 500;
	}
</style>
