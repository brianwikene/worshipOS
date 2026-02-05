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

<div class="mx-auto max-w-4xl px-4 py-8">
	<!-- Header -->
	<a
		href="/gatherings/{data.order.gathering.id}"
		class="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 transition hover:text-gray-900"
	>
		<ArrowLeft size={16} />
		Back to Gathering
	</a>

	<div class="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
		<div class="flex items-start justify-between">
			<div>
				<h1 class="text-2xl font-bold text-gray-900">{data.order.gathering.title}</h1>
				<div class="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
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
	</div>

	<!-- Plans -->
	{#if data.order.plans.length === 0}
		<div class="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12 text-center">
			<p class="text-gray-500">No plans scheduled for this gathering yet.</p>
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
