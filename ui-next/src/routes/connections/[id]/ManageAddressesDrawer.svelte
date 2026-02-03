<script lang="ts">
	import { enhance } from '$app/forms';
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import { Briefcase, Building, Home, MapPin, Plane, Trash2 } from '@lucide/svelte';

	let { open = $bindable(false), person } = $props<{
		open: boolean;
		person: any;
	}>();

	// State for the Form
	let isEditing = $state(false);
	let editData = $state<any>(null); // If null, we are adding new

	// Derived lists
	let personalAddresses = $derived(person.personalAddresses || []);
	let familyAddresses = $derived(person.family?.addresses || []);

	// Helper to get icon
	function getTypeIcon(type: string) {
		switch (type) {
			case 'work':
				return Briefcase;
			case 'vacation':
				return Plane;
			case 'business':
				return Building;
			default:
				return Home;
		}
	}

	function startEdit(addr: any = null) {
		editData = addr || {
			type: 'home',
			country: 'US',
			// Default logic: If they have a family, default to Family Address
			family_id: person.family?.id ?? null,
			person_id: person.family ? null : person.id
		};
		isEditing = true;
	}
</script>

<Drawer
	bind:open
	title={isEditing ? (editData.id ? 'Edit Address' : 'New Address') : 'Manage Addresses'}
