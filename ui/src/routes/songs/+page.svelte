<script lang="ts">
  import { onMount } from 'svelte';
  import { apiJson, apiFetch } from '$lib/api';
  import SongModal from '$lib/components/SongModal.svelte';

  interface Song {
    id: string;
    title: string;
    artist: string | null;
    key: string | null;
    bpm: number | null;
    ccli_number: string | null;
    notes: string | null;
  }

  let songs: Song[] = [];
  let loading = true;
  let error = '';
  let searchQuery = '';

  // Modal state
  let modalOpen = false;
  let editingSong: Song | null = null;
  let modalComponent: SongModal;

  onMount(() => {
    loadSongs();
  });

  async function loadSongs() {
    try {
      loading = true;
      const url = searchQuery
        ? `/api/songs?search=${encodeURIComponent(searchQuery)}`
        : '/api/songs';

      songs = await apiJson<Song[]>(url);
      error = '';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load songs';
    } finally {
      loading = false;
    }
  }

  function openAddModal() {
    editingSong = null;
    modalOpen = true;
  }

  function openEditModal(song: Song) {
    editingSong = song;
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
    editingSong = null;
  }

  async function handleSave(e: CustomEvent<{
    title: string;
    artist: string | null;
    key: string | null;
    bpm: number | null;
    ccli_number: string | null;
    notes: string | null;
  }>) {
    const songData = e.detail;

    try {
      modalComponent.setSaving(true);

      if (editingSong?.id) {
        await apiFetch(`/api/songs/${editingSong.id}`, {
          method: 'PUT',
          body: JSON.stringify(songData)
        });
      } else {
        await apiFetch('/api/songs', {
          method: 'POST',
          body: JSON.stringify(songData)
        });
      }

      closeModal();
      await loadSongs();
    } catch (err) {
      modalComponent.setError(err instanceof Error ? err.message : 'Failed to save song');
    }
  }

  async function handleDelete(song: Song) {
    if (!confirm(`Delete "${song.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await apiFetch(`/api/songs/${song.id}`, { method: 'DELETE' });
      await loadSongs();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete song');
    }
  }

  function handleSearch() {
    loadSongs();
  }

  function clearSearch() {
    searchQuery = '';
    loadSongs();
  }
</script>

<div class="sys-page">
  <div class="sys-page-header">
    <div>
      <h1 class="sys-title">Songs</h1>
      <p class="sys-subtitle">Manage your worship song library</p>
    </div>
    <button class="sys-btn sys-btn--primary" on:click={openAddModal}>
      + Add Song
    </button>
  </div>

  <div class="sys-toolbar">
    <div class="sys-search">
      <input
        class="sys-input"
        type="text"
        placeholder="Search songs by title or artist..."
        bind:value={searchQuery}
        on:keydown={(e) => e.key === 'Enter' && handleSearch()}
      />
    </div>
    <button class="sys-btn sys-btn--secondary" on:click={handleSearch}>Search</button>
    {#if searchQuery}
      <button class="sys-btn sys-btn--secondary" on:click={clearSearch}>Clear</button>
    {/if}
  </div>

  {#if loading}
    <div class="sys-state">Loading songs...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>Error: {error}</p>
      <button class="sys-btn sys-btn--danger" on:click={loadSongs}>Retry</button>
    </div>
  {:else if songs.length === 0}
    <div class="sys-state sys-state--empty">
      {#if searchQuery}
        <p>No songs found matching "{searchQuery}"</p>
        <button class="sys-btn sys-btn--secondary" on:click={clearSearch}>Clear search</button>
      {:else}
        <p>No songs in your library yet.</p>
        <button class="sys-btn sys-btn--primary" on:click={openAddModal}>Add your first song</button>
      {/if}
    </div>
  {:else}
    <div class="sys-grid sys-grid--cards">
      {#each songs as song}
        <div class="sys-card song-card">
          <div class="song-header">
            <h3 class="sys-card-title">{song.title}</h3>
            <div class="song-actions">
              <button class="sys-icon-btn" on:click={() => openEditModal(song)} title="Edit">
                ✏️
              </button>
              <button class="sys-icon-btn sys-icon-btn--danger" on:click={() => handleDelete(song)} title="Delete">
                🗑️
              </button>
            </div>
          </div>

          {#if song.artist}
            <div class="song-artist">by {song.artist}</div>
          {/if}

          <div class="song-details">
            {#if song.key}
              <span class="detail-item">
                <span class="label">Key:</span> {song.key}
              </span>
            {/if}
            {#if song.bpm}
              <span class="detail-item">
                <span class="label">BPM:</span> {song.bpm}
              </span>
            {/if}
            {#if song.ccli_number}
              <span class="detail-item">
                <span class="label">CCLI:</span> {song.ccli_number}
              </span>
            {/if}
          </div>

          {#if song.notes}
            <div class="song-notes">{song.notes}</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<SongModal
  bind:this={modalComponent}
  bind:open={modalOpen}
  song={editingSong}
  on:close={closeModal}
  on:save={handleSave}
/>

<style>
  /* Song-specific styles only - layout handled by sys-* classes */
  .song-card {
    padding: 1.5rem;
  }

  .song-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
    gap: 1rem;
  }

  .song-actions {
    display: flex;
    gap: 0.25rem;
  }

  .song-artist {
    color: var(--sys-muted);
    font-size: 0.9375rem;
    margin-bottom: 1rem;
  }

  .song-details {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .detail-item {
    font-size: 0.875rem;
    color: var(--sys-muted);
  }

  .label {
    font-weight: 600;
    color: var(--sys-text);
  }

  .song-notes {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--sys-panel);
    border-radius: 6px;
    font-size: 0.875rem;
    color: var(--sys-muted);
    line-height: 1.5;
  }
</style>