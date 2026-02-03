<script lang="ts">
	import { Briefcase, ChevronRight, Plus, Users } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();
</script>

<div class="mb-8 flex items-center justify-between">
	<div>
		<h1 class="text-2xl font-bold text-slate-900">Teams</h1>
		<p class="text-slate-500">Manage ministry teams and rosters.</p>
	</div>
	<a
		href="/admin/teams/bulk"
		class="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800"
	>
		<Plus size={16} /> Bulk Create
	</a>
</div>

<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
	{#if data.teams.length === 0}
		<div class="py-12 text-center">
			<Briefcase size={48} class="mx-auto mb-4 text-slate-200" />
			<h3 class="text-lg font-medium text-slate-900">No teams found</h3>
			<p class="text-slate-500">Get started by creating your first team.</p>
		</div>
	{:else}
		<div class="divide-y divide-slate-100">
			{#each data.teams as team}
				<a
					href="/admin/teams/{team.id}"
					class="group flex items-center justify-between p-4 transition-colors hover:bg-slate-50"
				>
					<div class="flex items-center gap-4">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-500 transition-colors group-hover:bg-pink-50 group-hover:text-pink-600"
						>
							{team.name[0]}
						</div>
						<div>
							<div class="font-bold text-slate-900">{team.name}</div>
							<div class="line-clamp-1 max-w-md text-xs text-slate-500">
								{team.description || 'No description'}
							</div>
						</div>
					</div>

					<div class="flex items-center gap-6">
						<div class="flex items-center gap-2 text-xs font-medium text-slate-500">
							<Users size={14} />
							{team.memberCount} members
						</div>
						<ChevronRight size={16} class="text-slate-300" />
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
