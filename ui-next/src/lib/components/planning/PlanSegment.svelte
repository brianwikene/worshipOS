<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Lock } from '@lucide/svelte';
	import { dndzone } from 'svelte-dnd-action';
	import PlanItem from '$lib/components/planning/PlanItem.svelte';

	type Segment = 'pre' | 'core' | 'post';
	type PlanItemShape = {
		id: string;
		title: string;
		duration: number;
		segment: Segment;
		order: number;
		song_id?: string | null;
		is_audible?: boolean;
		song?: { title?: string | null } | null;
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

	let localItems = $state<PlanItemShape[]>(items ?? []);

	$effect(() => {
		localItems = items ?? [];
	});

	let totalDuration = $derived(
		localItems.reduce((acc, item) => acc + (item.duration ?? 0), 0)
	);

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
		<span class="text-xs font-mono text-gray-500">{formatDuration(totalDuration)}</span>
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
