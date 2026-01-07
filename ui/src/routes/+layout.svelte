<script lang="ts">
  import TopNavigation from '$lib/components/layout/TopNavigation.svelte';
  import { onMount } from 'svelte';
// Existing tenant logic
  import { getActiveChurchId, listTenants, setActiveChurchId } from '$lib/tenant';
  import '../app.css';

  let { children } = $props();

  // 1. Get the list of tenants (Bethany, Vineyard, etc.)
  const tenants = listTenants();

  // 2. Track the active one
  let activeChurchId = $state('');

  // 3. Handle the switch
  function onTenantChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    setActiveChurchId(id);
    // Force reload so all API calls use the new Church ID
    window.location.reload();
  }

  onMount(() => {
    activeChurchId = getActiveChurchId();
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

  <main>
    {@render children()}
  </main>

</div>
