<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { apiJson, apiFetch } from '$lib/api';

  interface Team {
    id: string;
    name: string;
    color: string;
    icon: string;
  }

  interface Role {
    id: string;
    name: string;
    team_id: string | null;
    team_name: string | null;
    team_color: string | null;
    team_icon: string | null;
    ministry_area: string | null;
    description: string | null;
    load_weight: number;
    body_parts: string[];
    is_active: boolean;
  }

  let roles: Role[] = [];
  let teams: Team[] = [];
  let loading = true;
  let error = '';

  // Filter by team from URL
  let filterTeamId: string | null = null;

  // Modal state
  let showModal = false;
  let editingRole: Role | null = null;
  let saving = false;

  // Form state
  let formName = '';
  let formTeamId = '';
  let formDescription = '';
  let formLoadWeight = 10;
  let formBodyParts: string[] = [];

  // Available body parts
  const availableBodyParts = [
    { id: 'hands', label: 'Hands', icon: '✋' },
    { id: 'feet', label: 'Feet', icon: '🦶' },
    { id: 'voice', label: 'Voice', icon: '🎤' },
    { id: 'ears', label: 'Ears', icon: '👂' },
    { id: 'eyes', label: 'Eyes', icon: '👁️' }
  ];

  $: {
    filterTeamId = $page.url.searchParams.get('team');
  }

  onMount(async () => {
    await Promise.all([loadRoles(), loadTeams()]);
  });

  async function loadRoles() {
    loading = true;
    error = '';
    try {
      roles = await apiJson<Role[]>('/api/roles?include_inactive=true');
    } catch (e: any) {
      error = e?.message ?? 'Failed to load roles';
    } finally {
      loading = false;
    }
  }

  async function loadTeams() {
    try {
      teams = await apiJson<Team[]>('/api/teams');
    } catch (e) {
      console.error('Failed to load teams:', e);
    }
  }

  // Filter and group roles by team
  $: filteredRoles = filterTeamId
    ? roles.filter(r => r.team_id === filterTeamId)
    : roles;

  $: rolesByTeam = filteredRoles.reduce((acc, role) => {
    const teamKey = role.team_id || 'unassigned';
    const teamName = role.team_name || 'Unassigned';
    if (!acc[teamKey]) {
      acc[teamKey] = {
        name: teamName,
        color: role.team_color || '#9ca3af',
        icon: role.team_icon || '❓',
        roles: []
      };
    }
    acc[teamKey].roles.push(role);
    return acc;
  }, {} as Record<string, { name: string; color: string; icon: string; roles: Role[] }>);

  $: activeRolesCount = filteredRoles.filter(r => r.is_active).length;
  $: inactiveRolesCount = filteredRoles.filter(r => !r.is_active).length;
  $: filterTeam = teams.find(t => t.id === filterTeamId);

  function openAddModal() {
    editingRole = null;
    formName = '';
    formTeamId = filterTeamId || '';
    formDescription = '';
    formLoadWeight = 10;
    formBodyParts = [];
    showModal = true;
  }

  function openEditModal(role: Role) {
    editingRole = role;
    formName = role.name;
    formTeamId = role.team_id || '';
    formDescription = role.description || '';
    formLoadWeight = role.load_weight;
    formBodyParts = [...(role.body_parts || [])];
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingRole = null;
  }

  function toggleBodyPart(part: string) {
    if (formBodyParts.includes(part)) {
      formBodyParts = formBodyParts.filter(p => p !== part);
    } else {
      formBodyParts = [...formBodyParts, part];
    }
  }

  async function saveRole() {
    if (!formName.trim()) {
      alert('Role name is required');
      return;
    }

    saving = true;
    try {
      const payload = {
        name: formName.trim(),
        team_id: formTeamId || null,
        description: formDescription || null,
        load_weight: formLoadWeight,
        body_parts: formBodyParts
      };

      if (editingRole) {
        await apiFetch(`/api/roles/${editingRole.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/roles', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      closeModal();
      await loadRoles();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save role');
    } finally {
      saving = false;
    }
  }

  async function toggleActive(role: Role) {
    const action = role.is_active ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} "${role.name}"?`)) return;

    try {
      await apiFetch(`/api/roles/${role.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: !role.is_active })
      });
      await loadRoles();
    } catch (e: any) {
      alert(e?.message ?? `Failed to ${action} role`);
    }
  }

  function formatBodyParts(parts: string[]): string {
    if (!parts || parts.length === 0) return 'None';
    return parts.map(p => {
      const bp = availableBodyParts.find(b => b.id === p);
      return bp ? `${bp.icon} ${bp.label}` : p;
    }).join(', ');
  }
</script>

<div class="container">
  <header>
    <div class="header-content">
      <div class="title-section">
        <h1>Manage Roles</h1>
        <p>Define positions available for scheduling on services</p>
      </div>
      <button class="btn-add" on:click={openAddModal}>
        + Add Role
      </button>
    </div>

    <div class="stats-row">
      <div class="stat">
        <span class="stat-value">{activeRolesCount}</span>
        <span class="stat-label">Active Roles</span>
      </div>
      {#if inactiveRolesCount > 0}
        <div class="stat inactive">
          <span class="stat-value">{inactiveRolesCount}</span>
          <span class="stat-label">Inactive</span>
        </div>
      {/if}
    </div>
  </header>

  {#if loading}
    <div class="loading">Loading roles...</div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button on:click={loadRoles}>Retry</button>
    </div>
  {:else if roles.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🎭</div>
      <h3>No Roles Defined</h3>
      <p>Create roles to start scheduling team members for services.</p>
      <button class="btn-primary" on:click={openAddModal}>
        + Create Your First Role
      </button>
    </div>
  {:else}
    {#if filterTeam}
      <div class="filter-indicator">
        <span class="filter-icon" style="background: {filterTeam.color}">{filterTeam.icon}</span>
        <span>Showing roles in <strong>{filterTeam.name}</strong></span>
        <a href="/admin/roles" class="clear-filter">Clear filter</a>
      </div>
    {/if}
    <div class="roles-container">
      {#each Object.entries(rolesByTeam).sort((a, b) => a[1].name.localeCompare(b[1].name)) as [teamId, teamGroup]}
        <div class="team-group">
          <h2 class="team-title" style="background: {teamGroup.color}">
            <span class="team-icon">{teamGroup.icon}</span>
            {teamGroup.name}
            <span class="role-count">{teamGroup.roles.length}</span>
          </h2>
          <div class="roles-grid">
            {#each teamGroup.roles as role}
              <div class="role-card" class:inactive={!role.is_active}>
                <div class="role-header">
                  <h3>{role.name}</h3>
                  {#if !role.is_active}
                    <span class="inactive-badge">INACTIVE</span>
                  {/if}
                </div>

                {#if role.description}
                  <p class="role-description">{role.description}</p>
                {/if}

                <div class="role-meta">
                  <div class="meta-item">
                    <span class="meta-label">Body Parts</span>
                    <span class="meta-value">{formatBodyParts(role.body_parts)}</span>
                  </div>
                  <div class="meta-item">
                    <span class="meta-label">Load Weight</span>
                    <span class="meta-value">{role.load_weight}</span>
                  </div>
                </div>

                <div class="role-actions">
                  <button class="btn-edit" on:click={() => openEditModal(role)}>
                    Edit
                  </button>
                  <button
                    class="btn-toggle"
                    class:deactivate={role.is_active}
                    on:click={() => toggleActive(role)}
                  >
                    {role.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add/Edit Role Modal -->
{#if showModal}
<div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()}>
  <div class="modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeModal()}>
    <div class="modal-header">
      <h2>{editingRole ? 'Edit Role' : 'Add New Role'}</h2>
      <button class="close-btn" on:click={closeModal}>×</button>
    </div>

    <div class="modal-body">
      <div class="form-group">
        <label for="role-name">Role Name *</label>
        <input
          id="role-name"
          type="text"
          bind:value={formName}
          placeholder="e.g., Electric Guitar, Worship Leader"
        />
      </div>

      <div class="form-group">
        <label for="team">Team</label>
        <select id="team" bind:value={formTeamId}>
          <option value="">No team assigned</option>
          {#each teams as team}
            <option value={team.id}>
              {team.icon} {team.name}
            </option>
          {/each}
        </select>
        <small class="help-text">Assign this role to a ministry team</small>
      </div>

      <div class="form-group">
        <label for="description">Description</label>
        <textarea
          id="description"
          bind:value={formDescription}
          placeholder="Brief description of this role's responsibilities"
          rows="2"
        ></textarea>
      </div>

      <div class="form-group">
        <label>Body Parts Required</label>
        <p class="help-text">Select which body parts this role uses. This helps prevent scheduling conflicts (e.g., can't play drums and guitar at the same time).</p>
        <div class="body-parts-grid">
          {#each availableBodyParts as bp}
            <button
              type="button"
              class="body-part-btn"
              class:selected={formBodyParts.includes(bp.id)}
              on:click={() => toggleBodyPart(bp.id)}
            >
              <span class="bp-icon">{bp.icon}</span>
              <span class="bp-label">{bp.label}</span>
            </button>
          {/each}
        </div>
      </div>

      <div class="form-group">
        <label for="load-weight">Load Weight</label>
        <div class="load-weight-input">
          <input
            id="load-weight"
            type="range"
            min="1"
            max="20"
            bind:value={formLoadWeight}
          />
          <span class="load-value">{formLoadWeight}</span>
        </div>
        <small class="help-text">Higher weight = more demanding role. Used for balancing schedules.</small>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" on:click={closeModal}>Cancel</button>
      <button
        class="btn-save"
        on:click={saveRole}
        disabled={saving || !formName.trim()}
      >
        {saving ? 'Saving...' : (editingRole ? 'Save Changes' : 'Create Role')}
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

  /* Header */
  header {
    margin-bottom: 2rem;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .title-section h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: #1a1a1a;
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
    transition: all 0.2s;
  }

  .btn-add:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .stats-row {
    display: flex;
    gap: 1.5rem;
  }

  .stat {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a1a;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .stat.inactive .stat-value {
    color: #9ca3af;
  }

  /* Loading & Error */
  .loading, .error {
    text-align: center;
    padding: 3rem;
    background: #f9fafb;
    border-radius: 12px;
  }

  .error {
    background: #fef2f2;
    color: #b91c1c;
  }

  .error button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #dc2626;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border: 2px dashed #e5e7eb;
    border-radius: 12px;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .empty-state h3 {
    font-size: 1.25rem;
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

  /* Filter indicator */
  .filter-indicator {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-size: 0.875rem;
    color: #0369a1;
  }

  .filter-icon {
    width: 1.75rem;
    height: 1.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .clear-filter {
    margin-left: auto;
    color: #0284c7;
    text-decoration: none;
    font-weight: 500;
  }

  .clear-filter:hover {
    text-decoration: underline;
  }

  /* Roles grid */
  .roles-container {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .team-group {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .team-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: white;
    padding: 0.75rem 1.25rem;
    margin: 0;
  }

  .team-icon {
    font-size: 1rem;
  }

  .role-count {
    margin-left: auto;
    background: rgba(255, 255, 255, 0.2);
    padding: 0.125rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
    padding: 1.25rem;
  }

  .role-card {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.2s;
  }

  .role-card:hover {
    border-color: #667eea;
  }

  .role-card.inactive {
    opacity: 0.6;
    background: #f3f4f6;
  }

  .role-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .role-header h3 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    color: #1a1a1a;
  }

  .inactive-badge {
    font-size: 0.625rem;
    font-weight: 700;
    padding: 0.125rem 0.375rem;
    background: #9ca3af;
    color: white;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .role-description {
    font-size: 0.8125rem;
    color: #6b7280;
    margin: 0 0 0.75rem 0;
    line-height: 1.4;
  }

  .role-meta {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .meta-item {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .meta-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #9ca3af;
  }

  .meta-value {
    font-size: 0.8125rem;
    color: #374151;
  }

  .role-actions {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid #e5e7eb;
  }

  .btn-edit, .btn-toggle {
    flex: 1;
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
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

  .btn-toggle:not(.deactivate):hover {
    background: #ecfdf5;
    border-color: #10b981;
    color: #10b981;
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
    max-width: 500px;
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

  /* Form */
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

  .form-group input[type="text"],
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9375rem;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #667eea;
  }

  .form-group textarea {
    resize: vertical;
  }

  .help-text {
    display: block;
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.375rem;
  }

  /* Body parts selector */
  .body-parts-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .body-part-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .body-part-btn:hover {
    border-color: #667eea;
  }

  .body-part-btn.selected {
    border-color: #667eea;
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
  }

  .bp-icon {
    font-size: 1.25rem;
  }

  .bp-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #374151;
  }

  /* Load weight slider */
  .load-weight-input {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .load-weight-input input[type="range"] {
    flex: 1;
    height: 6px;
    -webkit-appearance: none;
    background: #e5e7eb;
    border-radius: 999px;
    outline: none;
  }

  .load-weight-input input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    cursor: pointer;
  }

  .load-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #667eea;
    min-width: 2rem;
    text-align: center;
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
  }

  .btn-save:hover:not(:disabled) {
    opacity: 0.9;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    .container {
      padding: 1rem;
    }

    .header-content {
      flex-direction: column;
      gap: 1rem;
    }

    .btn-add {
      width: 100%;
    }

    .roles-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
