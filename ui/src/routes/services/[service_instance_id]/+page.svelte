<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  const API_BASE = 'http://localhost:3000';

  // FIX: Match the parameter name to your folder name [service_instance_id]
  const instanceId = $page.params.service_instance_id;

  interface ServiceDetail {
    service_instance_id: string;
    service_time: string;
    service_group_id: string;
    group_date: string;
    service_name: string;
    context_name: string | null;
    campus_name: string | null;
  }

  let service: ServiceDetail | null = null;
  let loading = true;
  let error: string | null = null;

  async function loadService() {
    try {
      // Fetch using the ID we grabbed from the URL
      const res = await fetch(`${API_BASE}/service-instances/${instanceId}`);
      if (!res.ok) throw new Error('Failed to load service details');
      service = await res.json();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function formatTime(timeStr: string) {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  onMount(() => {
    loadService();
  });
</script>

<div class="container">
  <a href="/services" class="back-link">← Back to Services</a>

  {#if loading}
    <div class="loading">Loading details...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={loadService}>Retry</button>
    </div>
  {:else if service}
    <header class="detail-header">
      <div class="header-content">
        <h1>{service.service_name}</h1>
        <p class="date">{formatDate(service.group_date)}</p>
      </div>
      <div class="time-badge">
        {formatTime(service.service_time)}
      </div>
    </header>

    <div class="info-bar">
      <div class="info-item">
        <span class="label">Context</span>
        <span class="value">{service.context_name || 'General'}</span>
      </div>
      <div class="info-item">
        <span class="label">Campus</span>
        <span class="value">{service.campus_name || 'No Campus Assigned'}</span>
      </div>
    </div>

    <div class="content-grid">
      <section class="card">
        <h2>Team Assignments</h2>
        <div class="placeholder-content">
          <p>Coming soon...</p>
        </div>
      </section>

      <section class="card">
        <h2>Service Items</h2>
        <div class="placeholder-content">
          <p>Coming soon...</p>
        </div>
      </section>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .back-link {
    display: inline-block;
    margin-bottom: 24px;
    color: #0066cc;
    text-decoration: none;
    font-weight: 500;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    padding-bottom: 24px;
    border-bottom: 1px solid #e0e0e0;
  }

  h1 {
    margin: 0 0 8px 0;
    font-size: 32px;
    color: #1a1a1a;
  }

  .date {
    margin: 0;
    font-size: 18px;
    color: #666;
  }

  .time-badge {
    background: #0066cc;
    color: white;
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 20px;
    font-weight: 700;
  }

  .info-bar {
    display: flex;
    gap: 24px;
    margin-bottom: 32px;
    background: #f8f9fa;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid #e9ecef;
  }

  .info-item {
    display: flex;
    flex-direction: column;
  }

  .label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #888;
    margin-bottom: 4px;
    font-weight: 600;
  }

  .value {
    font-size: 16px;
    font-weight: 500;
    color: #333;
  }

  .content-grid {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .card {
    background: white;
    border: 1px solid #e3e3e3;
    border-radius: 14px;
    padding: 24px;
  }

  .card h2 {
    margin-top: 0;
    font-size: 20px;
    color: #1a1a1a;
    margin-bottom: 16px;
  }

  .placeholder-content {
    color: #999;
    font-style: italic;
    background: #fafafa;
    padding: 20px;
    border-radius: 8px;
    text-align: center;
  }

  .loading, .error {
    text-align: center;
    padding: 40px;
    color: #666;
  }
</style>
