<script lang="ts">
	import { ArrowLeft, MapPin, Music, User } from '@lucide/svelte';

	let { data } = $props();

	// Type assertion for plan items that may have leader_name
	type PlanItemWithLeader = (typeof data.plans)[number]['items'][number] & {
		leader_name?: string;
	};

	const formatDate = (dateStr: string | Date) => {
		const d = dateStr instanceof Date ? dateStr : new Date(dateStr);
		return d.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			timeZone: 'UTC'
		});
	};
</script>

<div class="flex h-screen flex-col overflow-hidden bg-gray-50/50">
	<div class="z-20 flex-none border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
		<div class="mx-auto flex max-w-7xl items-center justify-between">
			<div class="flex items-center gap-4">
				<a
					href="/gatherings"
					class="rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100"
					aria-label="Back to gatherings"
				>
					<ArrowLeft size={20} />
				</a>
				<div>
					<h1 class="text-xl font-bold text-gray-900">Planning Matrix</h1>
					<p class="flex items-center gap-1 text-xs text-gray-500">
						<MapPin size={12} />
						Next 3 Weeks • {data.plans[0]?.campus?.name || 'Main Campus'}
					</p>
				</div>
			</div>

			<div class="flex gap-2">
				<div
					class="flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
				>
					<Music size={12} /> Songs
				</div>
				<div
					class="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700"
				>
					<User size={12} /> People
				</div>
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-x-auto overflow-y-hidden p-6">
		<div class="grid h-full min-w-[900px] grid-cols-3 gap-6">
			{#each data.plans as plan}
				<div
					class="flex h-full max-h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
				>
					<div class="flex-none border-b border-gray-100 bg-gray-50/50 p-4">
						<div class="mb-1 flex items-start justify-between">
							<div class="flex flex-col">
								<span class="text-xs font-bold tracking-wider text-gray-400 uppercase">
									{new Date(plan.date).toLocaleDateString('en-US', {
										weekday: 'long',
										timeZone: 'UTC'
									})}
								</span>
								<span class="text-2xl font-bold text-gray-900">
									{formatDate(plan.date)}
								</span>
							</div>
							<span class="h-2 w-2 rounded-full bg-green-500" title="Ready"></span>
						</div>
						<h3
							class="truncate text-sm font-medium text-gray-600"
							title={plan.name || 'Untitled Plan'}
						>
							{plan.name || 'Untitled Plan'}
						</h3>
					</div>

					<div class="flex-1 space-y-2 overflow-y-auto bg-white p-2">
						{#each plan.items as rawItem}
							{@const item = rawItem as PlanItemWithLeader}
							{#if item.song}
								<div
									class="group rounded-lg border border-blue-100 bg-blue-50/50 p-2 transition-colors hover:border-blue-300"
								>
									<div class="flex items-start justify-between">
										<span class="text-sm leading-tight font-bold text-blue-900">
											{item.title}
										</span>
										{#if item.song?.original_key}
											<span
												class="rounded border border-blue-100 bg-white px-1 font-mono text-[10px] text-blue-500"
											>
												{item.song.original_key}
											</span>
										{/if}
									</div>
									{#if item.leader_name}
										<div class="mt-1 flex items-center gap-1 text-[10px] text-blue-600/80">
											<User size={10} />
											{item.leader_name}
										</div>
									{/if}
								</div>
							{:else}
								<div
									class="flex items-start justify-between rounded-lg border border-gray-100 bg-white p-2 transition-colors hover:border-gray-300"
								>
									<div>
										<div class="text-sm leading-tight font-medium text-gray-700">
											{item.title}
										</div>
										{#if item.leader_name}
											<div
												class="mt-1 flex inline-block items-center gap-1 rounded bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold text-gray-400"
											>
												{item.leader_name}
											</div>
										{/if}
									</div>
									<span class="mt-0.5 text-[9px] font-bold tracking-wider text-gray-300 uppercase">
										{item.segment}
									</span>
								</div>
							{/if}
						{/each}

						{#if plan.items.length === 0}
							<div class="py-10 text-center text-sm text-gray-300 italic">Plan is empty</div>
						{/if}
					</div>
				</div>
			{/each}

			{#if data.plans.length === 0}
				<div class="col-span-3 py-20 text-center text-gray-400">
					No upcoming plans found to compare.
				</div>
			{/if}
		</div>
	</div>
</div>
