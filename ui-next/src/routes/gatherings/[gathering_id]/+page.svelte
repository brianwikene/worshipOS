<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Calendar, ChevronRight, List, Music, Plus } from '@lucide/svelte';

	let { data } = $props();
	let showModal = $state(false);
	let submitting = $state(false);

	function asDate(v: unknown): Date {
		if (v instanceof Date) return v;
		if (typeof v === 'string' || typeof v === 'number') return new Date(v);
		return new Date(NaN);
	}

	let dateStr = $derived.by(() => {
		const d = asDate(data.gathering.date);
		if (Number.isNaN(d.getTime())) return 'Invalid Date';
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC'
		});
	});
</script>

<div class="mx-auto max-w-4xl px-4 py-8">
	<a
		href="/gatherings"
		class="mb-6 inline-flex items-center gap-2 text-sm text-stone-500 transition hover:text-stone-900"
	>
		<ArrowLeft size={16} />
		Back to Gatherings
	</a>

	<div class="mb-8 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
		<div class="flex flex-col justify-between gap-4 md:flex-row md:items-start">
			<div>
				<div
					class="mb-2 flex items-center gap-2 text-xs font-bold tracking-wide text-blue-600 uppercase"
				>
					<Calendar size={12} />
					{data.gathering.campus?.name}
				</div>
				<h1 class="text-3xl font-bold text-gray-900">{data.gathering.title}</h1>
				<p class="mt-2 text-xl font-light text-gray-500">{dateStr}</p>
			</div>

			<button
				type="button"
				onclick={() => (showModal = true)}
				class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-100"
			>
				<Plus size={18} />
				Add Plan
			</button>
		</div>
	</div>

	<h2 class="mb-4 text-sm font-bold tracking-wider text-gray-500 uppercase">Gathering Plans</h2>

	<div class="grid gap-4">
		{#each data.gathering.plans as plan}
			{@const gatheringId = data.gathering.id}
			<a
				href={`/gatherings/${gatheringId}/plans/${plan.id}/order`}
				class="group flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-blue-400 hover:shadow-md"
			>
				<div class="flex items-center gap-5">
					<div
						class="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-gray-100 bg-gray-50 transition-colors group-hover:border-blue-100 group-hover:bg-blue-50"
					>
						<span class="text-sm font-bold text-gray-900">{plan.title?.[0] ?? 'P'}</span>
						<span class="text-[10px] font-medium text-gray-400 uppercase">Plan</span>
					</div>

					<div>
						<h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-700">{plan.title}</h3>
						<div class="mt-1 flex items-center gap-2">
							{#if plan.items.length === 0}
								<span
									class="flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-xs text-amber-600"
								>
									Empty Plan
								</span>
							{:else}
								<span
									class="flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-xs text-green-600"
								>
									{plan.items.length} Items
								</span>
							{/if}
						</div>
					</div>
				</div>

				<div
					class="text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500"
				>
					<ChevronRight size={24} />
				</div>
			</a>
		{:else}
			<div
				class="rounded-xl border border-dashed border-gray-300 bg-white py-16 text-center shadow-sm"
			>
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50"
				>
					<List size={32} class="text-gray-300" />
				</div>
				<h3 class="text-lg font-bold text-gray-900">No plans yet</h3>
				<p class="mx-auto mt-2 max-w-xs text-gray-500">
					Add a plan to start building the order of service for this gathering.
				</p>
			</div>
		{/each}
	</div>

	<h2 class="mt-12 mb-4 text-sm font-bold tracking-wider text-gray-500 uppercase">Summary Views</h2>
	<div class="grid gap-4 sm:grid-cols-2">
		<a
			href={`/gatherings/${data.gathering.id}/order`}
			class="flex flex-col rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-stone-400 hover:shadow-md"
		>
			<div
				class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-600"
			>
				<List size={20} />
			</div>
			<h3 class="text-lg font-bold text-gray-900">Service Flow</h3>
			<p class="mt-1 text-sm text-gray-500">
				The complete order of service across all plans, start to finish.
			</p>
		</a>

		<a
			href={`/gatherings/${data.gathering.id}/rehearse`}
			class="flex flex-col rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-purple-400 hover:shadow-md"
		>
			<div
				class="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600"
			>
				<Music size={20} />
			</div>
			<h3 class="text-lg font-bold text-gray-900">Songs & Rehearsal</h3>
			<p class="mt-1 text-sm text-gray-500">
				Songs, keys, and setlist order at a glance for rehearsal prep.
			</p>
		</a>
	</div>
</div>

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-gray-900/60 backdrop-blur-sm"
			aria-label="Close add gathering plan modal"
			onclick={() => (showModal = false)}
		></button>

		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-gathering-plan-title"
			class="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
		>
			<h3 id="add-gathering-plan-title" class="mb-4 text-lg font-bold text-gray-900">
				Add Gathering Plan
			</h3>

			<form
				method="POST"
				action="?/addPlan"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
						showModal = false;
					};
				}}
				class="space-y-4"
			>
				<div>
					<label for="name" class="mb-1 block text-xs font-bold text-gray-500 uppercase">Name</label
					>
					<input
						type="text"
						name="name"
						id="name"
						value="Sunday Gathering"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<button
						type="button"
						onclick={() => (showModal = false)}
						disabled={submitting}
						class="text-sm font-medium text-gray-500 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={submitting}
						class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50"
					>
						{#if submitting}Adding…{:else}Add Plan{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
