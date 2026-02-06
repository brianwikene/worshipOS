<script lang="ts">
	import { enhance } from '$app/forms';
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import {
		ChevronDown,
		ChevronUp,
		LayoutGrid,
		List,
		LoaderCircle,
		Mail,
		Plus,
		Search,
		User,
		Users
	} from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let connections = $derived((data.connections || []) as any[]);

	let searchQuery = $state('');
	let viewMode = $state<'card' | 'table'>('card');
	let sortColumn = $state('last_name');
	let sortDirection = $state<'asc' | 'desc'>('asc');
	let isAddPersonOpen = $state(false);
	let isSubmitting = $state(false);
	let formError = $state<string | null>(null);

	function toggleSort(column: string) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	function getPrimaryAddress(person: any): { city: string; zip: string } | null {
		// Person's primary address first
		if (person.personalAddresses?.length) {
			const primary = person.personalAddresses.find((a: any) => a.is_primary) || person.personalAddresses[0];
			if (primary?.city || primary?.zip) return { city: primary.city || '', zip: primary.zip || '' };
		}
		// Family address fallback
		if (person.family?.addresses?.length) {
			const primary = person.family.addresses.find((a: any) => a.is_primary) || person.family.addresses[0];
			if (primary?.city || primary?.zip) return { city: primary.city || '', zip: primary.zip || '' };
		}
		return null;
	}

	function buildSearchString(p: any): string {
		const parts = [
			p.first_name,
			p.last_name,
			p.email,
			p.phone,
			p.family?.name
		];
		// Add address info
		if (p.personalAddresses) {
			for (const addr of p.personalAddresses) {
				parts.push(addr.street, addr.city, addr.zip);
			}
		}
		if (p.family?.addresses) {
			for (const addr of p.family.addresses) {
				parts.push(addr.street, addr.city, addr.zip);
			}
		}
		return parts.filter(Boolean).join(' ').toLowerCase();
	}

	let filteredPeople = $derived(
		connections.filter((p: any) => {
			if (!searchQuery) return true;
			return buildSearchString(p).includes(searchQuery.toLowerCase());
		})
	);

	let sortedPeople = $derived(
		[...filteredPeople].sort((a: any, b: any) => {
			let aVal = '';
			let bVal = '';
			if (sortColumn === 'first_name') {
				aVal = a.first_name?.toLowerCase() || '';
				bVal = b.first_name?.toLowerCase() || '';
			} else if (sortColumn === 'last_name') {
				aVal = a.last_name?.toLowerCase() || '';
				bVal = b.last_name?.toLowerCase() || '';
			} else if (sortColumn === 'email') {
				aVal = a.email?.toLowerCase() || '';
				bVal = b.email?.toLowerCase() || '';
			} else if (sortColumn === 'phone') {
				aVal = a.phone || '';
				bVal = b.phone || '';
			} else if (sortColumn === 'family') {
				aVal = a.family?.name?.toLowerCase() || '';
				bVal = b.family?.name?.toLowerCase() || '';
			} else if (sortColumn === 'city') {
				const aAddr = getPrimaryAddress(a);
				const bAddr = getPrimaryAddress(b);
				aVal = aAddr?.city?.toLowerCase() || '';
				bVal = bAddr?.city?.toLowerCase() || '';
			} else if (sortColumn === 'zip') {
				const aAddr = getPrimaryAddress(a);
				const bAddr = getPrimaryAddress(b);
				aVal = aAddr?.zip || '';
				bVal = bAddr?.zip || '';
			}
			if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		})
	);

	$effect(() => {
		if (form?.success) {
			isAddPersonOpen = false;
			isSubmitting = false;
			formError = null;
		} else if (form?.error) {
			formError =
				form.message || (form.errors ? 'Please fix the errors below.' : 'An error occurred.');
			isSubmitting = false;
		}
	});
</script>

