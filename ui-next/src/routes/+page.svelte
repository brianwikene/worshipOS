<script lang="ts">
	import { useTenant } from '$lib/tenant.svelte';

	let { data } = $props();
	const tenant = useTenant();

	// 1. VIEW STATE
	let viewMode = $state<'upcoming' | 'history'>('upcoming');

	// 2. FILTER & SORT LOGIC
	const today = new Date().toISOString().split('T')[0]; // "2026-01-24"

	// Upcoming: Date >= Today, Ascending (Sooner -> Later)
	let upcomingGatherings = $derived(
		data.gatherings
			.filter((g) => g.date >= today)
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
	);

	// History: Date < Today, Descending (Recent -> Older)
	let pastGatherings = $derived(
		data.gatherings
			.filter((g) => g.date < today)
			.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
	);
	let activeList = $derived(viewMode === 'upcoming' ? upcomingGatherings : pastGatherings);

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			weekday: 'short',
			timeZone: 'UTC'
		});
	}

	function formatTime(timeStr: string) {
		const [hours, minutes] = timeStr.split(':');
		const h = parseInt(hours);
		const ampm = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 || 12;
		return `${h12}:${minutes} ${ampm}`;
	}
</script>

<div class="mx-auto max-w-5xl p-8">
	<header class="mb-10 flex items-end justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-gray-900">Gatherings</h1>
			<p class="mt-1 font-medium text-gray-500">Build the plan. Share it with the team.</p>
		</div>

		<button
			class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800"
		>
			+ Schedule Gathering
		</button>
	</header>

	<div class="mb-8 flex">
		<div class="relative inline-flex rounded-lg bg-gray-100 p-1">
			<button
				onclick={() => (viewMode = 'upcoming')}
				class="relative z-10 rounded-md px-4 py-1.5 text-sm font-semibold transition-all
                       {viewMode === 'upcoming'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				Upcoming
			</button>

			<button
				onclick={() => (viewMode = 'history')}
				class="relative z-10 rounded-md px-4 py-1.5 text-sm font-semibold transition-all
                       {viewMode === 'history'
					? 'bg-white text-gray-900 shadow-sm'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				History
			</button>
		</div>
	</div>

	{#if activeList.length > 0}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each activeList as gathering}
				<div
					class="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
				>
					<div
						class="absolute top-0 left-0 h-full w-1
                        {viewMode === 'history'
							? 'bg-amber-100'
							: gathering.status === 'published'
								? 'bg-green-500'
								: 'bg-stone-300'}"
					></div>

					<div class="mb-6 ml-2">
						<div class="flex items-start justify-between">
							<div class="mb-1 text-xs font-bold tracking-wider text-gray-400 uppercase">
								{formatDate(gathering.date)}
							</div>

							{#if viewMode === 'history'}
								<span
									class="rounded border border-amber-100 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 uppercase"
								>
									Past
								</span>
							{/if}
						</div>

						<h3
							class="text-xl font-bold {viewMode === 'history'
								? 'text-gray-500'
								: 'text-gray-900'} leading-tight"
						>
							{gathering.title}
						</h3>
					</div>

					<div class="ml-2 space-y-2">
						{#each gathering.instances as instance}
							<a
								href="/gatherings/{gathering.id}/instances/{instance.id}"
								class="group/item flex items-center justify-between rounded-lg border p-2.5 transition
                                      {viewMode === 'history'
									? 'border-gray-100 bg-gray-50 text-gray-400 hover:bg-white hover:text-gray-600'
									: 'border-gray-100 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-white hover:text-gray-900'}"
							>
								<div class="flex items-center gap-3">
									<span class="font-mono text-sm font-bold">
										{formatTime(instance.start_time)}
									</span>
									<span class="text-sm">
										{instance.name}
									</span>
								</div>
								<svg
									class="h-4 w-4 text-gray-300 group-hover/item:text-gray-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 5l7 7-7 7"
									/>
								</svg>
							</a>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div
			class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-24"
		>
			<div class="mb-4 text-gray-200">
				<svg
					width="48"
					height="48"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
					<line x1="16" y1="2" x2="16" y2="6"></line>
					<line x1="8" y1="2" x2="8" y2="6"></line>
					<line x1="3" y1="10" x2="21" y2="10"></line>
				</svg>
			</div>
			<h2 class="mb-1 text-lg font-semibold text-gray-900">
				{viewMode === 'upcoming' ? 'No Upcoming Gatherings' : 'No History Found'}
			</h2>
			<p class="text-sm text-gray-500">
				{viewMode === 'upcoming'
					? 'You are all caught up.'
					: 'No past gatherings have been archived yet.'}
			</p>
		</div>
	{/if}
</div>
