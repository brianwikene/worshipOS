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
    is_family_address: boolean;
    is_primary?: boolean;
    family_id?: string;
    family_name?: string;
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
    family_addresses: Address[];
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

<div class="sys-page sys-page--narrow">
  <a href="/people" class="sys-back-link">← Back to People</a>

  {#if loading}
    <div class="sys-state">Loading person details...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>Error: {error}</p>
      <button class="sys-btn sys-btn--danger" on:click={loadPerson}>Retry</button>
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
          <button class="sys-btn sys-btn--primary" on:click={openEditModal}>
            ✏️ Edit
          </button>
          <button class="sys-btn sys-btn--secondary btn-archive" on:click={handleArchive}>
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

        <h2>Contact Methods</h2>

        {#if person.contact_methods.length === 0}
          <div class="empty-row">No contact methods available.</div>
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
          <button class="sys-btn sys-btn--primary btn-small" on:click={openAddAddressModal} title="Add a personal address (e.g., college, work)">
            + Add Personal Address
          </button>
        </div>

        {#if person.family_addresses.length === 0 && person.addresses.length === 0}
          <div class="empty-row">
            No addresses available.
            <button class="btn-link" on:click={openAddAddressModal}>Add a personal address</button>
          </div>
        {:else}
          <!-- Family Addresses (inherited) -->
          {#each person.family_addresses as addr}
            <div class="info-row address-row family-address">
              <div class="label-group">
                <span class="label">
                  {addr.label || 'Home'}
                  <span class="family-badge">via {addr.family_name}</span>
                  {#if addr.is_primary}
                    <span class="primary-badge">Primary</span>
                  {/if}
                </span>
                <span class="value">{formatAddress(addr)}</span>
              </div>
              <div class="row-actions">
                <a href="/families/{addr.family_id}" class="btn-icon" title="Edit on family page">↗️</a>
              </div>
            </div>
          {/each}

          <!-- Personal Addresses -->
          {#each person.addresses as addr}
            <div class="info-row address-row personal-address">
              <div class="label-group">
                <span class="label">
                  {addr.label || 'Address'}
                  <span class="personal-badge">Personal</span>
                </span>
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
          <button class="sys-btn sys-btn--primary btn-small" on:click={() => showAddRoleModal = true}>
            + Add Role
          </button>
        </div>

        {#if capabilities.length === 0}
          <div class="empty-roles-card">
            <p>No ministry roles assigned yet.</p>
            <button class="sys-btn sys-btn--primary" on:click={() => showAddRoleModal = true}>
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
<div class="sys-modal-overlay" on:click={() => showAddRoleModal = false} on:keydown={(e) => e.key === 'Escape' && (showAddRoleModal = false)}>
  <div class="sys-modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && (showAddRoleModal = false)}>
    <div class="sys-modal-header">
      <h2>Add Ministry Role</h2>
      <button class="sys-modal-close" on:click={() => showAddRoleModal = false}>×</button>
    </div>

    <div class="sys-modal-body">
      {#if unassignedRoles.length === 0}
        <div class="no-roles-available">
          <p>This person has been assigned all available roles, or no roles have been defined yet.</p>
        </div>
      {:else}
        <div class="sys-form-group">
          <label for="role-select">Select Role</label>
          <select id="role-select" class="sys-select" bind:value={selectedRoleId}>
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

        <div class="sys-form-group">
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

    <div class="sys-modal-actions">
      <button class="sys-btn sys-btn--secondary" on:click={() => showAddRoleModal = false}>Cancel</button>
      <button
        class="sys-btn sys-btn--primary"
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
<div class="sys-modal-overlay" on:click={closeAddressModal} on:keydown={(e) => e.key === 'Escape' && closeAddressModal()}>
  <div class="sys-modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeAddressModal()}>
    <div class="sys-modal-header">
      <h2>{editingAddress ? 'Edit Address' : 'Add Address'}</h2>
      <button class="sys-modal-close" on:click={closeAddressModal}>×</button>
    </div>

    <div class="sys-modal-body">
      <div class="sys-form-group">
        <label for="address-label">Label</label>
        <input
          id="address-label"
          class="sys-input"
          type="text"
          bind:value={addressLabel}
          placeholder="e.g., Home, Work, Mailing"
        />
      </div>

      <div class="sys-form-group">
        <label for="address-line1">Street Address</label>
        <input
          id="address-line1"
          class="sys-input"
          type="text"
          bind:value={addressLine1}
          placeholder="123 Main St"
        />
      </div>

      <div class="sys-form-group">
        <label for="address-line2">Apt/Suite/Unit (optional)</label>
        <input
          id="address-line2"
          class="sys-input"
          type="text"
          bind:value={addressLine2}
          placeholder="Apt 4B"
        />
      </div>

      <div class="sys-form-row">
        <div class="sys-form-group flex-2">
          <label for="address-city">City</label>
          <input
            id="address-city"
            class="sys-input"
            type="text"
            bind:value={addressCity}
            placeholder="City"
          />
        </div>

        <div class="sys-form-group flex-1">
          <label for="address-state">State</label>
          <input
            id="address-state"
            class="sys-input"
            type="text"
            bind:value={addressState}
            placeholder="TX"
            maxlength="2"
          />
        </div>

        <div class="sys-form-group flex-1">
          <label for="address-zip">ZIP</label>
          <input
            id="address-zip"
            class="sys-input"
            type="text"
            bind:value={addressPostalCode}
            placeholder="12345"
          />
        </div>
      </div>
    </div>

    <div class="sys-modal-actions">
      <button class="sys-btn sys-btn--secondary" on:click={closeAddressModal}>Cancel</button>
      <button
        class="sys-btn sys-btn--primary"
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
  /* Person detail page - specific styles only */

  /* Profile Card */
  .profile-card {
    background: white;
    border: 1px solid var(--sys-border);
    border-radius: var(--sys-radius-lg);
    overflow: hidden;
    box-shadow: var(--sys-shadow-sm);
  }

  .profile-header {
    background: var(--sys-panel);
    padding: 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-bottom: 1px solid var(--sys-border);
  }

  .avatar-large {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, var(--gatherings-accent-start), var(--gatherings-accent-end));
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 1rem;
  }

  .profile-header h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--sys-text);
  }

  .legal-name {
    margin: 0.5rem 0 0 0;
    font-size: 0.875rem;
    color: var(--sys-muted);
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  .btn-archive:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }

  .btn-small {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .info-section {
    padding: 2rem;
  }

  .info-section h2 {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: var(--sys-muted);
    margin: 1.5rem 0 0.75rem 0;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  .info-section h2:first-child {
    margin-top: 0;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    padding: 0.75rem 0;
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .info-row {
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--sys-border);
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
    gap: 0.25rem;
    flex: 1;
  }

  .label {
    font-size: 0.8125rem;
    color: var(--sys-muted);
    font-weight: 500;
  }

  .value, .value-link {
    font-size: 1rem;
    color: var(--sys-text);
  }

  .value-link {
    color: var(--gatherings-accent-start);
    text-decoration: none;
  }

  .value-link:hover {
    text-decoration: underline;
  }

  .badge {
    background: #e0e7ff;
    color: var(--gatherings-accent-start);
    font-size: 0.6875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 999px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .empty-row {
    color: var(--sys-muted);
    font-style: italic;
    padding: 0.625rem 0;
  }

  .section-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 1.5rem 0 0.75rem 0;
  }

  .section-header-row h2 {
    margin: 0;
  }

  /* Empty roles state */
  .empty-roles-card {
    text-align: center;
    padding: 2rem;
    background: var(--sys-panel);
    border: 2px dashed var(--sys-border);
    border-radius: var(--sys-radius-md);
    margin: 0.5rem 0;
  }

  .empty-roles-card p {
    color: var(--sys-muted);
    margin: 0 0 1rem 0;
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
    color: var(--sys-muted);
    margin: 0 0 0.5rem 0;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid var(--sys-border);
  }

  .role-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: white;
    border: 1px solid var(--sys-border);
    border-radius: var(--sys-radius-sm);
    margin-bottom: 0.5rem;
  }

  .role-card.primary {
    border-color: var(--gatherings-accent-start);
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
    color: var(--sys-text);
  }

  .primary-badge {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.125rem 0.375rem;
    background: linear-gradient(135deg, var(--gatherings-accent-start), var(--gatherings-accent-end));
    color: white;
    border-radius: 999px;
    text-transform: uppercase;
  }

  .role-details {
    display: flex;
    gap: 1rem;
    font-size: 0.8125rem;
    color: var(--sys-muted);
  }

  .proficiency { font-weight: 500; }
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

  .btn-star, .btn-remove {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--sys-border);
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-star { color: #d1d5db; }
  .btn-star:hover, .btn-star.active {
    color: #fbbf24;
    border-color: #fbbf24;
    background: #fffbeb;
  }

  .btn-remove { color: #9ca3af; }
  .btn-remove:hover {
    color: #ef4444;
    border-color: #ef4444;
    background: #fef2f2;
  }

  /* Proficiency selector */
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
    border: 1px solid var(--sys-border);
    border-radius: var(--sys-radius-sm);
    background: white;
    cursor: pointer;
  }

  .proficiency-btn:hover {
    border-color: var(--gatherings-accent-start);
  }

  .proficiency-btn.selected {
    border-color: var(--gatherings-accent-start);
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  }

  .level-number {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sys-text);
  }

  .level-label {
    font-size: 0.625rem;
    color: var(--sys-muted);
    text-transform: uppercase;
    margin-top: 0.25rem;
  }

  .no-roles-available {
    text-align: center;
    padding: 1.5rem;
    background: #fef3c7;
    border-radius: var(--sys-radius-sm);
  }

  .no-roles-available p {
    margin: 0;
    color: #92400e;
  }

  /* Address styles */
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
  }

  .btn-icon:hover {
    background: var(--sys-panel);
    border-color: var(--sys-border);
  }

  .btn-icon.delete:hover {
    background: #fef2f2;
    border-color: #fecaca;
  }

  .family-address {
    background: #f0fdf4;
    border-left: 3px solid #22c55e;
    padding-left: 0.75rem;
    margin-left: -0.75rem;
  }

  .family-badge {
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.125rem 0.375rem;
    background: #dcfce7;
    color: #15803d;
    border-radius: 4px;
    margin-left: 0.5rem;
  }

  .personal-badge {
    font-size: 0.6875rem;
    font-weight: 500;
    padding: 0.125rem 0.375rem;
    background: #e0e7ff;
    color: #4338ca;
    border-radius: 4px;
    margin-left: 0.5rem;
  }

  a.btn-icon {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--gatherings-accent-start);
    cursor: pointer;
    text-decoration: underline;
    font-size: inherit;
    padding: 0;
    margin-left: 0.5rem;
  }

  .btn-link:hover {
    color: var(--gatherings-accent-end);
  }

  .flex-1 { flex: 1; }
  .flex-2 { flex: 2; }

  @media (max-width: 640px) {
    .info-grid {
      grid-template-columns: 1fr;
    }

    .header-actions {
      flex-direction: column;
      width: 100%;
    }

    .proficiency-selector {
      flex-wrap: wrap;
    }

    .proficiency-btn {
      flex-basis: calc(33.333% - 0.5rem);
    }
  }
</style>
