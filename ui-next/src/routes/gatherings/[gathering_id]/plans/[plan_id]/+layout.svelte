<script lang="ts">
	import { page } from '$app/stores';
	import { format } from 'date-fns';
	import { toZonedTime } from 'date-fns-tz';
	// Ensure this is imported
	import { ArrowLeft, Calendar, Clock, ListMusic, Mic2, Users } from '@lucide/svelte';
	import type { LayoutData } from './$types';

	let { data, children } = $props<{ data: LayoutData; children: any }>();

	let plan = $derived(data.plan);
	let gathering = $derived(data.gathering);

	// 1. GATHERING DATE (For the "Bucket" - Date Only)
	let gatheringDate = $derived.by(() => {
		const utcDate = new Date(gathering.date);
		const tz = gathering.campus?.timezone || 'America/Los_Angeles';
		return toZonedTime(utcDate, tz);
	});

	// 2. PLAN TIME (For the "Execution" - 10:00 AM)
	// We use plan.starts_at now!
	let planStart = $derived.by(() => {
		if (!plan.starts_at) return new Date(); // Fallback
		const utcDate = new Date(plan.starts_at);
		const tz = gathering.campus?.timezone || 'America/Los_Angeles';
		return toZonedTime(utcDate, tz);
	});

	let tabs = [
		{ id: 'order', label: 'Order', icon: ListMusic },
		{ id: 'people', label: 'People', icon: Users },
		{ id: 'rehearse', label: 'Rehearse', icon: Mic2 }
	];
</script>

<div class="flex h-screen flex-col bg-slate-50">
	<header class="border-b border-slate-200 bg-white px-6 py-4">
		<div class="mb-4 flex items-center gap-2 text-xs font-medium text-slate-500">
			<a href="/gatherings" class="flex items-center gap-1 hover:text-slate-900">
				<ArrowLeft size={14} /> Gatherings
			</a>
			<span>/</span>
			<span class="text-slate-900">{gathering.title}</span>

			<span class="flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
				<Calendar size={12} />
				{format(gatheringDate, 'MMM d, yyyy')}
			</span>
		</div>

		<div class="flex items-start justify-between">
			<div>
				<h1 class="text-2xl font-bold text-slate-900">
					{plan.title || 'Untitled Plan'}
				</h1>

				<div class="mt-1 flex items-center gap-4 text-sm text-slate-500">
					<div class="flex items-center gap-1.5 font-bold text-slate-700">
						<Clock size={16} class="text-pink-600" />
						{format(planStart, 'h:mm a')}
					</div>
					{#if gathering.campus}
						<div class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
							{gathering.campus.name}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="mt-6 flex gap-1">
			{#each tabs as tab}
				{@const isActive = $page.url.pathname.includes(tab.id)}
				<a
					href="/gatherings/{gathering.id}/plans/{plan.id}/{tab.id}"
					class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors {isActive
						? 'bg-slate-900 text-white'
						: 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}"
				>
					<tab.icon size={16} />
					{tab.label}
				</a>
			{/each}
		</div>
	</header>

	<div class="flex-1 overflow-hidden">
		{@render children()}
	</div>
</div>
