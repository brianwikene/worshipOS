<script lang="ts">
	import { enhance } from '$app/forms';
	import Drawer from '$lib/components/ui/Drawer.svelte';
	import { Info, LoaderCircle, Shield } from '@lucide/svelte';
	import type { ActionData, PageData } from './$types';

	type Person = PageData['person'];

	let {
		open = $bindable(false),
		person,
		form
	} = $props<{
		open: boolean;
		person: Person;
		form: ActionData;
	}>();
	let isSubmitting = $state(false);
	let formError = $state<string | null>(null);

	// Derived errors and values for cleaner template
	let errors = $derived(form?.errors || {});
	let values = $derived(form?.values || {});

	$effect(() => {
		if (form?.success) {
			open = false;
			isSubmitting = false;
			formError = null;
		} else if (form?.error) {
			formError = form.message || (form.errors ? 'Please fix the errors below.' : 'An error occurred.');
			isSubmitting = false;
		}
	});
</script>

<Drawer bind:open title="Edit Profile">
	<form
		method="POST"
		action="?/updateProfile"
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
			<div class="rounded-md border border-red-200 bg-red-50 p-3" role="alert">
				<p class="text-sm font-medium text-red-800">{formError}</p>
			</div>
		{/if}

		<div class="space-y-4">
			<h4 class="text-xs font-bold tracking-wider text-gray-500 uppercase">Identity</h4>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="first_name" class="block text-sm font-medium text-gray-700">First Name</label>
					<input
						type="text"
						name="first_name"
						id="first_name"
						value={values.first_name ?? person.first_name}
						required
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm {errors.first_name
							? 'border-red-500'
							: ''}"
					/>
					{#if errors.first_name}
						<p class="mt-1 text-xs text-red-600">{errors.first_name}</p>
					{/if}
				</div>
				<div>
					<label for="last_name" class="block text-sm font-medium text-gray-700">Last Name</label>
					<input
						type="text"
						name="last_name"
						id="last_name"
						value={values.last_name ?? person.last_name}
						required
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm {errors.last_name
							? 'border-red-500'
							: ''}"
					/>
					{#if errors.last_name}
						<p class="mt-1 text-xs text-red-600">{errors.last_name}</p>
					{/if}
				</div>
			</div>

			<div>
				<label for="occupation" class="block text-sm font-medium text-gray-700">Occupation</label>
				<input
					type="text"
					name="occupation"
					id="occupation"
					value={values.occupation ?? person.occupation ?? ''}
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
				/>
			</div>
		</div>

		<hr class="border-gray-100" />

		<div class="space-y-4">
			<h4 class="text-xs font-bold tracking-wider text-gray-500 uppercase">Contact</h4>
			<div>
				<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
				<input
					type="email"
					name="email"
					id="email"
					value={values.email ?? person.email ?? ''}
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
				/>
			</div>
			<div>
				<label for="phone" class="block text-sm font-medium text-gray-700">Phone</label>
				<input
					type="tel"
					name="phone"
					id="phone"
					value={values.phone ?? person.phone ?? ''}
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
				/>
			</div>
		</div>

		<hr class="border-gray-100" />

		<div class="space-y-4">
			<h4 class="text-xs font-bold tracking-wider text-gray-500 uppercase">Pastoral Context</h4>
			<div>
				<label for="bio" class="block text-sm font-medium text-gray-700">Bio / Story</label>
				<textarea
					name="bio"
					id="bio"
					rows="3"
					class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					placeholder="Brief context about who they are...">{values.bio ?? person.bio ?? ''}</textarea
				>
			</div>
		</div>

		<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
			<div class="mb-2 flex items-center gap-2 text-blue-800">
				<Shield size={16} />
				<h4 class="text-sm font-bold uppercase">Protect this Season</h4>
			</div>

			<label for="capacity_note" class="mb-2 block text-xs text-blue-700">
				Add a short note to activate the <span class="font-bold">Season Shield</span>. Use this when
				someone needs margin or care—sabbaticals, grief, new babies, or demanding seasons.
			</label>

			<textarea
				name="capacity_note"
				id="capacity_note"
				rows="2"
				class="block w-full rounded-md border-blue-200 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
				placeholder="e.g. 'Stepping back for family leave.'">{values.capacity_note ?? person.capacity_note ?? ''}</textarea
			>

			<div class="mt-2 flex items-start gap-1.5 text-[10px] text-blue-600/80">
				<Info size={12} class="mt-0.5 shrink-0" />
				<p>Leaving this blank means they are in a "Standard" context.</p>
			</div>
		</div>

		<div class="mt-auto pt-4">
			<button
				type="submit"
				disabled={isSubmitting}
				class="flex w-full justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
			>
				{#if isSubmitting}
					<LoaderCircle class="mr-2 animate-spin" size={16} />
					Saving...
				{:else}
					Save Changes
				{/if}
			</button>
		</div>
	</form>
</Drawer>