<div class="min-h-screen bg-slate-50 pb-20">
	<div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
		<div class="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
			<div>
				<h1 class="text-2xl font-bold text-slate-900">Connections</h1>
				<p class="text-sm text-slate-500">People, households, teams, and serving.</p>
			</div>

			<button
				onclick={() => (isAddPersonOpen = true)}
				class="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
			>
				<Plus size={16} />
				Add Person
			</button>
		</div>

		{#if connections.length > 0}
			<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div class="relative flex-1">
					<label for="person-search" class="sr-only">Search people by name, email, phone, family, or address</label>
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
						<Search size={18} class="text-slate-400" />
					</div>
					<input
						id="person-search"
						type="text"
						bind:value={searchQuery}
						placeholder="Search by name, email, phone, family, address..."
						class="block w-full rounded-lg border border-slate-300 bg-white py-2 pr-3 pl-10 leading-5 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 focus:outline-none sm:text-sm"
					/>
				</div>

				<div class="flex rounded-lg border border-slate-200 bg-white shadow-sm" role="group" aria-label="View mode">
					<button
						type="button"
						onclick={() => (viewMode = 'card')}
						class="rounded-l-lg p-2 transition {viewMode === 'card' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}"
						aria-label="Card view"
					>
						<LayoutGrid size={18} />
					</button>
					<button
						type="button"
						onclick={() => (viewMode = 'table')}
						class="rounded-r-lg border-l border-slate-200 p-2 transition {viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}"
						aria-label="Table view"
					>
						<List size={18} />
					</button>
				</div>
			</div>
		{/if}

		{#if connections.length === 0}
			<div
				class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 py-24 text-center"
			>
				<div class="mb-4 rounded-full bg-white p-3 shadow-sm ring-1 ring-slate-200">
					<User size={24} class="text-slate-400" />
				</div>
				<h3 class="text-lg font-medium text-slate-900">Everyone starts somewhere.</h3>
				<p class="mt-1 max-w-sm text-sm text-slate-500">
					This is where people become known over time. You can add someone with just a name.
				</p>
				<button
					onclick={() => (isAddPersonOpen = true)}
					class="mt-6 text-sm font-medium text-emerald-600 hover:text-emerald-800 hover:underline"
				>
					Add your first person &rarr;
				</button>
			</div>
		{:else if sortedPeople.length === 0}
			<div class="py-12 text-center">
				<p class="text-sm text-slate-500">No one found matching "{searchQuery}"</p>
				<button
					class="mt-2 text-xs text-emerald-600 hover:text-emerald-800 hover:underline"
					onclick={() => (searchQuery = '')}
				>
					Clear search
				</button>
			</div>
		{:else if viewMode === 'card'}
			<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each sortedPeople as person}
					<a
						href="/connections/{person.id}"
						class="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-emerald-300 hover:shadow-md"
					>
						<div class="flex items-start justify-between">
							<div class="flex items-center gap-4">
								<div
									class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-lg font-bold text-slate-600 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-800"
								>
									{person.first_name[0]}{person.last_name[0]}
								</div>
								<div>
									<h3
										class="text-base font-bold text-slate-900 transition-colors group-hover:text-emerald-900"
									>
										{person.first_name}
										{person.last_name}
									</h3>
									{#if person.family}
										<p
											class="mt-0.5 flex items-center gap-1 text-xs text-slate-500 group-hover:text-emerald-700/80"
										>
											<Users size={10} />
											{person.family.name}
										</p>
									{/if}
								</div>
							</div>
						</div>

						<div class="mt-4 flex flex-col gap-2 border-t border-slate-50 pt-4">
							{#if person.email}
								<div
									class="flex items-center gap-2 truncate text-xs text-slate-500 group-hover:text-slate-600"
								>
									<Mail size={12} class="shrink-0 text-slate-400 group-hover:text-emerald-500" />
									{person.email}
								</div>
							{/if}

							{#if person.teamMemberships && person.teamMemberships.length > 0}
								<div class="mt-1 flex flex-wrap gap-1">
									{#each person.teamMemberships.slice(0, 2) as m}
										<span
											class="inline-flex items-center rounded border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700"
										>
											{m.team.name}
										</span>
									{/each}
									{#if person.teamMemberships.length > 2}
										<span
											class="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600"
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
		{:else}
			<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
				<table class="min-w-full divide-y divide-slate-200">
					<thead class="bg-slate-50">
						<tr>
							{#each [
								{ key: 'first_name', label: 'First Name' },
								{ key: 'last_name', label: 'Last Name' },
								{ key: 'email', label: 'Email' },
								{ key: 'phone', label: 'Phone' },
								{ key: 'family', label: 'Family' },
								{ key: 'city', label: 'City' },
								{ key: 'zip', label: 'Zip' }
							] as col}
								<th
									class="cursor-pointer px-4 py-3 text-left text-xs font-bold tracking-wide text-slate-500 uppercase select-none hover:text-slate-700"
								>
									<button type="button" class="flex items-center gap-1" onclick={() => toggleSort(col.key)}>
										{col.label}
										{#if sortColumn === col.key}
											{#if sortDirection === 'asc'}
												<ChevronUp size={14} />
											{:else}
												<ChevronDown size={14} />
											{/if}
										{/if}
									</button>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each sortedPeople as person}
							{@const addr = getPrimaryAddress(person)}
							<tr class="transition-colors hover:bg-slate-50">
								<td class="px-4 py-3">
									<a href="/connections/{person.id}" class="font-medium text-slate-900 hover:text-emerald-600">
										{person.first_name}
									</a>
								</td>
								<td class="px-4 py-3">
									<a href="/connections/{person.id}" class="font-medium text-slate-900 hover:text-emerald-600">
										{person.last_name}
									</a>
								</td>
								<td class="px-4 py-3 text-sm text-slate-500">{person.email || '-'}</td>
								<td class="px-4 py-3 text-sm text-slate-500">{person.phone || '-'}</td>
								<td class="px-4 py-3 text-sm text-slate-500">{person.family?.name || '-'}</td>
								<td class="px-4 py-3 text-sm text-slate-500">{addr?.city || '-'}</td>
								<td class="px-4 py-3 text-sm text-slate-500">{addr?.zip || '-'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
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
			formError = null;
			return async ({ update }) => {
				await update();
				isSubmitting = false;
			};
		}}
		class="flex h-full flex-col gap-6"
	>
		{#if formError}
			<div class="rounded-md border border-red-200 bg-red-50 p-4" role="alert">
				<p class="text-sm font-medium text-red-800">{formError}</p>
			</div>
		{/if}

		<div class="rounded-md border border-slate-200 bg-slate-50 p-4">
			<p class="text-sm text-slate-600">
				You can add someone with just a name. We don't need full data to start caring for them.
			</p>
		</div>

		<div class="space-y-4">
			<div>
				<label for="first_name" class="block text-sm font-medium text-slate-700">First Name</label>
				<input
					type="text"
					name="first_name"
					id="first_name"
					required
					class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
				/>
			</div>

			<div>
				<label for="last_name" class="block text-sm font-medium text-slate-700">Last Name</label>
				<input
					type="text"
					name="last_name"
					id="last_name"
					required
					class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
				/>
			</div>

			<div class="border-t border-slate-100 pt-4">
				<h4 class="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
					Optional Contact Info
				</h4>

				<div class="space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium text-slate-700">Email</label>
						<input
							type="email"
							name="email"
							id="email"
							class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
						/>
					</div>

					<div>
						<label for="phone" class="block text-sm font-medium text-slate-700">Phone</label>
						<input
							type="tel"
							name="phone"
							id="phone"
							class="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm"
						/>
					</div>
				</div>
			</div>
		</div>

		<div class="mt-auto pt-6">
			<button
				type="submit"
				disabled={isSubmitting}
				class="flex w-full justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
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