>
	<div class="space-y-6 p-4">
		{#if isEditing}
			<form
				method="POST"
				action="?/saveAddress"
				use:enhance={() => {
					return async ({ result }) => {
						if (result.type === 'success') {
							isEditing = false;
							editData = null;
						}
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="address_id" value={editData.id ?? ''} />

				{#if person.family}
					<div class="grid grid-cols-2 gap-2 rounded-lg bg-stone-100 p-1">
						<label
							for="scope-family"
							class="flex cursor-pointer items-center justify-center gap-2 rounded-md p-2 transition-colors {editData.family_id
								? 'bg-white font-bold text-slate-900 shadow-sm'
								: 'text-stone-500'}"
						>
							<input
								type="radio"
								name="scope"
								id="scope-family"
								class="hidden"
								checked={!!editData.family_id}
								onchange={() => {
									editData.family_id = person.family.id;
									editData.person_id = null;
								}}
							/>
							<Home size={16} /> Family
						</label>
						<label
							for="scope-person"
							class="flex cursor-pointer items-center justify-center gap-2 rounded-md p-2 transition-colors {editData.person_id
								? 'bg-white font-bold text-slate-900 shadow-sm'
								: 'text-stone-500'}"
						>
							<input
								type="radio"
								name="scope"
								id="scope-person"
								class="hidden"
								checked={!!editData.person_id}
								onchange={() => {
									editData.person_id = person.id;
									editData.family_id = null;
								}}
							/>
							<Building size={16} /> Personal
						</label>
					</div>
					<input type="hidden" name="family_id" value={editData.family_id ?? ''} />
					<input type="hidden" name="person_id" value={editData.person_id ?? ''} />
				{:else}
					<input type="hidden" name="person_id" value={person.id} />
				{/if}

				<div class="grid grid-cols-2 gap-4">
					<div class="col-span-1">
						<label for="addr-type" class="block text-xs font-bold text-stone-500 uppercase"
							>Type</label
						>
						<select
							name="type"
							id="addr-type"
							class="mt-1 w-full rounded-md border-stone-300 text-sm"
							bind:value={editData.type}
						>
							<option value="home">Home</option>
							<option value="work">Work</option>
							<option value="mailing">Mailing</option>
							<option value="vacation">Vacation / Seasonal</option>
							<option value="school">School / College</option>
							<option value="other">Other</option>
						</select>
					</div>
					<div class="col-span-1">
						<label for="addr-company" class="block text-xs font-bold text-stone-500 uppercase"
							>Company (Opt)</label
						>
						<input
							type="text"
							name="company_name"
							id="addr-company"
							class="mt-1 w-full rounded-md border-stone-300 text-sm"
							bind:value={editData.company_name}
							placeholder="e.g. Office"
						/>
					</div>
				</div>

				<div>
					<label for="addr-street" class="block text-xs font-bold text-stone-500 uppercase"
						>Street</label
					>
					<input
						type="text"
						name="street"
						id="addr-street"
						required
						class="mt-1 w-full rounded-md border-stone-300 text-sm"
						bind:value={editData.street}
					/>
				</div>

				<div class="grid grid-cols-6 gap-2">
					<div class="col-span-3">
						<label for="addr-city" class="block text-xs font-bold text-stone-500 uppercase"
							>City</label
						>
						<input
							type="text"
							name="city"
							id="addr-city"
							class="mt-1 w-full rounded-md border-stone-300 text-sm"
							bind:value={editData.city}
						/>
					</div>
					<div class="col-span-1">
						<label for="addr-state" class="block text-xs font-bold text-stone-500 uppercase"
							>State</label
						>
						<input
							type="text"
							name="state"
							id="addr-state"
							class="mt-1 w-full rounded-md border-stone-300 text-sm"
							bind:value={editData.state}
						/>
					</div>
					<div class="col-span-2">
						<label for="addr-zip" class="block text-xs font-bold text-stone-500 uppercase"
							>Zip</label
						>
						<input
							type="text"
							name="zip"
							id="addr-zip"
							class="mt-1 w-full rounded-md border-stone-300 text-sm"
							bind:value={editData.zip}
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4 border-t border-stone-100 pt-2">
					<div>
						<label for="addr-start" class="block text-xs font-bold text-stone-400 uppercase"
							>Start Date (Opt)</label
						>
						<input
							type="date"
							name="start_date"
							id="addr-start"
							class="mt-1 w-full rounded-md border-stone-300 text-xs text-stone-600"
							value={editData.start_date
								? new Date(editData.start_date).toISOString().split('T')[0]
								: ''}
						/>
					</div>
					<div>
						<label for="addr-end" class="block text-xs font-bold text-stone-400 uppercase"
							>End Date (Opt)</label
						>
						<input
							type="date"
							name="end_date"
							id="addr-end"
							class="mt-1 w-full rounded-md border-stone-300 text-xs text-stone-600"
							value={editData.end_date
								? new Date(editData.end_date).toISOString().split('T')[0]
								: ''}
						/>
					</div>
				</div>

				<div class="flex items-center justify-end gap-2 border-t border-stone-200 pt-4">
					<button
						type="button"
						onclick={() => (isEditing = false)}
						class="px-3 py-2 text-sm font-bold text-stone-500 hover:text-stone-800">Cancel</button
					>
					<button
						type="submit"
						class="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
						>Save Address</button
					>
				</div>
			</form>
		{:else}
			<button
				onclick={() => startEdit()}
				class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 py-3 text-sm font-bold text-stone-500 hover:border-stone-400 hover:bg-stone-50"
			>
				<MapPin size={16} /> Add New Address
			</button>

			<div class="space-y-6">
				{#if personalAddresses.length > 0}
					<div>
						<h4 class="mb-2 text-xs font-bold text-stone-400 uppercase">Personal Addresses</h4>
						<div class="space-y-2">
							{#each personalAddresses as addr}
								{@const Icon = getTypeIcon(addr.type)}

								<div
									class="flex items-start justify-between rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
								>
									<div class="flex items-start gap-3">
										<div class="rounded bg-stone-100 p-2 text-stone-600">
											<Icon size={16} />
										</div>
										<div>
											<div class="flex items-center gap-2">
												<span class="text-sm font-bold text-slate-900 capitalize">{addr.type}</span>
												{#if addr.start_date}
													<span class="rounded bg-sky-100 px-1.5 text-[10px] text-sky-700"
														>Seasonal</span
													>
												{/if}
											</div>
											{#if addr.company_name}
												<div class="text-xs font-semibold text-stone-600">{addr.company_name}</div>
											{/if}
											<div class="mt-0.5 text-xs text-stone-500">
												{addr.street}<br />
												{addr.city}, {addr.state}
												{addr.zip}
											</div>
										</div>
									</div>
									<div class="flex flex-col gap-2">
										<button
											onclick={() => startEdit(addr)}
											class="text-xs font-bold text-blue-600 hover:underline">Edit</button
										>
										<form method="POST" action="?/deleteAddress" use:enhance>
											<input type="hidden" name="address_id" value={addr.id} />
											<button class="text-xs text-stone-400 hover:text-red-600">
												<Trash2 size={14} />
											</button>
										</form>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if familyAddresses.length > 0}
					<div>
						<h4 class="mb-2 text-xs font-bold text-stone-400 uppercase">Household Addresses</h4>
						<div class="space-y-2">
							{#each familyAddresses as addr}
								<div
									class="flex items-start justify-between rounded-lg border border-stone-200 bg-stone-50 p-3"
								>
									<div class="flex items-start gap-3">
										<div class="rounded border border-stone-200 bg-white p-2 text-stone-600">
											<Home size={16} />
										</div>
										<div>
											<div class="flex items-center gap-2">
												<span class="text-sm font-bold text-slate-800 capitalize">{addr.type}</span>
												<span class="text-[10px] tracking-wide text-stone-400 uppercase"
													>Shared</span
												>
											</div>
											<div class="mt-0.5 text-xs text-stone-500">
												{addr.street}<br />
												{addr.city}, {addr.state}
												{addr.zip}
											</div>
										</div>
									</div>

									<div class="flex flex-col items-end gap-2">
										<button
											onclick={() => startEdit(addr)}
											class="text-xs font-bold text-stone-500 hover:text-slate-900"
										>
											Edit
										</button>

										<form method="POST" action="?/deleteAddress" use:enhance>
											<input type="hidden" name="address_id" value={addr.id} />
											<button
												class="flex items-center gap-1 text-xs text-stone-400 hover:text-red-600"
												title="Delete this address"
											>
												<Trash2 size={14} />
											</button>
										</form>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</Drawer>
