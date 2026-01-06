<script lang="ts">
  import { apiFetch, apiJson } from '$lib/api';
  import ObjectMark from '$lib/components/identity/ObjectMark.svelte';
  import SongModal from '$lib/components/SongModal.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Card from '$lib/components/ui/Card.svelte';
  import type { ParsedSong, SongSourceFormat } from '$lib/songs/types';
  import type { SongsViewMode } from '$lib/stores/songsPrefs';
  import { songsPrefs } from '$lib/stores/songsPrefs';
  import type { TableAffordances, TableRowAction, TableSortField } from '$lib/types/table';
  import { onMount } from 'svelte';

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
  type SongSortField = 'title' | 'key' | 'bpm' | 'updated';
  type SortDir = 'asc' | 'desc';

  let songs: Song[] = [];
  let loading = true;
  let error = '';
  let searchQuery = '';
  let viewMode: SongsViewMode = 'table';
  let tableSortBy: SongSortField = 'title';
  let tableSortDir: SortDir = 'asc';
  let tableSongs: Song[] = [];

  // Modal state
  let modalOpen = false;
  let editingSong: Song | null = null;
  let modalComponent: SongModal;

  function formatSourceFormat(format: SongSourceFormat) {
    return format === 'chordpro' ? 'ChordPro' : 'Plain text';
  }

  const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

  function formatTimestamp(value?: string | null) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return dateFormatter.format(date);
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

  $: viewMode = $songsPrefs.viewMode;

  function setViewMode(mode: SongsViewMode) {
    songsPrefs.update((prefs) => ({ ...prefs, viewMode: mode }));
  }

  function toggleSort(field: SongSortField) {
    if (tableSortBy === field) {
      tableSortDir = tableSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      tableSortBy = field;
      tableSortDir = 'asc';
    }
  }

  function getSongInitial(title?: string | null) {
    if (!title) return '♪';
    const trimmed = title.trim();
    return trimmed ? trimmed[0].toUpperCase() : '♪';
  }

  function compareSongs(a: Song, b: Song, field: SongSortField) {
    const dir = tableSortDir === 'asc' ? 1 : -1;
    const getString = (value: string | null | undefined) => (value ?? '').toLowerCase();
    const getNumber = (value: number | null | undefined) => (value ?? Number.NEGATIVE_INFINITY);
    const getDate = (value: string | null | undefined) => {
      if (!value) return 0;
      const ts = new Date(value).getTime();
      return Number.isNaN(ts) ? 0 : ts;
    };

    switch (field) {
      case 'title':
        return getString(a.title).localeCompare(getString(b.title)) * dir;
      case 'key':
        return getString(a.key).localeCompare(getString(b.key)) * dir;
      case 'bpm':
        return (getNumber(a.bpm) - getNumber(b.bpm)) * dir;
      case 'updated':
        return (getDate(a.updated_at ?? a.created_at) - getDate(b.updated_at ?? b.created_at)) * dir;
      default:
        return 0;
    }
  }

  $: tableSongs =
    viewMode === 'table'
      ? songs.slice().sort((a, b) => compareSongs(a, b, tableSortBy))
      : songs;

  type SongSortOption = TableSortField<SongSortField, { columnClass: string }>;
  type SongRowAction = TableRowAction<Song>;

  // Table affordances define how users interact with this domain.
  // This is intentionally explicit to distinguish relational (People)
  // from operational/catalog (Songs) behaviors.
  const songsTableAffordances: TableAffordances<Song, SongSortOption, SongRowAction> = {
    searchPlaceholder: 'Search songs by title or artist...',
    rowLink: (song: Song) => ({
      href: `/songs/${song.id}`,
      label: `Open ${song.title}`
    }),
    sortFields: [
      { field: 'title', label: 'Title', columnClass: 'col-title' },
      { field: 'key', label: 'Key', columnClass: 'col-key' },
      { field: 'bpm', label: 'BPM', columnClass: 'col-bpm' },
      { field: 'updated', label: 'Updated', columnClass: 'col-updated' }
    ],
    rowActions: [
      {
        key: 'view',
        title: 'View song',
        icon: '👁️',
        variant: 'sys-icon-btn--ghost',
        type: 'link',
        href: (song: Song) => `/songs/${song.id}`
      },
      {
        key: 'edit',
        title: 'Edit song',
        icon: '✏️',
        variant: 'sys-icon-btn--ghost',
        type: 'button',
        handler: openEditModal
      },
      {
        key: 'delete',
        title: 'Delete song',
        icon: '🗑️',
        variant: 'sys-icon-btn--ghost sys-icon-btn--danger',
        type: 'button',
        handler: handleDelete
      }
    ]
  };

  const songsColumnSorts = songsTableAffordances.sortFields;
  const getSongsSortMeta = (field: SongSortField) =>
    songsColumnSorts.find((column) => column.field === field)!;

  const titleSort = getSongsSortMeta('title');
  const keySort = getSongsSortMeta('key');
  const bpmSort = getSongsSortMeta('bpm');
  const updatedSort = getSongsSortMeta('updated');
