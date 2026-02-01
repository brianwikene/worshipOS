<script lang="ts">
	import {
		Calendar,
		Heart,
		Users,
		Shield,
		Coffee,
		Hash,
		Activity,
		HandHeart
	} from '@lucide/svelte';
	import { fade } from 'svelte/transition';

	let { data } = $props();

	// Derived state ensures reactivity if data updates
	let currentUser = $derived(data.currentUser);
	let isLeader = $derived(data.isLeader);
	let personal = $derived(data.personal);
	let leader = $derived(data.leader);

	let viewMode = $state<'personal' | 'leader'>('personal');
</script>

<div class="min-h-screen bg-stone-50 pb-20">
	<div class="sticky top-0 z-10 border-b border-stone-200 bg-white">
		<div class="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-xl font-bold text-slate-900">
						Hello, {currentUser?.first_name}
					</h1>
					<p class="text-xs text-stone-500">Welcome to your dashboard.</p>
				</div>

				{#if isLeader}
					<div class="flex rounded-lg bg-stone-100 p-1">
						<button
							onclick={() => (viewMode = 'personal')}
							class={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${viewMode === 'personal' ? 'bg-white text-slate-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
						>
							Me
						</button>
						<button
							onclick={() => (viewMode = 'leader')}
							class={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-all ${viewMode === 'leader' ? 'bg-slate-900 text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
						>
							<Shield size={12} />
							Leadership
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
		
		{#if viewMode === 'personal' && personal}
			<div in:fade={{ duration: 200 }} class="grid grid-cols-1 gap-8 md:grid-cols-3">
				
				<div class="space-y-6 md:col-span-2">
					<section>
						<h2 class="mb-3 flex items-center gap-2 text-xs font-bold text-stone-400 uppercase">
							<Calendar size={14} /> My Schedule
						</h2>
						{#if personal.upcomingServings.length > 0}
							<div class="space-y-2">
								{#each personal.upcomingServings as event}
									<div
										class="flex items-center justify-between rounded-lg border border-stone-200 bg-white p-3"
									>
										<div>
											<div class="text-sm font-bold text-slate-900">{event.title}</div>
											<div class="text-xs text-stone-500">
												{new Date(event.date).toLocaleDateString()}
											</div>
										</div>
										<div class="text-right">
											<span class="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">
												{event.role}
											</span>
											<div class="mt-1 text-[10px] text-stone-400">{event.team}</div>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div
								class="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center text-xs text-stone-500"
							>
								No upcoming serving dates.
							</div>
						{/if}
					</section>
				</div>

				<div class="space-y-6">
					<section>
						<h2 class="mb-3 flex items-center gap-2 text-xs font-bold text-stone-400 uppercase">
							<Users size={14} /> My Groups
						</h2>
						{#if personal.myGroups.length > 0}
							<div class="space-y-2">
								{#each personal.myGroups as group}
									<div class="rounded-lg border border-stone-200 bg-white p-3">
										<div class="flex items-center gap-2">
											{#if group.type === 'kinship'}
												<Coffee size={14} class="text-orange-500" />
											{:else if group.type === 'outreach'}
												<HandHeart size={14} class="text-red-500" />
											{:else}
												<Hash size={14} class="text-purple-500" />
											{/if}
											<div class="text-sm font-bold text-slate-900">{group.name}</div>
										</div>
										<p class="mt-1 line-clamp-2 text-xs text-stone-500">
											{group.description || 'No description'}
										</p>
									</div>
								{/each}
							</div>
						{:else}
							<div
								class="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center text-xs text-stone-500"
							>
								Not in any groups yet.
							</div>
						{/if}
					</section>
				</div>
			</div>
		{/if}

		{#if isLeader && viewMode === 'leader' && leader}
			<div in:fade={{ duration: 200 }} class="grid grid-cols-1 gap-8 md:grid-cols-2">
				
				<section>
					<h2 class="mb-3 flex items-center gap-2 text-xs font-bold text-stone-400 uppercase">
						<Activity size={14} /> The Pulse
					</h2>
					<div class="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
						{#if leader.activityFeed.length > 0}
							<div class="divide-y divide-stone-100">
								{#each leader.activityFeed as item}
									<div class="flex items-start gap-3 p-4">
										<div
											class={`mt-1 h-2 w-2 rounded-full ${item.type === 'join' ? 'bg-green-500' : 'bg-purple-500'}`}
										></div>
										<div>
											<p class="text-sm text-slate-900">
												<span class="font-bold"
													>{item.personFirst || 'Someone'} {item.personLast || ''}</span
												>
												{#if item.type === 'join'}
													joined <span class="font-bold text-slate-900">{item.targetName}</span>
												{:else}
													asked for <span class="font-bold text-purple-700">Prayer</span>
												{/if}
											</p>
											{#if item.date}
												<p class="mt-0.5 text-xs text-stone-400">
													{new Date(item.date).toLocaleDateString()}
												</p>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<div class="p-8 text-center text-xs text-stone-400">No recent activity.</div>
						{/if}
					</div>
				</section>

				<section>
					<h2 class="mb-3 flex items-center gap-2 text-xs font-bold text-stone-400 uppercase">
						<Heart size={14} /> Prayer Needs
					</h2>
					<div class="space-y-3">
						{#if leader.prayerWall.length > 0}
							{#each leader.prayerWall as req}
								<div class="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
									<p class="mb-2 text-sm text-slate-800">"{req.content}"</p>
									<div class="flex items-center justify-between text-xs text-stone-400">
										<span
											>{req.created_at
												? new Date(req.created_at).toLocaleDateString()
												: 'Unknown'}</span
										>
										{#if req.is_private}
											<span class="flex items-center gap-1 font-bold text-orange-600"
												><Shield size={10} /> Private</span
											>
										{/if}
									</div>
								</div>
							{/each}
						{:else}
							<div
								class="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-center text-xs text-stone-500"
							>
								No active prayer requests.
							</div>
						{/if}
					</div>
				</section>
			</div>
		{/if}
	</div>
</div>