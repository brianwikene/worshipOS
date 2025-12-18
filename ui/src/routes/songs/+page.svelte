<script lang="ts">
  import { onMount } from 'svelte';

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
  let showModal = false;
  let editingSong: Song | null = null;

  // Form fields
  let formTitle = '';
  let formArtist = '';
  let formKey = '';
  let formBpm: number | null = null;
  let formCcli = '';
  let formNotes = '';

  const CHURCH_ID = 'a8c2c7ab-836a-4ef1-a373-562e20babb76';
  const API_BASE = 'http://localhost:3000';

  onMount(() => {
    loadSongs();
  });

  async function loadSongs() {
    try {
      loading = true;
      const url = searchQuery
        ? `${API_BASE}/songs&search=${encodeURIComponent(searchQuery)}`
        : `${API_BASE}/songs`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      songs = await res.json();
      error = '';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load songs';
    } finally {
      loading = false;
    }
  }

  function openCreateModal() {
    editingSong = null;
    formTitle = '';
    formArtist = '';
    formKey = '';
    formBpm = null;
    formCcli = '';
    formNotes = '';
    showModal = true;
  }

  function openEditModal(song: Song) {
    editingSong = song;
    formTitle = song.title;
    formArtist = song.artist || '';
    formKey = song.key || '';
    formBpm = song.bpm;
    formCcli = song.ccli_number || '';
    formNotes = song.notes || '';
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingSong = null;
  }

  async function saveSong() {
    try {
      if (!formTitle.trim()) {
        alert('Song title is required');
        return;
      }

      const songData = {
        church_id: CHURCH_ID,
        title: formTitle,
        artist: formArtist || null,
        key: formKey || null,
        bpm: formBpm,
        ccli_number: formCcli || null,
        notes: formNotes || null
      };

      const url = editingSong
        ? `${API_BASE}/songs/${editingSong.id}`
        : `${API_BASE}/songs`;

      const method = editingSong ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(songData)
      });

      if (!res.ok) throw new Error(`Failed to save: ${res.statusText}`);

      closeModal();
      await loadSongs();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save song');
    }
  }

  async function deleteSong(song: Song) {
    if (!confirm(`Delete "${song.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/songs/${song.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error(`Failed to delete: ${res.statusText}`);

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

<div class="container">
  <header>
    <div class="header-content">
      <div class="title-section">
        <h1>Songs</h1>
        <p>Manage your worship song library</p>
      </div>
      <button class="primary-btn" on:click={openCreateModal}>
        + Add Song
      </button>
    </div>

    <div class="search-bar">
      <input
        type="text"
        placeholder="Search songs by title or artist..."
        bind:value={searchQuery}
        on:keyup={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button class="search-btn" on:click={handleSearch}>Search</button>
      {#if searchQuery}
        <button class="clear-btn" on:click={clearSearch}>Clear</button>
      {/if}
    </div>
  </header>

  {#if loading}
    <div class="loading">Loading songs...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={loadSongs}>Retry</button>
    </div>
  {:else if songs.length === 0}
    <div class="empty">
      <p>No songs found.</p>
      {#if searchQuery}
        <button on:click={clearSearch}>Clear search</button>
      {:else}
        <button on:click={openCreateModal}>Add your first song</button>
      {/if}
    </div>
  {:else}
    <div class="songs-grid">
      {#each songs as song}
        <div class="song-card">
          <div class="song-header">
            <h3>{song.title}</h3>
            <div class="song-actions">
              <button class="icon-btn edit" on:click={() => openEditModal(song)} title="Edit">
                ✏️
              </button>
              <button class="icon-btn delete" on:click={() => deleteSong(song)} title="Delete">
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

<!-- Modal -->
{#if showModal}
  <div class="modal-overlay" on:click={closeModal}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>{editingSong ? 'Edit Song' : 'Add New Song'}</h2>
        <button class="close-btn" on:click={closeModal}>×</button>
      </div>

      <form on:submit|preventDefault={saveSong}>
        <div class="form-group">
          <label for="title">Title *</label>
          <input
            id="title"
            type="text"
            bind:value={formTitle}
            placeholder="Way Maker"
            required
          />
        </div>

        <div class="form-group">
          <label for="artist">Artist</label>
          <input
            id="artist"
            type="text"
            bind:value={formArtist}
            placeholder="Sinach"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="key">Key</label>
            <input
              id="key"
              type="text"
              bind:value={formKey}
              placeholder="G"
              maxlength="5"
            />
          </div>

          <div class="form-group">
            <label for="bpm">BPM</label>
            <input
              id="bpm"
              type="number"
              bind:value={formBpm}
              placeholder="72"
              min="40"
              max="200"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="ccli">CCLI Number</label>
          <input
            id="ccli"
            type="text"
            bind:value={formCcli}
            placeholder="7115744"
          />
        </div>

        <div class="form-group">
          <label for="notes">Notes</label>
          <textarea
            id="notes"
            bind:value={formNotes}
            placeholder="Song structure, arrangement notes, etc."
            rows="3"
          ></textarea>
        </div>

        <div class="modal-actions">
          <button type="button" class="secondary-btn" on:click={closeModal}>
            Cancel
          </button>
          <button type="submit" class="primary-btn">
            {editingSong ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

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
    margin-bottom: 0.5rem;
    color: #1a1a1a;
  }

  header p {
    color: #666;
    font-size: 1.1rem;
  }

  .search-bar {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .search-bar input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
  }

  .search-bar input:focus {
    outline: none;
    border-color: #1976d2;
  }

  .search-btn, .clear-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .search-btn {
    background: #1976d2;
    color: white;
    border: none;
  }

  .search-btn:hover {
    background: #1565c0;
  }

  .clear-btn {
    background: white;
    color: #666;
    border: 1px solid #e0e0e0;
  }

  .clear-btn:hover {
    background: #f5f5f5;
  }

  .primary-btn {
    padding: 0.75rem 1.5rem;
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

  .primary-btn:hover {
    background: #1565c0;
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
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    border: none;
  }

  .error button {
    background: #c00;
    color: white;
  }

  .empty button {
    background: #1976d2;
    color: white;
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
    transform: translateY(-2px);
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
    gap: 0.5rem;
  }

  .icon-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s;
    opacity: 0.6;
  }

  .icon-btn:hover {
    opacity: 1;
    background: #f5f5f5;
  }

  .icon-btn.delete:hover {
    background: #ffebee;
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

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .modal-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #f5f5f5;
  }

  form {
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #1a1a1a;
  }

  input, textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
  }

  input:focus, textarea:focus {
    outline: none;
    border-color: #1976d2;
  }

  textarea {
    resize: vertical;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .secondary-btn {
    padding: 0.75rem 1.5rem;
    background: white;
    color: #666;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .secondary-btn:hover {
    background: #f5f5f5;
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

    .primary-btn {
      width: 100%;
    }

    .songs-grid {
      grid-template-columns: 1fr;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
