<script lang="ts">
  import { page } from '$app/stores';
  import { apiJson } from '$lib/api';
  import type { ParsedLyricLine, ParsedSong, SongSourceFormat } from '$lib/songs/types';

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

  let song: Song | null = null;
  let loading = true;
  let error = '';
  let songId = '';
  let showDirectives = false;
  type RenderLine =
    | { kind: 'blank' }
    | { kind: 'section'; title: string }
    | { kind: 'directive'; raw: string }
    | { kind: 'pair'; chords: string; lyrics: string };

  let renderedLines: RenderLine[] = [];
  let hasDirectiveLines = false;
  let hasRenderablePairs = false;
  type ChartFontSize = 'sm' | 'md' | 'lg';
  type ChartLayout = 'single' | 'double';
  const CHART_PREFS_KEY = 'worshipos:song-chart:prefs';

  let fontSize: ChartFontSize = 'md';
  let chartLayout: ChartLayout = 'single';

  $: songId = $page.params.id;

  let lastLoadedId: string | null = null;

  $: if (songId && songId !== lastLoadedId) {
    lastLoadedId = songId;
    loadSong(songId);
  }

  async function loadSong(id: string) {
    loading = true;
    error = '';
    try {
      song = await apiJson<Song>(`/api/songs/${id}`);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load song';
      song = null;
    } finally {
      loading = false;
    }
  }

  function getRenderableText(current: Song | null): string {
    if (!current) return '';
    if (current.raw_text?.trim()) return current.raw_text;

    const parsed = current.parsed_json;
    if (!parsed) return '';

    const lines: string[] = [];
    for (const section of parsed.sections) {
      lines.push(`[${section.label}]`);
      for (const line of section.lines) {
        if (!line.lyrics && line.chords.length === 0) {
          lines.push('');
          continue;
        }

        const lyrics = line.lyrics ?? '';
        if (!line.chords.length) {
          lines.push(lyrics);
          continue;
        }

        let result = '';
        let cursor = 0;
        const sorted = [...line.chords].sort((a, b) => a.position - b.position);
        for (const chord of sorted) {
          const pos = Math.min(Math.max(chord.position, 0), lyrics.length);
          result += lyrics.slice(cursor, pos) + `[${chord.chord}]`;
          cursor = pos;
        }
        result += lyrics.slice(cursor);
        lines.push(result);
      }
      lines.push('');
    }

    return lines.join('\n').trimEnd();
  }

  function isSectionLine(line: string): string | null {
    const match = line.trim().match(/^\[(.+?)\]$/);
    return match ? match[1] : null;
  }

  function isDirectiveLine(line: string): boolean {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('{c:') && lower.endsWith('}')) return false;
    return trimmed.startsWith('{') && trimmed.endsWith('}') && trimmed.includes(':');
  }

  function renderChordPair(line: string): { chords: string; lyrics: string } {
    let lyrics = '';
    let position = 0;
    const chordChars: string[] = [];

    const ensureLength = (len: number) => {
      while (chordChars.length < len) chordChars.push(' ');
    };

    const placeChord = (label: string) => {
      const clean = label.trim();
      if (!clean) return;
      ensureLength(position + clean.length);
      for (let i = 0; i < clean.length; i += 1) {
        chordChars[position + i] = clean[i];
      }
    };

    for (let i = 0; i < line.length; ) {
      if (line[i] === '[') {
        const end = line.indexOf(']', i + 1);
        if (end > i + 1) {
          placeChord(line.slice(i + 1, end));
          i = end + 1;
          continue;
        }
      }

      if (line[i] === '{' && line.slice(i, i + 3).toLowerCase() === '{c:') {
        const end = line.indexOf('}', i + 3);
        if (end > i + 3) {
          placeChord(line.slice(i + 3, end));
          i = end + 1;
          continue;
        }
      }

      lyrics += line[i];
      position += 1;
      i += 1;
    }

    ensureLength(position);
    const chords = chordChars.join('').replace(/\s+$/g, '');
    return { chords, lyrics };
  }

  function buildRenderLines(text: string): RenderLine[] {
    if (!text) return [];
    return text.replace(/\r\n/g, '\n').split('\n').map<RenderLine>((raw) => {
      if (!raw.trim()) return { kind: 'blank' };

      const section = isSectionLine(raw);
      if (section) return { kind: 'section', title: section };

      if (isDirectiveLine(raw)) {
        return { kind: 'directive', raw };
      }

      const pair = renderChordPair(raw);
      return { kind: 'pair', chords: pair.chords, lyrics: pair.lyrics };
    });
  }

  $: renderableText = getRenderableText(song);
  $: renderedLines = buildRenderLines(renderableText);
  $: hasDirectiveLines = renderedLines.some((line) => line.kind === 'directive');
  $: hasRenderablePairs = renderedLines.some((line) => line.kind === 'pair');

  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem(CHART_PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { fontSize?: ChartFontSize; chartLayout?: ChartLayout };
        if (parsed.fontSize === 'sm' || parsed.fontSize === 'md' || parsed.fontSize === 'lg') {
          fontSize = parsed.fontSize;
        }
        if (parsed.chartLayout === 'single' || parsed.chartLayout === 'double') {
          chartLayout = parsed.chartLayout;
        }
      }
    } catch {
      // ignore malformed storage
    }
  }

  $: if (typeof window !== 'undefined') {
    const payload = JSON.stringify({ fontSize, chartLayout });
    window.localStorage.setItem(CHART_PREFS_KEY, payload);
  }

  function setFontSize(size: ChartFontSize) {
    fontSize = size;
  }

  function setChartLayout(layout: ChartLayout) {
    chartLayout = layout;
  }
