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
  <header>
    <div class="header-content">
      <div class="title-section">
        <h1>Songs</h1>
        <p>Manage your worship song library</p>
      </div>
      <button class="sys-btn sys-btn--primary" on:click={openAddModal}>
        <span class="plus">+</span> Add Song
      </button>
    </div>

    <div class="sys-search">
      <input class="sys-input"
        type="text"
        placeholder="Search songs by title or artist..."
        bind:value={searchQuery}
        on:keydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button class="btn-search" on:click={handleSearch}>Search</button>
      {#if searchQuery}
        <button class="btn-clear" on:click={clearSearch}>Clear</button>
      {/if}
    </div>
  </header>

  {#if loading}
    <div class="sys-state">Loading songs...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>Error: {error}</p>
      <button on:click={loadSongs}>Retry</button>
    </div>
  {:else if songs.length === 0}
    <div class="sys-state sys-state--empty">
      {#if searchQuery}
        <p>No songs found matching "{searchQuery}"</p>
        <button on:click={clearSearch}>Clear search</button>
      {:else}
        <p>No songs in your library yet.</p>
        <button on:click={openAddModal}>Add your first song</button>
      {/if}
    </div>
  {:else}
    <div class="songs-grid">
      {#each songs as song}
        <div class="song-card">
          <div class="song-header">
            <h3>{song.title}</h3>
            <div class="song-actions">
              <button class="btn-icon" on:click={() => openEditModal(song)} title="Edit">
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
  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  header {
    margin-bottom: 2rem;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    gap: 2rem;
  }

  .title-section {
    flex: 1;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: #1a1a1a;
  }

  header p {
    color: #666;
    font-size: 1.1rem;
    margin: 0;
  }

  .btn-add {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-add:hover {
    background: #1565c0;
  }

  .plus {
    font-size: 1.25rem;
    font-weight: 300;
  }

  .search-bar {
    display: flex;
    gap: 0.5rem;
  }

  .search-bar input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
  }

  .search-bar input:focus {
    outline: none;
    border-color: #1976d2;
    box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.1);
  }

  .btn-search, .btn-clear {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-search {
    background: #f0f0f0;
    border: 1px solid #ddd;
    color: #333;
  }

  .btn-search:hover {
    background: #e5e5e5;
  }

  .btn-clear {
    background: white;
    border: 1px solid #ddd;
    color: #666;
  }

  .btn-clear:hover {
    background: #f5f5f5;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 3rem;
    background: #f5f5f5;
    border-radius: 8px;
    margin-top: 2rem;
  }

  .error {
    background: #fee;
    color: #c00;
  }

  .error button, .empty button {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .error button {
    background: #c00;
  }

  .error button:hover {
    background: #a00;
  }

  .empty button:hover {
    background: #1565c0;
  }

  .songs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .song-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.2s;
  }

  .song-card:hover {
    border-color: #1976d2;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .song-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
    gap: 1rem;
  }

  h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
    flex: 1;
    line-height: 1.3;
  }

  .song-actions {
    display: flex;
    gap: 0.25rem;
  }

  .btn-icon {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 6px;
    transition: all 0.2s;
    opacity: 0.6;
  }

  .btn-icon:hover {
    opacity: 1;
    background: #f0f0f0;
  }

  .btn-danger:hover {
    background: #fee;
  }

  .song-artist {
    color: #666;
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
    color: #666;
  }

  .label {
    font-weight: 600;
    color: #1a1a1a;
  }

  .song-notes {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 6px;
    font-size: 0.875rem;
    color: #666;
    line-height: 1.5;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 2rem;
    }

    .header-content {
      flex-direction: column;
      gap: 1rem;
    }

    .btn-add {
      width: 100%;
      justify-content: center;
    }

    .songs-grid {
      grid-template-columns: 1fr;
    }

    .search-bar {
      flex-direction: column;
    }

    .btn-search, .btn-clear {
      width: 100%;
    }
  }
</style>