</script>

<div class="sys-page">
  <div class="sys-page-header">
    <div>
      <h1 class="sys-title">Songs</h1>
      <p class="sys-subtitle">Keep lyrics, arrangements, and context in one calm view.</p>
    </div>
    <button class="sys-btn sys-btn--primary" type="button" on:click={openAddModal}>
      + Add Song
    </button>
  </div>

  <div class="sys-toolbar">
    <input
      class="sys-input"
      placeholder={songsTableAffordances.searchPlaceholder}
      bind:value={searchQuery}
      on:keydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <button class="sys-btn sys-btn--secondary" type="button" on:click={handleSearch}>Search</button>
    {#if searchQuery}
      <button class="sys-btn sys-btn--secondary" type="button" on:click={clearSearch}>Clear</button>
    {/if}
  </div>

  <div class="songs-controls">
    <div class="sys-toggle" role="group" aria-label="Songs view mode">
      <button
        type="button"
        class="sys-toggle-btn"
        class:active={viewMode === 'cards'}
        on:click={() => setViewMode('cards')}
        aria-label="Card view"
        title="Card view"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
        </svg>
      </button>
      <button
        type="button"
        class="sys-toggle-btn"
        class:active={viewMode === 'table'}
        on:click={() => setViewMode('table')}
        aria-label="Table view"
        title="Table view"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
        </svg>
      </button>
    </div>
  </div>

  {#if loading}
    <div class="sys-state">Loading songs...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>Error: {error}</p>
      <button class="sys-btn sys-btn--primary" type="button" on:click={loadSongs}>Retry</button>
    </div>
  {:else if songs.length === 0}
    <div class="sys-state sys-state--empty">
      {#if searchQuery}
        <p>No songs found matching “{searchQuery}”.</p>
        <button class="sys-btn sys-btn--secondary" type="button" on:click={clearSearch}>Clear search</button>
      {:else}
        <p>No songs in your library yet.</p>
        <button class="sys-btn sys-btn--primary" type="button" on:click={openAddModal}>
          Add your first song
        </button>
      {/if}
    </div>
  {:else}
    {#if viewMode === 'cards'}
      <div class="songs-grid">
        {#each songs as song}
          {@const preview = buildLyricsPreview(song)}
          {@const warnings = song.parser_warnings ?? []}
          <Card elevated={false}>
            <svelte:fragment slot="header">
              <div class="song-card__header">
                <div class="song-card__identity">
                  <div class="song-card__anchor" aria-hidden="true">
                    <span class="songs-anchor-badge" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <path fill="currentColor" d="M9 5v10.17A3 3 0 1 0 11 18V9h6V5H9z" />
                      </svg>
                    </span>
                    <span class="songs-row-mark">
                      <ObjectMark
                        size="sm"
                        variant="songs"
                        label={getSongInitial(song.title)}
                      />
                    </span>
                  </div>
                  <div>
                    <p class="song-card__format">{formatSourceFormat(song.source_format)}</p>
                    <h3>{song.title}</h3>
                    {#if song.artist}
                      <p class="song-card__artist">{song.artist}</p>
                    {/if}
                  </div>
                </div>
                <div class="song-card__actions">
                  {#if warnings.length}
                    <Badge variant="warning">Warnings</Badge>
                  {/if}
                  <Badge variant="muted">
                    {song.arrangement_count} {song.arrangement_count === 1 ? 'arrangement' : 'arrangements'}
                  </Badge>
                  <div class="song-card__action-buttons">
                    <Button
                      variant="ghost"
                      size="sm"
                      on:click={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openEditModal(song);
                      }}
                    >
                      Edit
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      on:click={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(song);
                      }}
                    >
                      Delete
                    </Button>

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
    {:else}
      <div class="sys-table-wrap">
        <table class="sys-table songs-table" aria-label="Songs table">
          <thead>
              <tr>
                <th scope="col" class="col-photo">Song</th>
              <th scope="col" class={titleSort.columnClass}>
                <button
                  type="button"
                  class="th-btn"
                  on:click={() => toggleSort('title')}
                  aria-label={`Sort by ${titleSort.label.toLowerCase()}`}
                >
                  {titleSort.label}
                  <span class="sort-indicator">
                    {tableSortBy === 'title' ? (tableSortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </button>
              </th>

              <th scope="col" class={keySort.columnClass}>
                <button
                  type="button"
                  class="th-btn"
                  on:click={() => toggleSort('key')}
                  aria-label={`Sort by ${keySort.label.toLowerCase()}`}
                >
                  {keySort.label}
                  <span class="sort-indicator">
                    {tableSortBy === 'key' ? (tableSortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </button>
              </th>

              <th scope="col" class={bpmSort.columnClass}>
                <button
                  type="button"
                  class="th-btn"
                  on:click={() => toggleSort('bpm')}
                  aria-label={`Sort by ${bpmSort.label.toLowerCase()}`}
                >
                  {bpmSort.label}
                  <span class="sort-indicator">
                    {tableSortBy === 'bpm' ? (tableSortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </button>
              </th>

              <th scope="col" class="col-format">Format</th>
              <th scope="col" class="col-warnings">Warnings</th>

              <th scope="col" class={updatedSort.columnClass}>
                <button
                  type="button"
                  class="th-btn"
                  on:click={() => toggleSort('updated')}
                  aria-label={`Sort by ${updatedSort.label.toLowerCase()}`}
                >
                  {updatedSort.label}
                  <span class="sort-indicator">
                    {tableSortBy === 'updated' ? (tableSortDir === 'asc' ? '▲' : '▼') : ''}
                  </span>
                </button>
              </th>
              <th scope="col" class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each tableSongs as song (song.id)}
              {@const warnings = song.parser_warnings ?? []}
              {@const rowLink = songsTableAffordances.rowLink(song)}
              <tr>
                <td class="col-photo">
                  <a href={rowLink.href} class="row-link songs-photo-link" aria-label={rowLink.label}>
                    <span class="songs-anchor-badge" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                        <path fill="currentColor" d="M9 5v10.17A3 3 0 1 0 11 18V9h6V5H9z" />
                      </svg>
                    </span>
                    <span class="songs-row-mark">
                      <ObjectMark
                        size="sm"
                        variant="songs"
                        label={getSongInitial(song.title)}
                      />
                    </span>
                  </a>
                </td>
                <td class="col-title">
                  <a href={rowLink.href} class="row-link">
                    <div class="primary">{song.title}</div>
                    {#if song.artist || song.arrangement_count}
                      <div class="muted songs-row-meta">
                        {#if song.artist}{song.artist}{/if}
                        {#if song.artist && song.arrangement_count}
                          <span aria-hidden="true">&nbsp;·&nbsp;</span>
                        {/if}
                        {#if song.arrangement_count}
                          {song.arrangement_count} {song.arrangement_count === 1 ? 'arrangement' : 'arrangements'}
                        {/if}
                      </div>
                    {/if}
                  </a>
                </td>
                <td class="col-key">{song.key ?? '—'}</td>
                <td class="col-bpm">{song.bpm ?? '—'}</td>
                <td class="col-format">{formatSourceFormat(song.source_format)}</td>
                <td class="col-warnings">
                  {#if warnings.length}
                    <span class="badge badge-warning">Warnings</span>
                  {:else}
                    <span class="muted">—</span>
                  {/if}
                </td>
                <td class="col-updated">{formatTimestamp(song.updated_at ?? song.created_at)}</td>
                <td class="col-actions">
                  <div class="songs-table-actions">
                    {#each songsTableAffordances.rowActions as action (action.key)}
                      {#if action.type === 'link'}
                        <a
                          class={`sys-icon-btn ${action.variant ?? ''}`.trim()}
                          href={action.href(song)}
                          title={action.title}
                          aria-label={`${action.title} ${song.title}`}
                        >
                          {action.icon}
                        </a>
                      {:else}
                        <button
                          class={`sys-icon-btn ${action.variant ?? ''}`.trim()}
                          on:click={() => action.handler(song)}
                          title={action.title}
                          type="button"
                        >
                          {action.icon}
                        </button>
                      {/if}
                    {/each}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
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
  .songs-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .sys-toggle-btn svg {
    pointer-events: none;
  }

  .songs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--ui-space-4);
  }

  .songs-grid :global(.rounded-card) {
    background: white;
    border: 1px solid var(--sys-border);
    box-shadow: var(--sys-shadow-sm);
    transition:
      border-color 0.15s ease,
      box-shadow 0.15s ease;
  }

  .songs-grid :global(.rounded-card:hover) {
    border-color: #cfcfcf;
    box-shadow: var(--sys-shadow-md);
  }

  .songs-view-toggle {
    display: inline-flex;
    gap: 0.5rem;
    padding: 0.25rem;
    border: 1px solid var(--sys-border);
    border-radius: var(--sys-radius-lg);
    background: white;
    margin-bottom: var(--ui-space-4);
  }

  .songs-view-btn {
    border: 0;
    background: transparent;
    padding: 0.35rem 0.9rem;
    border-radius: var(--sys-radius-md);
    cursor: pointer;
    color: var(--sys-muted);
    font-weight: 500;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .songs-view-btn.active {
    background: rgba(99, 102, 241, 0.12);
    color: var(--sys-text);
  }

  .sys-table-wrap {
    margin-top: var(--ui-space-4);
    border: 1px solid var(--sys-border);
    border-radius: var(--sys-radius-lg);
    overflow-x: auto;
    background: white;
  }

  .sys-table {
    width: 100%;
    min-width: 760px;
    border-collapse: separate;
    border-spacing: 0;
  }

  .sys-table th,
  .sys-table td {
    padding: 12px 14px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    vertical-align: middle;
    text-align: left;
  }

  .sys-table thead {
    background: var(--sys-panel);
  }

  .sys-table tbody tr:last-child td {
    border-bottom: none;
  }

  .col-photo {
    width: 110px;
  }

  .col-actions {
    width: 150px;
  }

  .th-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: 0;
    padding: 0;
    font: inherit;
    cursor: pointer;
    color: inherit;
  }

  .th-btn:focus-visible {
    outline: 2px solid var(--gatherings-accent-start);
    outline-offset: 2px;
  }

  .sort-indicator {
    font-size: 12px;
    opacity: 0.7;
  }

  .row-link {
    display: block;
    color: inherit;
    text-decoration: none;
  }

  .row-link:hover .primary {
    text-decoration: underline;
  }

  .songs-photo-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .songs-anchor-badge {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    border: 1px solid color-mix(in srgb, var(--songs-accent) 40%, rgba(0, 0, 0, 0.08));
    background: color-mix(in srgb, var(--songs-accent) 12%, #ffffff);
    color: var(--songs-accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .songs-row-mark {
    display: inline-flex;
    flex-shrink: 0;
  }

  .primary {
    font-weight: 600;
  }

  .muted {
    color: var(--sys-muted);
    font-size: 0.9rem;
  }

  .songs-row-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 500;
    border: 1px solid var(--sys-border);
    background: var(--sys-panel);
  }

  .badge-warning {
    background: #fef3c7;
    border-color: #fcd34d;
    color: #92400e;
  }

  .songs-table-actions {
    display: inline-flex;
    gap: 0.35rem;
  }

  .song-card__header {
    display: flex;
    justify-content: space-between;
    gap: var(--ui-space-3);
    align-items: flex-start;
  }

  .song-card__identity {
    display: flex;
    align-items: flex-start;
    gap: var(--ui-space-3);
  }

  .song-card__anchor {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    flex-shrink: 0;
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
    .songs-controls {
      flex-direction: column;
      align-items: flex-start;
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
