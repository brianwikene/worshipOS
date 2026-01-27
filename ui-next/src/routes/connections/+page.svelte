<script lang="ts">
	import { enhance } from '$app/forms';
	// CHANGED: Loader2 -> LoaderCircle
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import { LoaderCircle, Mail, Plus, Search, User, Users } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let people = $derived(data.people);
	let searchQuery = $state('');

	let isAddPersonOpen = $state(false);
	let isSubmitting = $state(false);

	// CHANGED: Added type definition for 'p'
	let filteredPeople = $derived(
		people.filter((p: (typeof people)[number]) => {
			const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
			return fullName.includes(searchQuery.toLowerCase());
		})
	);

	$effect(() => {
		if (form?.success) {
			isAddPersonOpen = false;
			isSubmitting = false;
		}
	});
</script>

<div class="bg-meadow-50/30 min-h-screen pb-20">
	<div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
		<div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
			<div>
				<h1 class="text-meadow-950 text-2xl font-bold">Connections</h1>
				<p class="text-meadow-900/60 text-sm">People, households, teams, and serving.</p>
			</div>

			<button
				onclick={() => (isAddPersonOpen = true)}
				class="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800"
			>
				<Plus size={16} />
				Add Person
			</button>
		</div>

		{#if people.length > 0}
			<div class="relative mb-6">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
					<Search size={18} class="text-meadow-400" />
				</div>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search by name..."
					class="border-meadow-200 placeholder-meadow-400/70 focus:border-meadow-500 focus:ring-meadow-500/20 block w-full rounded-lg border bg-white py-2 pr-3 pl-10 leading-5 shadow-sm transition duration-150 ease-in-out focus:ring-2 focus:outline-none sm:text-sm"
				/>
			</div>
		{/if}

		{#if people.length === 0}
			<div
				class="border-meadow-200 bg-meadow-50/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-24 text-center"
			>
				<div class="ring-meadow-100 mb-4 rounded-full bg-white p-3 shadow-sm ring-1">
					<User size={24} class="text-meadow-400" />
				</div>
				<h3 class="text-meadow-900 text-lg font-medium">Everyone starts somewhere.</h3>
				<p class="text-meadow-800/70 mt-1 max-w-sm text-sm">
					This is where people become known over time. You can add someone with just a name.
				</p>
				<button
					onclick={() => (isAddPersonOpen = true)}
					class="text-meadow-700 hover:text-meadow-900 mt-6 text-sm font-medium hover:underline"
				>
					Add your first person &rarr;
				</button>
			</div>
		{:else if filteredPeople.length === 0}
			<div class="py-12 text-center">
				<p class="text-meadow-800/60 text-sm">No one found matching "{searchQuery}"</p>
				<button
					class="text-meadow-700 hover:text-meadow-900 mt-2 text-xs hover:underline"
					onclick={() => (searchQuery = '')}
				>
					Clear search
				</button>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each filteredPeople as person}
					<a
						href="/connections/{person.id}"
						class="group border-meadow-100 hover:border-meadow-300 hover:shadow-meadow-900/5 rounded-xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md"
					>
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-4">
								<div
									class="bg-meadow-50 text-meadow-700 group-hover:bg-meadow-100 group-hover:text-meadow-900 flex h-12 w-12 items-center justify-center
									rounded-full text-lg font-bold transition-colors"
								>
									{person.first_name[0]}{person.last_name[0]}
								</div>
								<div>
									<h3
										class="group-hover:text-meadow-900 text-base font-bold text-gray-900 transition-colors"
									>
										{person.first_name}
										{person.last_name}
									</h3>
									{#if person.family}
										<p
											class="group-hover:text-meadow-700/80 mt-0.5 flex items-center gap-1 text-xs text-gray-500"
										>
											<Users size={10} />
											{person.family.name}
										</p>
									{/if}
								</div>
							</div>
						</div>

						<div class="border-meadow-50 mt-4 flex flex-col gap-2 border-t pt-4">
							{#if person.email}
								<div
									class="flex items-center gap-2 truncate text-xs text-gray-500 group-hover:text-gray-600"
								>
									<Mail size={12} class="group-hover:text-meadow-500 shrink-0 text-gray-400" />
									{person.email}
								</div>
							{/if}
							{#if person.teamMemberships.length > 0}
								<div class="mt-1 flex flex-wrap gap-1">
									{#each person.teamMemberships.slice(0, 2) as m}
										<span
											class="bg-meadow-50 text-meadow-700 border-meadow-100 inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium"
										>
											{m.team.name}
										</span>
									{/each}
									{#if person.teamMemberships.length > 2}
										<span
											class="inline-flex items-center rounded border border-gray-100 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600"
										>
											+{person.teamMemberships.length - 2}
										</span>
									{/if}
								</div>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>

<Drawer bind:open={isAddPersonOpen} title="Add a person">
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				await update();
				isSubmitting = false;
			};
		}}
		class="flex h-full flex-col gap-6"
	>
		<div class="bg-meadow-50 border-meadow-100 rounded-md border p-4">
			<p class="text-meadow-800 text-sm">
				You can add someone with just a name. We don't need full data to start caring for them.
			</p>
		</div>

		<div class="space-y-4">
			<div>
				<label for="first_name" class="block text-sm font-medium text-gray-700">First Name</label>
				<input
					type="text"
					name="first_name"
					id="first_name"
					required
					class="focus:border-meadow-500 focus:ring-meadow-500 mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
				/>
			</div>

			<div>
				<label for="last_name" class="block text-sm font-medium text-gray-700">Last Name</label>
				<input
					type="text"
					name="last_name"
					id="last_name"
					required
					class="focus:border-meadow-500 focus:ring-meadow-500 mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
				/>
			</div>

			<div class="border-t border-gray-100 pt-4">
				<h4 class="mb-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
					Optional Contact Info
				</h4>

				<div class="space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
						<input
							type="email"
							name="email"
							id="email"
							class="focus:border-meadow-500 focus:ring-meadow-500 mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
						/>
					</div>

					<div>
						<label for="phone" class="block text-sm font-medium text-gray-700">Phone</label>
						<input
							type="tel"
							name="phone"
							id="phone"
							class="focus:border-meadow-500 focus:ring-meadow-500 mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
						/>
					</div>
				</div>
			</div>
		</div>

		<div class="mt-auto pt-6">
			<button
				type="submit"
				disabled={isSubmitting}
				class="flex w-full justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
			>
				{#if isSubmitting}
					<LoaderCircle class="mr-2 animate-spin" size={16} />
					Saving...
				{:else}
					Create Person
				{/if}
			</button>
		</div>
	</form>
</Drawer>
