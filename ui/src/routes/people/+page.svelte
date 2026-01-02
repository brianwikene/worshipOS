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
  let sortBy: 'last_name' | 'first_name' | 'updated_at' = 'last_name';
  let sortDir: 'asc' | 'desc' = 'asc';
  let viewMode: 'cards' | 'table' = 'cards';

  // Modal state
  let modalOpen = false;
  let editingPerson: Person | null = null;
  let modalComponent: PersonModal;

  onMount(() => {
    // restore preferred view mode
  const savedView = localStorage.getItem('people:viewMode');
  if (savedView === 'cards' || savedView === 'table') {
    viewMode = savedView;
  }

  // initial data load
    loadPeople();
  });

  // UI helpers
  function setViewMode(mode: 'cards' | 'table') {
    viewMode = mode;
    localStorage.setItem('people:viewMode', mode);
  }

  async function loadPeople() {
    loading = true;
    error = '';
    try {
      const params = new URLSearchParams();

      if (searchQuery) params.set('search', searchQuery);
      params.set('sort', sortBy);
      params.set('dir', sortDir);
      const url = `/api/people?${params.toString()}`;

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

<div class="people-controls">
  <!-- view toggle -->
  <div class="people-view-toggle" role="group" aria-label="People view">
    <button
      type="button"
      class="people-view-btn"
      class:active={viewMode === 'cards'}
      on:click={() => setViewMode('cards')}
      aria-label="Card view"
      title="Card view"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z" />
      </svg>
    </button>

    <button
      type="button"
      class="people-view-btn"
      class:active={viewMode === 'table'}
      on:click={() => setViewMode('table')}
      aria-label="Table view"
      title="Table view"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
      </svg>
    </button>
  </div>

  <!-- sort controls -->
  <div class="people-sort-group">
    <select class="sys-select people-sort-select" bind:value={sortBy} on:change={loadPeople}>
      <option value="last_name">Last name</option>
      <option value="first_name">First name</option>
      <!-- IMPORTANT: your API whitelist doesn't include updated_at yet -->
      <option value="created_at">Recently added</option>
    </select>

    <button
      type="button"
      class="sys-btn sys-btn--secondary sort-dir-btn"
      on:click={() => { sortDir = sortDir === 'asc' ? 'desc' : 'asc'; loadPeople(); }}
    >
      {sortDir === 'asc' ? 'A–Z' : 'Z–A'}
    </button>
  </div>
</div>
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
    {#if viewMode === 'cards'}  
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
    {:else}
    <!-- Table view placeholder for now -->
    <div class="sys-table-wrap">
  <table class="sys-table" aria-label="People table">
    <thead>
      <tr>
        <th class="col-photo">Photo</th>

        <th class="col-name">
          <button
            type="button"
            class="th-btn"
            on:click={() => {
              // sort by last_name by default when clicking "Name"
              sortBy = 'last_name';
              sortDir = sortDir === 'asc' ? 'desc' : 'asc';
              loadPeople();
            }}
            aria-label="Sort by name"
          >
            Name
            <span class="sort-indicator">{sortBy === 'last_name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}</span>
          </button>
        </th>

        <th class="col-legal">Legal name</th>

        <th class="col-contact">Contact</th>

        <th class="col-actions">Actions</th>
      </tr>
    </thead>

    <tbody>
      {#each people as person (person.id)}
        <tr>
          <td class="col-photo">
            <a href={`/people/${person.id}`} class="row-link" aria-label={`Open ${person.display_name}`}>
              <div class="sys-avatar sys-avatar--people">
                {getInitial(person.display_name)}
              </div>
            </a>
          </td>

          <td class="col-name">
            <a href={`/people/${person.id}`} class="row-link">
              <div class="primary">{person.display_name}</div>
              {#if person.goes_by && person.goes_by !== person.first_name}
                <div class="secondary">({person.goes_by})</div>
              {/if}
            </a>
          </td>

          <td class="col-legal">
            <span class="muted">{person.first_name} {person.last_name}</span>
          </td>

          <td class="col-contact">
            {#if person.has_contact_info}
              <span class="badge">📞 Contact info</span>
            {:else}
              <span class="muted">No contact info</span>
            {/if}
          </td>

          <td class="col-actions">
            <button class="sys-icon-btn" on:click={() => openEditModal(person)} title="Edit" type="button">✏️</button>
            <button class="sys-icon-btn sys-icon-btn--danger" on:click={() => handleDelete(person)} title="Archive" type="button">🗑️</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

  {/if}
  {/if}


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

  .people-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.people-sort-group .sys-select {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-right: 32px; /* space for the native arrow */
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}
.people-sort-select {
  box-sizing: border-box;
}

.people-sort-select {
  height: 40px;            /* give it a little more breathing room */
  line-height: 40px;       /* vertically centers the text */
  padding: 0 36px 0 12px;  /* zero vertical padding so nothing gets clipped */
}


.people-sort-group .sys-select,
.people-sort-group .sys-btn,
.people-view-btn {
  height: 36px;
}

.people-sort-group .sys-select {
  width: 220px;      /* pick a size you like */
  min-width: 220px;  /* prevents flex from crushing it */
}


  .people-view-toggle {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  border: 1px solid var(--sys-border, #e5e7eb);
  border-radius: 10px;
  background: white;
}

.people-view-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--sys-muted, #6b7280);
  cursor: pointer;
}

.people-view-btn:hover {
  background: rgba(0, 0, 0, 0.04);
  color: var(--sys-text, #111827);
}

.people-view-btn.active {
  background: rgba(99, 102, 241, 0.12); /* subtle “selected” */
  color: var(--sys-primary, #4f46e5);
}
.sys-table-wrap {
  overflow-x: auto;
}

.sys-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}

.sys-table th,
.sys-table td {
  padding: 12px 14px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  vertical-align: middle;
  text-align: left;
}

.col-photo { width: 64px; }
.col-actions { width: 120px; }

.th-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: 0;
  padding: 0;
  font: inherit;
  cursor: pointer;
}

.sort-indicator {
  font-size: 12px;
  opacity: 0.7;
}

.row-link {
  color: inherit;
  text-decoration: none;
}

.row-link:hover .primary {
  text-decoration: underline;
}

.primary {
  font-weight: 600;
}

.secondary,
.muted {
  opacity: 0.7;
  font-size: 13px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(0,0,0,0.04);
  font-size: 12px;
}


</style>