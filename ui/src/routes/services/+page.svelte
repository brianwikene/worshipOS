<script lang="ts">
  import { onMount } from 'svelte';

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

  let services: ServiceGroup[] = [];
  let loading = true;
  let error = '';
  const ORG_ID = 'a8c2c7ab-836a-4ef1-a373-562e20babb76';
  const API_BASE = 'http://localhost:3000';

  onMount(async () => {
    try {
      const res = await fetch(`${API_BASE}/services?org_id=${ORG_ID}`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      services = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load services';
    } finally {
      loading = false;
    }
  });

  function formatDate(dateStr: string): string {
    if (!dateStr) return 'Date not available';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch (e) {
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

<div class="container">
  <header>
    <div class="header-content">
      <div class="title-section">
        <h1>Services</h1>
        <p>Upcoming worship services</p>
      </div>
      <button class="refresh-btn" on:click={() => window.location.reload()}>
        Refresh
      </button>
    </div>
  </header>

  {#if loading}
    <div class="loading">Loading services...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={() => window.location.reload()}>Retry</button>
    </div>
  {:else if services.length === 0}
    <div class="empty">
      <p>No upcoming services scheduled.</p>
    </div>
  {:else}
    <div class="services-list">
      {#each services as service}
        <div class="service-block">
          <div class="service-header-group">
            <div class="service-title-row">
                <h2>{service.name}</h2>
                <span class="context-badge">{service.context_name}</span>
            </div>
            <div class="service-date">{formatDate(service.group_date)}</div>
          </div>

          <div class="instances-grid">
            {#each service.instances as instance}
              <a href={`/service-instances/${instance.id}`} class="instance-link">
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

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  }

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

  /* LOADING & ERROR STATES */
  .loading, .error, .empty { text-align: center; padding: 3rem; background: #f9fafb; border-radius: 8px; margin-top: 2rem; color: #6b7280; }
  .error { background: #fef2f2; color: #b91c1c; }
  .error button { margin-top: 1rem; padding: 0.5rem 1rem; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; }

  /* SERVICE LIST LAYOUT */
  .services-list { display: flex; flex-direction: column; gap: 2rem; }
  .service-block { border-bottom: 1px solid #e5e7eb; padding-bottom: 2rem; }
  .service-block:last-child { border-bottom: none; }

  .service-header-group { margin-bottom: 1.5rem; }
  .service-title-row { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.25rem; }
  .service-block h2 { font-size: 1.5rem; font-weight: 600; color: #111827; margin: 0; }

  .context-badge {
    background: #eff6ff;
    color: #2563eb;
    padding: 0.125rem 0.625rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .service-date { color: #6b7280; font-size: 0.95rem; }

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
</style>
