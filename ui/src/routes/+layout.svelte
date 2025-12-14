<script lang="ts">
  import { page } from '$app/stores';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="app-container">
  <nav class="main-nav">
    <div class="nav-content">
      <div class="logo">Worship OS</div>
      <div class="nav-links">
        <a href="/services" class:active={$page.url.pathname.startsWith('/services')}>
          Services
        </a>
        <a href="/people" class:active={$page.url.pathname.startsWith('/people')}>
          People
        </a>
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
    max-width: 900px;
    margin: 0 auto;
    padding: 0 24px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .page-content {
    min-height: calc(100vh - 64px);
  }
</style>
