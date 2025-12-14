<script lang="ts">
  import { onMount } from 'svelte';

  // Matches your DB schema
  interface Person {
    id: string;
    display_name: string;
  }

  const ORG_ID = 'a8c2c7ab-836a-4ef1-a373-562e20babb76';
  const API_BASE = 'http://localhost:3000';

  let people: Person[] = [];
  let loading = true;
  let error: string | null = null;

  async function loadPeople() {
    loading = true;
    error = null;
    try {
      const res = await fetch(`${API_BASE}/people?org_id=${ORG_ID}`);
      if (!res.ok) throw new Error('Failed to load people');
      people = await res.json();
    } catch (e: any) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadPeople();
  });
</script>

<svelte:head>
  <title>People – Worship OS</title>
</svelte:head>

<div class="container">
  <header class="pageHeader">
    <h1>People</h1>
    <button on:click={loadPeople} disabled={loading} class="refreshBtn">
      {loading ? 'Loading…' : 'Refresh'}
    </button>
  </header>

  {#if error}
    <div class="errorBox">
      <strong>Couldn't load people.</strong>
      <div class="errorMessage">{error}</div>
    </div>
  {:else if loading}
    <div class="loadingState">
      <p>Loading team...</p>
    </div>
  {:else if people.length === 0}
    <div class="emptyState">
      <p>No people found.</p>
    </div>
  {:else}
    <div class="peopleList">
      {#each people as person}
        <div class="personCard">
          <div class="avatarPlaceholder">
            {person.display_name.charAt(0).toUpperCase()}
          </div>
          <div class="personInfo">
            <h2 class="personName">{person.display_name}</h2>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .container {
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

  .peopleList {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 20px;
  }

  .personCard {
    background: white;
    border: 1px solid #e3e3e3;
    border-radius: 14px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .personCard:hover {
    border-color: #ccc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .avatarPlaceholder {
    width: 48px;
    height: 48px;
    background: #e3f2fd;
    color: #1976d2;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: 700;
  }

  .personName {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
  }

  .loadingState, .emptyState {
    padding: 40px;
    text-align: center;
    color: #666;
  }

  .errorBox {
    border: 1px solid #f2b8b8;
    background: #fff3f3;
    padding: 16px;
    border-radius: 12px;
  }
</style>
