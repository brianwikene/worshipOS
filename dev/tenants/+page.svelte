<!-- /dev/tenants/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';

  function selectTenant(churchId: string) {
    localStorage.setItem('dev_church_id', churchId);
    goto('/services');
  }
</script>

<button on:click={() => selectTenant(a8c2c7ab-836a-4ef1-a373-562e20babb76)}>
  Vineyard Test
</button>

<button on:click={() => selectTenant(84c66cbb-1f13-4ed2-8416-076755b5dc49)}>
  Bethany Community Church
</button>
