<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  interface ServiceInstance {
    service_instance_id: string;
    service_time: string;
    campus_id: string | null;
    campus_name: string | null;
    service_group_id: string;
    group_date: string;
    service_name: string;
    context_id: string;
    context_name: string;
    org_id: string;
  }

  let service: ServiceInstance | null = null;
  let loading = true;
  let error = '';

  const API_BASE = 'http://localhost:3000';

  onMount(async () => {
    const instanceId = $page.params.service_instance_id;

    try {
      const res = await fetch(`${API_BASE}/service-instances/${instanceId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.statusText}`);
      }
      service = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load service details';
    } finally {
      loading = false;
    }
  });

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  function formatTime(timeStr: string): string {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }
</script>

<div class="container">
  <a href="/services" class="back-link">← Back to Services</a>

  {#if loading}
    <div class="loading">Loading service details...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={() => window.location.reload()}>Retry</button>
    </div>
  {:else if service}
    <div class="detail-card">
      <div class="header">
        <div class="title-section">
          <h1>{service.service_name}</h1>
          <span class="context-badge">{service.context_name}</span>
        </div>
        <div class="date-time">
          <div class="date">{formatDate(service.group_date)}</div>
          <div class="time">{formatTime(service.service_time)}</div>
        </div>
      </div>

      <div class="info-section">
        {#if service.campus_name}
          <div class="info-row">
            <span class="label">Campus</span>
            <span class="value">
              <span class="icon">📍</span>
              {service.campus_name}
            </span>
          </div>
        {:else}
          <div class="info-row">
            <span class="label">Campus</span>
            <span class="value warning">
              <span class="icon">⚠️</span>
              Not assigned
            </span>
          </div>
        {/if}

        <div class="info-row">
          <span class="label">Service ID</span>
          <span class="value mono">{service.service_instance_id}</span>
        </div>
      </div>

      <div class="placeholder-section">
        <h2>Team Assignments</h2>
        <p class="coming-soon">Coming soon - team scheduling will appear here</p>
      </div>

      <div class="placeholder-section">
        <h2>Song List</h2>
        <p class="coming-soon">Coming soon - worship setlist will appear here</p>
      </div>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
  }

  .back-link {
    display: inline-block;
    margin-bottom: 1.5rem;
    color: #666;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .back-link:hover {
    color: #1976d2;
  }

  .loading, .error {
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

  .detail-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    overflow: hidden;
  }

  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
  }

  .title-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
  }

  .context-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
    backdrop-filter: blur(10px);
  }

  .date-time {
    display: flex;
    gap: 2rem;
    font-size: 1.125rem;
  }

  .date {
    opacity: 0.9;
  }

  .time {
    font-weight: 600;
  }

  .info-section {
    padding: 2rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
    border-bottom: 1px solid #f0f0f0;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .label {
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    font-size: 0.875rem;
    letter-spacing: 0.05em;
  }

  .value {
    color: #1a1a1a;
    font-size: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .value.warning {
    color: #999;
    font-style: italic;
  }

  .value.mono {
    font-family: 'Courier New', monospace;
    font-size: 0.875rem;
    color: #666;
  }

  .icon {
    font-size: 1.125rem;
  }

  .placeholder-section {
    padding: 2rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .placeholder-section:last-child {
    border-bottom: none;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: #1a1a1a;
  }

  .coming-soon {
    color: #999;
    font-style: italic;
    margin: 0;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 1.5rem;
    }

    .title-section {
      flex-direction: column;
      align-items: flex-start;
    }

    .date-time {
      flex-direction: column;
      gap: 0.5rem;
    }

    .info-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
</style>
