<script lang="ts">
  import { onMount } from 'svelte';
  import { apiJson, apiFetch } from '$lib/api';

  interface RoleRequirement {
    role_id: string;
    role_name: string;
    ministry_area: string | null;
    min_needed: number;
    max_needed: number | null;
  }

  interface ServiceType {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    role_requirements: RoleRequirement[];
  }

  interface Role {
    id: string;
    name: string;
    ministry_area: string | null;
  }

  let serviceTypes: ServiceType[] = [];
  let roles: Role[] = [];
  let loading = true;
  let error = '';

  // Modal state
  let showModal = false;
  let editingType: ServiceType | null = null;
  let saving = false;

  // Form state
  let formName = '';
  let formDescription = '';
  let formRequirements: Array<{ role_id: string; min_needed: number; max_needed: number | null }> = [];

  onMount(async () => {
    await Promise.all([loadServiceTypes(), loadRoles()]);
  });

  async function loadServiceTypes() {
    loading = true;
    error = '';
    try {
      serviceTypes = await apiJson<ServiceType[]>('/api/contexts?include_inactive=true&include_requirements=true');
    } catch (e: any) {
      error = e?.message ?? 'Failed to load service types';
    } finally {
      loading = false;
    }
  }

  async function loadRoles() {
    try {
      roles = await apiJson<Role[]>('/api/roles');
    } catch (e) {
      console.error('Failed to load roles:', e);
    }
  }

  // Group roles by ministry area
  $: rolesByMinistry = roles.reduce((acc, role) => {
    const area = role.ministry_area || 'Other';
    if (!acc[area]) acc[area] = [];
    acc[area].push(role);
    return acc;
  }, {} as Record<string, Role[]>);

  function openAddModal() {
    editingType = null;
    formName = '';
    formDescription = '';
    formRequirements = [];
    showModal = true;
  }

  function openEditModal(type: ServiceType) {
    editingType = type;
    formName = type.name;
    formDescription = type.description || '';
    formRequirements = type.role_requirements.map(r => ({
      role_id: r.role_id,
      min_needed: r.min_needed,
      max_needed: r.max_needed
    }));
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingType = null;
  }

  function addRoleRequirement(roleId: string) {
    if (formRequirements.some(r => r.role_id === roleId)) return;
    formRequirements = [...formRequirements, { role_id: roleId, min_needed: 1, max_needed: null }];
  }

  function removeRoleRequirement(roleId: string) {
    formRequirements = formRequirements.filter(r => r.role_id !== roleId);
  }

  function updateRequirement(roleId: string, field: 'min_needed' | 'max_needed', value: number | null) {
    formRequirements = formRequirements.map(r =>
      r.role_id === roleId ? { ...r, [field]: value } : r
    );
  }

  function getRoleName(roleId: string): string {
    return roles.find(r => r.id === roleId)?.name || 'Unknown';
  }

  function getRoleMinistry(roleId: string): string {
    return roles.find(r => r.id === roleId)?.ministry_area || 'Other';
  }

  // Roles not yet added as requirements
  $: availableRoles = roles.filter(r => !formRequirements.some(req => req.role_id === r.id));

  async function saveServiceType() {
    if (!formName.trim()) {
      alert('Service type name is required');
      return;
    }

    saving = true;
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription || null,
        role_requirements: formRequirements
      };

      if (editingType) {
        await apiFetch(`/api/contexts/${editingType.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        // Create context first, then update with requirements
        const created = await apiJson<ServiceType>('/api/contexts', {
          method: 'POST',
          body: JSON.stringify({ name: formName.trim(), description: formDescription || null })
        });

        if (formRequirements.length > 0) {
          await apiFetch(`/api/contexts/${created.id}`, {
            method: 'PUT',
            body: JSON.stringify({ role_requirements: formRequirements })
          });
        }
      }

      closeModal();
      await loadServiceTypes();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save service type');
    } finally {
      saving = false;
    }
  }

  async function toggleActive(type: ServiceType) {
    const action = type.is_active ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} "${type.name}"?`)) return;

    try {
      await apiFetch(`/api/contexts/${type.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !type.is_active })
      });
      await loadServiceTypes();
    } catch (e: any) {
      alert(e?.message ?? `Failed to ${action} service type`);
    }
  }

  function getTotalPositions(reqs: RoleRequirement[]): number {
    return reqs.reduce((sum, r) => sum + r.min_needed, 0);
  }
</script>

<div class="container">
  <header>
    <div class="header-content">
      <div class="title-section">
        <h1>Service Types</h1>
        <p>Define types of services and their required team positions</p>
      </div>
      <button class="btn-add" on:click={openAddModal}>
        + Add Service Type
      </button>
    </div>
  </header>

  {#if loading}
    <div class="loading">Loading service types...</div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button on:click={loadServiceTypes}>Retry</button>
    </div>
  {:else if serviceTypes.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>No Service Types Defined</h3>
      <p>Create service types like "Sunday AM", "Youth", or "Midweek" to start scheduling.</p>
      <button class="btn-primary" on:click={openAddModal}>
        + Create Your First Service Type
      </button>
    </div>
  {:else}
    <div class="types-grid">
      {#each serviceTypes as type}
        <div class="type-card" class:inactive={!type.is_active}>
          <div class="type-header">
            <h2>{type.name}</h2>
            {#if !type.is_active}
              <span class="inactive-badge">INACTIVE</span>
            {/if}
          </div>

          {#if type.description}
            <p class="type-description">{type.description}</p>
          {/if}

          <div class="requirements-section">
            <h3>Required Positions ({getTotalPositions(type.role_requirements)} total)</h3>

            {#if type.role_requirements.length === 0}
              <p class="no-requirements">No positions defined for this service type.</p>
            {:else}
              <div class="requirements-list">
                {#each type.role_requirements as req}
                  <div class="requirement-item">
                    <span class="req-role">{req.role_name}</span>
                    <span class="req-count">
                      {req.min_needed}{req.max_needed && req.max_needed !== req.min_needed ? `-${req.max_needed}` : ''}
                    </span>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <div class="type-actions">
            <button class="btn-edit" on:click={() => openEditModal(type)}>
              Edit
            </button>
            <button
              class="btn-toggle"
              class:deactivate={type.is_active}
              on:click={() => toggleActive(type)}
            >
              {type.is_active ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add/Edit Service Type Modal -->
{#if showModal}
<div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()}>
  <div class="modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeModal()}>
    <div class="modal-header">
      <h2>{editingType ? 'Edit Service Type' : 'Add Service Type'}</h2>
      <button class="close-btn" on:click={closeModal}>×</button>
    </div>

    <div class="modal-body">
      <div class="form-group">
        <label for="type-name">Name *</label>
        <input
          id="type-name"
          type="text"
          bind:value={formName}
          placeholder="e.g., Sunday AM, Youth, Midweek"
        />
      </div>

      <div class="form-group">
        <label for="type-desc">Description</label>
        <textarea
          id="type-desc"
          bind:value={formDescription}
          placeholder="Brief description of this service type"
          rows="2"
        ></textarea>
      </div>

      <div class="form-section">
        <div class="section-header">
          <h3>Required Positions</h3>
          <span class="position-count">{formRequirements.reduce((s, r) => s + r.min_needed, 0)} total</span>
        </div>
        <p class="help-text">Define which roles are needed for this type of service and how many of each.</p>

        {#if formRequirements.length > 0}
          <div class="requirements-editor">
            {#each formRequirements as req}
              <div class="req-row">
                <div class="req-info">
                  <span class="req-name">{getRoleName(req.role_id)}</span>
                  <span class="req-ministry">{getRoleMinistry(req.role_id)}</span>
                </div>
                <div class="req-counts">
                  <div class="count-input">
                    <label>Min</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={req.min_needed}
                      on:input={(e) => updateRequirement(req.role_id, 'min_needed', parseInt(e.currentTarget.value) || 1)}
                    />
                  </div>
                  <div class="count-input">
                    <label>Max</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={req.max_needed ?? ''}
                      placeholder="—"
                      on:input={(e) => updateRequirement(req.role_id, 'max_needed', e.currentTarget.value ? parseInt(e.currentTarget.value) : null)}
                    />
                  </div>
                </div>
                <button class="btn-remove-req" on:click={() => removeRoleRequirement(req.role_id)}>×</button>
              </div>
            {/each}
          </div>
        {/if}

        {#if availableRoles.length > 0}
          <div class="add-role-section">
            <label>Add Position</label>
            <select on:change={(e) => { addRoleRequirement(e.currentTarget.value); e.currentTarget.value = ''; }}>
              <option value="">— Select a role to add —</option>
              {#each Object.entries(rolesByMinistry) as [ministry, ministryRoles]}
                <optgroup label={ministry}>
                  {#each ministryRoles.filter(r => !formRequirements.some(req => req.role_id === r.id)) as role}
                    <option value={role.id}>{role.name}</option>
                  {/each}
                </optgroup>
              {/each}
            </select>
          </div>
        {:else if formRequirements.length > 0}
          <p class="all-roles-added">All available roles have been added.</p>
        {:else}
          <div class="no-roles-warning">
            <p>No roles defined yet. <a href="/admin/roles">Create roles first</a> to add position requirements.</p>
          </div>
        {/if}
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" on:click={closeModal}>Cancel</button>
      <button
        class="btn-save"
        on:click={saveServiceType}
        disabled={saving || !formName.trim()}
      >
        {saving ? 'Saving...' : (editingType ? 'Save Changes' : 'Create Service Type')}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  header {
    margin-bottom: 2rem;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .title-section h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .title-section p {
    color: #6b7280;
    margin: 0;
  }

  .btn-add {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-add:hover {
    opacity: 0.9;
  }

  /* Loading & Error */
  .loading, .error, .empty-state {
    text-align: center;
    padding: 3rem;
    background: #f9fafb;
    border-radius: 12px;
  }

  .error {
    background: #fef2f2;
    color: #b91c1c;
  }

  .empty-state {
    background: white;
    border: 2px dashed #e5e7eb;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    margin: 0 0 0.5rem 0;
  }

  .empty-state p {
    color: #6b7280;
    margin: 0 0 1.5rem 0;
  }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  /* Types grid */
  .types-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 1.5rem;
  }

  .type-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.2s;
  }

  .type-card:hover {
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
  }

  .type-card.inactive {
    opacity: 0.6;
  }

  .type-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .type-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .inactive-badge {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.125rem 0.5rem;
    background: #9ca3af;
    color: white;
    border-radius: 4px;
  }

  .type-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
  }

  .requirements-section {
    background: #f9fafb;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .requirements-section h3 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #6b7280;
    margin: 0 0 0.75rem 0;
  }

  .no-requirements {
    font-size: 0.875rem;
    color: #9ca3af;
    font-style: italic;
    margin: 0;
  }

  .requirements-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .requirement-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .req-role {
    color: #374151;
  }

  .req-count {
    font-weight: 600;
    color: #667eea;
  }

  .type-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-edit, .btn-toggle {
    flex: 1;
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-edit {
    background: white;
    border: 1px solid #667eea;
    color: #667eea;
  }

  .btn-edit:hover {
    background: #f0f1ff;
  }

  .btn-toggle {
    background: white;
    border: 1px solid #d1d5db;
    color: #6b7280;
  }

  .btn-toggle.deactivate:hover {
    background: #fef2f2;
    border-color: #ef4444;
    color: #ef4444;
  }

  /* Modal */
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
    max-width: 600px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
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

  /* Form */
  .form-group {
    margin-bottom: 1.25rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9375rem;
    box-sizing: border-box;
  }

  .form-group textarea {
    resize: vertical;
  }

  .form-section {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .section-header h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .position-count {
    font-size: 0.875rem;
    color: #667eea;
    font-weight: 600;
  }

  .help-text {
    font-size: 0.75rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
  }

  .requirements-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .req-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 8px;
  }

  .req-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .req-name {
    font-weight: 500;
    color: #1a1a1a;
  }

  .req-ministry {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .req-counts {
    display: flex;
    gap: 0.5rem;
  }

  .count-input {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .count-input label {
    font-size: 0.625rem;
    text-transform: uppercase;
    color: #6b7280;
  }

  .count-input input {
    width: 3rem;
    padding: 0.375rem;
    text-align: center;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-size: 0.875rem;
  }

  .btn-remove-req {
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: #fee2e2;
    color: #ef4444;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-remove-req:hover {
    background: #fecaca;
  }

  .add-role-section {
    margin-top: 0.75rem;
  }

  .add-role-section label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.375rem;
  }

  .add-role-section select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .all-roles-added {
    font-size: 0.8125rem;
    color: #10b981;
    font-style: italic;
    margin: 0.75rem 0 0 0;
  }

  .no-roles-warning {
    padding: 0.75rem;
    background: #fef3c7;
    border-radius: 6px;
    font-size: 0.8125rem;
    color: #92400e;
  }

  .no-roles-warning a {
    color: #d97706;
    text-decoration: underline;
  }

  .btn-cancel {
    padding: 0.625rem 1.25rem;
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-save {
    padding: 0.625rem 1.25rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .types-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
