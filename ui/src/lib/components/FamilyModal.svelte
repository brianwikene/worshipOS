<!-- /ui/src/lib/components/FamilyModal.svelte -->
<script lang="ts">
  type Family = {
    id?: string;
    name?: string;
    notes?: string | null;
  };

  export let open = false;
  export let family: Family | null = null;

  // ✅ Callback props instead of dispatch
  export let onClose: () => void = () => {};
  export let onSave: (payload: { name: string; notes: string }) => void | Promise<void> =
    async () => {};

  let name = '';
  let notes = '';
  let saving = false;
  let errorMsg = '';

  // Derived state
  $: isEdit = Boolean(family?.id);
  $: title = isEdit ? 'Edit Family' : 'Add Family';
  $: canSave = name.trim().length > 0 && !saving;

  // Reset form only when modal opens
  let wasOpen = false;
  $: if (open && !wasOpen) {
    name = family?.name ?? '';
    notes = family?.notes ?? '';
    errorMsg = '';
    saving = false;
  }
  $: wasOpen = open;

  function close() {
    if (saving) return;

    open = false;      // ✅ makes bind:open work
    onClose();         // ✅ parent callback
  }

  function onBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
  }

  async function submit() {
    if (!canSave) return;

    errorMsg = '';
    saving = true;

    try {
      await onSave({
        name: name.trim(),
        notes: notes.trim()
      });
    } catch (err) {
      // If parent throws, surface it here
      errorMsg = err instanceof Error ? err.message : String(err);
      saving = false;
    }
  }

  // Parent can still control state via bind:this
  export function setError(msg: string) {
    errorMsg = msg;
    saving = false;
  }

  export function setSaving(val: boolean) {
    saving = val;
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
  <div class="modal-backdrop" on:click={onBackdropClick}>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header class="modal-header">
        <h2 id="modal-title">{title}</h2>
        <button class="close-btn" on:click={close} aria-label="Close" disabled={saving}>
          ✕
        </button>
      </header>

      <form on:submit|preventDefault={submit}>
        <div class="modal-body">
          {#if errorMsg}
            <div class="error-message">{errorMsg}</div>
          {/if}

          <div class="form-group">
            <label for="family_name">Family Name <span class="required">*</span></label>
            <input
              id="family_name"
              type="text"
              bind:value={name}
              placeholder="e.g. The Wikene Family"
              disabled={saving}
              autofocus
            />
            <span class="hint">Usually the family surname</span>
          </div>

          <div class="form-group">
            <label for="notes">Notes <span class="optional">(optional)</span></label>
            <textarea
              id="notes"
              bind:value={notes}
              placeholder="Any notes about this family..."
              rows="3"
              disabled={saving}
            />
          </div>
        </div>

        <footer class="modal-footer">
          <button type="button" class="btn-secondary" on:click={close} disabled={saving}>
            Cancel
          </button>

          <button type="submit" class="btn-primary" disabled={!canSave}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Family'}
          </button>
        </footer>
      </form>
    </div>
  </div>
{/if}

<style>
  /* same styles as before */
  .modal-backdrop {
    position: fixed;
    inset: 0;
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
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow: auto;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: #666;
    cursor: pointer;
    padding: 0.25rem;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover:not(:disabled) {
    background: #f0f0f0;
    color: #1a1a1a;
  }

  .close-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .error-message {
    background: #fee;
    color: #c00;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #333;
    margin-bottom: 0.375rem;
  }

  .required {
    color: #c00;
  }

  .optional {
    font-weight: 400;
    color: #888;
  }

  input, textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }

  input:focus, textarea:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }

  input:disabled, textarea:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
  }

  .hint {
    display: block;
    font-size: 0.75rem;
    color: #888;
    margin-top: 0.25rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e0e0e0;
    background: #fafafa;
    border-radius: 0 0 12px 12px;
  }

  button {
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-secondary {
    background: white;
    border: 1px solid #ddd;
    color: #333;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f5f5f5;
    border-color: #ccc;
  }

  .btn-primary {
    background: #0066cc;
    border: 1px solid #0066cc;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0055aa;
  }

  .btn-primary:disabled,
  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
