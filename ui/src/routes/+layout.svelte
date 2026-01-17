<script lang="ts">
  // ui/src/routes/+layout.svelte
  import TopNavigation from '$lib/components/layout/TopNavigation.svelte';
  import { getActiveChurchId, listTenants, setActiveChurchId } from '$lib/tenant';
  import { onMount } from 'svelte';
  import '../app.css';

  let { children } = $props();

  const tenants = listTenants();
  let activeChurchId = $state('');

  // Handle tenant switch (localStorage + server cookie)
  async function onTenantChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;

    setActiveChurchId(id);
    activeChurchId = id;
    const updatedChurchId = activeChurchId;

    const res = await fetch('/api/tenant/active-church', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ churchId: updatedChurchId })
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Failed to set active church cookie:', res.status, text);
    }

    // Reload so SSR loads use the cookie immediately
    window.location.reload();
  }

  // On first load: sync cookie from localStorage once
  onMount(async () => {
    activeChurchId = getActiveChurchId();

    if (activeChurchId) {
      await fetch('/api/tenant/active-church', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchId: activeChurchId })
      });
    }
  });
</script>


<svelte:head>
  <title>Worship OS</title>
</svelte:head>

<div class="min-h-screen bg-[var(--ui-color-bg)] text-[var(--ui-color-text)] font-sans antialiased">

  <TopNavigation
    {tenants}
    {activeChurchId}
    {onTenantChange}
  />

  <main class="sys-shell sys-shell--main">
    <div class="sys-container">
      {@render children()}
    </div>
  </main>


</div>
