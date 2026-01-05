<script lang="ts">
  import { onMount } from 'svelte';
  import { apiJson, apiFetch } from '$lib/api';
  import SongModal from '$lib/components/SongModal.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import type { ParsedSong, SongSourceFormat } from '$lib/songs/types';

  interface Song {
    id: string;
    title: string;
    artist: string | null;
    key: string | null;
    bpm: number | null;
    ccli_number: string | null;
    notes: string | null;
    source_format: SongSourceFormat;
    raw_text: string | null;
    parsed_json: ParsedSong | null;
    parser_warnings: string[];
    arrangement_count: number;
    created_at: string;
    updated_at: string;
  }

  type SongFormPayload = {
    title: string;
    artist: string | null;
    key: string | null;
    bpm: number | null;
    ccli_number: string | null;
    notes: string | null;
    source_format: SongSourceFormat;
    raw_text: string | null;
  };

  const MAX_PREVIEW_LINES = 6;

  let songs: Song[] = [];
  let loading = true;
  let error = '';
  let searchQuery = '';

  // Modal state
  let modalOpen = false;
  let editingSong: Song | null = null;
  let modalComponent: SongModal;

  function formatSourceFormat(format: SongSourceFormat) {
    return format === 'chordpro' ? 'ChordPro' : 'Plain text';
  }

  function buildLyricsPreview(song: Song): string | null {
    const sections = song.parsed_json?.sections;
    if (!sections || sections.length === 0) {
      return null;
    }

    const lines: string[] = [];
    for (const section of sections) {
      lines.push(section.label.toUpperCase());
      for (const line of section.lines) {
        if (line.lyrics) {
          lines.push(line.lyrics);
        } else if (line.chords.length) {
          lines.push(line.chords.map((chord) => chord.chord).join(' '));
        }
        if (lines.length >= MAX_PREVIEW_LINES) break;
      }
      if (lines.length >= MAX_PREVIEW_LINES) break;
      lines.push('');
    }

    return lines.slice(0, MAX_PREVIEW_LINES).join('\n').trim() || null;
  }

  function showParserWarnings(warnings?: string[]) {
    if (!warnings || warnings.length === 0) return;
    alert(`Song saved with warnings:\n- ${warnings.join('\n- ')}`);
  }

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

  async function handleSave(e: CustomEvent<SongFormPayload>) {
    const songData = e.detail;

    try {
      modalComponent.setSaving(true);

      const url = editingSong?.id ? `/api/songs/${editingSong.id}` : '/api/songs';
      const method = editingSong?.id ? 'PUT' : 'POST';
      const saved = await apiJson<Song>(url, {
        method,
        body: JSON.stringify(songData)
      });

      closeModal();
      await loadSongs();
      showParserWarnings(saved.parser_warnings);
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

<div class="songs-shell">
  <div class="songs-header">
    <div>
      <h1>Songs</h1>
      <p>Keep lyrics, arrangements, and context in one calm view.</p>
    </div>
    <Button on:click={openAddModal}>+ Add Song</Button>
  </div>

  <div class="songs-toolbar">
    <Input
      placeholder="Search songs by title or artist..."
      bind:value={searchQuery}
      on:keydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <Button variant="secondary" on:click={handleSearch}>Search</Button>
    {#if searchQuery}
      <Button variant="ghost" on:click={clearSearch}>Clear</Button>
    {/if}
  </div>

  {#if loading}
    <div class="songs-state">Loading songs...</div>
  {:else if error}
    <div class="songs-state songs-state--error">
      <p>{error}</p>
      <Button variant="primary" on:click={loadSongs}>Retry</Button>
    </div>
  {:else if songs.length === 0}
    <div class="songs-state songs-state--empty">
      {#if searchQuery}
        <p>No songs found matching “{searchQuery}”.</p>
        <Button variant="secondary" on:click={clearSearch}>Clear search</Button>
      {:else}
        <p>No songs in your library yet.</p>
        <Button on:click={openAddModal}>Add your first song</Button>
      {/if}
    </div>
  {:else}
    <div class="songs-grid">
      {#each songs as song}
        {@const preview = buildLyricsPreview(song)}
        {@const warnings = song.parser_warnings ?? []}
        <Card elevated={false}>
          <svelte:fragment slot="header">
            <div class="song-card__header">
              <div>
                <p class="song-card__format">{formatSourceFormat(song.source_format)}</p>
                <h3>{song.title}</h3>
                {#if song.artist}
                  <p class="song-card__artist">{song.artist}</p>
                {/if}
              </div>
              <div class="song-card__actions">
                {#if warnings.length}
                  <Badge variant="warning">Warnings</Badge>
                {/if}
                <Badge variant="muted">
                  {song.arrangement_count} {song.arrangement_count === 1 ? 'arrangement' : 'arrangements'}
                </Badge>
                <div class="song-card__action-buttons">
                  <Button variant="ghost" size="sm" on:click={() => openEditModal(song)}>Edit</Button>
                  <Button variant="ghost" size="sm" on:click={() => handleDelete(song)}>Delete</Button>
                </div>
              </div>
            </div>
          </svelte:fragment>

          <div class="song-card__meta">
            {#if song.key}
              <div>
                <span class="meta-label">Key</span>
                <span class="meta-value">{song.key}</span>
              </div>
            {/if}
            {#if song.bpm}
              <div>
                <span class="meta-label">BPM</span>
                <span class="meta-value">{song.bpm}</span>
              </div>
            {/if}
            {#if song.ccli_number}
              <div>
                <span class="meta-label">CCLI</span>
                <span class="meta-value">{song.ccli_number}</span>
              </div>
            {/if}
          </div>

          <div class="song-card__preview">
            {#if preview}
              <pre>{preview}</pre>
            {:else}
              <p>No lyrics stored yet.</p>
            {/if}
          </div>

          {#if song.notes}
            <div class="song-card__notes">{song.notes}</div>
          {/if}

          {#if warnings.length}
            <div class="song-card__warning-panel">
              <strong>Warnings</strong>
              <ul>
                {#each warnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </Card>
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
  .songs-shell {
    max-width: 1100px;
    margin: 0 auto;
    padding: var(--ui-space-6) var(--ui-space-4);
  }

  .songs-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--ui-space-4);
    margin-bottom: var(--ui-space-4);
  }

  .songs-header h1 {
    margin: 0;
    font-size: var(--ui-font-size-xl);
    color: var(--ui-color-text);
  }

  .songs-header p {
    margin: var(--ui-space-1) 0 0;
    color: var(--ui-color-text-muted);
  }

  .songs-toolbar {
    display: flex;
    gap: var(--ui-space-3);
    align-items: center;
    margin-bottom: var(--ui-space-5);
  }

  .songs-toolbar :global(.ui-input) {
    flex: 1;
  }

  .songs-state {
    border: 1px dashed var(--ui-color-border);
    border-radius: var(--ui-radius-lg);
    padding: var(--ui-space-6);
    text-align: center;
    background: var(--ui-color-surface);
    color: var(--ui-color-text-muted);
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
    align-items: center;
  }

  .songs-state--error {
    border-color: color-mix(in srgb, var(--ui-color-danger) 40%, white);
    color: var(--ui-color-danger);
  }

  .songs-state--empty {
    border-style: solid;
    border-color: var(--ui-color-border);
  }

  .songs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--ui-space-4);
  }

  .song-card__header {
    display: flex;
    justify-content: space-between;
    gap: var(--ui-space-3);
    align-items: flex-start;
  }

  .song-card__format {
    margin: 0 0 var(--ui-space-1);
    font-size: var(--ui-font-size-sm);
    color: var(--ui-color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .song-card__header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--ui-color-text);
  }

  .song-card__artist {
    margin: var(--ui-space-1) 0 0;
    color: var(--ui-color-text-muted);
    font-size: var(--ui-font-size-sm);
  }

  .song-card__actions {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    align-items: flex-end;
  }

  .song-card__action-buttons {
    display: flex;
    gap: var(--ui-space-2);
  }

  .song-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-4);
    margin-bottom: var(--ui-space-4);
  }

  .song-card__meta .meta-label {
    display: block;
    font-size: var(--ui-font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--ui-color-text-muted);
  }

  .song-card__meta .meta-value {
    font-weight: 600;
    color: var(--ui-color-text);
  }

  .song-card__preview {
    background: var(--ui-color-surface-muted);
    border-radius: var(--ui-radius-md);
    padding: var(--ui-space-3);
    min-height: 4.5rem;
    margin-bottom: var(--ui-space-3);
  }

  .song-card__preview pre {
    margin: 0;
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
    font-size: var(--ui-font-size-sm);
    white-space: pre-wrap;
    color: var(--ui-color-text);
  }

  .song-card__preview p {
    margin: 0;
    color: var(--ui-color-text-muted);
    font-size: var(--ui-font-size-sm);
  }

  .song-card__notes {
    padding: var(--ui-space-3);
    border-radius: var(--ui-radius-md);
    background: var(--ui-color-surface-muted);
    color: var(--ui-color-text-muted);
    font-size: var(--ui-font-size-sm);
    margin-bottom: var(--ui-space-3);
    line-height: 1.4;
  }

  .song-card__warning-panel {
    border-radius: var(--ui-radius-md);
    border: 1px solid color-mix(in srgb, var(--ui-color-warning) 35%, white);
    background: color-mix(in srgb, var(--ui-color-warning) 10%, #fffdf5);
    color: var(--ui-color-warning);
    font-size: var(--ui-font-size-sm);
    padding: var(--ui-space-3);
    line-height: 1.4;
  }

  .song-card__warning-panel ul {
    margin: var(--ui-space-2) 0 0;
    padding-left: var(--ui-space-4);
  }

  @media (max-width: 640px) {
    .songs-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .song-card__actions {
      align-items: flex-start;
    }

    .song-card__action-buttons {
      width: 100%;
      flex-direction: column;
    }
  }
</style>
