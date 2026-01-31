<script lang="ts">
	import { enhance } from '$app/forms';
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import { Check, LoaderCircle, MapPin, Search, Users } from '@lucide/svelte';
	import type { PageData } from './$types';

	type Family = PageData['allFamilies'][number];

	let { open = $bindable(false), allFamilies = [] } = $props<{
		open: boolean;
		allFamilies: Family[];
	}>();

	let activeTab = $state<'existing' | 'new'>('existing');
	let isSubmitting = $state(false);

	// Search State
	let searchQuery = $state('');
	let selectedFamilyId = $state<string | null>(null);

	// Derived search results
	let filteredFamilies = $derived(
		searchQuery.length < 2
			? []
			: allFamilies.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
	);
</script>

<Drawer bind:open title="Connect Household">
	<div class="mb-6 grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-1">
		<button
			onclick={() => (activeTab = 'existing')}
			class="rounded-md py-1.5 text-xs font-bold transition-all {activeTab === 'existing'
				? 'bg-white text-gray-900 shadow-sm'
				: 'text-gray-500 hover:text-gray-700'}"
		>
			Find Existing
		</button>
		<button
			onclick={() => (activeTab = 'new')}
			class="rounded-md py-1.5 text-xs font-bold transition-all {activeTab === 'new'
				? 'text-meadow-700 bg-white shadow-sm'
				: 'text-gray-500 hover:text-gray-700'}"
		>
			Create New
		</button>
	</div>

	{#if activeTab === 'existing'}
		<form
			method="POST"
			action="?/connectFamily"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					await update();
					isSubmitting = false;
					open = false;
				};
			}}
			class="flex h-full flex-col"
		>
			<div class="relative mb-4">
				<label for="family-search" class="sr-only">Search families by name</label>
				<Search class="absolute top-2.5 left-3 text-gray-400" size={16} />
				<input
					id="family-search"
					type="text"
					bind:value={searchQuery}
					placeholder="Search families (e.g. 'Wikene')..."
					class="focus:border-meadow-500 focus:ring-meadow-500 block w-full rounded-md border-gray-300 pl-9 shadow-sm sm:text-sm"
				/>
			</div>

			<div class="flex-1 space-y-2 overflow-y-auto">
				{#each filteredFamilies as family}
					<button
						type="button"
						onclick={() => (selectedFamilyId = family.id)}
						class="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all
						{selectedFamilyId === family.id
							? 'border-meadow-500 bg-meadow-50 ring-meadow-500 ring-1'
							: 'hover:border-meadow-300 border-gray-200 hover:bg-gray-50'}"
					>
						<div>
							<div class="font-bold text-gray-900">{family.name}</div>
							{#if family.address_city}
								<div class="flex items-center gap-1 text-xs text-gray-500">
									<MapPin size={10} />
									{family.address_city}
								</div>
							{/if}
						</div>
						{#if selectedFamilyId === family.id}
							<div
								class="bg-meadow-600 flex h-5 w-5 items-center justify-center rounded-full text-white"
							>
								<Check size={12} />
							</div>
						{/if}
					</button>
				{/each}

				{#if searchQuery.length > 1 && filteredFamilies.length === 0}
					<div class="py-8 text-center">
						<p class="text-sm text-gray-500">No families found.</p>
						<button
							type="button"
							onclick={() => (activeTab = 'new')}
							class="text-meadow-600 mt-2 text-xs font-bold hover:underline"
						>
							Create "{searchQuery}" as new?
						</button>
					</div>
				{/if}
			</div>

			<input type="hidden" name="family_id" value={selectedFamilyId || ''} />

			<div class="mt-4 border-t border-gray-100 pt-4">
				<button
					type="submit"
					disabled={!selectedFamilyId || isSubmitting}
					class="flex w-full justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
				>
					{#if isSubmitting}
						<LoaderCircle class="mr-2 animate-spin" size={16} /> Connecting...
					{:else}
						Connect Selected Family
					{/if}
				</button>
			</div>
		</form>
	{:else}
		<form
			method="POST"
			action="?/createFamily"
			use:enhance={() => {
				isSubmitting = true;
				return async ({ update }) => {
					await update();
					isSubmitting = false;
					open = false;
				};
			}}
			class="flex h-full flex-col gap-4"
		>
			<div class="bg-meadow-50 border-meadow-100 rounded-md border p-4">
				<div class="flex items-start gap-3">
					<div class="text-meadow-600 mt-0.5 rounded-full bg-white p-1.5 shadow-sm">
						<Users size={16} />
					</div>
					<div>
						<h4 class="text-meadow-900 text-sm font-bold">New Household</h4>
						<p class="text-meadow-800/70 text-xs">
							This creates a new family unit and automatically links this person to it.
						</p>
					</div>
				</div>
			</div>

			<div>
				<label for="name" class="block text-sm font-medium text-gray-700">Family Name</label>
				<input
					type="text"
					name="name"
					id="name"
					placeholder="e.g. The Wikene Family"
					value={searchQuery || ''}
					required
					class="focus:border-meadow-500 focus:ring-meadow-500 mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
				/>
			</div>

			<div>
				<label for="city" class="block text-sm font-medium text-gray-700">City (Optional)</label>
				<input
					type="text"
					name="city"
					id="city"
					placeholder="e.g. Seattle"
					class="focus:border-meadow-500 focus:ring-meadow-500 mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
				/>
			</div>

			<div class="mt-auto pt-6">
				<button
					type="submit"
					disabled={isSubmitting}
					class="flex w-full justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
				>
					{#if isSubmitting}
						<LoaderCircle class="mr-2 animate-spin" size={16} /> Creating...
					{:else}
						Create & Connect
					{/if}
				</button>
			</div>
		</form>
	{/if}
</Drawer>
