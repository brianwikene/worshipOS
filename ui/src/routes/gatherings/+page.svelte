<script lang="ts">
  import { onMount } from 'svelte';
  import { apiJson, apiFetch } from '$lib/api';
  import { page } from '$app/stores';
  import { getActiveChurchId } from '$lib/tenant';

  type ViewMode = 'upcoming' | 'past';
  let view: ViewMode = 'upcoming';

  let activeChurchId = '';
  let services: any[] = [];
  let error: string | null = null;
  let loading = true;

  // Add Service modal state
  let showAddModal = false;
  let addingService = false;
  let contexts: Array<{ id: string; name: string }> = [];
  let roles: Array<{ id: string; name: string; ministry_area: string | null }> = [];
  let campuses: Array<{ id: string; name: string }> = [];

  // Form state
  let newServiceName = '';
  let newServiceContextId = '';
  let newServiceDate = '';
  let serviceInstances: Array<{ time: string; campus_id: string }> = [{ time: '09:00', campus_id: '' }];
  let selectedPositions: Array<{ role_id: string; quantity: number }> = [];

  // Get minimum date (today)
  function getMinDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

$: {
  const v = $page.url.searchParams.get('view');
  view = v === 'past' ? 'past' : 'upcoming';
}

  // Updated interface to include the ministry breakdown array
  interface Assignments {
    total_positions: number;
    filled_positions: number;
    confirmed: number;
    pending: number;
    unfilled: number;
    by_ministry: Array<{
      ministry_area: string;
      total: number;
      filled: number;
      confirmed: number;
      pending: number;
    }>;
  }

  interface ServiceInstance {
    id: string;
    service_time: string;
    campus_id: string | null;
    campus_name: string | null;
    assignments: Assignments;
  }

  interface ServiceGroup {
    id: string;
    group_date: string;
    name: string;
    context_name: string;
    instances: ServiceInstance[];
  }

  function formatDate(dateStr: string): string {
  if (!dateStr) return 'Date not available';
  try {
    const date = parseDateOnlyLocal(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

  function formatTime(timeStr: string): string {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  function startOfTodayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isUpcoming(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const serviceDate = new Date(dateStr);
  serviceDate.setHours(0, 0, 0, 0);

  return serviceDate >= today;
}

function parseDateOnlyLocal(dateStr: string): Date {
  // Handles "YYYY-MM-DD" as a local calendar date (not UTC midnight)
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return new Date(dateStr); // fallback for full ISO timestamps

  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1; // 0-based
  const day = Number(m[3]);

  return new Date(year, monthIndex, day); // local midnight
}

function isPastGroupDate(groupDateStr: string): boolean {
  const today = startOfTodayLocal();
  const d = parseDateOnlyLocal(groupDateStr);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

function sortInstances(instances: ServiceInstance[], mode: ViewMode): ServiceInstance[] {
  return [...instances].sort((a, b) => {
    // service_time is "HH:MM:SS" and group_date is outside, so we mostly sort by time within a day.
    // If you later have service_start_at, use that instead.
    const ta = a.service_time ?? '00:00:00';
    const tb = b.service_time ?? '00:00:00';
    return mode === 'upcoming' ? ta.localeCompare(tb) : tb.localeCompare(ta);
  });
}

async function loadServices() {
  loading = true;
  error = null;

  try {
    // If your backend supports view filtering:
    // services = await apiJson<ServiceGroup[]>(`/api/gatherings?view=${view}`);
    // Otherwise keep it simple:
    services = await apiJson<ServiceGroup[]>('/api/gatherings');
  } catch (e: any) {
    error = e?.message ?? 'Failed to load services';
    services = [];
  } finally {
    loading = false;
  }
}

onMount(async () => {
  activeChurchId = getActiveChurchId();
  await loadServices();
  await loadFormData();
});

async function loadFormData() {
  try {
    const [ctxData, roleData, campusData] = await Promise.all([
      apiJson<typeof contexts>('/api/contexts'),
      apiJson<typeof roles>('/api/roles'),
      apiJson<typeof campuses>('/api/campuses')
    ]);
    contexts = ctxData;
    roles = roleData;
    campuses = campusData;
  } catch (e) {
    console.error('Failed to load form data:', e);
  }
}

function openAddModal() {
  // Reset form
  newServiceName = contexts.length > 0 ? contexts[0].name : '';
  newServiceContextId = contexts.length > 0 ? contexts[0].id : '';
  newServiceDate = getMinDate();
  serviceInstances = [{ time: '09:00', campus_id: campuses.length > 0 ? campuses[0].id : '' }];
  selectedPositions = [];
  showAddModal = true;
}

function closeAddModal() {
  showAddModal = false;
}

function addServiceInstance() {
  serviceInstances = [...serviceInstances, { time: '10:30', campus_id: campuses.length > 0 ? campuses[0].id : '' }];
}

function removeServiceInstance(index: number) {
  if (serviceInstances.length > 1) {
    serviceInstances = serviceInstances.filter((_, i) => i !== index);
  }
}

function addPosition(roleId: string) {
  const existing = selectedPositions.find(p => p.role_id === roleId);
  if (existing) {
    existing.quantity += 1;
    selectedPositions = [...selectedPositions];
  } else {
    selectedPositions = [...selectedPositions, { role_id: roleId, quantity: 1 }];
  }
}

function removePosition(roleId: string) {
  const existing = selectedPositions.find(p => p.role_id === roleId);
  if (existing && existing.quantity > 1) {
    existing.quantity -= 1;
    selectedPositions = [...selectedPositions];
  } else {
    selectedPositions = selectedPositions.filter(p => p.role_id !== roleId);
  }
}

function getPositionQuantity(roleId: string): number {
  return selectedPositions.find(p => p.role_id === roleId)?.quantity ?? 0;
}

// Group roles by ministry area for display
$: rolesByMinistry = roles.reduce((acc, role) => {
  const area = role.ministry_area || 'Other';
  if (!acc[area]) acc[area] = [];
  acc[area].push(role);
  return acc;
}, {} as Record<string, typeof roles>);

async function createService() {
  if (!newServiceName || !newServiceDate || serviceInstances.length === 0) {
    alert('Please fill in all required fields');
    return;
  }

  // Validate date is not in past
  const selectedDate = new Date(newServiceDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Allow 2 hours of grace period
  const graceDate = new Date(today.getTime() - (2 * 60 * 60 * 1000));
  graceDate.setHours(0, 0, 0, 0);

  if (selectedDate < graceDate) {
    alert('Service date must be today or in the future');
    return;
  }

  addingService = true;
  try {
    await apiFetch('/api/gatherings', {
      method: 'POST',
      body: JSON.stringify({
        name: newServiceName,
        context_id: newServiceContextId || null,
        group_date: newServiceDate,
        instances: serviceInstances.map(i => ({
          service_time: i.time + ':00',
          campus_id: i.campus_id || null
        })),
        positions: selectedPositions
      })
    });

    closeAddModal();
    await loadServices();
  } catch (e: any) {
    alert(e?.message ?? 'Failed to create service');
  } finally {
    addingService = false;
  }
}

let visibleServices: ServiceGroup[] = [];

$: visibleServices = services
  .filter(service =>
    view === 'past'
      ? isPastGroupDate(service.group_date)
      : !isPastGroupDate(service.group_date)
  )
  .sort((a, b) => {
    // Upcoming: soonest first | Past: most recent first
    return view === 'past'
      ? b.group_date.localeCompare(a.group_date)
      : a.group_date.localeCompare(b.group_date);
  })
  .map(service => ({
    ...service,
    instances: sortInstances(service.instances, view)
  }));

  // Logic for the main status banner color
  function getStatusColor(assignments: Assignments): string {
    if (assignments.total_positions === 0) return 'gray';
    if (assignments.unfilled > 0) return 'red';
    if (assignments.pending > 0) return 'yellow';
    return 'green';
  }

  // Logic for the main status banner text
  function getStatusLabel(assignments: Assignments): string {
    if (assignments.total_positions === 0) return 'No positions defined';
    if (assignments.unfilled > 0) return `${assignments.unfilled} UNFILLED`;
    if (assignments.pending > 0) return `${assignments.pending} PENDING`;
    return 'FULLY STAFFED';
  }
</script>

<div class="sys-page">
  <header>
    <div class="header-content">
      <div class="title-section">
        <h1>Gatherings</h1>
        <p>Scheduled Gatherings</p>
        <p>church_id: {activeChurchId}</p>
      </div>
      <nav class="view-toggle" aria-label="Filter gatherings by timeframe">
        <a
          class:selected={view === 'upcoming'}
          aria-current={view === 'upcoming' ? 'page' : undefined}
          href="/gatherings?view=upcoming"
        >
          Upcoming
        </a>
        <a
          class:selected={view === 'past'}
          aria-current={view === 'past' ? 'page' : undefined}
          href="/gatherings?view=past"
        >
          Past
        </a>
      </nav>
      <div class="header-actions">
        <button class="sys-btn sys-btn--primary" type="button" on:click={openAddModal}>
          + Add Gathering
        </button>
        <button class="sys-btn sys-btn--secondary" type="button" on:click={() => window.location.reload()}>
          Refresh
        </button>
      </div>
    </div>
  </header>

  {#if loading}
    <div class="sys-state">Loading gatherings...</div>
  {:else if error}
    <div class="sys-state sys-state--error">
      <p>Error: {error}</p>
      <button type="button" on:click={() => window.location.reload()}>Retry</button>
    </div>
  {:else if visibleServices.length === 0}
    <div class="empty-state-card">
      {#if view === 'past'}
        <div class="empty-icon">📋</div>
        <h3>No Past Services</h3>
        <p>There are no past gatherings to display.</p>
      {:else}
        <div class="empty-icon">📅</div>
        <h3>No Upcoming Gatherings</h3>
        <p>You don't have any gatherings scheduled yet. Would you like to create one?</p>
        <button class="sys-btn sys-btn--primary" type="button" on:click={openAddModal}>
          + Schedule a Gathering
        </button>
      {/if}
    </div>
  {:else}
    <div class="services-list">
      {#each visibleServices as service}
        <div class="service-block">
          <div class="service-header-bar">
            <div class="header-top">
              <h2>{service.name}</h2>
              <span class="context-badge">{service.context_name}</span>
            </div>
            <div class="header-meta">
              <span class="meta-item">{formatDate(service.group_date)}</span>
            </div>
          </div>

          <div class="instances-grid">
            {#each service.instances as instance}
              <a href={`/gatherings/${instance.id}`} class="instance-link">
                <div class="instance-card">

                  <div class="instance-header">
                    <div class="time">{formatTime(instance.service_time)}</div>
                    {#if instance.campus_name}
                      <div class="campus">
                        <span class="icon">📍</span>
                        {instance.campus_name}
                      </div>
                    {:else}
                      <div class="campus no-campus">
                        <span class="icon">⚠️</span>
                        No campus assigned
                      </div>

                    {/if}
                    {#if view === 'past'}
                    <div class="mode-badge">PAST</div>
                    {/if}

                  </div>

                  {#if instance.assignments && instance.assignments.total_positions > 0}
                    <div class="assignments-container">

                        <div class="status-banner {getStatusColor(instance.assignments)}">
                            {getStatusLabel(instance.assignments)}
                        </div>

                        <div class="stats-grid">
                            <div class="stat-box confirmed">
                                <span class="stat-value">{instance.assignments.confirmed}</span>
                                <span class="stat-label">Confirmed</span>
                            </div>
                            <div class="stat-box pending">
                                <span class="stat-value">{instance.assignments.pending}</span>
                                <span class="stat-label">Pending</span>
                            </div>
                            <div class="stat-box unfilled">
                                <span class="stat-value">{instance.assignments.unfilled}</span>
                                <span class="stat-label">Unfilled</span>
                            </div>
                        </div>

                        <div class="total-progress">
                            <div class="progress-text">
                                {instance.assignments.filled_positions} of {instance.assignments.total_positions} positions filled
                            </div>
                            <div class="progress-track">
                                <div class="progress-fill" style="width: {(instance.assignments.filled_positions / instance.assignments.total_positions) * 100}%"></div>
                            </div>
                        </div>

                        {#if instance.assignments.by_ministry && instance.assignments.by_ministry.length > 0}
                        <div class="ministry-breakdown">
                            <h4>Ministry Breakdown</h4>
                            {#each instance.assignments.by_ministry as ministry}
                                <div class="ministry-row">
                                    <div class="ministry-info">
                                        <span class="ministry-name">{ministry.ministry_area}</span>
                                        <div class="ministry-stats">
                                            {#if ministry.pending > 0}
                                                <span class="pending-text">{ministry.pending} pending</span>
                                                <span class="separator">•</span>
                                            {/if}
                                            <span class="ministry-count">{ministry.confirmed}/{ministry.total} confirmed</span>
                                        </div>
                                    </div>
                                    <div class="ministry-track">
                                        <div class="ministry-fill green" style="width: {(ministry.confirmed / ministry.total) * 100}%"></div>
                                        <div class="ministry-fill yellow" style="width: {(ministry.pending / ministry.total) * 100}%"></div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                        {/if}

                    </div>
                  {:else}
                    <div class="no-assignments">
                      No scheduling requirements defined
                    </div>
                  {/if}
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Service Modal -->
{#if showAddModal}
<div
  class="modal-overlay"
  role="presentation"
  aria-hidden="true"
  tabindex="-1"
  on:click={closeAddModal}
  on:keydown={(e) => e.key === 'Escape' && closeAddModal()}
>
  <div
    class="modal add-service-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="add-service-modal-title"
    aria-describedby="add-service-modal-body"
    tabindex="-1"
    on:click|stopPropagation
    on:keydown={(e) => e.key === 'Escape' && closeAddModal()}
  >
    <div class="modal-header">
      <h2 id="add-service-modal-title">Schedule New Service</h2>
      <button class="close-btn" type="button" aria-label="Close modal" on:click={closeAddModal}>×</button>
    </div>

    <div class="modal-body" id="add-service-modal-body">
      <!-- Service Type & Name -->
      <div class="form-section">
        <h3>Service Details</h3>

        <div class="form-row">
          <div class="form-group">
            <label for="service-type">Service Type</label>
            <select id="service-type" bind:value={newServiceContextId} on:change={(e) => {
              const ctx = contexts.find(c => c.id === e.currentTarget.value);
              if (ctx) newServiceName = ctx.name;
            }}>
              <option value="">— Select Type —</option>
              {#each contexts as ctx}
                <option value={ctx.id}>{ctx.name}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="service-name">Service Name</label>
            <input id="service-name" type="text" bind:value={newServiceName} placeholder="e.g., Sunday AM" />
          </div>
        </div>

        <div class="form-group">
          <label for="service-date">Date</label>
          <input id="service-date" type="date" bind:value={newServiceDate} min={getMinDate()} />
          <small class="help-text">Services can only be scheduled for today or future dates.</small>
        </div>
      </div>

      <!-- Service Times/Instances -->
      <div class="form-section">
        <div class="section-header-row">
          <h3>Service Times</h3>
          <button type="button" class="add-instance-btn" on:click={addServiceInstance}>+ Add Time</button>
        </div>

        {#each serviceInstances as instance, idx}
          {@const timeId = `instance-time-${idx}`}
          {@const campusId = `instance-campus-${idx}`}
          <div class="instance-row">
            <div class="form-group">
              <label for={timeId}>Time</label>
              <input id={timeId} type="time" bind:value={instance.time} />
            </div>
            <div class="form-group flex-grow">
              <label for={campusId}>Campus</label>
              <select id={campusId} bind:value={instance.campus_id}>
                <option value="">— No Campus —</option>
                {#each campuses as campus}
                  <option value={campus.id}>{campus.name}</option>
                {/each}
              </select>
            </div>
            {#if serviceInstances.length > 1}
              <button type="button" class="remove-btn" on:click={() => removeServiceInstance(idx)}>×</button>
            {/if}
          </div>
        {/each}
      </div>

      <!-- Positions/Roles -->
      {#if roles.length > 0}
        <div class="form-section">
          <h3>Team Positions</h3>
          <p class="section-description">Select the positions you'll need to fill for this service. You can add multiples of the same role.</p>

          {#each Object.entries(rolesByMinistry) as [ministry, ministryRoles]}
            <div class="ministry-group">
              <h4 class="ministry-title">{ministry}</h4>
              <div class="roles-grid">
                {#each ministryRoles as role}
                  <div class="role-item" class:selected={getPositionQuantity(role.id) > 0}>
                    <div class="role-info">
                      <span class="role-name">{role.name}</span>
                    </div>
                    <div class="quantity-controls">
                      <button type="button" class="qty-btn" on:click={() => removePosition(role.id)} disabled={getPositionQuantity(role.id) === 0}>−</button>
                      <span class="qty-value">{getPositionQuantity(role.id)}</span>
                      <button type="button" class="qty-btn" on:click={() => addPosition(role.id)}>+</button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="form-section">
          <h3>Team Positions</h3>
          <div class="no-roles-notice">
            <p>No roles have been defined yet. You can add roles later or create this service without predefined positions.</p>
          </div>
        </div>
      {/if}

      <!-- Summary -->
      {#if selectedPositions.length > 0}
        <div class="summary-section">
          <h4>Position Summary</h4>
          <div class="summary-list">
            {#each selectedPositions as pos}
              {@const role = roles.find(r => r.id === pos.role_id)}
              {#if role}
                <span class="summary-tag">{pos.quantity}× {role.name}</span>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <div class="modal-actions">
      <button class="secondary-btn" type="button" on:click={closeAddModal}>Cancel</button>
      <button
        class="sys-btn sys-btn--primary"
        type="button"
        on:click={createService}
        disabled={addingService || !newServiceName || !newServiceDate}
      >
        {addingService ? 'Creating...' : 'Create Service'}
      </button>
    </div>
  </div>
</div>
{/if}

<style>
  /* HEADER STYLES */
  header { margin-bottom: 2rem; }
  .header-content { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; }
  .title-section h1 { font-size: 2rem; font-weight: 700; margin: 0 0 0.5rem 0; color: #1a1a1a; }
  .title-section p { color: #666; font-size: 1rem; margin: 0; }

  .refresh-btn {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    cursor: pointer;
    transition: all 0.2s;
  }
  .refresh-btn:hover { background: #f3f4f6; border-color: #9ca3af; }

.view-toggle {
  display: inline-flex;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.view-toggle a {
  padding: 0.35rem 0.75rem;
  font-size: 0.875rem;
  text-decoration: none;
  color: #374151;
  background: white;
}

.view-toggle a.selected {
  background: #111827;
  color: white;
}

.mode-badge {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: #ffc20e;
  color: #000000;
}

  /* LOADING & ERROR STATES */


  /* SERVICE LIST LAYOUT */
  .services-list { display: flex; flex-direction: column; gap: 2rem; }
  .service-block { border-bottom: 1px solid #e5e7eb; padding-bottom: 2rem; }
  .service-block:last-child { border-bottom: none; }

  /* Purple gradient header bar */
  .service-header-bar {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 1.25rem 1.5rem;
    border-radius: 12px;
    margin-bottom: 1.5rem;
  }

  .header-top {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .service-header-bar h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    margin: 0;
  }

  .service-header-bar .context-badge {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .header-meta {
    opacity: 0.95;
  }

  .meta-item {
    font-size: 0.9375rem;
  }

  /* INSTANCE GRID */
  .instances-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1.5rem;
  }

  .instance-link { text-decoration: none; color: inherit; display: block; }

  .instance-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.2s ease;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .instance-card:hover {
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);
    border-color: #d1d5db;
  }

  /* INSTANCE HEADER */
  .instance-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid #f3f4f6;
    padding-bottom: 1rem;
  }

  .time { font-size: 1.25rem; font-weight: 700; color: #111827; }
  .campus { font-size: 0.875rem; color: #6b7280; display: flex; align-items: center; gap: 0.25rem; }
  .no-campus { color: #9ca3af; font-style: italic; }

  /* ASSIGNMENTS SECTION */
  .assignments-container { display: flex; flex-direction: column; gap: 1rem; flex: 1; }

  /* STATUS BANNER */
  .status-banner {
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 700;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .status-banner.green { background: #dcfce7; color: #166534; }
  .status-banner.yellow { background: #fef9c3; color: #854d0e; }
  .status-banner.red { background: #fee2e2; color: #991b1b; }
  .status-banner.gray { background: #f3f4f6; color: #6b7280; }

  /* 3-COLUMN STATS GRID */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.75rem;
  }

  .stat-box {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 0.75rem 0.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .stat-value { font-size: 1.25rem; font-weight: 700; color: #111827; line-height: 1; margin-bottom: 0.25rem; }
  .stat-label { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }

  /* Color coding for stats */
  .stat-box.confirmed .stat-value { color: #166534; } /* Dark Green */
  .stat-box.pending .stat-value { color: #ca8a04; } /* Dark Yellow */
  .stat-box.unfilled .stat-value { color: #dc2626; } /* Dark Red */

  /* TOTAL PROGRESS BAR */
  .total-progress { margin-top: 0.5rem; }
  .progress-text { font-size: 0.75rem; color: #6b7280; text-align: center; margin-bottom: 0.25rem; }
  .progress-track { height: 6px; background: #f3f4f6; border-radius: 999px; overflow: hidden; }
  .progress-fill { height: 100%; background: #3b82f6; border-radius: 999px; }

  /* MINISTRY BREAKDOWN LIST */
  .ministry-breakdown {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f3f4f6;
  }

  .ministry-breakdown h4 {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #9ca3af;
    margin: 0 0 0.75rem 0;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .ministry-row { margin-bottom: 0.625rem; }
  .ministry-row:last-child { margin-bottom: 0; }

  .ministry-info { display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.8125rem; }
  .ministry-name { font-weight: 500; color: #374151; }
  .ministry-count { color: #6b7280; font-family: monospace; }

  .ministry-track { height: 4px; background: #f3f4f6; border-radius: 999px; overflow: hidden; width: 100%; }
  .ministry-fill { height: 100%; border-radius: 999px; transition: width 0.3s ease; }
  .ministry-fill.green { background: #10b981; }

  .no-assignments { font-style: italic; color: #9ca3af; font-size: 0.875rem; text-align: center; padding: 1rem; }

  @media (max-width: 640px) {
    .header-content { flex-direction: column; }
    .instances-grid { grid-template-columns: 1fr; }
  }
  .ministry-stats { display: flex; align-items: center; gap: 0.25rem; }

  .pending-text { color: #ca8a04; font-weight: 600; font-size: 0.75rem; }
  .separator { color: #d1d5db; font-size: 0.75rem; }

  .ministry-track {
      height: 6px;
      background: #f3f4f6;
      border-radius: 999px;
      overflow: hidden;
      width: 100%;
      display: flex; /* Allows bars to stack horizontally */
  }

  .ministry-fill { height: 100%; transition: width 0.3s ease; }
  .ministry-fill.green { background: #10b981; border-radius: 999px 0 0 999px; }
  .ministry-fill.yellow { background: #facc15; }

  /* Fix border radius if full or empty */
  .ministry-fill.green:last-child { border-radius: 999px; }

  /* Header actions */
  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .add-btn {
    padding: 0.5rem 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 600;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
  }
  .add-btn:hover { opacity: 0.9; transform: translateY(-1px); }

  /* Empty state card */
  .empty-state-card {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border: 2px dashed #e5e7eb;
    border-radius: 12px;
    margin-top: 2rem;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .empty-state-card h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 0.5rem 0;
  }

  .empty-state-card p {
    color: #6b7280;
    margin: 0 0 1.5rem 0;
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

  .add-service-modal {
    max-width: 700px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: white;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  .close-btn:hover { background: rgba(255, 255, 255, 0.3); }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
  }

  /* Form styles */
  .form-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid #f3f4f6;
  }
  .form-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }

  .form-section h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 1rem 0;
  }

  .section-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .section-header-row h3 { margin: 0; }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    margin-bottom: 1rem;
  }
  .form-group:last-child { margin-bottom: 0; }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.5rem;
  }

  .form-group input,
  .form-group select {
    padding: 0.625rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 0.9375rem;
    transition: border-color 0.2s;
  }
  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #667eea;
  }

  .help-text {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.375rem;
  }

  .section-description {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0 0 1rem 0;
  }

  /* Service instances */
  .add-instance-btn {
    padding: 0.375rem 0.75rem;
    background: white;
    border: 1px solid #667eea;
    border-radius: 6px;
    color: #667eea;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .add-instance-btn:hover { background: #f0f1ff; }

  .instance-row {
    display: flex;
    gap: 1rem;
    align-items: flex-end;
    margin-bottom: 0.75rem;
    padding: 0.75rem;
    background: #f9fafb;
    border-radius: 8px;
  }
  .instance-row .form-group { margin-bottom: 0; flex: 1; }
  .instance-row .flex-grow { flex: 2; }

  .remove-btn {
    padding: 0.5rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #ef4444;
    font-size: 1.25rem;
    cursor: pointer;
    transition: all 0.2s;
    line-height: 1;
    margin-bottom: 0.125rem;
  }
  .remove-btn:hover { background: #fef2f2; border-color: #ef4444; }

  /* Role selection */
  .ministry-group {
    margin-bottom: 1rem;
  }

  .ministry-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
    margin: 0 0 0.5rem 0;
    padding-bottom: 0.375rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .roles-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.5rem;
  }

  .role-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: white;
    transition: all 0.2s;
  }
  .role-item.selected {
    border-color: #667eea;
    background: #f0f1ff;
  }

  .role-info { flex: 1; }
  .role-name { font-size: 0.875rem; color: #1a1a1a; }

  .quantity-controls {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .qty-btn {
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    background: white;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .qty-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #667eea; }
  .qty-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .qty-value {
    min-width: 1.5rem;
    text-align: center;
    font-weight: 600;
    font-size: 0.875rem;
    color: #1a1a1a;
  }

  .no-roles-notice {
    padding: 1rem;
    background: #fef3c7;
    border-radius: 8px;
    border: 1px solid #fcd34d;
  }
  .no-roles-notice p {
    margin: 0;
    font-size: 0.875rem;
    color: #92400e;
  }

  /* Summary */
  .summary-section {
    background: #f0f1ff;
    border-radius: 8px;
    padding: 1rem;
    margin-top: 1rem;
  }
  .summary-section h4 {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #667eea;
    margin: 0 0 0.5rem 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .summary-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .summary-tag {
    padding: 0.25rem 0.625rem;
    background: white;
    border: 1px solid #667eea;
    border-radius: 999px;
    font-size: 0.8125rem;
    color: #667eea;
    font-weight: 500;
  }

  @media (max-width: 640px) {
    .form-row { grid-template-columns: 1fr; }
    .instance-row { flex-wrap: wrap; }
    .roles-grid { grid-template-columns: 1fr; }
  }
</style>
