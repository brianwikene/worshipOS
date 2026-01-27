<script lang="ts">
	import { enhance } from '$app/forms';
	import { Calendar, Layers, MapPin, Plus } from '@lucide/svelte';

	let { data } = $props();
	let showModal = $state(false);
	let isSeriesMode = $state(false); // Toggle for "Series" mode
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
				onclick={() => (showModal = true)}
				class="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-gray-800 hover:shadow-xl"
			>
				<Plus size={18} />
				New Gathering
			</button>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
		{#each data.gatherings as gathering}
			<a
				href="/gatherings/{gathering.id}"
				class="group block overflow-hidden rounded-xl border border-gray-200 bg-white transition-all hover:border-blue-300 hover:shadow-md"
			>
				<div
					class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3"
				>
					<div class="flex items-center gap-2 font-medium text-gray-600">
						<Calendar size={16} />
						{new Date(gathering.date).toLocaleDateString('en-US', {
							weekday: 'short',
							month: 'short',
							day: 'numeric'
						})}
					</div>
					{#if gathering.status === 'planning'}
						<span
							class="rounded-full border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-600 uppercase"
							>Planning</span
						>
					{:else}
						<span
							class="rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-[10px] font-bold tracking-wider text-green-600 uppercase"
							>Ready</span
						>
					{/if}
				</div>

				<div class="p-5">
					<h3
						class="mb-1 text-lg font-bold text-gray-900 transition-colors group-hover:text-blue-600"
					>
						{gathering.title}
					</h3>

					<div class="mt-4 space-y-2">
						{#if gathering.instances.length > 0}
							{#each gathering.instances as instance}
								<div
									class="flex items-center justify-between rounded border border-gray-100 bg-gray-50 p-2 text-sm transition group-hover:border-blue-100 group-hover:bg-blue-50/50"
								>
									<span class="font-mono font-medium text-gray-600"
										>{instance.start_time.slice(0, 5)}</span
									>
									<span class="text-gray-500">{instance.name}</span>
								</div>
							{/each}
						{:else}
							<p class="text-sm text-gray-400 italic">No times scheduled yet.</p>
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>

	{#if data.gatherings.length === 0}
		<div class="rounded-2xl border border-dashed border-gray-300 bg-gray-50 py-20 text-center">
			<h3 class="text-lg font-medium text-gray-900">No upcoming gatherings</h3>
			<p class="mt-1 text-gray-500">Click "New Gathering" to schedule your first service.</p>
		</div>
	{/if}
</div>

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			class="absolute inset-0 h-full w-full cursor-default bg-gray-900/60 backdrop-blur-sm"
			onclick={() => (showModal = false)}
			aria-label="Close Modal"
		></button>

		<div class="relative z-10 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
			<div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
				<h3 class="text-lg font-bold text-gray-900">Schedule Gathering</h3>
				<button onclick={() => (showModal = false)} class="text-gray-400 hover:text-gray-600"
					>✕</button
				>
			</div>

			<form
				method="POST"
				action="?/createGathering"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						showModal = false;
					};
				}}
				class="space-y-5 p-6"
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
						<label for="title" class="text-xs font-bold text-gray-500 uppercase"
							>Title {isSeriesMode ? '(Series Name)' : ''}</label
						>
						<input
							type="text"
							name="title"
							required
							placeholder={isSeriesMode ? 'e.g. Book of Philippians' : 'e.g. Sunday Service'}
							class="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div class="space-y-1">
						<label for="start_date" class="text-xs font-bold text-gray-500 uppercase"
							>Date {isSeriesMode ? '(Start)' : ''}</label
						>
						<input
							type="date"
							name="start_date"
							required
							class="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>

					<div class="space-y-1">
						<label for="time" class="text-xs font-bold text-gray-500 uppercase">Service Time</label>
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
									oninput={(e) =>
										(document.getElementById('week_disp').innerText =
											e.currentTarget.value + ' Weeks')}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600"
								/>
								<span
									id="week_disp"
									class="min-w-[4rem] font-mono font-bold whitespace-nowrap text-blue-600"
									>4 Weeks</span
								>
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
						class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button
					>
					<button
						type="submit"
						class="rounded-lg bg-gray-900 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-gray-800"
					>
						{isSeriesMode ? 'Generate Series' : 'Create Gathering'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
