
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { SongSourceFormat } from '$lib/songs/types';
  import Input from '$lib/components/ui/Input.svelte';
  import Textarea from '$lib/components/ui/Textarea.svelte';
  import Select from '$lib/components/ui/Select.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  export let open = false;
  export let song: {
    id?: string;
    title?: string;
    artist?: string | null;
    key?: string | null;
    bpm?: number | null;
    ccli_number?: string | null;
    notes?: string | null;
    raw_text?: string | null;
    source_format?: SongSourceFormat;
    parser_warnings?: string[];
  } | null = null;

  const dispatch = createEventDispatcher<{
    close: void;
    save: {
      title: string;
      artist: string | null;
      key: string | null;
      bpm: number | null;
      ccli_number: string | null;
      notes: string | null;
      raw_text: string | null;
      source_format: SongSourceFormat;
    };
  }>();

  let title = '';
  let artist = '';
  let key = '';
  let bpm: number | null = null;
  let ccliNumber = '';
  let notes = '';
  let rawText = '';
  let sourceFormat: SongSourceFormat = 'chordpro';
  let saving = false;
  let error = '';
  let parserWarnings: string[] = [];
  let importMessage = '';
  let importMessageTimer: ReturnType<typeof setTimeout> | null = null;
  let fileInput: HTMLInputElement | null = null;

  // Reset form when modal opens
  $: if (open) {
    title = song?.title ?? '';
    artist = song?.artist ?? '';
    key = song?.key ?? '';
    bpm = song?.bpm ?? null;
    ccliNumber = song?.ccli_number ?? '';
    notes = song?.notes ?? '';
    rawText = song?.raw_text ?? '';
    sourceFormat = song?.source_format ?? 'chordpro';
    parserWarnings = song?.parser_warnings ?? [];
    error = '';
    saving = false;
  }

  $: isEdit = !!song?.id;
  $: modalTitle = isEdit ? 'Edit Song' : 'Add New Song';
  $: canSave = title.trim() && !saving;

  function handleClose() {
    if (!saving) {
      dispatch('close');
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  function showImportMessage(msg: string) {
    importMessage = msg;
    if (importMessageTimer) clearTimeout(importMessageTimer);
    importMessageTimer = setTimeout(() => {
      importMessage = '';
      importMessageTimer = null;
    }, 2500);
  }

  async function handleFileSelection(file: File | undefined | null) {
    if (!file) return;
    try {
      const text = await file.text();
      rawText = text;
      sourceFormat = 'chordpro';
      showImportMessage('ChordPro imported');
    } catch (err) {
      console.error('Failed to read file', err);
      showImportMessage('Import failed');
    }
  }

  function onFileInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    handleFileSelection(target.files?.[0]);
    target.value = '';
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    handleFileSelection(event.dataTransfer?.files?.[0]);
    isDragActive = false;
  }

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    if (!isDragActive) {
      isDragActive = true;
    }
  }

  function onDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragActive = false;
  }

  let isDragActive = false;

  async function handleSubmit() {
    if (!canSave) return;

    error = '';
    saving = true;

    dispatch('save', {
      title: title.trim(),
      artist: artist.trim() || null,
      key: key.trim() || null,
      bpm: bpm,
      ccli_number: ccliNumber.trim() || null,
      notes: notes.trim() || null,
      raw_text: rawText ? rawText : null,
      source_format: sourceFormat
    });
  }

  export function setError(msg: string) {
    error = msg;
    saving = false;
  }

  export function setSaving(val: boolean) {
    saving = val;
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" on:click={handleBackdropClick} on:keydown={handleKeydown}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal-header">
        <h2 id="modal-title">{modalTitle}</h2>
        <button class="close-btn" on:click={handleClose} aria-label="Close" disabled={saving}>
          ✕
        </button>
      </header>

      <form on:submit|preventDefault={handleSubmit}>
        <div class="modal-body">
          {#if error}
            <div class="error-message">{error}</div>
          {/if}

          <div class="form-group">
            <label for="title">Title <span class="required">*</span></label>
            <Input
              id="title"
              bind:value={title}
              placeholder="Way Maker"
              disabled={saving}
              autofocus
            />
          </div>

          <div class="form-group">
            <label for="artist">Artist</label>
            <Input id="artist" bind:value={artist} placeholder="Sinach" disabled={saving} />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="key">Key</label>
              <Input
                id="key"
                bind:value={key}
                placeholder="G"
                maxlength={5}
                disabled={saving}
              />
            </div>

            <div class="form-group">
              <label for="bpm">BPM</label>
              <Input
                id="bpm"
                type="number"
                bind:value={bpm}
                placeholder="72"
                min={40}
                max={240}
                disabled={saving}
              />
            </div>
          </div>

          <div class="form-group">
            <label for="ccli">CCLI Number</label>
            <Input
              id="ccli"
              bind:value={ccliNumber}
              placeholder="7115744"
              disabled={saving}
            />
            <span class="hint">For CCLI license reporting</span>
          </div>

          <div class="form-group">
            <label for="format">Lyrics Format</label>
            <Select id="format" bind:value={sourceFormat} disabled={saving}>
              <option value="chordpro">ChordPro (use [C] style chords)</option>
              <option value="plain_text">Plain text (lyrics only)</option>
            </Select>
            <span class="hint">
              ChordPro keeps chords inline, e.g., <code>[C]</code>You are here.
            </span>
          </div>

          <div
            class="drop-zone"
            class:drop-zone--active={isDragActive}
            on:dragover={onDragOver}
            on:dragleave={onDragLeave}
            on:drop={onDrop}
            on:click={() => fileInput?.click()}
          >
            <div>
              <strong>Drop .pro file</strong> or click to choose
            </div>
            <small>.pro / ChordPro files are supported</small>
            <input
              type="file"
              accept=".pro,text/plain"
              bind:this={fileInput}
              on:change={onFileInputChange}
              tabindex="-1"
            />
          </div>

          {#if importMessage}
            <div class="import-message">{importMessage}</div>
          {/if}

          <div class="form-group">
            <label for="raw-text">Lyrics &amp; Chords</label>
            <Textarea
              id="raw-text"
              bind:value={rawText}
              placeholder="[C]You are here, moving in our midst"
              rows={8}
              disabled={saving}
            />
            <span class="hint">
              ChordPro format supported (sections, directives, inline chords). Use blank lines between sections.
            </span>
          </div>

          {#if parserWarnings.length}
            <div class="warning-banner">
              <strong>Previous parser warnings</strong>
              <ul>
                {#each parserWarnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
            </div>
          {/if}

          <div class="form-group">
            <label for="notes">Notes</label>
            <Textarea
              id="notes"
              bind:value={notes}
              placeholder="Song structure, arrangement notes, etc."
              rows={3}
              disabled={saving}
            />
          </div>
        </div>

        <footer class="modal-footer">
          <Button type="button" variant="ghost" on:click={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave}>
            {#if saving}
              Saving...
            {:else}
              {isEdit ? 'Update Song' : 'Add Song'}
            {/if}
          </Button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--ui-space-4);
  }

  .modal {
    background: var(--ui-color-surface);
    border-radius: var(--ui-radius-lg);
    box-shadow: var(--ui-shadow-lg);
    width: 100%;
    max-width: 560px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--ui-space-4) var(--ui-space-5);
    border-bottom: 1px solid var(--ui-color-border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--ui-color-text);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--ui-color-text-muted);
    cursor: pointer;
    padding: var(--ui-space-1);
    border-radius: var(--ui-radius-sm);
    transition: background 0.2s ease;
  }

  .close-btn:hover:not(:disabled) {
    background: var(--ui-color-surface-muted);
    color: var(--ui-color-text);
  }

  .close-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-body {
    padding: var(--ui-space-5);
    overflow-y: auto;
  }

  .error-message {
    background: color-mix(in srgb, var(--ui-color-danger) 12%, #fff5f5);
    color: var(--ui-color-danger);
    border: 1px solid color-mix(in srgb, var(--ui-color-danger) 35%, white);
    padding: var(--ui-space-3);
    border-radius: var(--ui-radius-md);
    margin-bottom: var(--ui-space-4);
    font-size: var(--ui-font-size-sm);
  }

  .form-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--ui-space-3);
  }

  .form-group {
    margin-bottom: var(--ui-space-4);
  }

  label {
    display: block;
    font-size: var(--ui-font-size-sm);
    font-weight: 600;
    color: var(--ui-color-text);
    margin-bottom: var(--ui-space-1);
  }

  .required {
    color: var(--ui-color-danger);
  }

  .hint {
    display: block;
    font-size: var(--ui-font-size-xs);
    color: var(--ui-color-text-muted);
    margin-top: var(--ui-space-1);
  }

  .hint code {
    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
    font-size: var(--ui-font-size-xs);
    background: var(--ui-color-surface-muted);
    padding: 0.05rem 0.3rem;
    border-radius: var(--ui-radius-sm);
  }

  .drop-zone {
    border: 1px dashed var(--ui-color-border);
    border-radius: var(--ui-radius-md);
    padding: var(--ui-space-4);
    text-align: center;
    color: var(--ui-color-text-muted);
    font-size: var(--ui-font-size-sm);
    margin-bottom: var(--ui-space-3);
    cursor: pointer;
    transition:
      border-color 0.2s ease,
      background 0.2s ease,
      color 0.2s ease;
  }

  .drop-zone:hover {
    border-color: var(--ui-color-accent);
  }

  .drop-zone--active {
    border-color: var(--ui-color-accent);
    background: color-mix(in srgb, var(--ui-color-accent) 7%, var(--ui-color-surface));
    color: var(--ui-color-text);
  }

  .drop-zone input {
    display: none;
  }

  .import-message {
    font-size: var(--ui-font-size-sm);
    color: var(--ui-color-success);
    background: color-mix(in srgb, var(--ui-color-success) 15%, #f0fff4);
    border: 1px solid color-mix(in srgb, var(--ui-color-success) 35%, white);
    border-radius: var(--ui-radius-sm);
    padding: var(--ui-space-2) var(--ui-space-3);
    margin-bottom: var(--ui-space-3);
  }

  .warning-banner {
    border: 1px solid color-mix(in srgb, var(--ui-color-warning) 40%, white);
    background: color-mix(in srgb, var(--ui-color-warning) 12%, #fffaf0);
    color: var(--ui-color-warning);
    border-radius: var(--ui-radius-md);
    padding: var(--ui-space-3);
    font-size: var(--ui-font-size-sm);
    margin-bottom: var(--ui-space-4);
  }

  .warning-banner ul {
    margin: var(--ui-space-2) 0 0;
    padding-left: var(--ui-space-4);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--ui-space-3);
    padding: var(--ui-space-4) var(--ui-space-5);
    border-top: 1px solid var(--ui-color-border);
    background: var(--ui-color-surface-muted);
  }

  @media (max-width: 520px) {
    .modal-body {
      padding: var(--ui-space-4);
    }
  }
</style>
