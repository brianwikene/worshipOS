<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowLeft, Calendar, ChevronRight, Plus } from '@lucide/svelte';

	let { data } = $props();
	let showModal = $state(false);

	// FIX: Use $derived() to silence the warning and make it reactive
	// Added 'T00:00:00' to prevent timezone shifts (e.g. Feb 1 becoming Jan 31)
	let dateStr = $derived(
		new Date(data.gathering.date + 'T00:00:00').toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		})
	);
</script>

<div class="mx-auto max-w-4xl px-4 py-8">
	<a
		href="/gatherings"
		class="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-gray-900"
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
				Add Time
			</button>
		</div>
	</div>

	<h2 class="mb-4 text-sm font-bold tracking-wider text-gray-500 uppercase">Service Times</h2>

	<div class="grid gap-4">
		{#each data.gathering.instances as instance}
			<a
				href="/gatherings/{data.gathering.id}/instances/{instance.id}/order"
				class="group flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-blue-400 hover:shadow-md"
			>
				<div class="flex items-center gap-5">
					<div
						class="flex h-16 w-16 flex-col items-center justify-center rounded-lg border border-gray-100 bg-gray-50 transition-colors group-hover:border-blue-100 group-hover:bg-blue-50"
					>
						<span class="text-lg font-bold text-gray-900">
							{instance.start_time.slice(0, 5)}
						</span>
						<span class="text-[10px] font-medium text-gray-400 uppercase">Start</span>
					</div>

					<div>
						<h3 class="text-lg font-bold text-gray-900 group-hover:text-blue-700">
							{instance.name}
						</h3>
						<div class="mt-1 flex items-center gap-2">
							{#if instance.planItems.length === 0}
								<span
									class="flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-xs text-amber-600"
								>
									Empty Plan
								</span>
							{:else}
								<span
									class="flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-xs text-green-600"
								>
									{instance.planItems.length} Items
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
		{/each}
	</div>
</div>

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 h-full w-full cursor-default bg-gray-900/60 backdrop-blur-sm"
			aria-label="Close add service time modal"
			onclick={() => (showModal = false)}
		></button>

		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="add-service-time-title"
			class="relative z-10 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"
		>
			<h3 id="add-service-time-title" class="mb-4 text-lg font-bold text-gray-900">Add Service Time</h3>

			<form
				method="POST"
				action="?/addInstance"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
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
						value="Sunday Service"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
					/>
				</div>

				<div>
					<label for="time" class="mb-1 block text-xs font-bold text-gray-500 uppercase">Time</label
					>
					<input
						type="time"
						name="time"
						required
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
					/>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<button
						type="button"
						onclick={() => (showModal = false)}
						class="text-sm font-medium text-gray-500">Cancel</button
					>
					<button
						type="submit"
						class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
						>Add Time</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
