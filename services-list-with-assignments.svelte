<script lang="ts">
  import { onMount } from 'svelte';

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

  function getStatusColor(assignments: Assignments): string {
    if (assignments.total_positions === 0) return 'gray';
    if (assignments.unfilled > 0) return 'red';
    if (assignments.pending > 0) return 'yellow';
    if (assignments.confirmed === assignments.total_positions) return 'green';
    return 'yellow';
  }

  function getStatusLabel(assignments: Assignments): string {
    if (assignments.total_positions === 0) return 'No positions defined';
    if (assignments.unfilled > 0) return `${assignments.unfilled} unfilled`;
    if (assignments.pending > 0) return `${assignments.pending} pending`;
    if (assignments.confirmed === assignments.total_positions) return 'Fully staffed';
    return 'Partial';
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
        <div class="service-card">
          <div class="service-header">
            <h2>{service.name}</h2>
            <span class="context-badge">{service.context_name}</span>
          </div>
          <div class="service-date">{formatDate(service.group_date)}</div>
          
          <div class="instances">
            {#each service.instances as instance}
              <a href={`/services/${instance.id}`} class="instance-link">
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

                  <!-- Assignment Status -->
                  {#if instance.assignments && instance.assignments.total_positions > 0}
                    <div class="assignments-summary">
                      <div class="status-badge {getStatusColor(instance.assignments)}">
                        {getStatusLabel(instance.assignments)}
                      </div>
                      
                      <div class="stats">
                        <div class="stat confirmed">
                          <span class="stat-number">{instance.assignments.confirmed}</span>
                          <span class="stat-label">Confirmed</span>
                        </div>
                        {#if instance.assignments.pending > 0}
                          <div class="stat pending">
                            <span class="stat-number">{instance.assignments.pending}</span>
                            <span class="stat-label">Pending</span>
                          </div>
                        {/if}
                        {#if instance.assignments.unfilled > 0}
                          <div class="stat unfilled">
                            <span class="stat-number">{instance.assignments.unfilled}</span>
                            <span class="stat-label">Unfilled</span>
                          </div>
                        {/if}
                      </div>

                      <div class="total-count">
                        {instance.assignments.filled_positions} of {instance.assignments.total_positions} positions filled
                      </div>
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
  }

  header {
    margin-bottom: 2rem;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }

  .title-section {
    flex: 1;
  }

  .refresh-btn {
    padding: 0.625rem 1.25rem;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: #1a1a1a;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .refresh-btn:hover {
    background: #f5f5f5;
    border-color: #1976d2;
    color: #1976d2;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    color: #1a1a1a;
  }

  header p {
    color: #666;
    font-size: 1.1rem;
  }

  .loading, .error, .empty {
    text-align: center;
    padding: 3rem;
    background: #f5f5f5;
    border-radius: 8px;
    margin-top: 2rem;
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
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .error button:hover {
    background: #a00;
  }

  .services-list {
    display: grid;
    gap: 1.5rem;
  }

  .service-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 1.5rem;
    transition: box-shadow 0.2s;
  }

  .service-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .service-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    gap: 1rem;
  }

  .service-card h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .context-badge {
    background: #e3f2fd;
    color: #1976d2;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .service-date {
    color: #666;
    font-size: 1rem;
    margin-bottom: 1rem;
  }

  .instances {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .instance-link {
    text-decoration: none;
    color: inherit;
  }

  .instance-card {
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1rem;
    transition: all 0.2s;
    cursor: pointer;
  }

  .instance-card:hover {
    background: #e3f2fd;
    border-color: #1976d2;
    transform: translateY(-2px);
  }

  .instance-header {
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .time {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 0.5rem;
  }

  .campus {
    color: #666;
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .icon {
    font-size: 1rem;
  }

  .no-campus {
    color: #999;
    font-style: italic;
  }

  .assignments-summary {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .status-badge {
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 600;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-badge.green {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .status-badge.yellow {
    background: #fff3e0;
    color: #f57c00;
  }

  .status-badge.red {
    background: #ffebee;
    color: #c62828;
  }

  .status-badge.gray {
    background: #f5f5f5;
    color: #999;
  }

  .stats {
    display: flex;
    gap: 0.5rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    padding: 0.5rem;
    border-radius: 6px;
    background: white;
  }

  .stat.confirmed {
    border: 1px solid #c8e6c9;
  }

  .stat.pending {
    border: 1px solid #ffe0b2;
  }

  .stat.unfilled {
    border: 1px solid #ffcdd2;
  }

  .stat-number {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1a1a1a;
  }

  .stat-label {
    font-size: 0.6875rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 0.125rem;
  }

  .total-count {
    font-size: 0.8125rem;
    color: #666;
    text-align: center;
  }

  .no-assignments {
    color: #999;
    font-size: 0.875rem;
    font-style: italic;
    text-align: center;
    padding: 0.75rem;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 2rem;
    }

    .header-content {
      flex-direction: column;
      gap: 1rem;
    }

    .refresh-btn {
      align-self: flex-start;
    }

    .service-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .instances {
      grid-template-columns: 1fr;
    }
  }
</style>
