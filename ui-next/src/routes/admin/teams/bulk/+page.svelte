<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowRight, Check, List, Type } from '@lucide/svelte';
	import { slide } from 'svelte/transition';

	// State
	let rawInput = $state('');
	let preview = $state<any[]>([]);
	let isSubmitting = $state(false);
	let result = $props(); // Form result

	// The Parser Logic
	// Format expected: "Team Name: Role 1, Role 2, Role 3"
	function parseInput() {
		if (!rawInput.trim()) {
			preview = [];
			return;
		}

		preview = rawInput
			.split('\n')
			.filter((line) => line.trim().length > 0)
			.map((line) => {
				// Split "Worship: Vocal, Keys" into ["Worship", " Vocal, Keys"]
				const parts = line.split(':');
				const name = parts[0].trim();
				const rolesRaw = parts[1] || '';

				// Clean up roles
				const roles = rolesRaw
					.split(',')
					.map((r) => r.trim())
					.filter((r) => r.length > 0);

				return { name, roles };
			});
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-slate-900">Bulk Team Creator</h1>
			<p class="text-slate-500">Paste your team list to create structure instantly.</p>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
		<div class="space-y-4">
			<div class="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
				<p class="mb-2 flex items-center gap-2 font-bold">
					<Type size={14} /> Format Guide
				</p>
				<p class="mb-2 opacity-80">Enter one team per line. Optionally add roles after a colon.</p>
				<div class="rounded bg-white/60 p-3 font-mono text-xs shadow-sm">
					<span class="font-bold text-slate-700">Worship Team</span>: Vocalist, Guitar, Keys<br />
					<span class="font-bold text-slate-700">Welcome Team</span>: Greeter, Usher, Parking<br />
					<span class="font-bold text-slate-700">Kids Ministry</span>
				</div>
			</div>

			<div class="relative">
				<textarea
					bind:value={rawInput}
					oninput={parseInput}
					placeholder="Paste your list here..."
					class="h-96 w-full rounded-xl border-slate-300 bg-white p-4 font-mono text-sm leading-relaxed shadow-sm focus:border-pink-500 focus:ring-pink-500"
				></textarea>
				<div
					class="pointer-events-none absolute right-4 bottom-4 text-xs font-bold tracking-wider text-slate-300 uppercase"
				>
					Input Editor
				</div>
			</div>
		</div>

		<div class="flex flex-col rounded-xl border border-slate-200 bg-slate-50/50">
			<div
				class="flex items-center justify-between rounded-t-xl border-b border-slate-200 bg-white px-6 py-4"
			>
				<h3
					class="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-500 uppercase"
				>
					<List size={14} />
					Preview
					{#if preview.length > 0}
						<span class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-900"
							>{preview.length}</span
						>
					{/if}
				</h3>
			</div>

			<div class="max-h-[500px] flex-1 overflow-y-auto p-6">
				{#if preview.length > 0}
					<div class="space-y-3" transition:slide>
						{#each preview as item}
							<div
								class="flex items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
							>
								<div
									class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-pink-50 font-bold text-pink-600"
								>
									{item.name[0]}
								</div>
								<div>
									<div class="font-bold text-slate-900">{item.name}</div>
									{#if item.roles.length > 0}
										<div class="mt-2 flex flex-wrap gap-1.5">
											{#each item.roles as role}
												<span
													class="inline-flex items-center rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-slate-600 uppercase"
												>
													{role}
												</span>
											{/each}
										</div>
									{:else}
										<div class="mt-1 flex items-center gap-1 text-xs text-slate-400 italic">
											No specific roles defined
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="flex h-full flex-col items-center justify-center text-center text-slate-400">
						<ArrowRight size={32} class="mb-2 opacity-20" />
						<p class="text-sm">Start typing to see the magic...</p>
					</div>
				{/if}
			</div>

			<div class="rounded-b-xl border-t border-slate-200 bg-white p-4">
				<form
					method="POST"
					action="?/bulkCreateTeams"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
							isSubmitting = false;
							rawInput = ''; // Clear on success
							preview = [];
						};
					}}
				>
					<input type="hidden" name="json_data" value={JSON.stringify(preview)} />
					<button
						disabled={preview.length === 0 || isSubmitting}
						class="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 text-sm font-bold text-white shadow-md transition-all hover:scale-[1.01] hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<span class="animate-pulse">Creating...</span>
						{:else}
							<Check size={16} />
							Create {preview.length} Teams
						{/if}
					</button>
				</form>
			</div>
		</div>
	</div>
</div>
