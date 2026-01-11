<!-- /src/routes/care/+page.svelte -->
<!-- See /docs/TEND-CARE-ARCHITECTURE.md for boundary rules -->
<!--
  CARE: A case container with ownership.
  - Tightly controlled access (RLS)
  - May contain sensitive pastoral content
  - TEND may trigger, but never modify
  See also /docs/CARE.md
-->

<script lang="ts">
  let { data } = $props();
</script>

<div class="p-8">
  <div class="bg-slate-800 text-white p-4 rounded mb-8 shadow-lg font-mono text-sm">
    <h2 class="text-green-400 font-bold mb-2">🕵️ DEBUG: Who am I?</h2>
    {#if data.user}
      <p><strong>Email:</strong> {data.user.email}</p>
      <p><strong>UUID:</strong> <span class="bg-slate-700 px-1 select-all">{data.user.id}</span></p>
      <div class="mt-2 pt-2 border-t border-slate-600 text-xs text-gray-400">
        (Copy this UUID. If it doesn't match the 'assigned_to' column in your database, you won't see any cases.)
      </div>
    {:else}
      <p class="text-red-400 font-bold">⚠️ NOT LOGGED IN</p>
    {/if}
  </div>

  <h1 class="text-2xl font-bold mb-6">My Care Cases 🛡️</h1>

  {#if data.cases.length === 0}
    <div class="p-8 text-center bg-gray-50 rounded border border-dashed border-gray-300">
      <p class="text-gray-500 italic">No active cases assigned to you.</p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each data.cases as c}
        <div class="border-l-4 border-indigo-500 bg-white p-4 shadow-sm rounded-r">
          <h3 class="font-bold text-lg">{c.title}</h3>
          <p class="text-sm text-gray-500">{c.status}</p>
        </div>
      {/each}
    </div>
  {/if}
</div>
