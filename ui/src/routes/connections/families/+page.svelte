<!-- /src/routes/connections/families/+page.svelte -->

<script lang="ts">
  import { apiFetch, apiJson } from '$lib/api';
  import FamilyModal from '$lib/components/FamilyModal.svelte';
  import ObjectMark from '$lib/components/identity/ObjectMark.svelte';
  import { onMount } from 'svelte';

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

  // View State (Default to Cards for "Tending")
  let viewMode: 'cards' | 'table' = 'cards';

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

  // Integrity Check: "Archive, Don't Delete"
  async function handleArchive(family: Family) {
    if (!confirm(`Archive "${family.name}"? This family will be hidden but not deleted.`)) {
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

  <div class="sys-toolbar" style="display: flex; justify-content: space-between;">
    <div style="display: flex; gap: 10px; flex: 1;">
      <input
        class="sys-input"
        type="text"
        placeholder="Search families..."
        bind:value={searchQuery}
        on:keydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button class="sys-btn sys-btn--secondary" on:click={handleSearch}>Search</button>
    </div>

    <div class="sys-toggle" role="group" aria-label="Family view">
      <button
        type="button"
        class="sys-toggle-btn"
        class:active={viewMode === 'cards'}
        on:click={() => viewMode = 'cards'}
        title="Card view"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" /></svg>
      </button>

      <button
        type="button"
        class="sys-toggle-btn"
        class:active={viewMode === 'table'}
        on:click={() => viewMode = 'table'}
        title="Table view"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" /></svg>
      </button>
    </div>
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

    {#if viewMode === 'cards'}
      <div class="sys-grid sys-grid--cards">
        {#each families as family}
          <div class="sys-card family-card">
            <a href={`/connections/families/${family.id}`} class="family-link">
              <ObjectMark
                variant="families"
                size="md"
                className="family-avatar"
                label={getInitials(family.name)}
              />
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

    {:else}
      <div class="sys-card" style="margin-top: 20px; padding: 0;">
        <div class="sys-table-wrap" style="border: none; margin: 0;">
          <table class="sys-table">
            <thead>
              <tr>
                <th style="width: 60px;"></th>
                <th>Family Name</th>
                <th>Members</th>
                <th>Primary Contact</th>
                <th class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each families as family}
                <tr>
                  <td>
                    <a href={`/connections/families/${family.id}`} class="row-link">
                      <ObjectMark
                        variant="families"
                        size="sm"
                        label={getInitials(family.name)}
                      />
                    </a>
                  </td>

                  <td>
                    <a href={`/connections/families/${family.id}`} class="row-link">
                      <span class="primary" style="font-weight: 600;">{family.name}</span>
                    </a>
                  </td>

                  <td>
                    <span class="text-muted text-sm">
                      {formatMemberCount(Number(family.member_count), Number(family.child_count))}
                    </span>
                  </td>

                  <td>
                    {#if family.primary_contacts.length > 0}
                      <span class="text-sm">
                        {family.primary_contacts.map(c => c.display_name).join(', ')}
                      </span>
                    {:else}
                      <span class="text-muted text-sm italic">—</span>
                    {/if}
                  </td>

                  <td class="col-actions">
                    <button class="sys-icon-btn" on:click={() => openEditModal(family)} title="Edit">
                      ✏️
                    </button>
                    <button class="sys-icon-btn sys-icon-btn--danger" on:click={() => handleArchive(family)} title="Archive">
                      🗑️
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
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
  /* Local layout overrides only */
  .family-card {
    display: flex;
    align-items: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .family-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }

  .family-link {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    text-decoration: none;
    color: inherit;
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
  }

  .member-count, .primary-contacts {
    font-size: 0.85rem;
    color: var(--sys-muted);
  }

  .card-actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    border-left: 1px solid var(--sys-border);
  }

  /* Table Specifics */
  .row-link {
    color: inherit;
    text-decoration: none;
    display: block;
    height: 100%;
  }

  /* Ensure the toggle buttons align nicely */
  .sys-toolbar {
    align-items: center;
    gap: 1rem;
  }
</style>
