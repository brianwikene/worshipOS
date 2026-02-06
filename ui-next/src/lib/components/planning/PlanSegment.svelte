<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Lock } from '@lucide/svelte';
	import { dndzone } from 'svelte-dnd-action';
	import PlanItem from '$lib/components/planning/PlanItem.svelte';

	type Segment = 'pre' | 'core' | 'post';
	type ItemType = 'header' | 'song' | 'sermon' | 'announcement' | 'prayer' | 'reading' | 'media' | 'offering' | 'communion' | 'baptism' | 'dedication' | 'other';
	type PlanItemShape = {
		id: string;
		title: string;
		duration: number | null;
		segment: Segment;
		type: ItemType;
		order: number;
		song_id?: string | null;
		leader_id?: string | null;
		is_audible?: boolean;
		offset_minutes?: number | null;
		song?: { title?: string | null; original_key?: string | null } | null;
		leader?: { id: string; first_name: string; last_name: string | null } | null;
		timeLabel?: string;
	};

	let {
		title,
		segment,
		items,
		locked = false
	} = $props<{
		title: string;
		segment: Segment;
		items: PlanItemShape[];
		locked?: boolean;
	}>();

	const dispatch = createEventDispatcher<{
		reorder: { segment: Segment; itemIds: string[] };
		create: { segment: Segment; title: string };
		edit: { item: PlanItemShape };
		durationChange: { itemId: string; duration: number };
	}>();

	let draftTitle = $state('');

	let localItems = $state<PlanItemShape[]>([]);

	$effect(() => {
		localItems = items ?? [];
	});

	// For pre/post: total is the span based on offsets, not sum of durations
	// For core: total is sum of sequential durations
	let totalDuration = $derived.by(() => {
		if (segment === 'pre') {
			// Pre: max offset in minutes, converted to seconds
			const maxOffset = Math.max(...localItems.map((item) => item.offset_minutes ?? 0), 0);
			return maxOffset * 60;
		} else if (segment === 'post') {
			// Post: max of (offset + duration) to find when last item ends
			const maxEnd = Math.max(
				...localItems.map((item) => {
					const offsetSec = (item.offset_minutes ?? 0) * 60;
					return offsetSec + (item.duration ?? 0);
				}),
				0
			);
			return maxEnd;
		} else {
			// Core: sequential, sum of durations
			return localItems.reduce((acc, item) => acc + (item.duration ?? 0), 0);
		}
	});

	function formatDuration(seconds: number) {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function handleCreate() {
		const titleValue = draftTitle.trim();
		if (!titleValue || locked) return;
		dispatch('create', { segment, title: titleValue });
		draftTitle = '';
	}
</script>

<section class="overflow-hidden rounded-xl border border-gray-200 bg-white">
	<header class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
		<div class="flex items-center gap-2">
			<h3 class="text-sm font-semibold text-gray-900">{title}</h3>
			{#if locked}
				<Lock size={14} class="text-gray-400" />
			{/if}
		</div>
		<span class="font-mono text-xs text-gray-500">{formatDuration(totalDuration)}</span>
	</header>

	<div
		use:dndzone={{
			items: localItems,
			flipDurationMs: 150,
			dragDisabled: locked,
			dropFromOthersDisabled: true
		}}
		onconsider={(event) => {
			localItems = event.detail.items as PlanItemShape[];
		}}
		onfinalize={(event) => {
			localItems = event.detail.items as PlanItemShape[];
			const itemIds = event.detail.items.map((item: PlanItemShape) => item.id);
			dispatch('reorder', { segment, itemIds });
		}}
		class="divide-y divide-gray-100"
	>
		{#if localItems.length === 0}
			<div class="px-4 py-6 text-center text-sm text-gray-400">No items yet.</div>
		{:else}
			{#each localItems as item (item.id)}
				<PlanItem
					{item}
					{locked}
					on:edit={(event) => dispatch('edit', event.detail)}
					on:durationChange={(event) => dispatch('durationChange', event.detail)}
				/>
			{/each}
		{/if}
	</div>

	<div class="border-t border-gray-100 px-4 py-3">
		<label class="sr-only" for={`add-${segment}`}>Add item</label>
		<input
			id={`add-${segment}`}
			type="text"
			placeholder={locked ? 'Plan is locked' : 'Add item and press Enter'}
			bind:value={draftTitle}
			disabled={locked}
			onkeydown={(event) => {
				if (event.key === 'Enter') {
					event.preventDefault();
					handleCreate();
				}
			}}
			class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
		/>
	</div>
</section>
