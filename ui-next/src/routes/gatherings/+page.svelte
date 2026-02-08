<!--  src/routes/gatherings/+page.svelte -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { Calendar, Layers, MapPin, Plus } from '@lucide/svelte';

	let { data } = $props();
	let showModal = $state(false);
	let isSeriesMode = $state(false);
	let submitting = $state(false);

	const gatherings = $derived(data?.gatherings ?? []);

	function asDate(v: unknown): Date {
		if (v instanceof Date) return v;
		if (typeof v === 'string' || typeof v === 'number') return new Date(v);
		return new Date(NaN);
	}

	function formatShortDate(v: unknown): string {
		const d = asDate(v);
		if (Number.isNaN(d.getTime())) return 'Invalid date';
		return d.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	}
</script>

<div class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
	<div class="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-gray-900">Gatherings</h1>
			<p class="mt-1 flex items-center gap-2 text-gray-500">
				<MapPin size={16} />
				{data.campus?.name || 'Main Campus'}
			</p>
		</div>

		<div class="flex gap-3">
			<a
				href="/gatherings/matrix"
				class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:bg-gray-50"
			>
				<Layers size={18} />
				Matrix View
			</a>
			<button
				type="button"
				onclick={() => (showModal = true)}
				class="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-gray-800 hover:shadow-xl"
			>
				<Plus size={18} />
				New Gathering
			</button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each gatherings as gathering}
			<div
				class="group block overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:border-blue-300 hover:shadow-md"
			>
				<a
					href="/gatherings/{gathering.id}"
					class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3 transition-colors hover:bg-gray-100"
				>
					<div class="flex items-center gap-2 font-medium text-gray-600">
						<Calendar size={16} />
						{formatShortDate(gathering.date)}
					</div>

					<span
						class="rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-green-600 uppercase"
						>Ready</span
					>
				</a>

				<div class="p-5">
					<h3 class="mb-1 text-lg font-bold text-gray-900">
						{gathering.title}
					</h3>

					<div class="mt-4 space-y-2">
						{#if gathering.plans && gathering.plans.length > 0}
							{#each gathering.plans as plan}
								{@const p = plan as any}
								<a
									href="/gatherings/{gathering.id}/plans/{p.id}/order"
									class="flex items-center justify-between rounded border border-gray-100 bg-gray-50 p-2 text-sm transition hover:border-blue-300 hover:bg-blue-50/50"
								>
									<span class="font-medium text-gray-700">
										{p.name || p.title || 'Service Plan'}
									</span>
									<span class="text-[10px] text-gray-400">View →</span>
								</a>
							{/each}
						{:else}
							<p class="text-sm text-gray-400 italic">No plans scheduled yet.</p>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>

	{#if gatherings.length === 0}
		<div
			class="mt-10 rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-20 text-center"
		>
			<h3 class="text-lg font-medium text-gray-900">No upcoming gatherings</h3>
			<p class="mt-1 text-gray-500">Click "New Gathering" to schedule your first service.</p>

			<button
				type="button"
				onclick={() => (showModal = true)}
				class="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-gray-800"
			>
				<Plus size={18} />
				Schedule First Gathering
			</button>
		</div>
	{/if}
</div>

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-gray-900/60 backdrop-blur-sm"
			onclick={() => (showModal = false)}
			aria-label="Close Modal"
		></button>

		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="schedule-gathering-title"
			class="relative z-10 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
				<h3 id="schedule-gathering-title" class="text-lg font-bold text-gray-900">
					Schedule Gathering
				</h3>
				<button
					type="button"
					onclick={() => (showModal = false)}
					class="text-gray-400 hover:text-gray-600"
					aria-label="Close"
				>
					✕
				</button>
			</div>

			<form
				method="POST"
				action="?/createGathering"
				use:enhance={() => {
					submitting = true;
					return async ({ result, update }) => {
						await update();
						submitting = false;
						if (result.type === 'success') showModal = false;
					};
				}}
			>
				<input type="hidden" name="campus_id" value={data.campus?.id} />

				<div class="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
					<input
						type="checkbox"
						name="is_series"
						id="is_series"
						bind:checked={isSeriesMode}
						class="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
					/>
					<label
						for="is_series"
						class="cursor-pointer text-sm font-medium text-blue-900 select-none"
					>
						Create as a Series (Multiple Weeks)
					</label>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="col-span-2 space-y-1">
						<label for="title" class="text-xs font-bold text-gray-500 uppercase">
							Title {isSeriesMode ? '(Series Name)' : ''}
						</label>
						<input
							type="text"
							name="title"
							required
							placeholder={isSeriesMode ? 'e.g. Book of Philippians' : 'e.g. Sunday Gathering'}
							class="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div class="space-y-1">
						<label for="start_date" class="text-xs font-bold text-gray-500 uppercase">
							Date {isSeriesMode ? '(Start)' : ''}
						</label>
						<input
							type="date"
							name="start_date"
							required
							class="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div class="space-y-1">
						<label for="time" class="text-xs font-bold text-gray-500 uppercase"
							>Gathering Time</label
						>
						<input
							type="time"
							name="time"
							value="10:00"
							required
							class="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>

				{#if isSeriesMode}
					<div
						class="animate-in fade-in slide-in-from-top-2 space-y-3 border-t border-gray-100 pt-2 duration-300"
					>
						<div class="space-y-1">
							<label for="week_count" class="text-xs font-bold text-gray-500 uppercase"
								>How many weeks?</label
							>
							<div class="flex items-center gap-4">
								<input
									type="range"
									name="week_count"
									min="2"
									max="12"
									value="4"
									oninput={(e) => {
										const disp = document.getElementById('week_disp');
										if (disp) disp.innerText = e.currentTarget.value + ' Weeks';
									}}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
								/>
								<span
									id="week_disp"
									class="min-w-[4rem] font-mono font-bold whitespace-nowrap text-blue-600"
								>
									4 Weeks
								</span>
							</div>
							<p class="text-xs text-gray-400">
								This will create a gathering for every 7 days starting from the date above.
							</p>
						</div>
					</div>
				{/if}

				<div class="flex justify-end gap-3 pt-4">
					<button
						type="button"
						onclick={() => (showModal = false)}
						disabled={submitting}
						class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={submitting}
						class="rounded-lg bg-gray-900 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
					>
						{#if submitting}
							Creating…
						{:else}
							{isSeriesMode ? 'Generate Series' : 'Create Gathering'}
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
