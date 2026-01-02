<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { getActiveChurchId, setActiveChurchId, listTenants } from '$lib/tenant';
  import favicon from '$lib/assets/favicon.svg';
  
  import '../app.css';



  let { children } = $props();
  
  const tenants = listTenants();
  let activeChurchId = $state('');
  
  function onTenantChange(e: Event) {
    const id = (e.target as HTMLSelectElement).value;
    setActiveChurchId(id);
    window.location.reload();
  }
  
  onMount(() => {
    activeChurchId = getActiveChurchId();
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="app-container">
  <nav class="main-nav">
    <div class="nav-content">
      <div class="logo">Worship OS</div>
      
      <div class="nav-links">
        <a href="/gatherings" class:active={$page.url.pathname.startsWith('/gatherings')}>
          Gatherings
        </a>
        <a href="/people" class:active={$page.url.pathname.startsWith('/people')}>
          People
        </a>
        <a href="/families" class:active={$page.url.pathname.startsWith('/families')}>
          Families
        </a>
        <a href="/songs" class:active={$page.url.pathname.startsWith('/songs')}>
          Songs
        </a>
        <a href="/admin" class:active={$page.url.pathname.startsWith('/admin')}>
          Admin
        </a>
      </div>
      
      <div class="tenant-switcher">
        <select value={activeChurchId} onchange={onTenantChange}>
          {#each tenants as t}
            <option value={t.id}>{t.name}</option>
          {/each}
        </select>
      </div>
    </div>
  </nav>
  
  <div class="page-content">
    {@render children()}
  </div>
</div>

<style>
  /* Global App Styles */
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #f9f9f9;
    font-family: system-ui, -apple-system, sans-serif;
  }

  /* Navigation Bar */
  .main-nav {
    background: white;
    border-bottom: 1px solid #e0e0e0;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }

  .nav-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 24px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .logo {
    font-weight: 800;
    font-size: 20px;
    color: #1a1a1a;
    letter-spacing: -0.5px;
  }

  .nav-links {
    display: flex;
    gap: 24px;
    flex: 1;
  }

  .nav-links a {
    text-decoration: none;
    color: #666;
    font-weight: 500;
    font-size: 15px;
    padding: 8px 0;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .nav-links a:hover {
    color: #0066cc;
  }

  .nav-links a.active {
    color: #0066cc;
    border-bottom-color: #0066cc;
  }

  .tenant-switcher select {
    padding: 6px 12px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 14px;
    background: white;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tenant-switcher select:hover {
    border-color: #0066cc;
  }

  .tenant-switcher select:focus {
    outline: none;
    border-color: #0066cc;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
  }

  .page-content {
    min-height: calc(100vh - 64px);
  }

  @media (max-width: 768px) {
    .nav-content {
      flex-wrap: wrap;
      height: auto;
      padding: 12px 16px;
    }
    
    .nav-links {
      order: 3;
      width: 100%;
      justify-content: center;
      padding-top: 8px;
    }
  }
</style>