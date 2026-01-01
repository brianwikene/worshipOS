<script lang="ts">
  import { onMount } from 'svelte';
  import { apiJson, apiFetch } from '$lib/api';

  interface MergeEvent {
    id: string;
    survivor_id: string;
    survivor_name: string;
    merged_ids: string[];
    merged_names: string[];
    merged_count: number;
    transferred_records: Record<string, number>;
    performed_by: string;
    performed_at: string;
    reason: string | null;
    can_undo: boolean;
    undone_at: string | null;
    undone_by: string | null;
    undo_reason: string | null;
  }

  let merges: MergeEvent[] = [];
  let loading = true;
  let error = '';
  let total = 0;
  let includeUndone = false;

  // Undo modal
  let showUndoModal = false;
  let selectedMerge: MergeEvent | null = null;
  let undoReason = '';
  let undoing = false;

  onMount(() => {
    loadMerges();
  });

  async function loadMerges() {
    loading = true;
    error = '';

    try {
      const params = new URLSearchParams({
        limit: '100',
        include_undone: includeUndone.toString()
      });

      const result = await apiJson<{ merges: MergeEvent[]; total: number }>(
        `/api/admin/merges?${params}`
      );

      merges = result.merges;
      total = result.total;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load merge history';
    } finally {
      loading = false;
    }
  }

  function openUndo(merge: MergeEvent) {
    selectedMerge = merge;
    undoReason = '';
    showUndoModal = true;
  }

  function closeUndo() {
    showUndoModal = false;
    selectedMerge = null;
  }

  async function performUndo() {
    if (!selectedMerge) return;
    undoing = true;

    try {
      await apiFetch(`/api/admin/merges/${selectedMerge.id}/undo`, {
        method: 'POST',
        body: JSON.stringify({ reason: undoReason || null })
      });

      closeUndo();
      await loadMerges();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to undo merge');
    } finally {
      undoing = false;
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString();
  }

  function formatTransferred(transferred: Record<string, number>): string {
    const parts = [];
    if (transferred.service_assignments) parts.push(`${transferred.service_assignments} assignments`);
    if (transferred.role_capabilities) parts.push(`${transferred.role_capabilities} capabilities`);
    if (transferred.family_memberships) parts.push(`${transferred.family_memberships} family memberships`);
    if (transferred.contact_methods) parts.push(`${transferred.contact_methods} contacts`);
    return parts.length > 0 ? parts.join(', ') : 'None';
  }

  $: if (includeUndone !== undefined) {
    loadMerges();
  }
</script>

<div class="container">
  <div class="header">
    <div class="header-left">
      <a href="/admin/duplicates" class="back-link">← Back to Duplicates</a>
      <h1>Merge History</h1>
      <p class="subtitle">View and undo previous merge operations</p>
    </div>
  </div>

  <div class="filters">
    <label class="checkbox-filter">
      <input type="checkbox" bind:checked={includeUndone} />
      Show undone merges
    </label>
    <div class="filter-info">
      {total} merge{total !== 1 ? 's' : ''} total
    </div>
  </div>

  {#if loading}
    <div class="loading">Loading merge history...</div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button on:click={loadMerges}>Retry</button>
    </div>
  {:else if merges.length === 0}
    <div class="empty">
      <p>No merge history found.</p>
      <a href="/admin/duplicates" class="btn-primary">Go to Duplicates</a>
    </div>
  {:else}
    <div class="merges-list">
      {#each merges as merge}
        <div class="merge-card" class:undone={merge.undone_at}>
          <div class="merge-main">
            <div class="merge-icon">
              {#if merge.undone_at}
                <span class="icon-undone">↩</span>
              {:else}
                <span class="icon-merged">⊕</span>
              {/if}
            </div>

            <div class="merge-info">
              <div class="merge-title">
                {#each merge.merged_names as name, i}
                  <span class="merged-name">{name}</span>
                  {#if i < merge.merged_names.length - 1}<span class="merge-arrow">→</span>{/if}
                {/each}
                <span class="merge-arrow">→</span>
                <span class="survivor-name">{merge.survivor_name}</span>
              </div>

              <div class="merge-details">
                <span class="detail">by {merge.performed_by}</span>
                <span class="detail">{formatDate(merge.performed_at)}</span>
                {#if merge.reason}
                  <span class="detail reason">"{merge.reason}"</span>
                {/if}
              </div>

              {#if Object.keys(merge.transferred_records).length > 0}
                <div class="transferred">
                  Transferred: {formatTransferred(merge.transferred_records)}
                </div>
              {/if}

              {#if merge.undone_at}
                <div class="undone-info">
                  Undone by {merge.undone_by} on {formatDate(merge.undone_at)}
                  {#if merge.undo_reason}
                    - "{merge.undo_reason}"
                  {/if}
                </div>
              {/if}
            </div>
          </div>

          <div class="merge-actions">
            {#if merge.can_undo}
              <button class="btn-undo" on:click={() => openUndo(merge)}>
                Undo Merge
              </button>
            {:else if merge.undone_at}
              <span class="status-undone">Undone</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Undo Modal -->
{#if showUndoModal && selectedMerge}
<div class="modal-overlay" on:click={closeUndo} on:keydown={(e) => e.key === 'Escape' && closeUndo()}>
  <div class="modal" on:click|stopPropagation on:keydown={() => {}}>
    <div class="modal-header">
      <h2>Undo Merge</h2>
      <button class="close-btn" on:click={closeUndo}>×</button>
    </div>

    <div class="modal-body">
      <div class="undo-summary">
        <p>This will restore the following person(s):</p>
        <ul>
          {#each selectedMerge.merged_names as name}
            <li>{name}</li>
          {/each}
        </ul>
      </div>

      <div class="undo-warning">
        <strong>Note:</strong> Records that were transferred (service assignments, capabilities, etc.)
        will remain with the survivor ({selectedMerge.survivor_name}). You may need to manually
        reassign them if needed.
      </div>

      <div class="undo-reason">
        <label for="undo-reason">Reason for undo (optional)</label>
        <textarea
          id="undo-reason"
          bind:value={undoReason}
          placeholder="e.g., These are actually two different people (twins)"
        ></textarea>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" on:click={closeUndo}>Cancel</button>
      <button class="btn-undo-confirm" on:click={performUndo} disabled={undoing}>
        {undoing ? 'Undoing...' : 'Confirm Undo'}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .container {
    max-width: 900px;
    margin: 40px auto;
    padding: 0 20px;
  }

  .header {
    margin-bottom: 1.5rem;
  }

  .back-link {
    color: #666;
    text-decoration: none;
    font-size: 0.9rem;
    display: inline-block;
    margin-bottom: 0.5rem;
  }

  .back-link:hover {
    color: #0066cc;
  }

  .header h1 {
    margin: 0;
    font-size: 1.75rem;
    color: #1a1a1a;
  }

  .subtitle {
    margin: 0.25rem 0 0;
    color: #666;
  }

  .filters {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 8px;
  }

  .checkbox-filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .filter-info {
    color: #666;
    font-size: 0.9rem;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 3rem;
    background: #f5f5f5;
    border-radius: 12px;
  }

  .error {
    background: #fef2f2;
    color: #dc2626;
  }

  .btn-primary {
    display: inline-block;
    padding: 0.625rem 1.25rem;
    background: #0066cc;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 500;
    margin-top: 1rem;
  }

  .merges-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .merge-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .merge-card.undone {
    opacity: 0.6;
    background: #f9fafb;
  }

  .merge-main {
    display: flex;
    gap: 1rem;
    flex: 1;
  }

  .merge-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .icon-merged {
    background: #dcfce7;
    color: #166534;
  }

  .icon-undone {
    background: #f3f4f6;
    color: #6b7280;
  }

  .merge-info {
    flex: 1;
  }

  .merge-title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    font-weight: 500;
    color: #1a1a1a;
    margin-bottom: 0.5rem;
  }

  .merged-name {
    color: #dc2626;
    text-decoration: line-through;
  }

  .merge-arrow {
    color: #9ca3af;
    margin: 0 0.25rem;
  }

  .survivor-name {
    color: #059669;
    font-weight: 600;
  }

  .merge-details {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: #666;
  }

  .detail {
    display: flex;
    align-items: center;
  }

  .detail:not(:last-child)::after {
    content: '•';
    margin-left: 0.5rem;
    color: #ccc;
  }

  .detail.reason {
    font-style: italic;
  }

  .transferred {
    font-size: 0.8rem;
    color: #666;
    margin-top: 0.5rem;
    background: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    display: inline-block;
  }

  .undone-info {
    font-size: 0.8rem;
    color: #92400e;
    margin-top: 0.5rem;
    background: #fef3c7;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .merge-actions {
    display: flex;
    align-items: center;
  }

  .btn-undo {
    padding: 0.5rem 1rem;
    background: white;
    color: #dc2626;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.85rem;
  }

  .btn-undo:hover {
    background: #fef2f2;
  }

  .status-undone {
    color: #6b7280;
    font-size: 0.85rem;
  }

  /* Modal */
  .modal-overlay {
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
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: #fef2f2;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.125rem;
    color: #dc2626;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: #666;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: #fee2e2;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .undo-summary {
    margin-bottom: 1rem;
  }

  .undo-summary p {
    margin: 0 0 0.5rem;
    font-weight: 500;
  }

  .undo-summary ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .undo-summary li {
    margin-bottom: 0.25rem;
  }

  .undo-warning {
    background: #fef3c7;
    border: 1px solid #fcd34d;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.9rem;
    color: #78350f;
    margin-bottom: 1rem;
  }

  .undo-reason label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
  }

  .undo-reason textarea {
    width: 100%;
    min-height: 80px;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-family: inherit;
    resize: vertical;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .btn-cancel {
    padding: 0.625rem 1.25rem;
    background: white;
    color: #333;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
  }

  .btn-cancel:hover {
    background: #f5f5f5;
  }

  .btn-undo-confirm {
    padding: 0.625rem 1.25rem;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
  }

  .btn-undo-confirm:hover:not(:disabled) {
    background: #b91c1c;
  }

  .btn-undo-confirm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .merge-card {
      flex-direction: column;
    }

    .merge-actions {
      width: 100%;
      justify-content: flex-end;
    }

    .merge-title {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
