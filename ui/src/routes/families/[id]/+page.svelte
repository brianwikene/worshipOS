<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { apiJson, apiFetch } from '$lib/api';
  import FamilyModal from '$lib/components/FamilyModal.svelte';

  interface FamilyMember {
    membership_id: string;
    person_id: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    goes_by: string | null;
    relationship: string;
    is_active: boolean;
    is_temporary: boolean;
    is_primary_contact: boolean;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
  }

  interface Family {
    id: string;
    name: string;
    notes: string | null;
    is_active: boolean;
    street: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    members: FamilyMember[];
  }

  interface Person {
    id: string;
    display_name: string;
  }

  let family: Family | null = null;
  let loading = true;
  let error = '';

  // Edit family modal
  let editModalOpen = false;
  let editModalComponent: FamilyModal;

  // Add member state
  let showAddMember = false;
  let availablePeople: Person[] = [];
  let selectedPersonId = '';
  let selectedRelationship = 'other';
  let isPrimaryContact = false;
  let isTemporary = false;
  let addingMember = false;

  const relationshipOptions = [
    { value: 'parent', label: 'Parent' },
    { value: 'guardian', label: 'Guardian' },
    { value: 'spouse', label: 'Spouse' },
    { value: 'child', label: 'Child' },
    { value: 'foster_child', label: 'Foster Child' },
    { value: 'grandparent', label: 'Grandparent' },
    { value: 'sibling', label: 'Sibling' },
    { value: 'other', label: 'Other' }
  ];

  onMount(() => {
    loadFamily();
  });

  async function loadFamily() {
    const familyId = $page.params.id;
    loading = true;
    error = '';

    try {
      family = await apiJson<Family>(`/api/families/${familyId}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load family';
    } finally {
      loading = false;
    }
  }

  async function loadAvailablePeople() {
    try {
      availablePeople = await apiJson<Person[]>('/api/people');
    } catch (e) {
      console.error('Failed to load people:', e);
    }
  }

  function openEditModal() {
    editModalOpen = true;
  }

  function closeEditModal() {
    editModalOpen = false;
  }

  async function handleEditSave(e: CustomEvent<{ name: string; notes: string }>) {
    if (!family) return;

    const { name, notes } = e.detail;

    try {
      editModalComponent.setSaving(true);

      await apiFetch(`/api/families/${family.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, notes })
      });

      closeEditModal();
      await loadFamily();
    } catch (err) {
      editModalComponent.setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleArchive() {
    if (!family) return;

    if (!confirm(`Archive "${family.name}"? This family can be restored later.`)) {
      return;
    }

    try {
      await apiFetch(`/api/families/${family.id}`, { method: 'DELETE' });
      goto('/families');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive family');
    }
  }

  async function toggleAddMember() {
    showAddMember = !showAddMember;
    if (showAddMember && availablePeople.length === 0) {
      await loadAvailablePeople();
    }
    // Reset form
    selectedPersonId = '';
    selectedRelationship = 'other';
    isPrimaryContact = false;
    isTemporary = false;
  }

  async function handleAddMember() {
    if (!family || !selectedPersonId) return;

    addingMember = true;

    try {
      await apiFetch(`/api/families/${family.id}/members`, {
        method: 'POST',
        body: JSON.stringify({
          person_id: selectedPersonId,
          relationship: selectedRelationship,
          is_primary_contact: isPrimaryContact,
          is_temporary: isTemporary
        })
      });

      showAddMember = false;
      await loadFamily();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      addingMember = false;
    }
  }

  async function handleRemoveMember(member: FamilyMember) {
    if (!family) return;

    if (!confirm(`Remove ${member.display_name} from this family?`)) {
      return;
    }

    try {
      await apiFetch(`/api/families/${family.id}/members/${member.membership_id}`, {
        method: 'DELETE'
      });
      await loadFamily();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove member');
    }
  }

  async function togglePrimaryContact(member: FamilyMember) {
    if (!family) return;

    try {
      await apiFetch(`/api/families/${family.id}/members/${member.membership_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          is_primary_contact: !member.is_primary_contact
        })
      });
      await loadFamily();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update member');
    }
  }

  function formatRelationship(rel: string): string {
    return rel.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function formatAddress(family: Family): string | null {
    const parts = [
      family.street,
      family.city ? `${family.city},` : null,
      family.state,
      family.postal_code
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : null;
  }

  // Filter out people already in the family
  $: filteredPeople = availablePeople.filter(
    p => !family?.members.some(m => m.person_id === p.id && m.is_active)
  );

  $: activeMembers = family?.members.filter(m => m.is_active) ?? [];
  $: inactiveMembers = family?.members.filter(m => !m.is_active) ?? [];
</script>

<div class="container">
  <a href="/families" class="back-link">← Back to Families</a>

  {#if loading}
    <div class="loading">Loading family details...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={loadFamily}>Retry</button>
    </div>
  {:else if family}
    <div class="family-header">
      <div class="header-info">
        <h1>{family.name}</h1>
        {#if family.notes}
          <p class="notes">{family.notes}</p>
        {/if}
        {#if formatAddress(family)}
          <p class="address">📍 {formatAddress(family)}</p>
        {/if}
      </div>
      <div class="header-actions">
        <button class="btn-edit" on:click={openEditModal}>
          ✏️ Edit
        </button>
        <button class="btn-archive" on:click={handleArchive}>
          🗑️ Archive
        </button>
      </div>
    </div>

    <div class="members-section">
      <div class="section-header">
        <h2>Family Members ({activeMembers.length})</h2>
        <button class="btn-add-member" on:click={toggleAddMember}>
          {showAddMember ? 'Cancel' : '+ Add Member'}
        </button>
      </div>

      {#if showAddMember}
        <div class="add-member-form">
          <div class="form-row">
            <div class="form-group">
              <label for="person">Person</label>
              <select id="person" bind:value={selectedPersonId} disabled={addingMember}>
                <option value="">Select a person...</option>
                {#each filteredPeople as person}
                  <option value={person.id}>{person.display_name}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label for="relationship">Relationship</label>
              <select id="relationship" bind:value={selectedRelationship} disabled={addingMember}>
                {#each relationshipOptions as opt}
                  <option value={opt.value}>{opt.label}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-row checkboxes">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={isPrimaryContact} disabled={addingMember} />
              Primary Contact
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={isTemporary} disabled={addingMember} />
              Temporary (e.g., foster placement)
            </label>
          </div>
          <button
            class="btn-confirm-add"
            on:click={handleAddMember}
            disabled={!selectedPersonId || addingMember}
          >
            {addingMember ? 'Adding...' : 'Add to Family'}
          </button>
        </div>
      {/if}

      {#if activeMembers.length === 0}
        <div class="empty-members">
          <p>No members in this family yet.</p>
        </div>
      {:else}
        <div class="members-list">
          {#each activeMembers as member}
            <div class="member-card" class:temporary={member.is_temporary}>
              <a href={`/people/${member.person_id}`} class="member-link">
                <div class="member-avatar">
                  {member.display_name.charAt(0).toUpperCase()}
                </div>
                <div class="member-info">
                  <div class="member-name">
                    {member.display_name}
                    {#if member.is_primary_contact}
                      <span class="badge primary">Primary Contact</span>
                    {/if}
                    {#if member.is_temporary}
                      <span class="badge temporary">Temporary</span>
                    {/if}
                  </div>
                  <div class="member-relationship">
                    {formatRelationship(member.relationship)}
                  </div>
                </div>
              </a>
              <div class="member-actions">
                <button
                  class="btn-icon"
                  on:click={() => togglePrimaryContact(member)}
                  title={member.is_primary_contact ? 'Remove as primary contact' : 'Set as primary contact'}
                >
                  {member.is_primary_contact ? '⭐' : '☆'}
                </button>
                <button
                  class="btn-icon btn-danger"
                  on:click={() => handleRemoveMember(member)}
                  title="Remove from family"
                >
                  ✕
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}

      {#if inactiveMembers.length > 0}
        <details class="inactive-section">
          <summary>Former Members ({inactiveMembers.length})</summary>
          <div class="members-list inactive">
            {#each inactiveMembers as member}
              <div class="member-card inactive">
                <div class="member-info">
                  <div class="member-name">{member.display_name}</div>
                  <div class="member-relationship">
                    {formatRelationship(member.relationship)}
                    {#if member.end_date}
                      — Left {member.end_date}
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        </details>
      {/if}
    </div>
  {/if}
</div>

<FamilyModal
  bind:this={editModalComponent}
  bind:open={editModalOpen}
  family={family}
  on:close={closeEditModal}
  on:save={handleEditSave}
/>

<style>
  .container {
    max-width: 800px;
    margin: 40px auto;
    padding: 0 20px;
  }

  .back-link {
    display: inline-block;
    margin-bottom: 20px;
    color: #666;
    text-decoration: none;
    font-weight: 500;
  }

  .back-link:hover {
    color: #0066cc;
  }

  .loading, .error {
    text-align: center;
    padding: 3rem;
    background: #f5f5f5;
    border-radius: 12px;
  }

  .error {
    background: #fee;
    color: #c00;
  }

  .error button {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: #c00;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .family-header {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .header-info h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    color: #1a1a1a;
  }

  .notes {
    color: #666;
    margin: 0 0 0.5rem 0;
  }

  .address {
    color: #888;
    font-size: 0.9rem;
    margin: 0;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-edit, .btn-archive {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-edit {
    background: #0066cc;
    color: white;
    border: 1px solid #0066cc;
  }

  .btn-edit:hover {
    background: #0055aa;
  }

  .btn-archive {
    background: white;
    color: #666;
    border: 1px solid #ddd;
  }

  .btn-archive:hover {
    background: #fee;
    border-color: #fcc;
    color: #c00;
  }

  .members-section {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #eee;
    background: #fafafa;
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .btn-add-member {
    padding: 0.5rem 1rem;
    background: #e3f2fd;
    color: #0066cc;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-add-member:hover {
    background: #bbdefb;
  }

  .add-member-form {
    padding: 1.5rem;
    background: #f9fafb;
    border-bottom: 1px solid #eee;
  }

  .form-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .form-group {
    flex: 1;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #333;
    margin-bottom: 0.375rem;
  }

  select {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    background: white;
  }

  select:focus {
    outline: none;
    border-color: #0066cc;
  }

  .checkboxes {
    margin-bottom: 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: #333;
    cursor: pointer;
  }

  .btn-confirm-add {
    padding: 0.625rem 1.25rem;
    background: #0066cc;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-confirm-add:hover:not(:disabled) {
    background: #0055aa;
  }

  .btn-confirm-add:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .empty-members {
    padding: 2rem;
    text-align: center;
    color: #888;
  }

  .members-list {
    padding: 0.5rem;
  }

  .member-card {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    transition: background 0.2s;
  }

  .member-card:hover {
    background: #f5f5f5;
  }

  .member-card.temporary {
    border-left: 3px solid #ff9800;
  }

  .member-card.inactive {
    opacity: 0.6;
  }

  .member-link {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 1rem;
    text-decoration: none;
    color: inherit;
  }

  .member-avatar {
    width: 40px;
    height: 40px;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    flex-shrink: 0;
  }

  .member-info {
    flex: 1;
  }

  .member-name {
    font-weight: 500;
    color: #1a1a1a;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .member-relationship {
    font-size: 0.85rem;
    color: #666;
  }

  .badge {
    font-size: 0.7rem;
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    font-weight: 500;
  }

  .badge.primary {
    background: #e3f2fd;
    color: #0066cc;
  }

  .badge.temporary {
    background: #fff3e0;
    color: #e65100;
  }

  .member-actions {
    display: flex;
    gap: 0.25rem;
  }

  .btn-icon {
    background: none;
    border: none;
    padding: 0.5rem;
    cursor: pointer;
    border-radius: 6px;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .btn-icon:hover {
    background: #f0f0f0;
  }

  .btn-danger:hover {
    background: #fee;
  }

  .inactive-section {
    border-top: 1px solid #eee;
    padding: 1rem;
  }

  .inactive-section summary {
    cursor: pointer;
    font-size: 0.9rem;
    color: #666;
    padding: 0.5rem;
  }

  .inactive-section summary:hover {
    color: #333;
  }

  .members-list.inactive {
    padding-top: 0.5rem;
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 1rem;
      margin: 20px auto;
    }

    .family-header {
      flex-direction: column;
    }

    .header-actions {
      width: 100%;
    }

    .btn-edit, .btn-archive {
      flex: 1;
    }

    .form-row {
      flex-direction: column;
    }

    .section-header {
      flex-direction: column;
      gap: 0.75rem;
      align-items: stretch;
    }
  }
</style>