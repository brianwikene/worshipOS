<script lang="ts">
	import { enhance } from '$app/forms';
	import { Archive, Plus, RotateCcw, Trash2, X } from '@lucide/svelte';
	import type { PageData } from './$types';

	type Person = PageData['person'];
	type Team = PageData['allTeams'][number];
	type TeamMembership = NonNullable<Person['teamMemberships']>[number];

	let {
		open = $bindable(),
		person,
		allTeams = []
	} = $props<{
		open: boolean;
		person: Person;
		allTeams: Team[];
	}>();

	let loading = $state(false);
	let isCreatingTeam = $state(false);
	let formError = $state<string | null>(null);

	// 1. Filter Lists
	let activeMemberships = $derived(
		(person.teamMemberships || []).filter((m) => m.status === 'active')
	);
	let inactiveMemberships = $derived(
		(person.teamMemberships || []).filter((m) => m.status !== 'active')
	);

	// 2. Grouping Function
	function groupMemberships(list: TeamMembership[]) {
		const groups: Record<string, { team: TeamMembership['team']; memberships: TeamMembership[] }> =
			{};

		for (const m of list) {
			if (!m.team) continue;
			if (!groups[m.team.id]) {
				groups[m.team.id] = { team: m.team, memberships: [] };
			}
			groups[m.team.id].memberships.push(m);
		}

		// Return array sorted by Team Name
		return Object.values(groups).sort((a, b) => a.team.name.localeCompare(b.team.name));
	}

	let groupedActive = $derived(groupMemberships(activeMemberships));
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex justify-end">
		<div
			class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity"
			onclick={() => (open = false)}
			aria-hidden="true"
		></div>

		<div
			class="relative w-full max-w-md bg-white shadow-xl transition-transform duration-300 ease-out"
		>
			<div class="flex h-full flex-col">
				<div class="flex items-center justify-between border-b border-stone-100 px-6 py-4">
					<h2 class="text-lg font-bold text-slate-900">Manage Teams</h2>
					<button onclick={() => (open = false)} class="text-stone-400 hover:text-slate-900">
						<X size={20} />
					</button>
				</div>

				<div class="flex-1 overflow-y-auto p-6">
					{#if groupedActive.length > 0}
						<div class="mb-8 space-y-4">
							<h3 class="text-xs font-bold tracking-wide text-stone-400 uppercase">
								Current Seasons
							</h3>

							{#each groupedActive as group}
								<div class="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
									<div class="mb-3 flex items-center gap-3 border-b border-stone-100 pb-3">
										<div
											class="flex h-8 w-8 items-center justify-center rounded bg-stone-100 font-bold text-stone-600"
										>
											{group.team.name[0]}
										</div>
										<div class="text-sm font-bold text-slate-900">{group.team.name}</div>
									</div>

									<div class="space-y-2 pl-2">
										{#each group.memberships as m}
											<div class="group flex items-center justify-between">
												<div class="flex items-center gap-2">
													<div class="h-1.5 w-1.5 rounded-full bg-green-400"></div>
													<span class="text-sm font-medium text-slate-700">{m.role}</span>
												</div>

												<form method="POST" action="?/archiveTeamMembership" use:enhance>
													<input type="hidden" name="membership_id" value={m.id} />
													<button
														class="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold text-stone-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-stone-100 hover:text-stone-600"
														title="End Season"
													>
														END <Archive size={12} />
													</button>
												</form>
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}

					{#if inactiveMemberships.length > 0}
						<div class="mb-8 space-y-3">
							<h3 class="text-xs font-bold tracking-wide text-stone-400 uppercase">Past Seasons</h3>
							{#each inactiveMemberships as m}
								<div
									class="flex items-center justify-between rounded-lg border border-dashed border-stone-200 bg-stone-50/50 p-2 opacity-75 hover:opacity-100"
								>
									<div class="flex items-center gap-3">
										<div class="pl-2 text-xs font-bold text-stone-400">{m.team.name}</div>
										<div class="text-xs text-stone-500">• {m.role}</div>
									</div>

									<div class="flex items-center gap-1">
										<form method="POST" action="?/restoreTeamMembership" use:enhance>
											<input type="hidden" name="membership_id" value={m.id} />
											<button class="p-1.5 text-stone-400 hover:text-slate-900" title="Restore">
												<RotateCcw size={14} />
											</button>
										</form>
										<form method="POST" action="?/deleteTeamMembership" use:enhance>
											<input type="hidden" name="membership_id" value={m.id} />
											<button
												class="p-1.5 text-stone-300 hover:text-red-500"
												title="Delete Forever"
											>
												<Trash2 size={14} />
											</button>
										</form>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="text-sm font-bold text-slate-900">
								{isCreatingTeam ? 'Create New Team' : 'Assign Role'}
							</h3>
							<button
								onclick={() => (isCreatingTeam = !isCreatingTeam)}
								class="text-xs font-medium text-slate-600 underline"
							>
								{isCreatingTeam ? 'Cancel' : 'Create new team'}
							</button>
						</div>

						{#if formError}
							<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
								<p class="text-sm font-medium text-red-800">{formError}</p>
							</div>
						{/if}

						{#if isCreatingTeam}
							<form
								method="POST"
								action="?/createTeam"
								use:enhance={() => {
									loading = true;
									formError = null;
									return async ({ result, update }) => {
										await update();
										loading = false;
										if (result.type === 'success') {
											isCreatingTeam = false;
										} else if (result.type === 'failure' && result.data?.error) {
											formError = result.data.error as string;
										}
									};
								}}
								class="space-y-4"
							>
								<div>
									<label for="name" class="block text-xs font-medium text-stone-500 uppercase"
										>New Team Name</label
									>
									<input
										type="text"
										name="name"
										placeholder="e.g. Worship Team"
										required
										class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
									/>
								</div>
								<button
									type="submit"
									disabled={loading}
									class="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
								>
									Create Team
								</button>
							</form>
						{:else}
							<form
								method="POST"
								action="?/joinTeam"
								use:enhance={() => {
									loading = true;
									formError = null;
									return async ({ result, update }) => {
										await update();
										loading = false;
										if (result.type === 'failure' && result.data?.error) {
											formError = result.data.error as string;
										}
									};
								}}
								class="space-y-4"
							>
								{#if allTeams.length === 0}
									<div class="py-4 text-center text-sm text-stone-500 italic">
										No teams exist yet.
									</div>
								{:else}
									<div>
										<label for="team_id" class="block text-xs font-medium text-stone-500 uppercase"
											>Select Team</label
										>
										<select
											name="team_id"
											required
											class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
										>
											{#each allTeams as team}
												<option value={team.id}>{team.name}</option>
											{/each}
										</select>
									</div>
									<div>
										<label for="role" class="block text-xs font-medium text-stone-500 uppercase"
											>Role</label
										>
										<input
											type="text"
											name="role"
											placeholder="e.g. Nursery, Guitar, Leader"
											class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
										/>
									</div>
									<button
										type="submit"
										disabled={loading}
										class="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
									>
										{#if loading}Saving...{:else}<Plus size={16} /> Assign Role{/if}
									</button>
								{/if}
							</form>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
