<script lang="ts">
	import { enhance } from '$app/forms';
	import { Plus, Trash2, X } from '@lucide/svelte';
	import type { PageData } from './$types';

	type Person = PageData['person'];

	let { open = $bindable(), person } = $props<{
		open: boolean;
		person: Person;
	}>();

	let loading = $state(false);
	let comfortLevel = $state(3); // Default to "Comfortable"
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
					<h2 class="text-lg font-bold text-slate-900">Manage Capabilities</h2>
					<button
						type="button"
						onclick={() => (open = false)}
						class="text-stone-400 hover:text-slate-900"
					>
						<X size={20} />
					</button>
				</div>

				<div class="flex-1 overflow-y-auto p-6">
					{#if formError}
						<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-3" role="alert">
							<p class="text-sm font-medium text-red-800">{formError}</p>
						</div>
					{/if}
					{#if person.capabilities.length > 0}
						<div class="mb-8 space-y-3">
							<h3 class="text-xs font-bold tracking-wide text-stone-400 uppercase">
								Current Skills
							</h3>
							{#each person.capabilities as cap}
								<div
									class="flex items-center justify-between rounded-lg border border-stone-100 bg-stone-50 p-3"
								>
									<div>
										<div class="text-sm font-bold text-slate-800">{cap.capability}</div>
										<div class="mt-1 flex gap-1">
											{#each Array(5) as _, i}
												<div
													class={`h-1.5 w-1.5 rounded-full ${i < (cap.rating || 0) ? 'bg-slate-400' : 'bg-stone-200'}`}
												></div>
											{/each}
										</div>
									</div>
									<form method="POST" action="?/removeCapability" use:enhance>
										<input type="hidden" name="capability_id" value={cap.id} />
										<button class="p-2 text-stone-400 transition-colors hover:text-red-600">
											<Trash2 size={16} />
										</button>
									</form>
								</div>
							{/each}
						</div>
					{/if}

					<div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
						<h3 class="mb-4 text-sm font-bold text-slate-900">Add New Capability</h3>

						<form
							method="POST"
							action="?/addCapability"
							use:enhance={() => {
								loading = true;
								formError = null;
								return async ({ result, update }) => {
									await update();
									loading = false;
									if (result.type === 'success') {
										comfortLevel = 3;
									} else if (result.type === 'failure' && result.data?.error) {
										formError = result.data.error as string;
									}
								};
							}}
							class="space-y-4"
						>
							<div>
								<label for="capability" class="block text-xs font-medium text-stone-500 uppercase"
									>Skill / Gift</label
								>
								<input
									type="text"
									name="capability"
									placeholder="e.g. Electric Guitar, Hospitality"
									required
									class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
								/>
							</div>

							<div>
								<div class="mb-2 block text-xs font-medium text-stone-500 uppercase">
									Comfort Level: <span class="font-bold text-slate-900"
										>{['Learning', 'Developing', 'Comfortable', 'Strong', 'Leading'][
											comfortLevel - 1
										]}</span
									>
								</div>
								<input type="hidden" name="rating" value={comfortLevel} />
								<div class="flex gap-2">
									{#each Array(5) as _, i}
										<button
											type="button"
											onclick={() => (comfortLevel = i + 1)}
											class={`h-8 w-8 rounded-full border transition-all ${
												i < comfortLevel
													? 'border-slate-800 bg-slate-800 text-white'
													: 'border-stone-200 bg-white hover:border-slate-300'
											}`}
										>
											{i + 1}
										</button>
									{/each}
								</div>
							</div>

							<div>
								<label for="notes" class="block text-xs font-medium text-stone-500 uppercase"
									>Notes (Optional)</label
								>
								<textarea
									name="notes"
									rows="2"
									placeholder="e.g. Owns a Gibson Les Paul, prefers rhythm."
									class="mt-1 block w-full rounded-md border-stone-300 shadow-sm focus:border-slate-500 focus:ring-slate-500 sm:text-sm"
								></textarea>
							</div>

							<button
								type="submit"
								disabled={loading}
								class="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
							>
								{#if loading}
									Saving...
								{:else}
									<Plus size={16} /> Add Capability
								{/if}
							</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
