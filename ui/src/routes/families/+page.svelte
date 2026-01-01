<script lang="ts">
  import { onMount } from 'svelte';
  import { apiJson, apiFetch } from '$lib/api';
  import FamilyModal from '$lib/components/FamilyModal.svelte';

  interface PrimaryContact {
    id: string;
    display_name: string;
  }

  interface Family {
    id: string;
    name: string;
    notes: string | null;
    is_active: boolean;
    member_count: number;
    child_count: number;
    primary_contacts: PrimaryContact[];
  }

  let families: Family[] = [];
  let loading = true;
  let error = '';
  let searchQuery = '';

  // Modal state
  let modalOpen = false;
  let editingFamily: Family | null = null;
  let modalComponent: FamilyModal;

  onMount(() => {
    loadFamilies();
  });

  async function loadFamilies() {
    loading = true;
    error = '';
    try {
      const url = searchQuery
        ? `/api/families?search=${encodeURIComponent(searchQuery)}`
        : '/api/families';
      families = await apiJson<Family[]>(url);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load families';
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    loadFamilies();
  }

  function openAddModal() {
    editingFamily = null;
    modalOpen = true;
  }

  function openEditModal(family: Family) {
    editingFamily = family;
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
    editingFamily = null;
  }

  async function handleSave(e: CustomEvent<{ name: string; notes: string }>) {
    const { name, notes } = e.detail;

    try {
      modalComponent.setSaving(true);

      if (editingFamily?.id) {
        await apiFetch(`/api/families/${editingFamily.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, notes })
        });
      } else {
        await apiFetch('/api/families', {
          method: 'POST',
          body: JSON.stringify({ name, notes })
        });
      }

      closeModal();
      await loadFamilies();
    } catch (err) {
      modalComponent.setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleArchive(family: Family) {
    if (!confirm(`Archive "${family.name}"? This family can be restored later.`)) {
      return;
    }

    try {
      await apiFetch(`/api/families/${family.id}`, { method: 'DELETE' });
      await loadFamilies();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive family');
    }
  }

  function getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  function formatMemberCount(count: number, childCount: number): string {
    if (count === 0) return 'No members';
    const parts = [`${count} member${count !== 1 ? 's' : ''}`];
    if (childCount > 0) {
      parts.push(`${childCount} child${childCount !== 1 ? 'ren' : ''}`);
    }
    return parts.join(', ');
  }
</script>

<div class="sys-page">
  <div class="sys-page-header">
    <div>
      <h1 class="sys-title">Families</h1>
      <p class="sys-subtitle">Household groups and family units</p>
    </div>
    <button class="sys-btn sys-btn--primary" on:click={openAddModal}>
      + Add Family
    </button>
  </div>

  <div class="sys-toolbar">
    <input
      class="sys-input"
      type="text"
      placeholder="Search families..."
      bind:value={searchQuery}
      on:keydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <button class="sys-btn sys-btn--secondary" on:click={handleSearch}>Search</button>
  </div>

  {#if loading}
    <div class="sys-state">Loading families...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>Error: {error}</p>
      <button class="sys-btn sys-btn--danger" on:click={loadFamilies}>Retry</button>
    </div>
  {:else if families.length === 0}
    <div class="sys-state sys-state--empty">
      {#if searchQuery}
        <p>No families found matching "{searchQuery}"</p>
        <button class="sys-btn sys-btn--secondary" on:click={() => { searchQuery = ''; loadFamilies(); }}>Clear search</button>
      {:else}
        <p>No families found.</p>
        <button class="sys-btn sys-btn--primary" on:click={openAddModal}>Create your first family</button>
      {/if}
    </div>
  {:else}
    <div class="sys-grid sys-grid--cards">
      {#each families as family}
        <div class="sys-card family-card">
          <a href={`/families/${family.id}`} class="family-link">
            <div class="sys-avatar sys-avatar--families family-avatar">
              {getInitials(family.name)}
            </div>
            <div class="family-info">
              <h2>{family.name}</h2>
              <div class="member-count">
                {formatMemberCount(Number(family.member_count), Number(family.child_count))}
              </div>
              {#if family.primary_contacts.length > 0}
                <div class="primary-contacts">
                  Contact: {family.primary_contacts.map(c => c.display_name).join(', ')}
                </div>
              {/if}
            </div>
          </a>
          <div class="card-actions">
            <button class="sys-icon-btn" on:click={() => openEditModal(family)} title="Edit">
              ✏️
            </button>
            <button class="sys-icon-btn sys-icon-btn--danger" on:click={() => handleArchive(family)} title="Archive">
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<FamilyModal
  bind:this={modalComponent}
  bind:open={modalOpen}
  family={editingFamily}
  on:close={closeModal}
  on:save={handleSave}
/>

<style>
  /* Families-specific styles only - layout handled by sys-* classes */
  .family-card {
    display: flex;
    align-items: center;
  }

  .family-link {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    text-decoration: none;
    color: inherit;
  }

  .family-avatar {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    font-size: 1.2rem;
  }

  .family-info {
    flex: 1;
    min-width: 0;
  }

  .family-info h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--sys-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .member-count {
    font-size: 0.875rem;
    color: var(--sys-muted);
    margin-bottom: 0.25rem;
  }

  .primary-contacts {
    font-size: 0.8rem;
    color: var(--sys-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-actions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    border-left: 1px solid var(--sys-border);
  }
</style>