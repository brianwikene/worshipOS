<script lang="ts">
	import { enhance } from '$app/forms';
	import { X } from '@lucide/svelte';
	import type { PageData } from './$types';

	type Person = PageData['person'];

	let { open = $bindable(), person } = $props<{
		open: boolean;
		person: Person;
	}>();

	let loading = $state(false);
	let formError = $state<string | null>(null);
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
					<h2 class="text-lg font-bold text-slate-900">Household Details</h2>
					<button
						type="button"
						onclick={() => (open = false)}
						class="text-stone-400 hover:text-slate-900"
					>
						<X size={20} />
					</button>
				</div>

				<form
					method="POST"
					action="?/updateHouseholdDetails"
					use:enhance={() => {
						loading = true;
						formError = null;
						return async ({ result, update }) => {
							await update();
							loading = false;
							if (result.type === 'success') {
								open = false;
							} else if (result.type === 'failure' && result.data?.error) {
								formError = result.data.error as string;
							}
						};
					}}
					class="flex-1 overflow-y-auto p-6"
				>
					{#if formError}
						<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
							<p class="text-sm font-medium text-red-800">{formError}</p>
						</div>
					{/if}

					<div class="space-y-6">
						<div class="rounded-lg border border-stone-100 bg-stone-50 p-4">
							<label
								for="family_name"
								class="block text-xs font-bold tracking-wide text-stone-400 uppercase"
							>
								Household Name
							</label>
							<div class="mt-1">
								<input
									type="text"
									name="family_name"
									id="family_name"
									value={person.family?.name ?? ''}
									class="block w-full rounded-md border-stone-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-sm placeholder:font-normal placeholder:text-stone-400 focus:border-stone-500 focus:ring-stone-500"
									placeholder="e.g. The Smith Family"
								/>
							</div>
							<p class="mt-2 text-xs text-stone-500 italic">
								Renaming this updates the household for all members.
							</p>
						</div>

						<div>
							<label for="household_role" class="block text-sm font-medium text-slate-700">
								Household Role (Optional)
							</label>
							<p class="text-xs text-stone-500 italic">
								Optional — clarifies how they relate to this Household
							</p>

							<p class="mb-2 text-xs text-stone-400">
								Examples: Parent, Child, Roommate, Caregiver.
							</p>
							<p class="mb-2 text-xs text-stone-400">Leave blank if no clarification is needed.</p>
							<input
								type="text"
								name="household_role"
								id="household_role"
								value={person.household_role ?? ''}
								placeholder="e.g. Exchange Student"
								class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-stone-500 focus:ring-stone-500 sm:text-sm"
							/>
						</div>

						<div
							class="flex items-start justify-between gap-4 rounded-lg border border-stone-200 p-4"
						>
							<div class="min-w-0">
								<label for="is_household_primary" class="block text-sm font-medium text-slate-900">
									Primary Contact
								</label>

								<p class="mt-1 text-xs text-stone-500">
									Marks this person as the main recipient for household mail and logistical updates.
								</p>

								<p class="mt-1 text-[11px] text-stone-400">
									<span class="font-medium text-stone-400">Note:</span>
									This does not imply decision-making authority.
								</p>
							</div>

							<input
								type="checkbox"
								name="is_household_primary"
								id="is_household_primary"
								checked={person.is_household_primary}
								class="mt-0.5 h-5 w-5 shrink-0 rounded border-stone-300 text-slate-900 focus:ring-slate-900"
							/>
						</div>
					</div>

					<div class="mt-8 flex justify-end gap-3 border-t border-stone-100 pt-6">
						<button
							type="button"
							onclick={() => (open = false)}
							class="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-slate-900"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={loading}
							class="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
						>
							{loading ? 'Saving...' : 'Save Details'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
