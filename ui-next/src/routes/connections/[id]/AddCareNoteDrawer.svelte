<script lang="ts">
	import { enhance } from '$app/forms';
	import { Lock, Send, X } from '@lucide/svelte';

	let { open = $bindable() } = $props<{ open: boolean }>();
	let loading = $state(false);
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
			<div class="flex h-full flex-col bg-amber-50/30">
				<div
					class="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-6 py-4"
				>
					<div class="flex items-center gap-2 text-amber-900">
						<Lock size={18} />
						<h2 class="text-lg font-bold">Add Care Note</h2>
					</div>
					<button onclick={() => (open = false)} class="text-amber-800/50 hover:text-amber-900">
						<X size={20} />
					</button>
				</div>

				<form
					method="POST"
					action="?/addCareNote"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update();
							loading = false;
							open = false;
						};
					}}
					class="flex-1 space-y-6 p-6"
				>
					<div>
						<label for="category" class="mb-1 block text-xs font-bold text-amber-800 uppercase"
							>Category</label
						>
						<select
							name="category"
							class="block w-full rounded-md border-amber-200 bg-white shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
						>
							<option value="General">General Check-in</option>
							<option value="Prayer">Prayer Request</option>
							<option value="Visitation">Visitation / Hospital</option>
							<option value="Crisis">Crisis / Urgent</option>
							<option value="Celebration">Celebration</option>
						</select>
					</div>

					<div>
						<label for="content" class="mb-1 block text-xs font-bold text-amber-800 uppercase"
							>Note Content</label
						>
						<textarea
							name="content"
							rows="6"
							required
							placeholder="Write your pastoral note here..."
							class="block w-full rounded-md border-amber-200 bg-white shadow-sm focus:border-amber-500 focus:ring-amber-500 sm:text-sm"
						></textarea>
						<p class="mt-2 text-xs text-amber-700/60 italic">
							* Only visible to Care Team and Admins. Not visible to the person.
						</p>
					</div>

					<div class="pt-4">
						<button
							type="submit"
							disabled={loading}
							class="flex w-full items-center justify-center gap-2 rounded-md bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
						>
							{#if loading}Saving...{:else}<Send size={16} /> Save Note{/if}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
