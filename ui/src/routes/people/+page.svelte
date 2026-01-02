<script lang="ts">
  import { onMount } from 'svelte';
  import { apiJson, apiFetch } from '$lib/api';
  import PersonModal from '$lib/components/PersonModal.svelte';

  interface Person {
    id: string;
    first_name: string | null;
    last_name: string | null;
    goes_by: string | null;
    display_name: string;
    has_contact_info: boolean;
  }

  let people: Person[] = [];
  let loading = true;
  let error = '';
  let searchQuery = '';

  // Modal state
  let modalOpen = false;
  let editingPerson: Person | null = null;
  let modalComponent: PersonModal;

  onMount(() => {
    loadPeople();
  });

  async function loadPeople() {
    loading = true;
    error = '';
    try {
      const url = searchQuery 
        ? `/api/people?search=${encodeURIComponent(searchQuery)}`
        : '/api/people';
      people = await apiJson<Person[]>(url);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load people';
    } finally {
      loading = false;
    }
  }

  function handleSearch() {
    loadPeople();
  }

  function openAddModal() {
    editingPerson = null;
    modalOpen = true;
  }

  function openEditModal(person: Person) {
    editingPerson = person;
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
    editingPerson = null;
  }

  async function handleSave(e: CustomEvent<{ first_name: string; last_name: string; goes_by: string }>) {
    const { first_name, last_name, goes_by } = e.detail;
    
    try {
      modalComponent.setSaving(true);
      
      if (editingPerson?.id) {
        // Update existing
        await apiFetch(`/api/people/${editingPerson.id}`, {
          method: 'PUT',
          body: JSON.stringify({ first_name, last_name, goes_by })
        });
      } else {
        // Create new
        await apiFetch('/api/people', {
          method: 'POST',
          body: JSON.stringify({ first_name, last_name, goes_by })
        });
      }
      
      closeModal();
      await loadPeople();
    } catch (err) {
      modalComponent.setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleDelete(person: Person) {
    if (!confirm(`Archive "${person.display_name}"? They can be restored later.`)) {
      return;
    }

    try {
      await apiFetch(`/api/people/${person.id}`, { method: 'DELETE' });
      await loadPeople();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive person');
    }
  }

  function getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }
</script>

<div class="sys-page">
  <div class="sys-page-header">
    <div>
      <h1 class="sys-title">People</h1>
      <p class="sys-subtitle">Team members and volunteers</p>
    </div>
    <button class="sys-btn sys-btn--primary" on:click={openAddModal}>
      + Add Person
    </button>
  </div>

  <div class="sys-toolbar">
    <input
      class="sys-input"
      placeholder="Search people..."
      bind:value={searchQuery}
      on:keydown={(e) => e.key === 'Enter' && handleSearch()}
    />
    <button class="sys-btn sys-btn--secondary" on:click={handleSearch}>Search</button>
  </div>

  {#if loading}
    <div class="sys-state">Loading people...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>Error: {error}</p>
      <button class="sys-btn sys-btn--danger" on:click={loadPeople}>Retry</button>
    </div>
  {:else if people.length === 0}
    <div class="sys-state sys-state--empty">
      {#if searchQuery}
        <p>No people found matching "{searchQuery}"</p>
        <button class="sys-btn sys-btn--secondary" on:click={() => { searchQuery = ''; loadPeople(); }}>Clear search</button>
      {:else}
        <p>No people found.</p>
        <button class="sys-btn sys-btn--primary" on:click={openAddModal}>Add your first person</button>
      {/if}
    </div>
  {:else}
    <div class="sys-grid sys-grid--cards">
      {#each people as person}
        <div class="sys-card person-card">
          <a href={`/people/${person.id}`} class="person-link">
            <div class="sys-avatar sys-avatar--people">
              {getInitial(person.display_name)}
            </div>
            <div class="person-info">
              <h2>{person.display_name}</h2>
              {#if person.goes_by && person.first_name && person.goes_by !== person.first_name}
                <div class="legal-name">({person.first_name})</div>
              {/if}
              {#if person.has_contact_info}
                <div class="contact-badge">☎ Contact Info</div>
              {:else}
                <div class="no-info">No contact info</div>
              {/if}
            </div>
          </a>
          <div class="card-actions">
            <button class="sys-icon-btn" on:click={() => openEditModal(person)} title="Edit">
              ✏️
            </button>
            <button class="sys-icon-btn sys-icon-btn--danger" on:click={() => handleDelete(person)} title="Archive">
              🗑️
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<PersonModal
  bind:this={modalComponent}
  bind:open={modalOpen}
  person={editingPerson}
  on:close={closeModal}
  on:save={handleSave}
/>

<style>
  /* People-specific styles only - layout handled by sys-* classes */
  .person-card {
    display: flex;
    align-items: center;
  }

  .person-link {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    text-decoration: none;
    color: inherit;
  }

  .sys-avatar--people {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    font-size: 1.4rem;
  }

  .person-info {
    flex: 1;
    min-width: 0;
  }

  .person-info h2 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: var(--sys-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .legal-name {
    font-size: 0.8rem;
    color: var(--sys-muted);
    margin-bottom: 0.25rem;
  }

  .contact-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: #e8f5e9;
    color: #2e7d32;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .no-info {
    color: var(--sys-muted);
    font-size: 0.8rem;
    font-style: italic;
  }

  .card-actions {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    border-left: 1px solid var(--sys-border);
  }
</style>