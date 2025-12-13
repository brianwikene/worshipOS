<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  const API_BASE = 'http://localhost:3000';

  let loading = true;
  let error: string | null = null;
  let serviceData: any = null;

  function formatDate(isoString: string) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatTime(timeString: string) {
    // "09:00:00" -> "9:00 AM"
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  async function loadServiceDetail() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${API_BASE}/service-instances/${$page.params.service_instance_id}`);
      if (!res.ok) {
        throw new Error(`API error ${res.status}`);
      }
      serviceData = await res.json();
    } catch (e: any) {
      error = e?.message ?? String(e);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadServiceDetail();
  });
</script>

<svelte:head>
  <title>Service Detail – Worship OS</title>
</svelte:head>

<main class="wrap">
  <a href="/services" class="backLink">← Back to Services</a>

  {#if loading}
    <div class="loadingState">
      <p>Loading service details...</p>
    </div>
  {:else if error}
    <div class="errorBox">
      <strong>Error loading service</strong>
      <div class="errorMessage">{error}</div>
    </div>
  {:else if serviceData}
    <div class="header">
      <div>
        <h1 class="serviceName">{serviceData.service_name}</h1>
        <div class="serviceDate">{formatDate(serviceData.group_date)}</div>
      </div>
      <div class="timeBadge">{formatTime(serviceData.service_time)}</div>
    </div>

    <div class="infoGrid">
      <div class="infoCard">
        <div class="infoLabel">Service ID</div>
        <div class="infoValue">{serviceData.service_instance_id}</div>
      </div>

      <div class="infoCard">
        <div class="infoLabel">Group ID</div>
        <div class="infoValue">{serviceData.service_group_id}</div>
      </div>

      {#if serviceData.campus_id}
        <div class="infoCard">
          <div class="infoLabel">Campus</div>
          <div class="infoValue">{serviceData.campus_id}</div>
        </div>
      {/if}

      {#if serviceData.context_id}
        <div class="infoCard">
          <div class="infoLabel">Context</div>
          <div class="infoValue">{serviceData.context_id}</div>
        </div>
      {/if}
    </div>

    <div class="sectionsPlaceholder">
      <h2>Team Assignments</h2>
      <p class="muted">Coming soon...</p>
    </div>

    <div class="sectionsPlaceholder">
      <h2>Service Items</h2>
      <p class="muted">Coming soon...</p>
    </div>
  {/if}
</main>

<style>
  .wrap {
    max-width: 900px;
    margin: 0 auto;
    padding: 24px;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .backLink {
    display: inline-block;
    color: #0066cc;
    text-decoration: none;
    margin-bottom: 24px;
    font-size: 15px;
  }

  .backLink:hover {
    text-decoration: underline;
  }

  .loadingState {
    padding: 40px;
    text-align: center;
    color: #666;
  }

  .errorBox {
    border: 1px solid #f2b8b8;
    background: #fff3f3;
    padding: 16px;
    border-radius: 12px;
    margin-top: 20px;
  }

  .errorMessage {
    color: #666;
    margin-top: 8px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 2px solid #e3e3e3;
  }

  .serviceName {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: #1a1a1a;
  }

  .serviceDate {
    margin-top: 8px;
    font-size: 18px;
    color: #666;
  }

  .timeBadge {
    background: #0066cc;
    color: white;
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 20px;
    font-weight: 600;
    white-space: nowrap;
  }

  .infoGrid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  .infoCard {
    background: #f8f9fa;
    border: 1px solid #e3e3e3;
    border-radius: 12px;
    padding: 16px;
  }

  .infoLabel {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #666;
    margin-bottom: 8px;
  }

  .infoValue {
    font-size: 14px;
    color: #1a1a1a;
    word-break: break-all;
    font-family: 'Monaco', 'Courier New', monospace;
  }

  .sectionsPlaceholder {
    background: white;
    border: 1px solid #e3e3e3;
    border-radius: 14px;
    padding: 24px;
    margin-bottom: 20px;
  }

  .sectionsPlaceholder h2 {
    margin: 0 0 12px 0;
    font-size: 20px;
    font-weight: 600;
  }

  .muted {
    color: #999;
    font-style: italic;
  }
</style>
