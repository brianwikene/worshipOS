<script lang="ts">
  import { goto } from '$app/navigation';

  const isDev = import.meta.env.DEV;

  const tenants = [
    { name: 'Vineyard Test', church_id: 'a8c2c7ab-836a-4ef1-a373-562e20babb76' },
    { name: 'Bethany Test',  church_id: '84c66cbb-1f13-4ed2-8416-076755b5dc49' }
  ];

  function enter(church_id: string) {
    localStorage.setItem('dev_church_id', church_id);
    goto('/services');
  }
</script>

{#if isDev}
  <main style="padding: 2rem;">
    <h1>WorshipOS Dev Launcher</h1>
    <p>Select a tenant to simulate.</p>

    <ul>
      {#each tenants as t}
        <li style="margin: .75rem 0;">
          <button on:click={() => enter(t.church_id)}>
            Enter {t.name}
          </button>
          <div style="font-size: .9rem; opacity: .7;">{t.church_id}</div>
        </li>
      {/each}
    </ul>
  </main>
{:else}
  <main style="padding: 2rem;">
    <h1>WorshipOS</h1>
  </main>
{/if}
