<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		Building2,
		Crown,
		MapPin,
		Plus,
		Save,
		Shield,
		Trash2,
		User,
		UserMinus
	} from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let isAddingCampus = $state(false);
	let isAddingStaff = $state(false);
</script>

<div class="mb-8">
	<h1 class="text-2xl font-bold text-slate-900">System Settings</h1>
	<p class="text-slate-500">Manage church details, campuses, and staff permissions.</p>
</div>

<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
	<div class="space-y-8">
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<div class="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4">
				<div class="rounded-lg bg-slate-100 p-2 text-slate-600">
					<Building2 size={20} />
				</div>
				<div>
					<h2 class="text-sm font-bold tracking-wider text-slate-900 uppercase">
						Organization Profile
					</h2>
					<p class="text-xs text-slate-500">How your church appears across the system</p>
				</div>
			</div>

			<form method="POST" action="?/updateChurch" use:enhance class="space-y-4">
				<div>
					<label for="c_name" class="mb-1 block text-xs font-bold text-slate-500 uppercase"
						>Church Name</label
					>
					<input
						id="c_name"
						type="text"
						name="name"
						value={data.churchData.name}
						class="w-full rounded-lg border-slate-300 shadow-sm focus:border-pink-500 focus:ring-pink-500"
					/>
				</div>
				<button
					class="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800"
				>
					<Save size={16} /> Save Changes
				</button>
			</form>
		</div>

		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<div class="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
				<div class="flex items-center gap-2">
					<div class="rounded-lg bg-slate-100 p-2 text-slate-600">
						<MapPin size={20} />
					</div>
					<div>
						<h2 class="text-sm font-bold tracking-wider text-slate-900 uppercase">Campuses</h2>
						<p class="text-xs text-slate-500">Physical locations for services</p>
					</div>
				</div>
				<button
					onclick={() => (isAddingCampus = !isAddingCampus)}
					class="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
				>
					<Plus size={16} />
				</button>
			</div>

			<div class="space-y-3">
				{#each data.campuses as campus}
					<div
						class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3"
					>
						<div>
							<div class="font-bold text-slate-900">{campus.name}</div>
							<div class="text-xs text-slate-500">{campus.location || 'No address set'}</div>
						</div>
						<form method="POST" action="?/deleteCampus" use:enhance>
							<input type="hidden" name="id" value={campus.id} />
							<button class="p-2 text-slate-300 hover:text-red-500" title="Delete Campus">
								<Trash2 size={16} />
							</button>
						</form>
					</div>
				{/each}

				{#if isAddingCampus}
					<form
						method="POST"
						action="?/createCampus"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								isAddingCampus = false;
							};
						}}
						class="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 p-4"
					>
						<div class="space-y-3">
							<input
								type="text"
								name="name"
								placeholder="Campus Name (e.g. North Campus)"
								class="w-full rounded-md border-slate-300 text-sm"
								required
							/>
							<input
								type="text"
								name="location"
								placeholder="Address / Location string"
								class="w-full rounded-md border-slate-300 text-sm"
							/>
							<div class="flex justify-end gap-2">
								<button
									type="button"
									onclick={() => (isAddingCampus = false)}
									class="px-3 py-1 text-xs font-bold text-slate-500">Cancel</button
								>
								<button class="rounded bg-slate-900 px-3 py-1 text-xs font-bold text-white"
									>Create</button
								>
							</div>
						</div>
					</form>
				{/if}

				{#if data.campuses.length === 0 && !isAddingCampus}
					<div class="py-4 text-center text-sm text-slate-400 italic">
						No campuses defined. Add your first location!
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="h-fit rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
			<div class="flex items-center gap-2">
				<div class="rounded-lg bg-slate-100 p-2 text-slate-600">
					<Shield size={20} />
				</div>
				<div>
					<h2 class="text-sm font-bold tracking-wider text-slate-900 uppercase">
						Staff & Leadership
					</h2>
					<p class="text-xs text-slate-500">Admins and Pastors</p>
				</div>
			</div>
			<button
				onclick={() => (isAddingStaff = !isAddingStaff)}
				class="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
			>
				<Plus size={16} />
			</button>
		</div>

		<div class="space-y-4">
			{#each data.staff as person}
				<div
					class="flex items-center justify-between rounded-lg border border-slate-100 p-3 shadow-sm"
				>
					<div class="flex items-center gap-3">
						<div
							class="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-500"
						>
							{person.first_name[0]}{person.last_name[0]}
						</div>
						<div>
							<div class="font-bold text-slate-900">{person.first_name} {person.last_name}</div>
							<div
								class="flex items-center gap-1 text-xs font-medium tracking-wide text-pink-600 uppercase"
							>
								{#if person.role === 'admin'}
									<Crown size={12} /> Admin
								{:else}
									<User size={12} /> Pastor
								{/if}
							</div>
						</div>
					</div>

					<form method="POST" action="?/demoteStaff" use:enhance>
						<input type="hidden" name="person_id" value={person.id} />
						<button
							class="rounded p-2 text-slate-300 hover:bg-slate-50 hover:text-red-500"
							title="Remove from Staff"
						>
							<UserMinus size={16} />
						</button>
					</form>
				</div>
			{/each}

			{#if isAddingStaff}
				<form
					method="POST"
					action="?/promoteStaff"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							isAddingStaff = false;
						};
					}}
					class="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4"
				>
					<h3 class="mb-3 text-xs font-bold text-blue-800 uppercase">Promote User</h3>
					<div class="space-y-3">
						<select name="person_id" class="w-full rounded-md border-blue-200 text-sm" required>
							<option value="" disabled selected>Select person...</option>
							{#each data.potentialStaff as p}
								<option value={p.id}>{p.first_name} {p.last_name}</option>
							{/each}
						</select>

						<select name="role" class="w-full rounded-md border-blue-200 text-sm" required>
							<option value="pastor">Pastor</option>
							<option value="admin">Admin (Full Access)</option>
						</select>

						<div class="flex justify-end gap-2">
							<button
								type="button"
								onclick={() => (isAddingStaff = false)}
								class="px-3 py-1 text-xs font-bold text-blue-400">Cancel</button
							>
							<button class="rounded bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-sm"
								>Promote</button
							>
						</div>
					</div>
				</form>
			{/if}
		</div>
	</div>
</div>
