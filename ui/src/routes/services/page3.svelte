<script lang="ts">
  import { onMount } from 'svelte';

  // --- TYPES ---
  // Matches the JSON structure returned by your index.js API
  interface ServiceInstance {
    id: string;
    service_time: string;
    campus_id: string | null;
    campus_name: string | null;
  }

  interface ServiceGroup {
    id: string;
    group_date: string;
    name: string;
    context_name: string;
    instances: ServiceInstance[];
  }

  // --- STATE ---
  const ORG_ID = 'a8c2c7ab-836a-4ef1-a373-562e20babb76';
  const API_BASE = 'http://localhost:3000';

  let loading = true;
  let error: string | null = null;
  let services: ServiceGroup[] = [];

  // --- LOGIC ---
  async function load() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${API_BASE}/services?org_id=${ORG_ID}`);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`API error ${res.status}: ${body}`);
      }
      services = await res.json();
    } catch (e: any) {
      error = e?.message ?? String(e);
    } finally {
      loading = false;
    }
  }

  // --- FORMATTERS ---
  function formatDate(value: string) {
    const d = new Date(value.includes('T') ? value : value + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  function formatTime(value: string) {
    const [hours, minutes] = value.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  onMount(() => {
    load();
  });
</script>

<svelte:head>
  <title>Services – Worship OS</title>
</svelte:head>

<main class="wrap">
  <header class="pageHeader">
    <h1>Services</h1>
    <button on:click={load} disabled={loading} class="refreshBtn">
      {loading ? 'Loading…' : 'Refresh'}
    </button>
  </header>

  {#if error}
    <div class="errorBox">
      <strong>Couldn't load services.</strong>
      <div class="errorMessage">{error}</div>
      <div class="errorHint">Tip: make sure your API is running on {API_BASE}.</div>
    </div>
  {:else if loading}
    <div class="loadingState">
      <p>Loading services...</p>
    </div>
  {:else if services.length === 0}
    <div class="emptyState">
      <p>No services found.</p>
    </div>
  {:else}
    <div class="servicesList">
      {#each services as service}
        <section class="serviceCard">
          <div class="cardHeader">
            <div>
              <h2 class="serviceName">{service.name}</h2>
              <div class="serviceDate">{formatDate(service.group_date)}</div>
            </div>
          </div>

          <div class="timeSlots">
            {#each service.instances as instance}
              <a class="timeSlot" href={`/services/${instance.id}`}>
                <span class="slotTime">{formatTime(instance.service_time)}</span>

                {#if instance.campus_name}
                  <span class="slotCampus">{instance.campus_name}</span>
                {:else}
                  <span class="slotCampus warning">⚠️ No Campus</span>
                {/if}
              </a>
            {/each}
          </div>
        </section>
      {/each}
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

  .pageHeader {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 2px solid #e3e3e3;
  }

  h1 {
    margin: 0;
    font-size: 32px;
    font-weight: 700;
    color: #1a1a1a;
  }

  .refreshBtn {
    padding: 10px 16px;
    border: 1px solid #ccc;
    border-radius: 10px;
    background: white;
    cursor: pointer;
    font-size: 15px;
    transition: all 0.2s;
  }

  .refreshBtn:hover:not(:disabled) {
    border-color: #0066cc;
    color: #0066cc;
  }

  .refreshBtn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loadingState {
    padding: 40px;
    text-align: center;
    color: #666;
    font-size: 16px;
  }

  .emptyState {
    padding: 40px;
    text-align: center;
    color: #999;
    font-style: italic;
    font-size: 16px;
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
    font-size: 15px;
  }

  .errorHint {
    color: #999;
    font-size: 14px;
    margin-top: 8px;
  }

  .servicesList {
    display: grid;
    gap: 20px;
  }

  .serviceCard {
    background: white;
    border: 1px solid #e3e3e3;
    border-radius: 14px;
    padding: 20px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .serviceCard:hover {
    border-color: #ccc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .cardHeader {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 16px;
  }

  .serviceName {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #1a1a1a;
  }

  .serviceDate {
    margin-top: 6px;
    font-size: 16px;
    color: #666;
  }

  .timeSlots {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* --- UPDATED BUTTON STYLE TO SUPPORT CAMPUS INFO --- */
  .timeSlot {
    display: inline-flex;
    flex-direction: column; /* Stack Time on top of Campus */
    align-items: center;
    justify-content: center;

    padding: 8px 20px;
    background: #0066cc; /* Original Blue */
    color: white;
    border: none;
    border-radius: 20px; /* Pill shape */
    text-decoration: none;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 100px;
    text-align: center;
  }

  .timeSlot:hover {
    background: #0052a3;
    transform: translateY(-1px);
    box-shadow: 0 2px 6px rgba(0, 102, 204, 0.3);
  }

  .slotTime {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.2;
  }

  .slotCampus {
    font-size: 12px;
    font-weight: 400;
    opacity: 0.9;
    margin-top: 2px;
  }

  .slotCampus.warning {
    font-style: italic;
    color: #ffeb3b; /* Yellow to stand out against blue */
    font-weight: 600;
  }
</style>
