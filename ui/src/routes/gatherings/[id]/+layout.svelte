<script lang="ts">
  import { page } from '$app/stores';

  export let data;

  $: service = data.service;
  $: serviceId = data.serviceId;

  const tabs = [
    { key: 'order', label: 'Order' },
    { key: 'people', label: 'People' },
    { key: 'rehearse', label: 'Rehearse' },
    { key: 'charts', label: 'Charts' }
  ];

  function isActive(tabKey: string): boolean {
    const pathname = $page.url.pathname;
    return pathname.endsWith(`/${tabKey}`) || pathname.endsWith(`/${tabKey}/`);
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch {
      return dateStr;
    }
  }

  function formatTime(timeStr: string): string {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }
</script>

<div class="container">
  <a href="/gatherings" class="back-link">← Back to Gatherings</a>

  {#if service}
    <!-- Service Header -->
    <div class="service-header">
      <div class="header-content">
        <h1>{service.service_name}</h1>
        {#if service.campus_name}
          <span class="campus-badge">{service.campus_name}</span>
        {/if}
      </div>
      <div class="service-meta">
        <div class="meta-item">
          <span class="label">Date:</span> {formatDate(service.group_date)}
        </div>
        <div class="meta-item">
          <span class="label">Time:</span> {formatTime(service.service_time)}
        </div>
        <div class="meta-item">
          <span class="label">Type:</span> {service.context_name}
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="gathering-tabs" role="tablist" aria-label="Gathering sections">
      {#each tabs as tab (tab.key)}
        <a
          href="/gatherings/{serviceId}/{tab.key}"
          class="gathering-tab"
          class:active={isActive(tab.key)}
          role="tab"
          aria-selected={isActive(tab.key)}
        >
          {tab.label}
        </a>
      {/each}
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      <slot />
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1400px;
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

  /* Service Header */
  .service-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 12px;
    margin-bottom: 0;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }

  .header-content {
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

  .campus-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.375rem 0.875rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .service-meta {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
    opacity: 0.95;
  }

  .meta-item {
    font-size: 0.9375rem;
  }

  .label {
    opacity: 0.8;
    margin-right: 0.375rem;
  }

  /* Tabs */
  .gathering-tabs {
    display: flex;
    gap: 0;
    background: white;
    border: 1px solid #e0e0e0;
    border-top: none;
    border-radius: 0 0 12px 12px;
    overflow: hidden;
    margin-bottom: 2rem;
  }

  .gathering-tab {
    flex: 1;
    padding: 1rem;
    text-align: center;
    font-weight: 500;
    font-size: 0.9375rem;
    color: #666;
    text-decoration: none;
    border-right: 1px solid #e0e0e0;
    transition: all 0.2s;
    position: relative;
  }

  .gathering-tab:last-child {
    border-right: none;
  }

  .gathering-tab:hover {
    color: #667eea;
    background: #f8f9fa;
  }

  .gathering-tab.active {
    color: #667eea;
    background: white;
  }

  .gathering-tab.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .tab-content {
    /* Content styling handled by child pages */
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 1.5rem;
    }

    .service-meta {
      flex-direction: column;
      gap: 0.5rem;
    }

    .gathering-tab {
      padding: 0.75rem 0.5rem;
      font-size: 0.875rem;
    }
  }
</style>
