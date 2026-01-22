<!-- /ui/src/routes/admin/teams/+page.svelte -->
<script lang="ts">
  import { apiFetch, apiJson } from '$lib/api';
  import { onMount } from 'svelte';

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

<div class="sys-page">
  <div class="sys-page-header">
    <div>
      <h1 class="sys-title">Ministry Teams</h1>
      <p class="sys-subtitle">Organize roles into teams like Worship, Hospitality, Kids, Tech, etc.</p>
    </div>
    <button class="sys-btn sys-btn--primary" on:click={openAddModal}>
      + Add Team
    </button>
  </div>

  {#if loading}
    <div class="sys-state">Loading teams...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>{error}</p>
      <button class="sys-btn sys-btn--danger" on:click={loadTeams}>Retry</button>
    </div>
  {:else if teams.length === 0 || (teams.length === 1 && teams[0].id === null)}
    <div class="sys-state sys-state--empty">
      <div class="empty-icon">👥</div>
      <h3>No Teams Created</h3>
      <p>Create teams to organize your ministry roles. Each team can have multiple positions.</p>
      <button class="sys-btn sys-btn--primary" on:click={openAddModal}>
        + Create Your First Team
      </button>
    </div>
  {:else}
    <div class="teams-grid">
      {#each activeTeams as team}
        <div class="team-card">

          <div class="team-card-header">
            <div class="team-icon-container" style="color: {team.color}; background-color: {team.color}15;">
              {team.icon}
            </div>
            <h2>{team.name}</h2>
          </div>

          <div class="team-card-body">
            {#if team.description}
              <p class="team-description">{team.description}</p>
            {/if}

            <div class="roles-section">
              {#if team.roles.length === 0}
                <p class="text-muted text-sm italic">No positions defined</p>
              {:else}
                <div class="roles-list">
                  {#each team.roles as role}
                    <span class="position-badge">{role.name}</span>
                  {/each}
                </div>
              {/if}
            </div>
          </div>

          <div class="team-card-footer">
            <button class="btn btn-sm" on:click={() => openEditModal(team)}>
              Edit
            </button>

            <a href="/admin/roles?team={team.id}" class="btn btn-sm">
              Manage Roles
            </a>

            <button class="btn btn-sm hover:text-red-600" on:click={() => toggleActive(team)}>
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

{#if showModal}
<div class="sys-modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()}>
  <div class="sys-modal" on:click|stopPropagation on:keydown={(e) => e.key === 'Escape' && closeModal()}>

    <div class="modal-header">
      <div class="flex items-center gap-4">
        <div
          class="team-icon-container"
          style="color: {formColor}; background-color: {formColor}15; width: 40px; height: 40px; font-size: 1.25rem;"
        >
          {formIcon}
        </div>
        <div>
          <h2 class="text-lg font-semibold text-gray-900">{editingTeam ? 'Edit Team' : 'New Team'}</h2>
          <p class="text-sm text-gray-500">Define the identity for this group.</p>
        </div>
      </div>
      <button class="text-gray-400 hover:text-gray-600 text-2xl" on:click={closeModal}>×</button>
    </div>

    <div class="sys-modal-body p-6">
      <div class="sys-form-group mb-4">
        <label for="team-name" class="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
        <input
          id="team-name"
          class="w-full rounded-lg border-gray-300 bg-gray-50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-brand-primary/20 transition-all"
          type="text"
          bind:value={formName}
          placeholder="e.g. Worship, Hospitality, Kids"
        />
      </div>

      <div class="sys-form-group mb-6">
        <label for="team-desc" class="block text-sm font-medium text-gray-700 mb-1">Purpose / Description</label>
        <textarea
          id="team-desc"
          class="w-full rounded-lg border-gray-300 bg-gray-50 p-2.5 text-sm focus:bg-white focus:ring-2 focus:ring-brand-primary/20 transition-all"
          bind:value={formDescription}
          placeholder="What is the primary care or service responsibility?"
          rows="2"
        ></textarea>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div class="sys-form-group">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Icon</label>
          <div class="picker-grid grid grid-cols-5 gap-2">
            {#each availableIcons as icon}
              <button
                type="button"
                class="w-10 h-10 flex items-center justify-center rounded-lg border transition-all {formIcon === icon ? 'border-brand-primary bg-brand-primary-light text-brand-primary' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}"
                on:click={() => formIcon = icon}
              >
                {icon}
              </button>
            {/each}
          </div>
        </div>

        <div class="sys-form-group">
          <label class="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Accent Color</label>
          <div class="picker-grid grid grid-cols-5 gap-2">
            {#each availableColors as color}
              <button
                type="button"
                class="w-10 h-10 rounded-full flex items-center justify-center transition-transform {formColor === color ? 'ring-2 ring-offset-2 ring-gray-300 scale-110' : 'hover:scale-105'}"
                style="background: {color}"
                on:click={() => formColor = color}
              >
                {#if formColor === color}
                  <span class="text-white text-xs drop-shadow-md">✓</span>
                {/if}
              </button>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <div class="sys-modal-actions border-t border-gray-100 p-4 bg-gray-50 rounded-b-xl flex justify-end gap-3">
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
        on:click={closeModal}
      >
        Cancel
      </button>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style="background-color: var(--brand-primary);"
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
  /* Teams page specific styles */
  .empty-icon { font-size: 3rem; margin-bottom: 1rem; }

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

  /* Modal specific styles */
  .modal-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .preview-icon {
    font-size: 1.5rem;
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

  @media (max-width: 640px) {
    .teams-grid {
      grid-template-columns: 1fr;
    }

    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
