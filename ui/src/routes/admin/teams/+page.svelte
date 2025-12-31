<script lang="ts">
  import { onMount } from 'svelte';
  import { apiJson, apiFetch } from '$lib/api';

  interface Role {
    id: string;
    name: string;
    body_parts: string[];
    is_active: boolean;
  }

  interface Team {
    id: string | null;
    name: string;
    description: string | null;
    color: string;
    icon: string;
    is_active: boolean;
    display_order: number;
    roles: Role[];
  }

  let teams: Team[] = [];
  let loading = true;
  let error = '';

  // Modal state
  let showModal = false;
  let editingTeam: Team | null = null;
  let saving = false;

  // Form state
  let formName = '';
  let formDescription = '';
  let formColor = '#667eea';
  let formIcon = '👥';

  // Common icons for teams
  const availableIcons = ['👥', '🎸', '🎛️', '👋', '👶', '🛡️', '🎬', '🙏', '📖', '🎵', '☕', '🚗', '🏠', '✨'];

  // Common colors
  const availableColors = [
    '#667eea', '#764ba2', '#3b82f6', '#10b981', '#f59e0b',
    '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
  ];

  onMount(loadTeams);

  async function loadTeams() {
    loading = true;
    error = '';
    try {
      teams = await apiJson<Team[]>('/api/teams?include_inactive=true&include_roles=true');
    } catch (e: any) {
      error = e?.message ?? 'Failed to load teams';
    } finally {
      loading = false;
    }
  }

  function openAddModal() {
    editingTeam = null;
    formName = '';
    formDescription = '';
    formColor = '#667eea';
    formIcon = '👥';
    showModal = true;
  }

  function openEditModal(team: Team) {
    if (!team.id) return; // Can't edit the "Unassigned" virtual team
    editingTeam = team;
    formName = team.name;
    formDescription = team.description || '';
    formColor = team.color;
    formIcon = team.icon;
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingTeam = null;
  }

  async function saveTeam() {
    if (!formName.trim()) {
      alert('Team name is required');
      return;
    }

    saving = true;
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription || null,
        color: formColor,
        icon: formIcon
      };

      if (editingTeam) {
        await apiFetch(`/api/teams/${editingTeam.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/teams', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      closeModal();
      await loadTeams();
    } catch (e: any) {
      alert(e?.message ?? 'Failed to save team');
    } finally {
      saving = false;
    }
  }

  async function toggleActive(team: Team) {
    if (!team.id) return;
    const action = team.is_active ? 'deactivate' : 'reactivate';
    const roleWarning = team.roles.length > 0
      ? ` This will unassign ${team.roles.length} role(s).`
      : '';

    if (!confirm(`Are you sure you want to ${action} "${team.name}"?${roleWarning}`)) return;

    try {
      if (team.is_active) {
        await apiFetch(`/api/teams/${team.id}`, { method: 'DELETE' });
      } else {
        await apiFetch(`/api/teams/${team.id}`, {
          method: 'PUT',
          body: JSON.stringify({ is_active: true })
        });
      }
      await loadTeams();
    } catch (e: any) {
      alert(e?.message ?? `Failed to ${action} team`);
    }
  }

  $: activeTeams = teams.filter(t => t.id !== null && t.is_active);
  $: inactiveTeams = teams.filter(t => t.id !== null && !t.is_active);
  $: unassignedTeam = teams.find(t => t.id === null);
</script>

<div class="container">
  <header>
    <div class="header-content">
      <div class="title-section">
        <h1>Ministry Teams</h1>
        <p>Organize roles into teams like Worship, Hospitality, Kids, Tech, etc.</p>
      </div>
      <button class="btn-add" on:click={openAddModal}>
        + Add Team
      </button>
    </div>
  </header>

  {#if loading}
    <div class="loading">Loading teams...</div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button on:click={loadTeams}>Retry</button>
    </div>
  {:else if teams.length === 0 || (teams.length === 1 && teams[0].id === null)}
    <div class="empty-state">
      <div class="empty-icon">👥</div>
      <h3>No Teams Created</h3>
      <p>Create teams to organize your ministry roles. Each team can have multiple positions.</p>
      <button class="btn-primary" on:click={openAddModal}>
        + Create Your First Team
      </button>
    </div>
  {:else}
    <div class="teams-grid">
      {#each activeTeams as team}
        <div class="team-card">
          <div class="team-header" style="background: {team.color}">
            <span class="team-icon">{team.icon}</span>
            <h2>{team.name}</h2>
          </div>

          <div class="team-body">
            {#if team.description}
              <p class="team-description">{team.description}</p>
            {/if}

            <div class="roles-section">
              <h3>Positions ({team.roles.length})</h3>
              {#if team.roles.length === 0}
                <p class="no-roles">No positions assigned yet</p>
              {:else}
                <div class="roles-list">
                  {#each team.roles as role}
                    <span class="role-tag">{role.name}</span>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <div class="team-actions">
            <button class="btn-edit" on:click={() => openEditModal(team)}>
              Edit
            </button>
            <a href="/admin/roles?team={team.id}" class="btn-manage">
              Manage Roles
            </a>
            <button class="btn-deactivate" on:click={() => toggleActive(team)}>
              Deactivate
            </button>
          </div>
        </div>
      {/each}
    </div>

    {#if unassignedTeam && unassignedTeam.roles.length > 0}
      <div class="unassigned-section">
        <h2>Unassigned Roles</h2>
        <p>These roles haven't been assigned to a team yet.</p>
        <div class="roles-list">
          {#each unassignedTeam.roles as role}
            <span class="role-tag unassigned">{role.name}</span>
          {/each}
        </div>
        <a href="/admin/roles" class="btn-link">Assign roles to teams →</a>
      </div>
    {/if}

    {#if inactiveTeams.length > 0}
      <div class="inactive-section">
        <h2>Inactive Teams ({inactiveTeams.length})</h2>
        <div class="inactive-list">
          {#each inactiveTeams as team}
            <div class="inactive-team">
              <span class="team-icon-small">{team.icon}</span>
              <span class="team-name">{team.name}</span>
              <button class="btn-reactivate" on:click={() => toggleActive(team)}>
                Reactivate
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Add/Edit Team Modal -->
{#if showModal}
<div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()}>
  <div class="modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeModal()}>
    <div class="modal-header" style="background: {formColor}">
      <div class="modal-title">
        <span class="preview-icon">{formIcon}</span>
        <h2>{editingTeam ? 'Edit Team' : 'Add New Team'}</h2>
      </div>
      <button class="close-btn" on:click={closeModal}>×</button>
    </div>

    <div class="modal-body">
      <div class="form-group">
        <label for="team-name">Team Name *</label>
        <input
          id="team-name"
          type="text"
          bind:value={formName}
          placeholder="e.g., Worship, Hospitality, Kids"
        />
      </div>

      <div class="form-group">
        <label for="team-desc">Description</label>
        <textarea
          id="team-desc"
          bind:value={formDescription}
          placeholder="What does this team do?"
          rows="2"
        ></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Icon</label>
          <div class="icon-grid">
            {#each availableIcons as icon}
              <button
                type="button"
                class="icon-btn"
                class:selected={formIcon === icon}
                on:click={() => formIcon = icon}
              >
                {icon}
              </button>
            {/each}
          </div>
        </div>

        <div class="form-group">
          <label>Color</label>
          <div class="color-grid">
            {#each availableColors as color}
              <button
                type="button"
                class="color-btn"
                class:selected={formColor === color}
                style="background: {color}"
                on:click={() => formColor = color}
              >
                {#if formColor === color}✓{/if}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <div class="modal-actions">
      <button class="btn-cancel" on:click={closeModal}>Cancel</button>
      <button
        class="btn-save"
        style="background: {formColor}"
        on:click={saveTeam}
        disabled={saving || !formName.trim()}
      >
        {saving ? 'Saving...' : (editingTeam ? 'Save Changes' : 'Create Team')}
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

  header { margin-bottom: 2rem; }

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

  /* Loading/Error/Empty */
  .loading, .error, .empty-state {
    text-align: center;
    padding: 3rem;
    background: #f9fafb;
    border-radius: 12px;
  }

  .error { background: #fef2f2; color: #b91c1c; }

  .empty-state {
    background: white;
    border: 2px dashed #e5e7eb;
  }

  .empty-icon { font-size: 3rem; margin-bottom: 1rem; }

  .empty-state h3 { margin: 0 0 0.5rem 0; }

  .empty-state p { color: #6b7280; margin: 0 0 1.5rem 0; }

  .btn-primary {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  /* Teams grid */
  .teams-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }

  .team-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.2s;
  }

  .team-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .team-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    color: white;
  }

  .team-icon {
    font-size: 1.5rem;
  }

  .team-header h2 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
  }

  .team-body {
    padding: 1.25rem;
  }

  .team-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  .roles-section h3 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #6b7280;
    margin: 0 0 0.5rem 0;
  }

  .no-roles {
    font-size: 0.8125rem;
    color: #9ca3af;
    font-style: italic;
    margin: 0;
  }

  .roles-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .role-tag {
    padding: 0.25rem 0.5rem;
    background: #f3f4f6;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #374151;
  }

  .role-tag.unassigned {
    background: #fef3c7;
    color: #92400e;
  }

  .team-actions {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid #f3f4f6;
    background: #f9fafb;
  }

  .btn-edit, .btn-manage, .btn-deactivate {
    flex: 1;
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    text-align: center;
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-edit {
    background: white;
    border: 1px solid #667eea;
    color: #667eea;
  }

  .btn-manage {
    background: #667eea;
    border: 1px solid #667eea;
    color: white;
  }

  .btn-deactivate {
    background: white;
    border: 1px solid #d1d5db;
    color: #6b7280;
  }

  .btn-deactivate:hover {
    background: #fef2f2;
    border-color: #ef4444;
    color: #ef4444;
  }

  /* Unassigned section */
  .unassigned-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-radius: 12px;
  }

  .unassigned-section h2 {
    font-size: 1rem;
    margin: 0 0 0.5rem 0;
    color: #92400e;
  }

  .unassigned-section p {
    font-size: 0.875rem;
    color: #a16207;
    margin: 0 0 1rem 0;
  }

  .btn-link {
    display: inline-block;
    margin-top: 1rem;
    color: #d97706;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  /* Inactive section */
  .inactive-section {
    margin-top: 2rem;
    padding: 1.5rem;
    background: #f9fafb;
    border-radius: 12px;
  }

  .inactive-section h2 {
    font-size: 1rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
  }

  .inactive-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .inactive-team {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
  }

  .team-icon-small {
    font-size: 1.25rem;
  }

  .team-name {
    flex: 1;
    color: #6b7280;
  }

  .btn-reactivate {
    padding: 0.375rem 0.75rem;
    background: white;
    border: 1px solid #10b981;
    color: #10b981;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .btn-reactivate:hover {
    background: #ecfdf5;
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
    max-width: 480px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.5rem;
    color: white;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .preview-icon {
    font-size: 1.5rem;
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

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9375rem;
    box-sizing: border-box;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  .icon-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .icon-btn {
    width: 2.5rem;
    height: 2.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    border-color: #667eea;
  }

  .icon-btn.selected {
    border-color: #667eea;
    background: #f0f1ff;
  }

  .color-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .color-btn {
    width: 2rem;
    height: 2rem;
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    color: white;
    font-weight: 700;
    transition: all 0.2s;
  }

  .color-btn:hover {
    transform: scale(1.1);
  }

  .color-btn.selected {
    border-color: white;
    box-shadow: 0 0 0 2px #1a1a1a;
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
    .teams-grid {
      grid-template-columns: 1fr;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
