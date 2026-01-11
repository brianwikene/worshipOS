<!-- /src/routes/connections/families/[id]/+page.svelte -->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { apiFetch, apiJson } from '$lib/api';
  import FamilyModal from '$lib/components/FamilyModal.svelte';
  import { onMount } from 'svelte';

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
    is_primary: boolean;
  }

  interface Family {
    id: string;
    name: string;
    notes: string | null;
    is_active: boolean;
    primary_address_id: string | null;
    addresses: Address[];
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

  // Address modal state
  let showAddressModal = false;
  let savingAddress = false;
  let editingAddress: Address | null = null;  // null means adding new
  let addressLine1 = '';
  let addressLine2 = '';
  let addressCity = '';
  let addressState = '';
  let addressPostalCode = '';
  let addressLabel = '';
  let addressIsPrimary = false;

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

  function formatAddressLine(addr: Address): string {
    const streetLine = addr.line1 || addr.street;
    const parts = [
      streetLine,
      addr.line2,
      addr.city ? `${addr.city},` : null,
      addr.state,
      addr.postal_code
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'No address details';
  }

  function openAddressModal(address: Address | null = null) {
    editingAddress = address;
    if (address) {
      addressLine1 = address.line1 || address.street || '';
      addressLine2 = address.line2 || '';
      addressCity = address.city || '';
      addressState = address.state || '';
      addressPostalCode = address.postal_code || '';
      addressLabel = address.label || '';
      addressIsPrimary = address.is_primary;
    } else {
      // New address
      addressLine1 = '';
      addressLine2 = '';
      addressCity = '';
      addressState = '';
      addressPostalCode = '';
      addressLabel = '';
      addressIsPrimary = (family?.addresses?.length ?? 0) === 0; // First address is primary
    }
    showAddressModal = true;
  }

  function closeAddressModal() {
    showAddressModal = false;
    editingAddress = null;
  }

  async function saveAddress() {
    if (!family) return;
    savingAddress = true;

    try {
      if (editingAddress) {
        // Update existing address
        await apiFetch(`/api/families/${family.id}/address`, {
          method: 'PUT',
          body: JSON.stringify({
            address_id: editingAddress.id,
            line1: addressLine1 || null,
            line2: addressLine2 || null,
            city: addressCity || null,
            state: addressState || null,
            postal_code: addressPostalCode || null,
            label: addressLabel || null,
            is_primary: addressIsPrimary
          })
        });
      } else {
        // Create new address
        await apiFetch(`/api/families/${family.id}/address`, {
          method: 'POST',
          body: JSON.stringify({
            line1: addressLine1 || null,
            line2: addressLine2 || null,
            city: addressCity || null,
            state: addressState || null,
            postal_code: addressPostalCode || null,
            label: addressLabel || null,
            is_primary: addressIsPrimary
          })
        });
      }

      closeAddressModal();
      await loadFamily();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save address');
    } finally {
      savingAddress = false;
    }
  }

  async function deleteAddress(addressId: string) {
    if (!family) return;
    if (!confirm('Delete this address?')) return;

    try {
      await apiFetch(`/api/families/${family.id}/address?address_id=${addressId}`, { method: 'DELETE' });
      await loadFamily();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to delete address');
    }
  }

  async function setPrimaryAddress(addressId: string) {
    if (!family) return;

    try {
      await apiFetch(`/api/families/${family.id}/address`, {
        method: 'PUT',
        body: JSON.stringify({
          address_id: addressId,
          is_primary: true
        })
      });
      await loadFamily();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to set primary address');
    }
  }

  // Filter out people already in the family
  $: filteredPeople = availablePeople.filter(
    p => !family?.members.some(m => m.person_id === p.id && m.is_active)
  );

  $: activeMembers = family?.members.filter(m => m.is_active) ?? [];
  $: inactiveMembers = family?.members.filter(m => !m.is_active) ?? [];
</script>

<div class="sys-page sys-page--narrow">
  <a href="/connections/families" class="sys-back-link">← Back to Families</a>

  {#if loading}
    <div class="sys-state">Loading family details...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>Error: {error}</p>
      <button class="sys-btn sys-btn--danger" on:click={loadFamily}>Retry</button>
    </div>
  {:else if family}
    <div class="family-header">
      <div class="header-info">
        <h1>{family.name}</h1>
        {#if family.notes}
          <p class="notes">{family.notes}</p>
        {/if}
        <div class="addresses-section">
          {#if family.addresses && family.addresses.length > 0}
            <div class="addresses-list">
              {#each family.addresses as address}
                <div class="address-item" class:primary={address.is_primary}>
                  <div class="address-content">
                    {#if address.is_primary}
                      <span class="badge primary-badge">Primary</span>
                    {/if}
                    {#if address.label}
                      <span class="address-label">{address.label}</span>
                    {/if}
                    <span class="address-text">📍 {formatAddressLine(address)}</span>
                  </div>
                  <div class="address-actions">
                    {#if !address.is_primary}
                      <button class="btn-address-action" on:click={() => setPrimaryAddress(address.id)} title="Set as primary">⭐</button>
                    {/if}
                    <button class="btn-address-action" on:click={() => openAddressModal(address)} title="Edit address">✏️</button>
                    <button class="btn-address-action delete" on:click={() => deleteAddress(address.id)} title="Delete address">🗑️</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
          <button class="btn-add-address" on:click={() => openAddressModal(null)}>
            + Add Address
          </button>
        </div>
      </div>
      <div class="header-actions">
        <button class="sys-btn sys-btn--primary" on:click={openEditModal}>
          ✏️ Edit
        </button>
        <button class="sys-btn sys-btn--secondary btn-archive" on:click={handleArchive}>
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
              <a href={`/connections/people/${member.person_id}`} class="member-link">
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
          placeholder="e.g., Home, Mailing, Summer Home"
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

      <div class="sys-form-group checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={addressIsPrimary} />
          Set as primary address
        </label>
      </div>
    </div>

    <div class="sys-modal-actions">
      <button class="sys-btn sys-btn--secondary" on:click={closeAddressModal}>Cancel</button>
      <button
        class="sys-btn sys-btn--primary"
        on:click={saveAddress}
        disabled={savingAddress}
      >
        {savingAddress ? 'Saving...' : 'Save Address'}
      </button>
    </div>
  </div>
</div>
{/if}

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

    .form-row-modal {
      flex-direction: column;
    }
  }

  /* Address Section */
  .addresses-section {
    margin-top: 0.75rem;
  }

  .addresses-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .address-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }

  .address-item.primary {
    border-color: #bfdbfe;
    background: #eff6ff;
  }

  .address-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
  }

  .address-label {
    font-weight: 600;
    color: #374151;
    font-size: 0.85rem;
  }

  .address-text {
    color: #6b7280;
    font-size: 0.85rem;
  }

  .primary-badge {
    background: #dbeafe;
    color: #1d4ed8;
    font-size: 0.7rem;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .address-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .btn-address-action {
    background: none;
    border: none;
    padding: 0.25rem;
    cursor: pointer;
    font-size: 0.8rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .btn-address-action:hover {
    opacity: 1;
  }

  .btn-address-action.delete:hover {
    color: #c00;
  }

  .btn-add-address {
    padding: 0.375rem 0.75rem;
    background: #f0f0f0;
    border: 1px dashed #ccc;
    border-radius: 6px;
    font-size: 0.85rem;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-add-address:hover {
    background: #e3f2fd;
    border-color: #0066cc;
    color: #0066cc;
  }

  .checkbox-group {
    margin-top: 0.5rem;
  }

  /* Modal Styles */
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

  .address-modal {
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

  .form-row-modal {
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
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 1rem;
    box-sizing: border-box;
  }

  .form-group input:focus {
    outline: none;
    border-color: #0066cc;
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
</style>
