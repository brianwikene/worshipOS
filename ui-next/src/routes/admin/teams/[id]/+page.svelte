<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Check, Pencil, Shield, UserPlus, X } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let team = $derived(data.team);
	let roster = $derived(data.roster); // The grouped data
	let allPeople = $derived(data.allPeople);

	// People available for dropdown (everyone)
	let availablePeople = $derived(allPeople);

	let selectedPersonId = $state('');

	// Header Edit State
	let isHeaderEditing = $state(false);

	// Per-Person Edit State (Tracked by Person ID)
	let editingPersonId = $state<string | null>(null);

	function toggleEditPerson(id: string) {
		if (editingPersonId === id) {
			editingPersonId = null;
		} else {
			editingPersonId = id;
		}
	}
</script>

<div class="mb-6">
	<a
		href="/admin/teams"
		class="mb-4 inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-slate-600"
	>
		<ArrowLeft size={12} /> Back to Teams
	</a>

	{#if isHeaderEditing}
		<form
			method="POST"
			action="?/updateTeam"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					isHeaderEditing = false;
				};
			}}
			class="rounded-xl border border-blue-100 bg-blue-50 p-4 transition-all"
		>
			<div class="mb-3">
				<label for="team_name" class="mb-1 block text-xs font-bold text-blue-800 uppercase"
					>Team Name</label
				>
				<input
					id="team_name"
					type="text"
					name="name"
					value={team.name}
					class="w-full rounded-lg border-blue-200 px-3 py-2 text-lg font-bold text-slate-900 focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>
			<div class="mb-4">
				<label for="team_desc" class="mb-1 block text-xs font-bold text-blue-800 uppercase"
					>Description</label
				>
				<input
					id="team_desc"
					type="text"
					name="description"
					value={team.description || ''}
					class="w-full rounded-lg border-blue-200 px-3 py-2 text-sm text-slate-600 focus:border-blue-500 focus:ring-blue-500"
				/>
			</div>
			<div class="flex gap-2">
				<button
					type="submit"
					class="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
				>
					<Check size={14} /> Save Changes
				</button>
				<button
					type="button"
					onclick={() => (isHeaderEditing = false)}
					class="flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50"
				>
					<X size={14} /> Cancel
				</button>
			</div>
		</form>
	{:else}
		<div class="group flex items-start justify-between">
			<div>
				<h1 class="flex items-center gap-3 text-3xl font-bold text-slate-900">
					{team.name}
					<button
						onclick={() => (isHeaderEditing = true)}
						class="rounded-full bg-slate-100 p-1.5 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-blue-600"
						title="Edit Team Details"
						aria-label="Edit Team Details"
					>
						<Pencil size={14} />
					</button>
				</h1>
				<p class="mt-1 text-slate-500">{team.description || 'No description provided'}</p>
			</div>
		</div>
	{/if}
</div>

<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
	<div class="space-y-4 lg:col-span-2">
		<h3 class="text-sm font-bold tracking-wider text-slate-500 uppercase">
			Current Roster ({roster.length})
		</h3>

		<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
			{#if roster.length === 0}
				<div class="p-8 text-center text-slate-400 italic">No members yet. Add someone!</div>
			{:else}
				<div class="divide-y divide-slate-100">
					{#each roster as entry}
						{@const isEditing = editingPersonId === entry.person.id}

						<div class="p-4 transition-colors {isEditing ? 'bg-slate-50' : ''}">
							<div class="flex items-start justify-between">
								<div class="flex gap-3">
									<div
										class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-600"
									>
										{entry.person.first_name[0]}
									</div>
									<div>
										<div class="font-bold text-slate-900">
											{entry.person.first_name}
											{entry.person.last_name}
										</div>

										<div class="mt-1 flex flex-wrap gap-2">
											{#each entry.roles as role}
												<div
													class="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 shadow-sm"
												>
													<Shield size={10} class="mr-1.5 text-slate-400" />
													{role.role}

													{#if isEditing}
														<form
															method="POST"
															action="?/removeMember"
															use:enhance
															class="ml-2 border-l border-slate-100 pl-2"
														>
															<input type="hidden" name="membership_id" value={role.id} />
															<button
																class="text-red-400 hover:text-red-600"
																title="Remove Role"
																aria-label="Remove Role"
															>
																<X size={12} />
															</button>
														</form>
													{/if}
												</div>
											{/each}
										</div>
									</div>
								</div>

								<button
									onclick={() => toggleEditPerson(entry.person.id)}
									class="text-xs font-medium text-slate-400 hover:text-blue-600"
								>
									{isEditing ? 'Done' : 'Edit'}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<div class="space-y-4">
		<div class="sticky top-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
			<h3 class="mb-3 text-xs font-bold tracking-wider text-slate-500 uppercase">
				Add Member / Role
			</h3>
			<form method="POST" action="?/addMember" use:enhance class="space-y-3">
				<div>
					<label for="person_id" class="mb-1 block text-xs font-bold text-slate-500 uppercase"
						>Person</label
					>
					<select
						id="person_id"
						name="person_id"
						bind:value={selectedPersonId}
						class="w-full rounded-lg border-slate-300 bg-white p-2.5 text-sm"
						required
					>
						<option value="" disabled selected>Select a person...</option>
						{#each availablePeople as p}
							<option value={p.id}>{p.first_name} {p.last_name}</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="role" class="mb-1 block text-xs font-bold text-slate-500 uppercase"
						>Role</label
					>
					<input
						id="role"
						type="text"
						name="role"
						placeholder="e.g. Guitar"
						class="w-full rounded-lg border-slate-300 p-2.5 text-sm"
					/>
				</div>

				<button
					disabled={!selectedPersonId}
					class="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<UserPlus size={16} /> Add to Team
				</button>
			</form>
		</div>
	</div>
</div>
