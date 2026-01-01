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
  <header>
    <div class="header-top">
      <div>
        <h1>Families</h1>
        <p>Household groups and family units</p>
      </div>
      <button class="sys-btn sys-btn--primary" on:click={openAddModal}>
        <span class="plus">+</span> Add Family
      </button>
    </div>

    <div class="sys-search">
      <input class="sys-input"
        type="text"
        placeholder="Search families..."
        bind:value={searchQuery}
        on:keydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button class="btn-search" on:click={handleSearch}>Search</button>
    </div>
  </header>

  {#if loading}
    <div class="sys-state">Loading families...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>Error: {error}</p>
      <button on:click={loadFamilies}>Retry</button>
    </div>
  {:else if families.length === 0}
    <div class="sys-state sys-state--empty">
      {#if searchQuery}
        <p>No families found matching "{searchQuery}"</p>
        <button on:click={() => { searchQuery = ''; loadFamilies(); }}>Clear search</button>
      {:else}
        <p>No families found.</p>
        <button on:click={openAddModal}>Create your first family</button>
      {/if}
    </div>
  {:else}
    <div class="families-grid">
      {#each families as family}
        <div class="family-card">
          <a href={`/families/${family.id}`} class="family-link">
            <div class="avatar">
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
            <button class="btn-icon" on:click={() => openEditModal(family)} title="Edit">
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
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  header {
    margin-bottom: 2rem;
  }

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    gap: 1rem;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: #1a1a1a;
  }

  header p {
    color: #666;
    font-size: 1.1rem;
    margin: 0;
  }

  .btn-add {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn-add:hover {
    background: #0055aa;
  }

  .plus {
    font-size: 1.25rem;
    font-weight: 300;
  }

  .search-bar {
    display: flex;
    gap: 0.5rem;
  }

  .search-bar input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
  }

  .search-bar input:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }

  .btn-search {
    padding: 0.75rem 1.5rem;
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-search:hover {
    background: #e5e5e5;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 3rem;
    background: #f5f5f5;
    border-radius: 8px;
    margin-top: 2rem;
  }

  .error {
    background: #fee;
    color: #c00;
  }

  .error button, .empty button {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .error button {
    background: #c00;
  }

  .error button:hover {
    background: #a00;
  }

  .empty button:hover {
    background: #0055aa;
  }

  .families-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1.5rem;
  }

  .family-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    display: flex;
    align-items: center;
    transition: all 0.2s;
  }

  .family-card:hover {
    border-color: #1976d2;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
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

  .avatar {
    width: 56px;
    height: 56px;
    background: #e8f5e9;
    color: #2e7d32;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .family-info {
    flex: 1;
    min-width: 0;
  }

  h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: #1a1a1a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .member-count {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.25rem;
  }

  .primary-contacts {
    font-size: 0.8rem;
    color: #888;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-actions {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    border-left: 1px solid #eee;
  }

  .btn-icon {
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
    font-size: 1rem;
  }

  .btn-icon:hover {
    background: #f0f0f0;
  }

  .btn-danger:hover {
    background: #fee;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    .header-top {
      flex-direction: column;
    }

    .btn-add {
      width: 100%;
      justify-content: center;
    }

    h1 {
      font-size: 2rem;
    }

    .families-grid {
      grid-template-columns: 1fr;
    }

    .search-bar {
      flex-direction: column;
    }

    .btn-search {
      width: 100%;
    }
  }
</style>