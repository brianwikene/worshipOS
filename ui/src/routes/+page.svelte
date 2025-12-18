<script lang="ts">
  import { onMount } from 'svelte';
  import { apiJson } from '$lib/api';
  import { getActiveChurchId, setActiveChurchId, listTenants } from '$lib/tenant';

  type Service = {
    id: string;
    name?: string;
    title?: string;
    starts_at?: string;
    start_time?: string;
  };

  const tenants = listTenants();

  let activeChurchId = '';
  let loading = true;
  let error: string | null = null;
  let services: Service[] = [];

  function displayServiceName(s: Service) {
    return s.name ?? s.title ?? '(untitled service)';
  }

  function displayServiceTime(s: Service) {
    const raw = s.starts_at ?? s.start_time;
    if (!raw) return '';
    try {
      return new Date(raw).toLocaleString();
    } catch {
      return String(raw);
    }
  }

  async function load() {
    loading = true;
    error = null;

    try {
      // Update this path to match your API route
      services = await apiJson<Service[]>('/services');
    } catch (e: any) {
      error = e?.message ?? 'Failed to load services';
      services = [];
    } finally {
      loading = false;
    }
  }

  function onTenantChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    activeChurchId = id;
    setActiveChurchId(id);

    // simplest + reliable: reload so everything refetches under new tenant
    window.location.reload();
  }

  onMount(async () => {
    activeChurchId = getActiveChurchId();
    await load();
  });
</script>

<svelte:head>
  <title>WorshipOS</title>
</svelte:head>

<main style="padding: 1rem; max-width: 900px; margin: 0 auto;">
  <header style="display:flex; gap:1rem; align-items:center; justify-content:space-between; flex-wrap:wrap;">
    <h1 style="margin:0;">WorshipOS</h1>

    <div style="display:flex; gap:.75rem; align-items:center; flex-wrap:wrap;">
      <label style="display:flex; gap:.5rem; align-items:center;">
        <span style="opacity:.8;">Tenant</span>
        <select bind:value={activeChurchId} on:change={onTenantChange}>
          {#each tenants as t}
            <option value={t.id}>{t.name}</option>
          {/each}
        </select>
      </label>

      <span style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:.85rem; opacity:.75;">
        {activeChurchId}
      </span>
    </div>
  </header>

  <section style="margin-top: 1.25rem;">
    <div style="display:flex; gap:.75rem; align-items:center;">
      <h2 style="margin:0;">Services</h2>
      <button on:click={load} disabled={loading}>Refresh</button>
    </div>

    {#if loading}
      <p style="opacity:.75; margin-top:.75rem;">Loading…</p>
    {:else if error}
      <p style="margin-top:.75rem; color: #b00020;">
        {error}
      </p>
      <p style="opacity:.75;">
        Sanity check: your browser should be sending <code>X-Church-Id</code> on every request, and the API should reject requests missing it.
      </p>
    {:else if services.length === 0}
      <p style="opacity:.75; margin-top:.75rem;">No services found for this tenant.</p>
    {:else}
      <ul style="margin-top:.75rem; padding-left: 1.25rem;">
        {#each services as s (s.id)}
          <li style="margin:.35rem 0;">
            <strong>{displayServiceName(s)}</strong>
            {#if displayServiceTime(s)}
              <span style="opacity:.75;"> — {displayServiceTime(s)}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>