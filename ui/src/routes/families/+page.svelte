<script lang="ts">
  import { onMount } from 'svelte';

  interface Family {
    id: string;
    name: string;
    notes: string | null;
    is_active: boolean;
    active_members: number;
    active_children: number;
    active_foster_children: number;
    primary_contacts: Array<{id: string, display_name: string}> | null;
  }

  let families: Family[] = [];
  let loading = true;
  let error = '';

  const ORG_ID = 'a8c2c7ab-836a-4ef1-a373-562e20babb76';
  const API_BASE = 'http://localhost:3000';

  onMount(async () => {
    try {
      const res = await fetch(`${API_BASE}/families?org_id=${ORG_ID}`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      families = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load families';
    } finally {
      loading = false;
    }
  });
</script>

<div class="container">
  <header>
    <div class="header-content">
      <div class="title-section">
        <h1>Families</h1>
        <p>Household groups and family units</p>
      </div>
      <button class="refresh-btn" on:click={() => window.location.reload()}>
        Refresh
      </button>
    </div>
  </header>

  {#if loading}
    <div class="loading">Loading families...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={() => window.location.reload()}>Retry</button>
    </div>
  {:else if families.length === 0}
    <div class="empty">
      <p>No families found.</p>
    </div>
  {:else}
    <div class="families-list">
      {#each families as family}
        <a href={`/families/${family.id}`} class="family-card">
          <div class="family-header">
            <h2>{family.name}</h2>
            {#if !family.is_active}
              <span class="inactive-badge">Inactive</span>
            {/if}
          </div>

          <div class="family-stats">
            <div class="stat">
              <span class="stat-number">{family.active_members}</span>
              <span class="stat-label">Members</span>
            </div>
            <div class="stat">
              <span class="stat-number">{family.active_children}</span>
              <span class="stat-label">Children</span>
            </div>
            {#if family.active_foster_children > 0}
              <div class="stat foster">
                <span class="stat-number">{family.active_foster_children}</span>
                <span class="stat-label">Foster</span>
              </div>
            {/if}
          </div>

          {#if family.primary_contacts && family.primary_contacts.length > 0}
            <div class="contacts">
              <span class="contacts-label">Contacts:</span>
              {family.primary_contacts.map(c => c.display_name).join(', ')}
            </div>
          {/if}

          {#if family.notes}
            <div class="notes">
              {family.notes}
            </div>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  header {
    margin-bottom: 2rem;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
  }

  .title-section {
    flex: 1;
  }

  .refresh-btn {
    padding: 0.625rem 1.25rem;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
    color: #1a1a1a;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .refresh-btn:hover {
    background: #f5f5f5;
    border-color: #1976d2;
    color: #1976d2;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    color: #1a1a1a;
  }

  header p {
    color: #666;
    font-size: 1.1rem;
  }

  .loading, .error, .empty {
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

  .families-list {
    display: grid;
    gap: 1.5rem;
  }

  .family-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 1.5rem;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s;
    display: block;
  }

  .family-card:hover {
    border-color: #1976d2;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }

  .family-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    gap: 1rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .inactive-badge {
    background: #f5f5f5;
    color: #999;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .family-stats {
    display: flex;
    gap: 2rem;
    margin-bottom: 1rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #f8f9fa;
    border-radius: 8px;
    min-width: 80px;
  }

  .stat.foster {
    background: #fff3e0;
  }

  .stat-number {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a1a;
  }

  .stat.foster .stat-number {
    color: #f57c00;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .contacts {
    color: #666;
    font-size: 0.9375rem;
    margin-bottom: 0.75rem;
  }

  .contacts-label {
    font-weight: 600;
    color: #1a1a1a;
  }

  .notes {
    color: #666;
    font-size: 0.875rem;
    font-style: italic;
    padding: 0.75rem;
    background: #f8f9fa;
    border-radius: 6px;
    border-left: 3px solid #1976d2;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 2rem;
    }

    .header-content {
      flex-direction: column;
      gap: 1rem;
    }

    .refresh-btn {
      align-self: flex-start;
    }

    .family-stats {
      gap: 1rem;
    }

    .stat {
      min-width: 60px;
      padding: 0.5rem 0.75rem;
    }

    .stat-number {
      font-size: 1.25rem;
    }
  }
</style>
