<script lang="ts">
  import { onMount } from 'svelte';

  interface Person {
    id: string;
    display_name: string;
    has_contact_info: boolean;
  }

  let people: Person[] = [];
  let loading = true;
  let error = '';

  const CHURCH_ID = 'a8c2c7ab-836a-4ef1-a373-562e20babb76';
  const API_BASE = 'http://localhost:3000';

  onMount(async () => {
    try {
      const res = await fetch(`${API_BASE}/people?church_id=${CHURCH_ID}`);
      if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
      people = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load people';
    } finally {
      loading = false;
    }
  });

  function getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }
</script>

<div class="container">
  <header>
    <h1>People</h1>
    <p>Team members and volunteers</p>
  </header>

  {#if loading}
    <div class="loading">Loading people...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={() => window.location.reload()}>Retry</button>
    </div>
  {:else if people.length === 0}
    <div class="empty">
      <p>No people found.</p>
    </div>
  {:else}
    <div class="people-grid">
      {#each people as person}
        <a href={`/people/${person.id}`} class="person-card">
          <div class="avatar">
            {getInitial(person.display_name)}
          </div>
          <div class="person-info">
            <h2>{person.display_name}</h2>
            {#if person.has_contact_info}
              <div class="contact-badge">
                <span class="phone-icon">☎</span>
                <span>Contact Info</span>
              </div>
            {:else}
              <div class="no-info">No Info</div>
            {/if}
          </div>
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

  .people-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .person-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s;
  }

  .person-card:hover {
    border-color: #1976d2;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }

  .avatar {
    width: 60px;
    height: 60px;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: 700;
    flex-shrink: 0;
  }

  .person-info {
    flex: 1;
    min-width: 0;
  }

  h2 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: #1a1a1a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .contact-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: #e8f5e9;
    color: #2e7d32;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .phone-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .no-info {
    color: #999;
    font-size: 0.875rem;
    font-style: italic;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 2rem;
    }

    .people-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