</script>

<div class="sys-page">
  <header class="sys-page-header">
    <div class="sys-page-header-main">
      <h1 class="sys-title">{song?.title ?? 'Song details'}</h1>
      <p class="sys-subtitle">ID: {songId}</p>
    </div>
  </header>

  <div class="sys-card song-detail-card">
    {#if loading}
      <p class="muted">Loading song...</p>
    {:else if error}
      <div class="sys-state sys-state--error">
        <p>Error: {error}</p>
        <button class="sys-btn sys-btn--secondary" type="button" on:click={() => loadSong(songId)}>
          Retry
        </button>
      </div>
    {:else if !song}
      <p class="muted">Song not found.</p>
    {:else}
      <section class="song-section">
        <h2>{song.title}</h2>
        {#if song.artist}
          <p class="muted">{song.artist}</p>
        {/if}
      </section>

      <section class="song-body">
        <div class="song-body-header">
          <h3>Chords & Lyrics</h3>
          <div class="chart-toolbar">
            <div class="chart-control-group" role="group" aria-label="Chart font size">
              <button
                class:active={fontSize === 'sm'}
                type="button"
                on:click={() => setFontSize('sm')}
              >
                A-
              </button>
              <button
                class:active={fontSize === 'md'}
                type="button"
                on:click={() => setFontSize('md')}
              >
                A
              </button>
              <button
                class:active={fontSize === 'lg'}
                type="button"
                on:click={() => setFontSize('lg')}
              >
                A+
              </button>
            </div>

            <div class="chart-control-group" role="group" aria-label="Chart layout">
              <button
                class:active={chartLayout === 'single'}
                type="button"
                on:click={() => setChartLayout('single')}
              >
                1 col
              </button>
              <button
                class:active={chartLayout === 'double'}
                type="button"
                on:click={() => setChartLayout('double')}
              >
                2 col
              </button>
            </div>

            {#if hasDirectiveLines}
              <button
                class="sys-btn sys-btn--secondary song-directive-toggle"
                type="button"
                on:click={() => (showDirectives = !showDirectives)}
              >
                {showDirectives ? 'Hide directives' : 'Show directives'}
              </button>
            {/if}
          </div>
        </div>

        {#if hasRenderablePairs}
          <div class={`song-chart song-chart--${fontSize} song-chart--${chartLayout}`}>
            {#each renderedLines as line, idx (idx)}
              {#if line.kind === 'section'}
                <h4 class="chart-section">{line.title}</h4>
              {:else if line.kind === 'blank'}
                <div class="chart-gap" aria-hidden="true"></div>
              {:else if line.kind === 'directive'}
                {#if showDirectives}
                  <div class="chart-directive">{line.raw}</div>
                {/if}
              {:else}
                <div class="chart-pair" aria-label={`Line ${idx + 1}`}>
                  <div class="chart-chords">{line.chords || '\u00A0'}</div>
                  <div class="chart-lyrics">{line.lyrics || '\u00A0'}</div>
                </div>
              {/if}
            {/each}
          </div>
        {:else}
          <p class="muted">No chords or lyrics stored yet.</p>
        {/if}
      </section>
    {/if}
  </div>
</div>

<style>
  .song-detail-card {
    padding: 1.5rem;
  }

  .song-section h2 {
    margin: 0;
  }

  .song-body {
    margin-top: 2rem;
  }

  .song-body-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .chart-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .chart-control-group {
    display: inline-flex;
    border: 1px solid var(--sys-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .chart-control-group button {
    border: none;
    background: transparent;
    padding: 0.25rem 0.6rem;
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--sys-muted);
  }

  .chart-control-group button.active {
    background: var(--sys-text);
    color: white;
  }

  .song-body h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--sys-muted);
  }

  .song-chart {
    margin-top: 1.5rem;
    padding: 1rem;
    border-radius: var(--ui-radius-md);
    background: var(--ui-color-surface-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 1.25rem;
    line-height: 1.7;
    max-width: 60rem;
    column-gap: 2rem;
  }

  .song-chart--single {
    column-count: 1;
  }

  .song-chart--double {
    column-count: 2;
  }

  @media (max-width: 960px) {
    .song-chart--double {
      column-count: 1;
    }
  }

  .song-chart--sm {
    font-size: 1rem;
  }

  .song-chart--md {
    font-size: 1.25rem;
  }

  .song-chart--lg {
    font-size: 1.45rem;
  }

  .chart-section {
    margin: 1.25rem 0 0.5rem;
    font-size: 0.95em;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .chart-gap {
    height: 0.9rem;
  }

  .chart-directive {
    font-size: 0.85em;
    opacity: 0.7;
    margin: 0.25rem 0;
  }

  .chart-pair {
    margin: 0.25rem 0 0.85rem;
    break-inside: avoid;
  }

  .chart-chords,
  .chart-lyrics {
    white-space: pre;
  }

  .chart-chords {
    font-weight: 700;
    letter-spacing: 0.02em;
    min-height: 1.2em;
  }

  .chart-lyrics {
    font-weight: 400;
  }

  .song-directive-toggle {
    font-size: 0.85rem;
  }

  .song-body pre {
    margin: 0;
    padding: 1rem;
    background: var(--ui-color-surface-muted, #f5f5f5);
    border-radius: var(--ui-radius-md, 8px);
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
    font-size: 0.95rem;
    white-space: pre-wrap;
    line-height: 1.45;
  }

  .muted {
    color: var(--sys-muted);
  }
</style>
