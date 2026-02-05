<!-- src/routes/gatherings/[gathering_id]/order/+page.svelte -->
<!-- Read-only view of gathering flow/order -->
<script lang="ts">
	import { ArrowLeft, Calendar, Clock, MapPin, Music } from '@lucide/svelte';

	let { data } = $props();

	function formatDate(v: unknown): string {
		const d = v instanceof Date ? v : new Date(String(v));
		if (Number.isNaN(d.getTime())) return 'Invalid date';
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '';
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins} min`;
	}

	function segmentLabel(segment: string): string {
		switch (segment) {
			case 'pre':
				return 'Pre-Service';
			case 'core':
				return 'Service';
			case 'post':
				return 'Post-Service';
			default:
				return segment;
		}
	}
</script>

<script lang="ts">
	import { ArrowLeft, Calendar, Clock, List, MapPin, Music } from '@lucide/svelte';

	let { data } = $props();

	function formatDate(v: unknown): string {
		const d = v instanceof Date ? v : new Date(String(v));
		if (Number.isNaN(d.getTime())) return 'Invalid date';
		return d.toLocaleDateString('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}

	function formatDuration(seconds: number | null): string {
		if (!seconds) return '';
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return secs > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${mins} min`;
	}

	function segmentLabel(segment: string): string {
		switch (segment) {
			case 'pre':
				return 'Pre-Service';
			case 'core':
				return 'Service';
			case 'post':
				return 'Post-Service';
			default:
				return segment;
		}
	}
</script>

<div class="min-h-screen bg-stone-50 pb-20">
	<!-- Header -->
	<header class="border-b border-stone-200 bg-white px-4 pt-4 shadow-sm">
		<div class="mx-auto max-w-4xl">
			<a
				href="/gatherings/{data.order.gathering.id}"
				class="mb-3 inline-flex items-center gap-2 text-sm text-stone-500 transition hover:text-stone-900"
			>
				<ArrowLeft size={16} />
				Back to Gathering
			</a>

			<div class="flex items-start justify-between">
				<div>
					<h1 class="text-2xl font-bold text-stone-900">{data.order.gathering.title}</h1>
					<div class="mt-1 flex flex-wrap items-center gap-4 text-sm text-stone-500">
						<span class="flex items-center gap-1.5">
							<Calendar size={14} />
							{formatDate(data.order.gathering.date)}
						</span>
						{#if data.order.gathering.campus}
							<span class="flex items-center gap-1.5">
								<MapPin size={14} />
								{data.order.gathering.campus.name}
							</span>
						{/if}
					</div>
				</div>
				<span
					class="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600"
				>
					{data.order.plans.length} Plan{data.order.plans.length !== 1 ? 's' : ''}
				</span>
			</div>

			<!-- Simple Tab Navigation -->
			<div class="mt-6 flex gap-6">
				<a
					href="/gatherings/{data.order.gathering.id}/order"
					class="border-b-2 border-stone-900 pb-3 text-sm font-bold text-stone-900"
				>
					<div class="flex items-center gap-2">
						<List size={16} />
						Service Flow
					</div>
				</a>
				<a
					href="/gatherings/{data.order.gathering.id}/rehearse"
					class="border-b-2 border-transparent pb-3 text-sm font-medium text-stone-500 transition hover:text-stone-900"
				>
					<div class="flex items-center gap-2">
						<Music size={16} />
						Songs & Rehearsal
					</div>
				</a>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-4xl px-4 py-8">
		<!-- Plans -->
		{#if data.order.plans.length === 0}
			<div class="rounded-xl border border-dashed border-stone-300 bg-white py-16 text-center shadow-sm">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-50">
					<List size={32} class="text-stone-300" />
				</div>
				<h3 class="text-lg font-bold text-stone-900">No plans scheduled yet</h3>
				<p class="mx-auto mt-2 max-w-xs text-stone-500">
					This gathering doesn't have any service plans yet. Once they are created, the full service flow will appear here.
				</p>
			</div>
		{:else}
		<div class="space-y-8">
			{#each data.order.plans as plan}
				<div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
					<!-- Plan Header -->
					<div class="border-b border-gray-100 bg-gray-50 px-5 py-3">
						<div class="flex items-center justify-between">
							<h2 class="font-bold text-gray-900">{plan.title}</h2>
							<span
								class="rounded-full px-2 py-0.5 text-xs font-medium {plan.status === 'locked'
									? 'bg-green-50 text-green-600'
									: plan.status === 'completed'
										? 'bg-gray-100 text-gray-500'
										: 'bg-amber-50 text-amber-600'}"
							>
								{plan.status}
							</span>
						</div>
					</div>

					<!-- Items -->
					{#if plan.items.length === 0}
						<div class="px-5 py-8 text-center text-sm text-gray-400 italic">No items yet</div>
					{:else}
						<div class="divide-y divide-gray-100">
							{#each plan.items as item, idx}
								<div
									class="flex items-start gap-4 px-5 py-3 transition hover:bg-gray-50 {item.segment ===
									'pre'
										? 'bg-blue-50/30'
										: item.segment === 'post'
											? 'bg-amber-50/30'
											: ''}"
								>
									<!-- Position number -->
									<div
										class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500"
									>
										{idx + 1}
									</div>

									<!-- Content -->
									<div class="min-w-0 flex-1">
										<div class="flex items-center gap-2">
											{#if item.song}
												<Music size={14} class="shrink-0 text-purple-500" />
											{/if}
											<span class="font-medium text-gray-900">{item.title}</span>
											{#if item.song?.key}
												<span
													class="rounded border border-purple-100 bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-600"
												>
													{item.song.key}
												</span>
											{/if}
										</div>

										{#if item.song?.artist}
											<p class="mt-0.5 text-xs text-gray-400">{item.song.artist}</p>
										{/if}

										{#if item.description}
											<p class="mt-1 text-sm text-gray-500">{item.description}</p>
										{/if}
									</div>

									<!-- Duration & Segment -->
									<div class="shrink-0 text-right">
										{#if item.duration}
											<div class="flex items-center gap-1 text-xs text-gray-400">
												<Clock size={12} />
												{formatDuration(item.duration)}
											</div>
										{/if}
										<div class="mt-1 text-[10px] font-medium text-gray-300 uppercase">
											{segmentLabel(item.segment)}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>
