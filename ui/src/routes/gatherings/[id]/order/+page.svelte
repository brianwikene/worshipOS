<script lang="ts">
  import { apiFetch } from '$lib/api';
  import { invalidateAll } from '$app/navigation';

  export let data;

  interface Song {
    id: string;
    song_id: string;
    title: string;
    artist: string | null;
    key: string | null;
    bpm: number | null;
    display_order: number;
    notes: string | null;
  }

  interface AvailableSong {
    id: string;
    title: string;
    artist: string | null;
    key: string | null;
    bpm: number | null;
  }

  $: service = data.service;
  $: songs = data.songs as Song[];
  $: availableSongs = data.availableSongs as AvailableSong[];

  // Add song modal state
  let showAddSongModal = false;
  let searchQuery = '';
  let selectedSongId = '';
  let songKey = '';
  let songNotes = '';
  let addingSong = false;

  // Edit song modal state
  let showEditSongModal = false;
  let editingSong: Song | null = null;
  let editSongKey = '';
  let editSongNotes = '';
  let savingEdit = false;

  // View chart modal state
  let showChartModal = false;
  let chartSong: Song | null = null;

  $: filteredSongs = availableSongs.filter((song) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(query) ||
      (song.artist && song.artist.toLowerCase().includes(query))
    );
  });

  $: selectedSong = availableSongs.find((s) => s.id === selectedSongId);

  function openAddSongModal() {
    showAddSongModal = true;
    searchQuery = '';
    selectedSongId = '';
    songKey = '';
    songNotes = '';
  }

  function closeAddSongModal() {
    showAddSongModal = false;
    searchQuery = '';
    selectedSongId = '';
    songKey = '';
    songNotes = '';
  }

  function selectSong(song: AvailableSong) {
    selectedSongId = song.id;
    songKey = song.key || '';
  }

  async function addSongToService() {
    if (!selectedSongId || !service) {
      alert('Please select a song');
      return;
    }

    try {
      addingSong = true;

      const nextOrder = songs.length > 0 ? Math.max(...songs.map((s) => s.display_order)) + 1 : 1;

      await apiFetch(`/api/gatherings/${service.id}/songs`, {
        method: 'POST',
        body: JSON.stringify({
          song_id: selectedSongId,
          display_order: nextOrder,
          key: songKey || null,
          notes: songNotes || null
        })
      });

      closeAddSongModal();
      await invalidateAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add song');
    } finally {
      addingSong = false;
    }
  }

  async function removeSong(songInstanceId: string) {
    if (!confirm('Remove this song from the service?')) return;
    if (!service) return;

    try {
      await apiFetch(`/api/gatherings/${service.id}/songs/${songInstanceId}`, { method: 'DELETE' });
      await invalidateAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to remove song');
    }
  }

  function openEditSongModal(song: Song) {
    editingSong = song;
    editSongKey = song.key || '';
    editSongNotes = song.notes || '';
    showEditSongModal = true;
  }

  function closeEditSongModal() {
    showEditSongModal = false;
    editingSong = null;
    editSongKey = '';
    editSongNotes = '';
  }

  async function updateSongInService() {
    if (!editingSong || !service) return;

    try {
      savingEdit = true;
      await apiFetch(`/api/gatherings/${service.id}/songs/${editingSong.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          key: editSongKey || null,
          notes: editSongNotes || null,
          display_order: editingSong.display_order
        })
      });

      closeEditSongModal();
      await invalidateAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to update song');
    } finally {
      savingEdit = false;
    }
  }

  function openChartModal(song: Song) {
    chartSong = song;
    showChartModal = true;
  }

  function closeChartModal() {
    showChartModal = false;
    chartSong = null;
  }
</script>

<div class="section songs-section">
  <div class="section-header">
    <h2>Setlist ({songs.length})</h2>
    <button class="icon-btn" on:click={openAddSongModal} title="Add song">+</button>
  </div>

  {#if songs.length === 0}
    <div class="empty-state">
      <p>No songs added yet</p>
      <button class="primary-btn" on:click={openAddSongModal}>Add First Song</button>
    </div>
  {:else}
    <div class="songs-list">
      {#each songs as song, index}
        <div class="song-item">
          <div class="song-number">{index + 1}</div>
          <div class="song-info">
            <div class="song-title">{song.title}</div>
            {#if song.artist}
              <div class="song-artist">by {song.artist}</div>
            {/if}
            <div class="song-details">
              {#if song.key}
                <span class="detail">Key: {song.key}</span>
              {/if}
              {#if song.bpm}
                <span class="detail">BPM: {song.bpm}</span>
              {/if}
            </div>
            {#if song.notes}
              <div class="song-notes">{song.notes}</div>
            {/if}
          </div>
          <div class="song-actions">
            <button class="icon-btn" on:click={() => openChartModal(song)} title="View chart"
              >📄</button
            >
            <button class="icon-btn" on:click={() => openEditSongModal(song)} title="Edit">✏️</button
            >
            <button class="icon-btn delete" on:click={() => removeSong(song.id)} title="Remove"
              >×</button
            >
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Song Modal -->
{#if showAddSongModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    on:click={closeAddSongModal}
    on:keydown={(e) => e.key === 'Escape' && closeAddSongModal()}
  >
    <div
      class="modal add-song-modal"
      role="dialog"
      aria-modal="true"
      on:click|stopPropagation
      on:keydown={(e) => e.key === 'Escape' && closeAddSongModal()}
    >
      <div class="modal-header">
        <h2>Add Song to Service</h2>
        <button class="close-btn" on:click={closeAddSongModal}>×</button>
      </div>

      <div class="modal-body">
        <!-- Search -->
        <div class="search-box">
          <input type="text" placeholder="Search songs..." bind:value={searchQuery} />
        </div>

        <!-- Song List -->
        <div class="song-select-list">
          {#if filteredSongs.length === 0}
            <div class="empty-message">
              {searchQuery ? 'No songs found' : 'No songs available'}
            </div>
          {:else}
            {#each filteredSongs as song}
              <button
                type="button"
                class="song-select-item"
                class:selected={selectedSongId === song.id}
                on:click={() => selectSong(song)}
              >
                <div class="song-select-info">
                  <div class="song-select-title">{song.title}</div>
                  {#if song.artist}
                    <div class="song-select-artist">by {song.artist}</div>
                  {/if}
                  <div class="song-select-meta">
                    {#if song.key}
                      <span>Key: {song.key}</span>
                    {/if}
                    {#if song.bpm}
                      <span>BPM: {song.bpm}</span>
                    {/if}
                  </div>
                </div>
                {#if selectedSongId === song.id}
                  <span class="checkmark">✓</span>
                {/if}
              </button>
            {/each}
          {/if}
        </div>

        <!-- Song Details (when selected) -->
        {#if selectedSong}
          <div class="song-details-form">
            <h3>Song Details</h3>

            <div class="form-group">
              <label for="key">Key (optional override)</label>
              <input
                id="key"
                type="text"
                bind:value={songKey}
                placeholder={selectedSong.key || 'e.g., G'}
              />
            </div>

            <div class="form-group">
              <label for="notes">Notes (optional)</label>
              <textarea
                id="notes"
                bind:value={songNotes}
                placeholder="e.g., Skip verse 2, extended intro"
                rows="2"
              ></textarea>
            </div>
          </div>
        {/if}
      </div>

      <div class="modal-actions">
        <button class="secondary-btn" on:click={closeAddSongModal}> Cancel </button>
        <button class="primary-btn" on:click={addSongToService} disabled={!selectedSongId || addingSong}>
          {addingSong ? 'Adding...' : 'Add Song'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Song Modal -->
{#if showEditSongModal && editingSong}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    on:click={closeEditSongModal}
    on:keydown={(e) => e.key === 'Escape' && closeEditSongModal()}
  >
    <div
      class="modal edit-song-modal"
      role="dialog"
      aria-modal="true"
      on:click|stopPropagation
      on:keydown={(e) => e.key === 'Escape' && closeEditSongModal()}
    >
      <div class="modal-header">
        <h2>Edit Song</h2>
        <button class="close-btn" on:click={closeEditSongModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="song-info-display">
          <div class="song-title-large">{editingSong.title}</div>
          {#if editingSong.artist}
            <div class="song-artist-display">by {editingSong.artist}</div>
          {/if}
        </div>

        <div class="form-group">
          <label for="edit-key">Key</label>
          <input id="edit-key" type="text" bind:value={editSongKey} placeholder="e.g., G, Am, Bb" />
        </div>

        <div class="form-group">
          <label for="edit-notes">Notes</label>
          <textarea
            id="edit-notes"
            bind:value={editSongNotes}
            placeholder="e.g., Skip verse 2, extended intro"
            rows="3"
          ></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="secondary-btn" on:click={closeEditSongModal}> Cancel </button>
        <button class="primary-btn" on:click={updateSongInService} disabled={savingEdit}>
          {savingEdit ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- View Chart Modal -->
{#if showChartModal && chartSong}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    on:click={closeChartModal}
    on:keydown={(e) => e.key === 'Escape' && closeChartModal()}
  >
    <div
      class="modal chart-modal"
      role="dialog"
      aria-modal="true"
      on:click|stopPropagation
      on:keydown={(e) => e.key === 'Escape' && closeChartModal()}
    >
      <div class="modal-header">
        <h2>{chartSong.title}</h2>
        <button class="close-btn" on:click={closeChartModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="chart-info">
          {#if chartSong.artist}
            <p class="chart-artist">by {chartSong.artist}</p>
          {/if}
          <div class="chart-meta">
            {#if chartSong.key}
              <span class="chart-detail"><strong>Key:</strong> {chartSong.key}</span>
            {/if}
            {#if chartSong.bpm}
              <span class="chart-detail"><strong>BPM:</strong> {chartSong.bpm}</span>
            {/if}
          </div>
          {#if chartSong.notes}
            <div class="chart-notes">
              <strong>Notes:</strong>
              {chartSong.notes}
            </div>
          {/if}
        </div>

        <div class="chart-placeholder">
          <div class="placeholder-icon">🎼</div>
          <p>Chart/lyrics viewer coming soon</p>
          <p class="placeholder-hint">Song charts will be displayed here</p>
        </div>
      </div>

      <div class="modal-actions">
        <button class="secondary-btn" on:click={closeChartModal}> Close </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .section {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 1.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #f0f0f0;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    color: #1a1a1a;
  }

  .icon-btn {
    background: none;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 0.375rem 0.75rem;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: #f5f5f5;
    border-color: #1976d2;
  }

  .icon-btn.delete:hover {
    background: #ffebee;
    border-color: #c62828;
    color: #c62828;
  }

  .primary-btn {
    padding: 0.75rem 1.5rem;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .primary-btn:hover:not(:disabled) {
    background: #1565c0;
  }

  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #999;
  }

  /* Songs Section */
  .songs-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .song-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .song-item:hover {
    background: #e3f2fd;
    border-color: #1976d2;
  }

  .song-number {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1976d2;
    color: white;
    border-radius: 50%;
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .song-info {
    flex: 1;
  }

  .song-title {
    font-weight: 600;
    font-size: 1rem;
    color: #1a1a1a;
    margin-bottom: 0.25rem;
  }

  .song-artist {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.375rem;
  }

  .song-details {
    display: flex;
    gap: 1rem;
    font-size: 0.8125rem;
    color: #666;
  }

  .detail {
    font-weight: 500;
  }

  .song-notes {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: white;
    border-radius: 4px;
    font-size: 0.8125rem;
    color: #666;
    font-style: italic;
  }

  .song-actions {
    display: flex;
    gap: 0.375rem;
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
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .add-song-modal {
    max-width: 700px;
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

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .search-box {
    margin-bottom: 1rem;
  }

  .search-box input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
  }

  .search-box input:focus {
    outline: none;
    border-color: #1976d2;
  }

  .song-select-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .empty-message {
    padding: 2rem;
    text-align: center;
    color: #999;
  }

  .song-select-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 1rem;
    border: none;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
    text-align: left;
  }

  .song-select-item:last-child {
    border-bottom: none;
  }

  .song-select-item:hover {
    background: #f8f9fa;
  }

  .song-select-item.selected {
    background: #e3f2fd;
    border-left: 3px solid #1976d2;
  }

  .song-select-info {
    flex: 1;
  }

  .song-select-title {
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 0.25rem;
  }

  .song-select-artist {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.25rem;
  }

  .song-select-meta {
    font-size: 0.8125rem;
    color: #999;
    display: flex;
    gap: 1rem;
  }

  .checkmark {
    font-size: 1.5rem;
    color: #1976d2;
    font-weight: bold;
  }

  .song-details-form {
    border-top: 2px solid #f0f0f0;
    padding-top: 1.5rem;
  }

  .song-details-form h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #1a1a1a;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #1a1a1a;
    font-size: 0.9375rem;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group textarea:focus {
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
    padding: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  /* Edit Song Modal */
  .edit-song-modal {
    max-width: 500px;
  }

  .song-info-display {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .song-title-large {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 0.25rem;
  }

  .song-artist-display {
    font-size: 0.9375rem;
    color: #666;
  }

  /* Chart Modal */
  .chart-modal {
    max-width: 600px;
  }

  .chart-info {
    margin-bottom: 1.5rem;
  }

  .chart-artist {
    font-size: 1rem;
    color: #666;
    margin: 0 0 1rem 0;
  }

  .chart-meta {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1rem;
  }

  .chart-detail {
    font-size: 0.9375rem;
    color: #1a1a1a;
  }

  .chart-notes {
    background: #f8f9fa;
    padding: 1rem;
    border-radius: 8px;
    font-size: 0.9375rem;
    color: #666;
  }

  .chart-placeholder {
    text-align: center;
    padding: 3rem 2rem;
    background: #f8f9fa;
    border-radius: 12px;
    border: 2px dashed #e0e0e0;
  }

  .placeholder-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .chart-placeholder p {
    margin: 0;
    color: #666;
    font-size: 1rem;
  }

  .placeholder-hint {
    margin-top: 0.5rem !important;
    font-size: 0.875rem !important;
    color: #999 !important;
  }
</style>
