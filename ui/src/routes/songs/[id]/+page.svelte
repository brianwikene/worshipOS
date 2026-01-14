<script lang="ts">
 // ui/src/routes/songs/[id]/+page.svelte
  import { page } from '$app/stores';
  import { apiFetch, apiJson } from '$lib/api';
  import ObjectMark from '$lib/components/identity/ObjectMark.svelte';
  import SongModal from '$lib/components/SongModal.svelte';
  import { onMount } from 'svelte';

  // --- Interfaces ---
  interface Attachment { id: string; filename: string; file_type: string; size: number; url: string; }
  interface Song {
    id: string; title: string; artist: string | null; key: string | null; bpm: number | null;
    ccli_number: string | null; notes: string | null; raw_text: string | null; is_active: boolean; attachments: Attachment[];
  }
  interface UsageHistory { id: string; date: string; name: string; }
  type Tab = 'chart' | 'lyrics' | 'resources' | 'history';

  // --- State ---
  let loading = true;
  let song: Song | null = null;
  let history: UsageHistory[] = [];
  let activeTab: Tab = 'chart';
  let fontSize: 'sm' | 'md' | 'lg' = 'md';
  let isEditing = false;
  let editBuffer = '';
  let fileInput: HTMLInputElement;
  let isUploading = false;
  let modalOpen = false;
  let modalComponent: SongModal;

  // Editor Ref
  let textAreaRef: HTMLTextAreaElement;

  // --- Init ---
  onMount(async () => { await loadSong(); });

  async function loadSong() {
    loading = true;
    try {
      const songId = $page.params.id;
      song = await apiJson<Song>(`/api/songs/${songId}`);
      try { history = await apiJson<UsageHistory[]>(`/api/songs/${songId}/history`); } catch (e) { history = []; }
      if (song?.raw_text) activeTab = 'chart';
    } catch (e) { console.error(e); } finally { loading = false; }
  }

  // --- PARSING ENGINE ---
  type Line = { type: 'lyrics' | 'section' | 'empty'; segments?: Segment[]; text?: string };
  type Segment = { chord: string; lyric: string };
  type ExtractedMeta = { title?: string; subtitle?: string; artist?: string; key?: string; time?: string; tempo?: string; copyright?: string; ccli?: string; };

  let computedMeta: ExtractedMeta = {};
  let pages: Line[][] = [];
  let cleanLyrics: string[] = [];

  $: if (song) {
    const result = parseChordPro(song.raw_text);
    computedMeta = result.meta;
    pages = paginateLines(result.lines, fontSize);
    cleanLyrics = generateCleanLyrics(song.raw_text);
  }

  function parseChordPro(text: string | null): { lines: Line[], meta: ExtractedMeta } {
    if (!text) return { lines: [], meta: {} };
    const lines: Line[] = [];
    const meta: ExtractedMeta = {};
    const rawLines = text.split('\n');

    for (let line of rawLines) {
      let trimmed = line.trim();

      // Metadata
      if (trimmed.startsWith('{title:') || trimmed.startsWith('{t:')) { meta.title = extractTag(trimmed); continue; }
      if (trimmed.startsWith('{subtitle:') || trimmed.startsWith('{st:') || trimmed.startsWith('{su:')) { meta.subtitle = extractTag(trimmed); continue; }
      if (trimmed.startsWith('{artist:') || trimmed.startsWith('{a:')) { meta.artist = extractTag(trimmed); continue; }
      if (trimmed.startsWith('{key:') || trimmed.startsWith('{k:')) { meta.key = extractTag(trimmed); continue; }
      if (trimmed.startsWith('{time:')) { meta.time = extractTag(trimmed); continue; }
      if (trimmed.startsWith('{tempo:') || trimmed.startsWith('{bpm:')) { meta.tempo = extractTag(trimmed); continue; }
      if (trimmed.startsWith('{copyright:') || (trimmed.startsWith('{c:') && trimmed.toLowerCase().includes('copyright'))) { meta.copyright = extractTag(trimmed); continue; }
      if (trimmed.startsWith('{ccli:')) { meta.ccli = extractTag(trimmed); continue; }

      if (!trimmed) { lines.push({ type: 'empty' }); continue; }

      // Sections
      if (trimmed.match(/^\{/)) {
         if (trimmed.match(/^\{(c:|comment:|soc|start_of_chorus|verse|chorus|bridge|intro|outro)/i)) {
            let label = trimmed.replace(/^\{(c:|comment:|soc|start_of_chorus|eoc|end_of_chorus)/i, '').replace(/[{}\[\]]/g, '').trim();
            if (label.toLowerCase() === 'soc') label = 'Chorus';
            lines.push({ type: 'section', text: label });
            continue;
         }
      }
      if (trimmed.startsWith('[') && trimmed.endsWith(']') && !trimmed.includes(' ')) {
        lines.push({ type: 'section', text: trimmed.slice(1, -1) });
        continue;
      }

      // Segments
      const segments: Segment[] = [];
      const regex = /\[(.*?)\]([^[]*)/g;
      let match;
      const firstChord = line.indexOf('[');
      if (firstChord > 0) {
        segments.push({ chord: '', lyric: line.substring(0, firstChord) });
      } else if (firstChord === -1) {
        lines.push({ type: 'lyrics', segments: [{ chord: '', lyric: line }] });
        continue;
      }
      while ((match = regex.exec(line)) !== null) {
        segments.push({ chord: match[1], lyric: match[2] });
      }
      lines.push({ type: 'lyrics', segments });
    }
    return { lines, meta };
  }

  function paginateLines(lines: Line[], fSize: string): Line[][] {
    const pages: Line[][] = [];
    let currentPage: Line[] = [];
    let currentWeight = 0;
    const maxWeight = fSize === 'lg' ? 38 : (fSize === 'md' ? 48 : 58);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let weight = line.type === 'section' ? 4 : (line.type === 'lyrics' ? 2 : 1);
      if (line.type === 'section' && (maxWeight - currentWeight) < 8) {
        pages.push(currentPage); currentPage = []; currentWeight = 0;
      }
      if (currentWeight + weight > maxWeight) {
        pages.push(currentPage); currentPage = []; currentWeight = 0;
      }
      currentPage.push(line); currentWeight += weight;
    }
    if (currentPage.length > 0) pages.push(currentPage);
    return pages;
  }

  function generateCleanLyrics(text: string | null): string[] {
    if (!text) return [];
    return text.split('\n').map(line => {
      let clean = line.replace(/\[.*?\]/g, '');
      if (clean.trim().startsWith('{')) return '';
      return clean;
    }).filter(l => l.trim() !== '');
  }

  function extractTag(line: string): string {
    return line.substring(line.indexOf(':') + 1).replace('}', '').trim();
  }

  // --- ACTIONS ---

  function insertTag(tag: string) {
    if (!textAreaRef) return;
    const start = textAreaRef.selectionStart;
    const end = textAreaRef.selectionEnd;
    const text = editBuffer;
    const before = text.substring(0, start);
    const after = text.substring(end);

    // Insert tag
    editBuffer = `${before}${tag}${after}`;

    // Restore focus and move cursor
    setTimeout(() => {
      textAreaRef.focus();
      const newCursorPos = start + tag.length;
      textAreaRef.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  }

  async function saveLyrics() {
    if (!song) return;
    try {
      const analysis = parseChordPro(editBuffer);
      const meta = analysis.meta;
      const payload: any = { raw_text: editBuffer };

      // Auto-update DB fields from Text Tags
      if (meta.title) payload.title = meta.title;
      if (meta.artist) payload.artist = meta.artist;
      if (meta.key) payload.key = meta.key;
      if (meta.ccli) payload.ccli_number = meta.ccli;
      if (meta.tempo) { const nums = meta.tempo.match(/\d+/); if (nums) payload.bpm = parseInt(nums[0]); }

      song.raw_text = editBuffer;
      // Optimistic UI updates
      if (meta.title) song.title = meta.title;
      if (meta.artist) song.artist = meta.artist;
      if (meta.key) song.key = meta.key;

      isEditing = false;
      await apiFetch(`/api/songs/${song.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } catch (err) { alert('Failed to save'); await loadSong(); }
  }

  function handleSchedule() { alert("Added to Gathering! (Simulation)"); }
  function startEditing() { if (song) { editBuffer = song.raw_text || ''; isEditing = true; } }
  function handlePrint() { window.print(); }

  async function handleFileUpload(e: Event) {
    const target = e.target as HTMLInputElement;
    if (!target.files || !target.files[0] || !song) return;
    isUploading = true;
    try {
      const formData = new FormData();
      formData.append('file', target.files[0]);
      await apiFetch(`/api/songs/${song.id}/attachments`, { method: 'POST', body: formData });
      await loadSong();
    } catch (e) { alert('Upload failed'); } finally { isUploading = false; target.value = ''; }
  }

  async function deleteAttachment(id: string) {
    if (confirm('Delete file?') && song) {
      await apiFetch(`/api/songs/${song.id}/attachments/${id}`, { method: 'DELETE' });
      await loadSong();
    }
  }

  async function handleIntegrityAction() {
    if (!song) return;
    if (history.length > 0) {
      if (confirm(`Archive "${song.title}"?`)) await apiFetch(`/api/songs/${song.id}`, { method: 'PUT', body: JSON.stringify({ is_active: false }) });
    } else {
      if (confirm(`Delete "${song.title}"?`)) await apiFetch(`/api/songs/${song.id}`, { method: 'DELETE' });
    }
    window.location.href = '/songs';
  }

  function getInitials(t: string) { return t.substring(0, 2).toUpperCase(); }
  function openEditModal() { if (song) modalOpen = true; }
  async function handleSaveDetails(e: CustomEvent<any>) {
    await apiFetch(`/api/songs/${song?.id}`, { method: 'PUT', body: JSON.stringify(e.detail) });
    await loadSong();
    modalOpen = false;
  }
</script>

<div class="sys-page">
  <input type="file" bind:this={fileInput} on:change={handleFileUpload} style="display:none" accept=".pdf,.png,.jpg">

  {#if loading}
    <div class="sys-state">Loading...</div>
  {:else if song}

    <div class="sys-page-header no-print">
      <div style="display: flex; gap: 16px; align-items: center;">
        <a href="/songs" class="sys-back-link">←</a>
        <ObjectMark variant="songs" size="lg" label={getInitials(song.title)} />
        <div>
          <h1 class="sys-title">{computedMeta.title || song.title}</h1>
          <p class="sys-subtitle">
            {computedMeta.artist || song.artist || 'Unknown'} • {computedMeta.key || song.key || 'No Key'}
          </p>
        </div>
      </div>
      <div class="header-actions">
        <button class="sys-btn sys-btn--primary" on:click={handleSchedule}>+ Schedule</button>
        <button class="sys-btn sys-btn--secondary" on:click={openEditModal}>Edit Details</button>
      </div>
    </div>

    <div class="sys-tabs no-print">
      <button class="sys-tab" class:active={activeTab === 'chart'} on:click={() => activeTab = 'chart'}>Chart</button>
      <button class="sys-tab" class:active={activeTab === 'lyrics'} on:click={() => activeTab = 'lyrics'}>Lyrics</button>
      <button class="sys-tab" class:active={activeTab === 'resources'} on:click={() => activeTab = 'resources'}>Files ({song.attachments?.length || 0})</button>
      <button class="sys-tab" class:active={activeTab === 'history'} on:click={() => activeTab = 'history'}>History</button>
    </div>

    <div class="content-grid">
      <div class="main-column">

        {#if activeTab === 'chart'}
          {#if isEditing}
            <div class="editor-grid no-print">
              <div class="sys-card editor-card">
                <textarea
                  bind:this={textAreaRef}
                  bind:value={editBuffer}
                  class="sys-textarea lyric-editor"
                  placeholder="{`{title: Waymaker}\n{key: G}\n\n{c: Verse 1}\n[G]Way [D]Maker...`}"
                ></textarea>
                <div class="editor-actions">
                  <button class="sys-btn sys-btn--secondary" on:click={() => isEditing = false}>Cancel</button>
                  <button class="sys-btn sys-btn--primary" on:click={saveLyrics}>Save Changes</button>
                </div>
              </div>

              <div class="tag-helper">
                <h3>Insert Tag</h3>
                <div class="tag-group">
                  <label>Headers</label>
                  <button class="tag-btn" on:click={() => insertTag('{c: Verse 1}\n')}>Verse 1</button>
                  <button class="tag-btn" on:click={() => insertTag('{c: Chorus}\n')}>Chorus</button>
                  <button class="tag-btn" on:click={() => insertTag('{c: Bridge}\n')}>Bridge</button>
                </div>
                <div class="tag-group">
                  <label>Metadata</label>
                  <button class="tag-btn" on:click={() => insertTag('{key: G}\n')}>Key: G</button>
                  <button class="tag-btn" on:click={() => insertTag('{time: 4/4}\n')}>Time: 4/4</button>
                  <button class="tag-btn" on:click={() => insertTag('{tempo: 72}\n')}>BPM: 72</button>
                </div>
                <div class="tag-group">
                  <label>Chords</label>
                  <button class="tag-btn" on:click={() => insertTag('[G]')}>[G]</button>
                  <button class="tag-btn" on:click={() => insertTag('[C]')}>[C]</button>
                  <button class="tag-btn" on:click={() => insertTag('[D]')}>[D]</button>
                </div>
              </div>
            </div>

          {:else}
            <div class="chart-controls no-print">
              <div class="size-toggle">
                <button class:active={fontSize === 'sm'} on:click={() => fontSize = 'sm'} title="Small">A</button>
                <button class:active={fontSize === 'md'} on:click={() => fontSize = 'md'} title="Medium">A</button>
                <button class:active={fontSize === 'lg'} on:click={() => fontSize = 'lg'} title="Large">A</button>
              </div>
              <div class="chart-actions">
                <button class="sys-btn sys-btn--sm sys-btn--secondary" on:click={handlePrint}>🖨️ Print</button>
                <button class="sys-btn sys-btn--sm sys-btn--primary" on:click={startEditing}>✏️ Edit</button>
              </div>
            </div>

            <div class="print-container">
              {#if pages.length > 0}
                {#each pages as pageLines, i}
                  <div class={`paper-sheet size-${fontSize}`}>

                    <div class="sheet-header">
                      {#if i === 0}
                        <div class="sheet-main-info">
                          <h1 class="sheet-title">{computedMeta.title || song.title}</h1>
                          {#if computedMeta.subtitle}<p class="sheet-subtitle">{computedMeta.subtitle}</p>{/if}
                          <p class="sheet-artist">{computedMeta.artist || song.artist || ''}</p>
                        </div>
                        <div class="sheet-meta-grid">
                          <div class="sheet-meta-item">
                            <span class="sheet-label">Key</span>
                            <span class="sheet-value">{computedMeta.key || song.key || '—'}</span>
                          </div>
                          <div class="sheet-meta-item">
                            <span class="sheet-label">BPM</span>
                            <span class="sheet-value">{computedMeta.tempo || song.bpm || '—'}</span>
                          </div>
                          <div class="sheet-meta-item">
                            <span class="sheet-label">Time</span>
                            <span class="sheet-value">{computedMeta.time || '4/4'}</span>
                          </div>
                        </div>
                      {:else}
                        <div class="sheet-main-info">
                          <h1 class="sheet-title-small">{computedMeta.title || song.title}</h1>
                        </div>
                        <div class="sheet-page-num">Page {i + 1} of {pages.length}</div>
                      {/if}
                    </div>

                    <div class="chord-content">
                      {#each pageLines as line}
                        {#if line.type === 'section'}
                          <div class="cp-section-header">{line.text}</div>
                        {:else if line.type === 'empty'}
                          <div class="cp-spacer"></div>
                        {:else if line.type === 'lyrics' && line.segments}
                          <div class="cp-line">
                            {#each line.segments as segment}
                              <div class="cp-token">
                                <div class="cp-chord">{segment.chord}</div>
                                <div class="cp-lyric">{segment.lyric || ' '}</div>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      {/each}
                    </div>

                    <div class="sheet-footer">
                      {#if computedMeta.ccli || song.ccli_number}CCLI #{computedMeta.ccli || song.ccli_number} • {/if}
                      {computedMeta.copyright || `© ${new Date().getFullYear()} ${song.artist || 'Copyright'}`}
                      <span class="footer-page"> • Page {i + 1}/{pages.length}</span>
                    </div>
                  </div>
                {/each}
              {:else}
                <div class="paper-sheet size-md empty-chart" on:click={startEditing}>
                  <p>No chart content. Click to add lyrics & chords.</p>
                </div>
              {/if}
            </div>
          {/if}

        {:else if activeTab === 'lyrics'}
          <div class="sys-card">
            <h3>Lyrics Only</h3>
            <p class="text-sm text-muted mb-4">Auto-generated from your chord chart for vocalists.</p>
            <div class="lyrics-readonly">
              {#if cleanLyrics.length > 0}
                {#each cleanLyrics as line}
                  <p class="lyric-line">{line || ' '}</p>
                {/each}
              {:else}
                <p>No lyrics found.</p>
              {/if}
            </div>
          </div>

        {:else if activeTab === 'resources'}
          <div class="sys-card">
            <h3>Attached Files</h3>
            <div class="file-list">
              {#each song.attachments || [] as file}
                <div class="file-row">
                  <span class="file-icon">{file.file_type.includes('pdf') ? '📄' : '📎'}</span>
                  <a href={file.url} target="_blank" class="file-link">{file.filename}</a>
                  <button class="sys-icon-btn sys-icon-btn--danger" on:click={() => deleteAttachment(file.id)}>🗑️</button>
                </div>
              {/each}
            </div>
            <button class="sys-btn sys-btn--secondary mt-4" on:click={() => fileInput.click()} disabled={isUploading}>
              {isUploading ? 'Uploading...' : '+ Upload PDF'}
            </button>
          </div>

        {:else if activeTab === 'history'}
          <div class="sys-card">
            <ul class="history-list">
              {#each history as h}
                <li><strong>{h.date}</strong> — {h.name}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>

      <div class="sidebar no-print">
        <div class="sys-card meta-card">
          <h3>Quick Look</h3>
          <div class="meta-row"><label>BPM</label> <span>{computedMeta.tempo || song.bpm || '—'}</span></div>
          <div class="meta-row"><label>Key</label> <span>{computedMeta.key || song.key || '—'}</span></div>
          <div class="meta-row"><label>CCLI</label> <span>{computedMeta.ccli || song.ccli_number || '—'}</span></div>
        </div>
        <div class="danger-zone">
          <button class="sys-btn-link text-red" on:click={handleIntegrityAction}>
            {history.length > 0 ? 'Archive Song' : 'Delete Song'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <SongModal bind:this={modalComponent} bind:open={modalOpen} song={song} on:close={() => modalOpen = false} on:save={handleSaveDetails} />
</div>

<style>
  /* Base Layout */
  .sys-back-link { font-size: 1.5rem; text-decoration: none; color: var(--sys-muted); }
  .header-actions { display: flex; gap: 12px; }
  .content-grid { display: grid; grid-template-columns: 1fr 280px; gap: 24px; margin-top: 24px; }
  .sys-tabs { display: flex; gap: 20px; border-bottom: 1px solid var(--sys-border); margin-bottom: 24px; }
  .sys-tab { background: none; border: none; padding: 10px 0; color: var(--sys-muted); cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500; }
  .sys-tab.active { color: var(--sys-primary); border-bottom-color: var(--sys-primary); }

  /* SIDEBAR FIX */
  .meta-card { padding: 16px; }

  /* EDITOR GRID */
  .editor-grid { display: grid; grid-template-columns: 1fr 200px; gap: 16px; }
  .tag-helper { background: var(--sys-bg-subtle); padding: 16px; border-radius: 8px; height: fit-content; }
  .tag-helper h3 { font-size: 0.9rem; font-weight: 700; margin-bottom: 12px; color: var(--sys-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .tag-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 6px; }
  .tag-group label { font-size: 0.75rem; font-weight: 600; color: var(--sys-muted); text-transform: uppercase; }
  .tag-btn { background: white; border: 1px solid var(--sys-border-light); padding: 6px 10px; font-size: 0.85rem; border-radius: 4px; text-align: left; cursor: pointer; transition: all 0.1s; }
  .tag-btn:hover { border-color: var(--sys-primary); color: var(--sys-primary); }

  /* CHART CONTROLS */
  .chart-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; width: 100%; max-width: 8.5in; margin-left: auto; margin-right: auto; }

  /* PAPER SHEET STYLES */
  .paper-sheet {
    background: white; width: 100%; max-width: 8.5in; min-height: 11in;
    margin: 0 auto 32px auto; padding: 0.5in 0.6in;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #111;
    display: flex; flex-direction: column;
    page-break-after: always; break-after: page;
  }

  /* SHEET HEADER */
  .sheet-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 24px; min-height: 50px; }
  .sheet-main-info { flex: 1; }
  .sheet-title { font-size: 28px; font-weight: 800; margin: 0; line-height: 1.1; letter-spacing: -0.02em; text-transform: uppercase; }
  .sheet-subtitle { font-size: 14px; font-style: italic; color: #555; margin: 4px 0 0 0; }
  .sheet-title-small { font-size: 18px; font-weight: 700; margin: 0; color: #444; text-transform: uppercase; }
  .sheet-artist { font-size: 14px; color: #444; margin: 4px 0 0 0; font-style: italic; }
  .sheet-page-num { font-size: 12px; color: #666; font-weight: 600; }
  .sheet-meta-grid { display: flex; gap: 24px; text-align: right; }
  .sheet-meta-item { display: flex; flex-direction: column; }
  .sheet-label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: 600; }
  .sheet-value { font-size: 18px; font-weight: 700; }

  /* CONTENT */
  .chord-content { flex: 1; }
  .size-sm { font-size: 12px; --chord-height: 16px; }
  .size-md { font-size: 14px; --chord-height: 20px; }
  .size-lg { font-size: 16px; --chord-height: 24px; }

  /* FIX: 2-LINE STACKING */
  .cp-line { display: flex; flex-wrap: wrap; margin-bottom: 1em; align-items: flex-end; }
  .cp-token {
    display: flex;
    flex-direction: column;
    margin-right: 0.3em;
  }
  .cp-chord { font-weight: 700; color: var(--sys-primary); min-height: var(--chord-height); line-height: 1; margin-bottom: 2px; }
  .cp-lyric { white-space: pre; line-height: 1.2; }

  .cp-section-header {
    font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; margin: 1.5em 0 0.5em 0;
    font-size: 0.9em; border-bottom: 1px solid #ddd; padding-bottom: 2px; display: block; width: 100%;
    page-break-after: avoid; break-after: avoid;
  }
  .cp-spacer { height: 1em; }
  .sheet-footer { margin-top: auto; padding-top: 16px; border-top: 1px solid #eee; font-size: 10px; color: #888; text-align: center; }

  /* Misc */
  .lyric-editor { min-height: 500px; font-family: monospace; font-size: 15px; line-height: 1.6; }
  .lyrics-readonly { font-family: 'Inter', sans-serif; font-size: 1.1rem; line-height: 1.6; color: var(--sys-text); max-width: 600px; }
  .lyric-line { min-height: 1.5em; margin-bottom: 0.5em; }
  .size-toggle { display: flex; background: var(--sys-bg-subtle); border-radius: 6px; padding: 2px; }
  .size-toggle button { background: none; border: none; padding: 4px 10px; cursor: pointer; border-radius: 4px; font-weight: 600; color: var(--sys-muted); }
  .size-toggle button.active { background: white; color: var(--sys-primary); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
  .file-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--sys-border-light); }
  .file-link { flex: 1; text-decoration: none; color: var(--sys-text); font-weight: 500; }
  .meta-row { display: flex; justify-content: space-between; padding: 8px 0; border-top: 1px solid var(--sys-border-light); color: var(--sys-muted); }
  .danger-zone { margin-top: 32px; text-align: right; }
  .mt-4 { margin-top: 1rem; }
  .mb-4 { margin-bottom: 1rem; }
  .text-sm { font-size: 0.85rem; }

  @media print {
    body * { visibility: hidden; }
    .print-container, .print-container * { visibility: visible; }
    .print-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
    .paper-sheet { box-shadow: none; margin: 0; width: 100%; max-width: 100%; min-height: auto; border: none; }
    .no-print, .sys-page-header, .sidebar, .sys-back-link { display: none !important; }
    .sheet-header { border-bottom: 2px solid #000 !important; -webkit-print-color-adjust: exact; }
    .cp-chord { color: #000 !important; }
    .cp-token { display: flex !important; flex-direction: column !important; }
  }
  @page { size: letter; margin: 0.5in; }
</style>
