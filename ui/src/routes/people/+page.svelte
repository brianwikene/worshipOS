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

<div class="container">
  <header>
    <div class="header-top">
      <div>
        <h1>People</h1>
        <p>Team members and volunteers</p>
      </div>
      <button class="btn-add" on:click={openAddModal}>
        <span class="plus">+</span> Add Person
      </button>
    </div>

    <div class="search-bar">
      <input
        type="text"
        placeholder="Search people..."
        bind:value={searchQuery}
        on:keydown={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button class="btn-search" on:click={handleSearch}>Search</button>
    </div>
  </header>

  {#if loading}
    <div class="loading">Loading people...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={loadPeople}>Retry</button>
    </div>
  {:else if people.length === 0}
    <div class="empty">
      {#if searchQuery}
        <p>No people found matching "{searchQuery}"</p>
        <button on:click={() => { searchQuery = ''; loadPeople(); }}>Clear search</button>
      {:else}
        <p>No people found.</p>
        <button on:click={openAddModal}>Add your first person</button>
      {/if}
    </div>
  {:else}
    <div class="people-grid">
      {#each people as person}
        <div class="person-card">
          <a href={`/people/${person.id}`} class="person-link">
            <div class="avatar">
              {getInitial(person.display_name)}
            </div>
            <div class="person-info">
              <h2>{person.display_name}</h2>
              {#if person.goes_by && person.first_name && person.goes_by !== person.first_name}
                <div class="legal-name">({person.first_name})</div>
              {/if}
              {#if person.has_contact_info}
                <div class="contact-badge">
                  <span class="phone-icon">☎</span>
                  <span>Contact Info</span>
                </div>
              {:else}
                <div class="no-info">No contact info</div>
              {/if}
            </div>
          </a>
          <div class="card-actions">
            <button class="btn-icon" on:click={() => openEditModal(person)} title="Edit">
              ✏️
            </button>
            <button class="btn-icon btn-danger" on:click={() => handleDelete(person)} title="Archive">
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

  .people-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .person-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    display: flex;
    align-items: center;
    transition: all 0.2s;
  }

  .person-card:hover {
    border-color: #1976d2;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .person-link {
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
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .person-info {
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

  .legal-name {
    font-size: 0.8rem;
    color: #888;
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

  .phone-icon {
    font-size: 0.9rem;
    line-height: 1;
  }

  .no-info {
    color: #999;
    font-size: 0.8rem;
    font-style: italic;
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

    .people-grid {
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