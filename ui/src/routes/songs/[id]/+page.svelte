<script lang="ts">
  import { page } from '$app/stores';
  import { apiFetch, apiJson } from '$lib/api';
  import ObjectMark from '$lib/components/identity/ObjectMark.svelte';
  import SongModal from '$lib/components/SongModal.svelte';
  import { onMount } from 'svelte';

  // --- Interfaces ---
  interface Song {
    id: string;
    title: string;
    artist: string | null;
    key: string | null; // e.g. "G"
    bpm: number | null;
    ccli_number: string | null;
    notes: string | null;
    content: string | null; // Lyrics/Chords
    created_at: string;
  }

  // NOTE: Schema Conflict Warning
  // The database likely still calls these "service_songs" or "plans",
  // but in the UI we strictly refer to them as "Gatherings".
  interface UsageHistory {
    id: string; // gathering_id
    date: string;
    name: string; // e.g., "Sunday Service"
  }

  // --- State ---
  let loading = true;
  let error = '';
  let song: Song | null = null;
  let history: UsageHistory[] = []; // Placeholder for "Liturgy Track"

  // Tab State for "Calm" navigation
  type Tab = 'resources' | 'lyrics' | 'history';
  let activeTab: Tab = 'resources';

  // Modal State
  let modalOpen = false;
  let modalComponent: SongModal;

  // --- Init ---
  onMount(async () => {
    await loadSong();
  });

  async function loadSong() {
    loading = true;
    try {
      const songId = $page.params.id;
      // Fetch Song Details
      song = await apiJson<Song>(`/api/songs/${songId}`);

      // TODO: Fetch History (commented out until API endpoint exists)
      // history = await apiJson<UsageHistory[]>(`/api/songs/${songId}/history`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load song';
    } finally {
      loading = false;
    }
  }

  // --- Actions ---

  // Integrity Check: Archive, Don't Delete
  async function handleArchive() {
    if (!song) return;
    const confirmMsg = `Archive "${song.title}"?\n\nThis will hide it from new plans but preserve its history in past gatherings.`;

    if (confirm(confirmMsg)) {
      try {
        await apiFetch(`/api/songs/${song.id}`, { method: 'DELETE' }); // API handles this as soft-delete
        window.location.href = '/songs';
      } catch (e) {
        alert('Failed to archive song: ' + (e instanceof Error ? e.message : 'Unknown error'));
      }
    }
  }

  function openEditModal() {
    if (song) modalOpen = true;
  }

  async function handleSave(e: CustomEvent<any>) {
    try {
      modalComponent.setSaving(true);
      // Update logic would go here
      await apiFetch(`/api/songs/${song?.id}`, {
        method: 'PUT',
        body: JSON.stringify(e.detail)
      });
      await loadSong();
      modalOpen = false;
    } catch (err) {
      modalComponent.setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  function getInitials(title: string) {
    return title.substring(0, 2).toUpperCase();
  }
</script>

<div class="sys-page">
  {#if loading}
    <div class="sys-state">Loading song...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>{error}</p>
      <a href="/songs" class="sys-btn sys-btn--secondary">Back to Songs</a>
    </div>
  {:else if song}

    <div class="sys-page-header">
      <div style="display: flex; gap: 16px; align-items: center;">
        <a href="/songs" class="sys-back-link" title="Back to Songs">←</a>
        <ObjectMark variant="songs" size="lg" label={getInitials(song.title)} />
        <div>
          <h1 class="sys-title">{song.title}</h1>
          <p class="sys-subtitle">
            {song.artist || 'Unknown Artist'}
            {#if song.ccli_number} • CCLI #{song.ccli_number}{/if}
          </p>
        </div>
      </div>

      <div class="header-actions">
        <button class="sys-btn sys-btn--secondary" on:click={openEditModal}>Edit Details</button>
      </div>
    </div>

    <div class="sys-tabs">
      <button
        class="sys-tab"
        class:active={activeTab === 'resources'}
        on:click={() => activeTab = 'resources'}
      >
        Resources & Keys
      </button>
      <button
        class="sys-tab"
        class:active={activeTab === 'lyrics'}
        on:click={() => activeTab = 'lyrics'}
      >
        Lyrics
      </button>
      <button
        class="sys-tab"
        class:active={activeTab === 'history'}
        on:click={() => activeTab = 'history'}
      >
        Usage History
      </button>
    </div>

    <div class="content-grid">

      <div class="main-column">

        {#if activeTab === 'resources'}

          <div class="sys-card section-card">
            <div class="card-header">
              <h3>Original Arrangement</h3>
              <span class="badge">{song.key || 'No Key'}</span>
            </div>

            <div class="resource-list">
              <div class="empty-state-small">
                <span class="icon">📄</span>
                <p>No PDF charts or files attached yet.</p>
                <button class="sys-btn sys-btn--sm sys-btn--secondary">+ Add File</button>
              </div>
            </div>
          </div>

          {:else if activeTab === 'lyrics'}
          <div class="sys-card lyric-card">
            <pre class="lyrics-preview">{song.content || 'No lyrics or content available.'}</pre>
          </div>

        {:else if activeTab === 'history'}
          <div class="sys-card">
            {#if history.length === 0}
              <div class="empty-state-small">
                <p>This song hasn't been scheduled in any gatherings yet.</p>
              </div>
            {:else}
              <ul class="history-list">
                {#each history as event}
                  <li>
                    <span class="date">{event.date}</span>
                    <span class="name">{event.name}</span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
      </div>

      <div class="sidebar">
        <div class="sys-card meta-card">
          <h3>Attributes</h3>

          <div class="meta-row">
            <label>BPM</label>
            <span>{song.bpm || '—'}</span>
          </div>

          <div class="meta-row">
            <label>Default Key</label>
            <span>{song.key || '—'}</span>
          </div>

          <div class="meta-row">
            <label>Themes</label>
            <span class="text-muted italic">No tags</span>
            </div>
        </div>

        {#if song.notes}
          <div class="sys-card note-card">
            <h3>Notes</h3>
            <p>{song.notes}</p>
          </div>
        {/if}

        <div class="danger-zone">
          <button class="sys-btn-link text-red" on:click={handleArchive}>
            Archive Song
          </button>
        </div>
      </div>
    </div>

  {/if}

  <SongModal
    bind:this={modalComponent}
    bind:open={modalOpen}
    song={song}
    on:close={() => modalOpen = false}
    on:save={handleSave}
  />
</div>

<style>
  /* Local Layout Styles */
  .sys-back-link {
    font-size: 1.5rem;
    text-decoration: none;
    color: var(--sys-muted);
    line-height: 1;
    padding-bottom: 4px;
  }

  .sys-back-link:hover {
    color: var(--sys-primary);
  }

  .content-grid {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 24px;
    margin-top: 24px;
  }

  @media (max-width: 768px) {
    .content-grid {
      grid-template-columns: 1fr;
    }
  }

  /* Tabs Styling */
  .sys-tabs {
    display: flex;
    gap: 24px;
    border-bottom: 1px solid var(--sys-border);
    margin-top: 24px;
  }

  .sys-tab {
    background: none;
    border: none;
    padding: 12px 4px;
    font-size: 0.95rem;
    color: var(--sys-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .sys-tab:hover {
    color: var(--sys-text);
  }

  .sys-tab.active {
    color: var(--sys-primary);
    border-bottom-color: var(--sys-primary);
    font-weight: 500;
  }

  /* Card Internals */
  .section-card {
    min-height: 200px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--sys-border-light);
  }

  .card-header h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .badge {
    background: var(--sys-bg-subtle);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .empty-state-small {
    text-align: center;
    padding: 32px;
    color: var(--sys-muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .empty-state-small .icon {
    font-size: 2rem;
    opacity: 0.5;
  }

  /* Lyric Preview */
  .lyric-card {
    background: #fafafa; /* Slight distinct background for content */
  }

  .lyrics-preview {
    white-space: pre-wrap;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9rem;
    color: var(--sys-text);
    line-height: 1.6;
    margin: 0;
  }

  /* Sidebar Meta */
  .meta-card h3, .note-card h3 {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sys-muted);
    margin: 0 0 16px 0;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid var(--sys-border-light);
    font-size: 0.9rem;
  }

  .meta-row:last-child {
    border-bottom: none;
  }

  .meta-row label {
    color: var(--sys-muted);
  }

  .danger-zone {
    margin-top: 24px;
    text-align: right;
  }

  .text-red {
    color: #dc2626;
    font-size: 0.85rem;
  }

  .text-red:hover {
    text-decoration: underline;
  }
</style>
