<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { apiJson, apiFetch } from '$lib/api';
  import PersonModal from '$lib/components/PersonModal.svelte';

  interface ContactMethod {
    type: string;
    value: string;
    label: string | null;
    is_primary: boolean;
  }

  interface Address {
    id: string;
    line1: string | null;
    line2: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    label: string | null;
  }

  interface Person {
    id: string;
    first_name: string | null;
    last_name: string | null;
    goes_by: string | null;
    display_name: string;
    is_active: boolean;
    contact_methods: ContactMethod[];
    addresses: Address[];
  }

  interface RoleCapability {
    id: string;
    role_id: string;
    role_name: string;
    ministry_area: string | null;
    body_parts: string[];
    proficiency: number;
    is_primary: boolean;
    is_approved: boolean;
    notes: string | null;
  }

  interface Role {
    id: string;
    name: string;
    ministry_area: string | null;
    body_parts: string[];
  }

  let person: Person | null = null;
  let loading = true;
  let error = '';

  // Role capabilities state
  let capabilities: RoleCapability[] = [];
  let availableRoles: Role[] = [];
  let showAddRoleModal = false;
  let addingRole = false;
  let selectedRoleId = '';
  let selectedProficiency = 3;

  // Modal state
  let modalOpen = false;
  let modalComponent: PersonModal;

  // Address modal state
  let showAddressModal = false;
  let editingAddress: Address | null = null;
  let savingAddress = false;
  let addressLine1 = '';
  let addressLine2 = '';
  let addressCity = '';
  let addressState = '';
  let addressPostalCode = '';
  let addressCountry = 'US';
  let addressLabel = '';

  onMount(() => {
    loadPerson();
    loadCapabilities();
    loadRoles();
  });

  async function loadCapabilities() {
    const personId = $page.params.id;
    try {
      capabilities = await apiJson<RoleCapability[]>(`/api/people/${personId}/capabilities`);
    } catch (e) {
      console.error('Failed to load capabilities:', e);
    }
  }

  async function loadRoles() {
    try {
      availableRoles = await apiJson<Role[]>('/api/roles');
    } catch (e) {
      console.error('Failed to load roles:', e);
    }
  }

  // Filter out roles the person already has
  $: unassignedRoles = availableRoles.filter(
    role => !capabilities.some(cap => cap.role_id === role.id)
  );

  // Group unassigned roles by ministry area
  $: rolesByMinistry = unassignedRoles.reduce((acc, role) => {
    const area = role.ministry_area || 'Other';
    if (!acc[area]) acc[area] = [];
    acc[area].push(role);
    return acc;
  }, {} as Record<string, Role[]>);

  // Group capabilities by ministry area
  $: capabilitiesByMinistry = capabilities.reduce((acc, cap) => {
    const area = cap.ministry_area || 'Other';
    if (!acc[area]) acc[area] = [];
    acc[area].push(cap);
    return acc;
  }, {} as Record<string, RoleCapability[]>);

  async function addRoleCapability() {
    if (!selectedRoleId) return;
    const personId = $page.params.id;

    addingRole = true;
    try {
      await apiFetch(`/api/people/${personId}/capabilities`, {
        method: 'POST',
        body: JSON.stringify({
          role_id: selectedRoleId,
          proficiency: selectedProficiency
        })
      });
      await loadCapabilities();
      showAddRoleModal = false;
      selectedRoleId = '';
      selectedProficiency = 3;
    } catch (e: any) {
      alert(e?.message ?? 'Failed to add role');
    } finally {
      addingRole = false;
    }
  }

  async function removeCapability(roleId: string, roleName: string) {
    if (!confirm(`Remove "${roleName}" from this person's capabilities?`)) return;
    const personId = $page.params.id;

    try {
      await apiFetch(`/api/people/${personId}/capabilities/${roleId}`, {
        method: 'DELETE'
      });
      await loadCapabilities();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to remove role');
    }
  }

  async function togglePrimary(roleId: string, currentValue: boolean) {
    const personId = $page.params.id;
    try {
      await apiFetch(`/api/people/${personId}/capabilities/${roleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_primary: !currentValue })
      });
      await loadCapabilities();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to update role');
    }
  }

  function getProficiencyLabel(level: number): string {
    const labels = ['', 'Beginner', 'Developing', 'Proficient', 'Advanced', 'Expert'];
    return labels[level] || 'Unknown';
  }

  function formatBodyParts(parts: string[]): string {
    if (!parts || parts.length === 0) return '';
    return parts.join(', ');
  }

  // Address functions
  function openAddAddressModal() {
    editingAddress = null;
    addressLine1 = '';
    addressLine2 = '';
    addressCity = '';
    addressState = '';
    addressPostalCode = '';
    addressCountry = 'US';
    addressLabel = '';
    showAddressModal = true;
  }

  function openEditAddressModal(addr: Address) {
    editingAddress = addr;
    addressLine1 = addr.line1 || addr.street || '';
    addressLine2 = addr.line2 || '';
    addressCity = addr.city || '';
    addressState = addr.state || '';
    addressPostalCode = addr.postal_code || '';
    addressCountry = addr.country || 'US';
    addressLabel = addr.label || '';
    showAddressModal = true;
  }

  function closeAddressModal() {
    showAddressModal = false;
    editingAddress = null;
  }

  async function saveAddress() {
    const personId = $page.params.id;
    savingAddress = true;

    try {
      const payload = {
        person_id: personId,
        line1: addressLine1 || null,
        line2: addressLine2 || null,
        city: addressCity || null,
        state: addressState || null,
        postal_code: addressPostalCode || null,
        country: addressCountry || 'US',
        label: addressLabel || null
      };

      if (editingAddress) {
        await apiFetch(`/api/addresses/${editingAddress.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/addresses', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      closeAddressModal();
      await loadPerson();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save address');
    } finally {
      savingAddress = false;
    }
  }

  async function deleteAddress(addr: Address) {
    if (!confirm('Delete this address?')) return;

    try {
      await apiFetch(`/api/addresses/${addr.id}`, { method: 'DELETE' });
      await loadPerson();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete address');
    }
  }

  async function loadPerson() {
    const personId = $page.params.id;
    loading = true;
    error = '';

    try {
      person = await apiJson<Person>(`/api/people/${personId}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load person details';
    } finally {
      loading = false;
    }
  }

  function openEditModal() {
    modalOpen = true;
  }

  function closeModal() {
    modalOpen = false;
  }

  async function handleSave(e: CustomEvent<{ first_name: string; last_name: string; goes_by: string }>) {
    if (!person) return;
    
    const { first_name, last_name, goes_by } = e.detail;
    
    try {
      modalComponent.setSaving(true);
      
      await apiFetch(`/api/people/${person.id}`, {
        method: 'PUT',
        body: JSON.stringify({ first_name, last_name, goes_by })
      });
      
      closeModal();
      await loadPerson(); // Reload to show updated data
    } catch (err) {
      modalComponent.setError(err instanceof Error ? err.message : 'Failed to save');
    }
  }

  async function handleArchive() {
    if (!person) return;
    
    if (!confirm(`Archive "${person.display_name}"? They can be restored later.`)) {
      return;
    }

    try {
      await apiFetch(`/api/people/${person.id}`, { method: 'DELETE' });
      goto('/people');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive person');
    }
  }

  function formatType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function formatAddress(addr: Address) {
    const streetLine = addr.line1 || addr.street;
    const parts = [
      streetLine,
      addr.line2,
      addr.city ? `${addr.city},` : null,
      addr.state,
      addr.postal_code
    ].filter(Boolean);
    return parts.join(' ') || 'No address details';
  }

  function getLink(method: ContactMethod) {
    if (method.type.includes('email')) return `mailto:${method.value}`;
    if (method.type.includes('phone')) return `tel:${method.value}`;
    return null;
  }
</script>

<div class="container">
  <a href="/people" class="back-link">← Back to People</a>

  {#if loading}
    <div class="loading">Loading person details...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={loadPerson}>Retry</button>
    </div>
  {:else if person}
    <div class="profile-card">
      <div class="profile-header">
        <div class="avatar-large">
          {person.display_name.charAt(0).toUpperCase()}
        </div>
        <h1>{person.display_name}</h1>
        {#if person.goes_by && person.first_name && person.goes_by !== person.first_name}
          <p class="legal-name">Legal name: {person.first_name} {person.last_name}</p>
        {/if}
        
        <div class="header-actions">
          <button class="btn-edit" on:click={openEditModal}>
            ✏️ Edit
          </button>
          <button class="btn-archive" on:click={handleArchive}>
            🗑️ Archive
          </button>
        </div>
      </div>

      <div class="info-section">
        <h2>Name Details</h2>
        <div class="info-grid">
          <div class="info-item">
            <span class="label">First Name</span>
            <span class="value">{person.first_name || '—'}</span>
          </div>
          <div class="info-item">
            <span class="label">Last Name</span>
            <span class="value">{person.last_name || '—'}</span>
          </div>
          <div class="info-item">
            <span class="label">Goes By</span>
            <span class="value">{person.goes_by || '—'}</span>
          </div>
        </div>

        <h2>Contact Information</h2>

        {#if person.contact_methods.length === 0}
          <div class="empty-row">No contact information available.</div>
        {:else}
          {#each person.contact_methods as contact}
            <div class="info-row">
              <div class="label-group">
                <span class="label">
                  {contact.label || formatType(contact.type)}
                </span>

                {#if getLink(contact)}
                  <a href={getLink(contact)} class="value-link">
                    {contact.value}
                  </a>
                {:else}
                  <span class="value">{contact.value}</span>
                {/if}
              </div>

              {#if contact.is_primary}
                <span class="badge">Primary</span>
              {/if}
            </div>
          {/each}
        {/if}

        <div class="section-header-row">
          <h2>Addresses</h2>
          <button class="btn-add-role" on:click={openAddAddressModal}>
            + Add Address
          </button>
        </div>
        {#if person.addresses.length === 0}
          <div class="empty-row">
            No addresses available.
            <button class="btn-link" on:click={openAddAddressModal}>Add one now</button>
          </div>
        {:else}
          {#each person.addresses as addr}
            <div class="info-row address-row">
              <div class="label-group">
                <span class="label">{addr.label || 'Address'}</span>
                <span class="value">{formatAddress(addr)}</span>
              </div>
              <div class="row-actions">
                <button class="btn-icon" on:click={() => openEditAddressModal(addr)} title="Edit">✏️</button>
                <button class="btn-icon delete" on:click={() => deleteAddress(addr)} title="Delete">🗑️</button>
              </div>
            </div>
          {/each}
        {/if}

        <div class="section-header-row">
          <h2>Ministry Roles</h2>
          <button class="btn-add-role" on:click={() => showAddRoleModal = true}>
            + Add Role
          </button>
        </div>

        {#if capabilities.length === 0}
          <div class="empty-roles-card">
            <p>No ministry roles assigned yet.</p>
            <button class="btn-add-first-role" on:click={() => showAddRoleModal = true}>
              + Add Their First Role
            </button>
          </div>
        {:else}
          <div class="roles-list">
            {#each Object.entries(capabilitiesByMinistry) as [ministry, ministryCapabilities]}
              <div class="ministry-section">
                <h3 class="ministry-header">{ministry}</h3>
                {#each ministryCapabilities as cap}
                  <div class="role-card" class:primary={cap.is_primary}>
                    <div class="role-main">
                      <div class="role-name-row">
                        <span class="role-name">{cap.role_name}</span>
                        {#if cap.is_primary}
                          <span class="primary-badge">PRIMARY</span>
                        {/if}
                      </div>
                      <div class="role-details">
                        <span class="proficiency proficiency-{cap.proficiency}">
                          {getProficiencyLabel(cap.proficiency)}
                        </span>
                        {#if cap.body_parts && cap.body_parts.length > 0}
                          <span class="body-parts">
                            Uses: {formatBodyParts(cap.body_parts)}
                          </span>
                        {/if}
                      </div>
                    </div>
                    <div class="role-actions">
                      <button
                        class="btn-star"
                        class:active={cap.is_primary}
                        on:click={() => togglePrimary(cap.role_id, cap.is_primary)}
                        title={cap.is_primary ? 'Remove as primary' : 'Set as primary role'}
                      >
                        {cap.is_primary ? '★' : '☆'}
                      </button>
                      <button
                        class="btn-remove"
                        on:click={() => removeCapability(cap.role_id, cap.role_name)}
                        title="Remove role"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Add Role Modal -->
{#if showAddRoleModal}
<div class="modal-overlay" on:click={() => showAddRoleModal = false} on:keydown={(e) => e.key === 'Escape' && (showAddRoleModal = false)}>
  <div class="modal add-role-modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && (showAddRoleModal = false)}>
    <div class="modal-header">
      <h2>Add Ministry Role</h2>
      <button class="close-btn" on:click={() => showAddRoleModal = false}>×</button>
    </div>

    <div class="modal-body">
      {#if unassignedRoles.length === 0}
        <div class="no-roles-available">
          <p>This person has been assigned all available roles, or no roles have been defined yet.</p>
        </div>
      {:else}
        <div class="form-group">
          <label for="role-select">Select Role</label>
          <select id="role-select" bind:value={selectedRoleId}>
            <option value="">— Choose a role —</option>
            {#each Object.entries(rolesByMinistry) as [ministry, roles]}
              <optgroup label={ministry}>
                {#each roles as role}
                  <option value={role.id}>{role.name}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label>Proficiency Level</label>
          <div class="proficiency-selector">
            {#each [1, 2, 3, 4, 5] as level}
              <button
                type="button"
                class="proficiency-btn"
                class:selected={selectedProficiency === level}
                on:click={() => selectedProficiency = level}
              >
                <span class="level-number">{level}</span>
                <span class="level-label">{getProficiencyLabel(level)}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" on:click={() => showAddRoleModal = false}>Cancel</button>
      <button
        class="btn-save"
        on:click={addRoleCapability}
        disabled={!selectedRoleId || addingRole}
      >
        {addingRole ? 'Adding...' : 'Add Role'}
      </button>
    </div>
  </div>
</div>
{/if}

<!-- Address Modal -->
{#if showAddressModal}
<div class="modal-overlay" on:click={closeAddressModal} on:keydown={(e) => e.key === 'Escape' && closeAddressModal()}>
  <div class="modal address-modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeAddressModal()}>
    <div class="modal-header">
      <h2>{editingAddress ? 'Edit Address' : 'Add Address'}</h2>
      <button class="close-btn" on:click={closeAddressModal}>×</button>
    </div>

    <div class="modal-body">
      <div class="form-group">
        <label for="address-label">Label</label>
        <input
          id="address-label"
          type="text"
          bind:value={addressLabel}
          placeholder="e.g., Home, Work, Mailing"
        />
      </div>

      <div class="form-group">
        <label for="address-line1">Street Address</label>
        <input
          id="address-line1"
          type="text"
          bind:value={addressLine1}
          placeholder="123 Main St"
        />
      </div>

      <div class="form-group">
        <label for="address-line2">Apt/Suite/Unit (optional)</label>
        <input
          id="address-line2"
          type="text"
          bind:value={addressLine2}
          placeholder="Apt 4B"
        />
      </div>

      <div class="form-row">
        <div class="form-group flex-2">
          <label for="address-city">City</label>
          <input
            id="address-city"
            type="text"
            bind:value={addressCity}
            placeholder="City"
          />
        </div>

        <div class="form-group flex-1">
          <label for="address-state">State</label>
          <input
            id="address-state"
            type="text"
            bind:value={addressState}
            placeholder="TX"
            maxlength="2"
          />
        </div>

        <div class="form-group flex-1">
          <label for="address-zip">ZIP</label>
          <input
            id="address-zip"
            type="text"
            bind:value={addressPostalCode}
            placeholder="12345"
          />
        </div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" on:click={closeAddressModal}>Cancel</button>
      <button
        class="btn-save"
        on:click={saveAddress}
        disabled={savingAddress}
      >
        {savingAddress ? 'Saving...' : (editingAddress ? 'Save Changes' : 'Add Address')}
      </button>
    </div>
  </div>
</div>
{/if}

<PersonModal
  bind:this={modalComponent}
  bind:open={modalOpen}
  person={person}
  on:close={closeModal}
  on:save={handleSave}
/>

<style>
  .container {
    max-width: 600px;
    margin: 40px auto;
    padding: 0 20px;
    font-family: system-ui, sans-serif;
  }

  .back-link {
    display: inline-block;
    margin-bottom: 20px;
    color: #666;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }
  
  .back-link:hover {
    color: #0066cc;
  }

  /* Loading and Error States */
  .loading,
  .error {
    text-align: center;
    padding: 3rem;
    background: #f5f5f5;
    border-radius: 12px;
    margin-top: 2rem;
  }

  .error {
    background: #fee;
    color: #c00;
  }

  .error p {
    margin: 0 0 1rem 0;
  }

  .error button {
    padding: 0.5rem 1.5rem;
    background: #c00;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .error button:hover {
    background: #a00;
  }

  /* Profile Card */
  .profile-card {
    background: white;
    border: 1px solid #e3e3e3;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  }

  .profile-header {
    background: #f9fafb;
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-bottom: 1px solid #eee;
  }

  .avatar-large {
    width: 80px;
    height: 80px;
    background: #0066cc;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  h1 {
    margin: 0;
    font-size: 24px;
    color: #1a1a1a;
  }

  .legal-name {
    margin: 8px 0 0 0;
    font-size: 14px;
    color: #666;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  .btn-edit, .btn-archive {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
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

  .info-section {
    padding: 32px;
  }

  h2 {
    font-size: 14px;
    text-transform: uppercase;
    color: #888;
    margin: 24px 0 12px 0;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  h2:first-child {
    margin-top: 0;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    padding: 12px 0;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .info-row {
    padding: 12px 0;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .label-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .label {
    font-size: 13px;
    color: #666;
    font-weight: 500;
  }

  .value,
  .value-link {
    font-size: 16px;
    color: #1a1a1a;
  }

  .value-link {
    color: #0066cc;
    text-decoration: none;
    transition: text-decoration 0.2s;
  }

  .value-link:hover {
    text-decoration: underline;
  }

  .badge {
    background: #e3f2fd;
    color: #0066cc;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .empty-row {
    color: #999;
    font-style: italic;
    padding: 10px 0;
  }

  /* Section header with button */
  .section-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 24px 0 12px 0;
  }

  .section-header-row h2 {
    margin: 0;
  }

  .btn-add-role {
    padding: 0.375rem 0.75rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-add-role:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* Empty roles state */
  .empty-roles-card {
    text-align: center;
    padding: 2rem;
    background: #f9fafb;
    border: 2px dashed #e5e7eb;
    border-radius: 12px;
    margin: 0.5rem 0;
  }

  .empty-roles-card p {
    color: #6b7280;
    margin: 0 0 1rem 0;
  }

  .btn-add-first-role {
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-add-first-role:hover {
    opacity: 0.9;
  }

  /* Roles list */
  .roles-list {
    margin-top: 0.5rem;
  }

  .ministry-section {
    margin-bottom: 1rem;
  }

  .ministry-header {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    margin: 0 0 0.5rem 0;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .role-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    transition: all 0.2s;
  }

  .role-card.primary {
    border-color: #667eea;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
  }

  .role-main {
    flex: 1;
  }

  .role-name-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .role-name {
    font-weight: 600;
    color: #1a1a1a;
  }

  .primary-badge {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.125rem 0.375rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .role-details {
    display: flex;
    gap: 1rem;
    font-size: 0.8125rem;
    color: #6b7280;
  }

  .proficiency {
    font-weight: 500;
  }

  .proficiency-1 { color: #ef4444; }
  .proficiency-2 { color: #f97316; }
  .proficiency-3 { color: #eab308; }
  .proficiency-4 { color: #22c55e; }
  .proficiency-5 { color: #10b981; }

  .body-parts {
    font-style: italic;
  }

  .role-actions {
    display: flex;
    gap: 0.25rem;
  }

  .btn-star,
  .btn-remove {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .btn-star {
    color: #d1d5db;
  }

  .btn-star:hover,
  .btn-star.active {
    color: #fbbf24;
    border-color: #fbbf24;
    background: #fffbeb;
  }

  .btn-remove {
    color: #9ca3af;
  }

  .btn-remove:hover {
    color: #ef4444;
    border-color: #ef4444;
    background: #fef2f2;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
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
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .add-role-modal {
    max-width: 480px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .modal-header h2 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    color: white;
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group:last-child {
    margin-bottom: 0;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-group select {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9375rem;
    transition: border-color 0.2s;
  }

  .form-group select:focus {
    outline: none;
    border-color: #667eea;
  }

  .proficiency-selector {
    display: flex;
    gap: 0.5rem;
  }

  .proficiency-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .proficiency-btn:hover {
    border-color: #667eea;
  }

  .proficiency-btn.selected {
    border-color: #667eea;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  }

  .level-number {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1a1a1a;
  }

  .level-label {
    font-size: 0.625rem;
    color: #6b7280;
    text-transform: uppercase;
    margin-top: 0.25rem;
  }

  .no-roles-available {
    text-align: center;
    padding: 1.5rem;
    background: #fef3c7;
    border-radius: 8px;
  }

  .no-roles-available p {
    margin: 0;
    color: #92400e;
  }

  .btn-cancel {
    padding: 0.625rem 1.25rem;
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel:hover {
    background: #f3f4f6;
  }

  .btn-save {
    padding: 0.625rem 1.25rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-save:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .container {
      padding: 0 16px;
      margin: 20px auto;
    }

    .info-section {
      padding: 24px;
    }

    .profile-header {
      padding: 24px;
    }

    h1 {
      font-size: 20px;
    }

    .avatar-large {
      width: 64px;
      height: 64px;
      font-size: 28px;
    }

    .info-grid {
      grid-template-columns: 1fr;
    }

    .header-actions {
      flex-direction: column;
      width: 100%;
    }

    .btn-edit, .btn-archive {
      width: 100%;
      justify-content: center;
    }

    .proficiency-selector {
      flex-wrap: wrap;
    }

    .proficiency-btn {
      flex-basis: calc(33.333% - 0.5rem);
    }

    .form-row {
      flex-direction: column;
    }
  }

  /* Address Modal */
  .address-modal {
    max-width: 480px;
  }

  .address-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .row-actions {
    display: flex;
    gap: 0.25rem;
    margin-left: 0.5rem;
  }

  .btn-icon {
    padding: 0.375rem 0.5rem;
    background: none;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .btn-icon:hover {
    background: #f3f4f6;
    border-color: #e5e7eb;
  }

  .btn-icon.delete:hover {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .btn-link {
    background: none;
    border: none;
    color: #667eea;
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    padding: 0;
    margin-left: 0.5rem;
  }

  .btn-link:hover {
    color: #764ba2;
  }

  .form-row {
    display: flex;
    gap: 0.75rem;
  }

  .flex-1 {
    flex: 1;
  }

  .flex-2 {
    flex: 2;
  }

  .form-group input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9375rem;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }

  .form-group input:focus {
    outline: none;
    border-color: #667eea;
  }
</style>