<script lang="ts">
  export let data;

  const badge = (role: string) => {
    if (role === 'pastor') return 'Pastor';
    if (role === 'care') return 'Care Team';
    if (role === 'admin') return 'Admin';
    return 'Member';
  };
</script>


<div class="p-8">
  <div class="bg-slate-800 text-white p-4 rounded mb-6 shadow-lg font-mono text-sm">
    <h2 class="text-green-400 font-bold mb-2">🕵️ DEBUG: Who am I?</h2>
    {#if data.user}
      <p><strong>Email:</strong> {data.user.email}</p>
      <p>
        <strong>UUID:</strong>
        <span class="bg-slate-700 px-1 select-all">{data.user.id}</span>
      </p>
      <p class="mt-2">
        <strong>Role:</strong> {badge(data.role)} <span class="text-slate-400">({data.role})</span>
      </p>
      <div class="mt-2 pt-2 border-t border-slate-600 text-xs text-gray-400">
        RLS should filter cases. If you see cases you shouldn’t, you’re bypassing auth (service role / db pool).
      </div>
    {:else}
      <p class="text-red-400 font-bold">⚠️ NOT LOGGED IN</p>
    {/if}
  </div>

  <div class="flex items-baseline justify-between mb-6">
    <h1 class="text-2xl font-bold">Care Cases 🛡️</h1>

    {#if data.showAll}
      <a class="text-sm underline" href="/care">Show only my cases</a>
    {:else}
      <a class="text-sm underline" href="/care?all=1">Show all I can see</a>
    {/if}
  </div>

{#if (data.cases ?? []).length === 0}
    <div class="p-8 text-center bg-gray-50 rounded border border-dashed border-gray-300">
      <p class="text-gray-500 italic">
        {data.showAll ? 'No active cases you can see.' : 'No active cases assigned to you.'}
      </p>
    </div>
  {:else}
    <div class="space-y-4">
      {#each (data.cases ?? []) as c}
        <div class="border-l-4 border-indigo-500 bg-white p-4 shadow-sm rounded-r">
          <div class="flex items-center justify-between gap-4">
            <h3 class="font-bold text-lg">{c.title ?? 'Untitled case'}</h3>

            {#if c.sensitivity_level === 'pastors_only'}
              <span class="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">Pastors only</span>
            {:else}
              <span class="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700">Standard</span>
            {/if}
          </div>

          <p class="text-sm text-gray-600 mt-1">
            <strong>Person:</strong> {c.subject_name}
          </p>

          <p class="text-sm text-gray-600">
            <strong>Assigned to:</strong> {c.assigned_to_name ?? 'Unassigned'}
          </p>

          <p class="text-xs text-gray-500 mt-2">{c.status}</p>
        </div>
      {/each}
    </div>
  {/if}
</div>
