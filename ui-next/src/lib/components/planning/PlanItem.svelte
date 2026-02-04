<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { GripVertical, Pencil, Music } from '@lucide/svelte';

	type Segment = 'pre' | 'core' | 'post';
	type PlanItem = {
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

	let { item, locked = false } = $props<{
		item: PlanItem;
		locked?: boolean;
	}>();

	const dispatch = createEventDispatcher<{
		edit: { item: PlanItem };
		durationChange: { itemId: string; duration: number };
	}>();

	let minutes = $state(Math.floor((item.duration ?? 0) / 60));
	let seconds = $state((item.duration ?? 0) % 60);

	$effect(() => {
		minutes = Math.floor((item.duration ?? 0) / 60);
		seconds = (item.duration ?? 0) % 60;
	});

	function commitDuration() {
		const minValue = Number(minutes);
		const secValue = Number(seconds);
		const min = Number.isFinite(minValue) ? Math.max(0, minValue) : 0;
		const sec = Number.isFinite(secValue) ? Math.min(59, Math.max(0, secValue)) : 0;
		const duration = min * 60 + sec;
		dispatch('durationChange', { itemId: item.id, duration });
	}
</script>

<div class="grid w-full grid-cols-[28px_64px_1fr_120px] items-center gap-3 px-4 py-3">
	<div class="flex items-center justify-center text-gray-300">
		{#if !locked}
			<GripVertical size={16} />
		{/if}
	</div>

	<div class="text-center font-mono text-xs text-gray-500">
		{item.timeLabel ?? '--:--'}
	</div>

	<div class="min-w-0">
		<button
			type="button"
			onclick={() => dispatch('edit', { item })}
			class="flex w-full min-w-0 items-center gap-2 text-left"
		>
			<span class="truncate text-sm font-semibold text-gray-900">{item.title}</span>
			{#if item.song_id}
				<span
					class="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600"
				>
					<Music size={12} />
					{item.song?.title ?? 'Song'}
				</span>
			{/if}
		</button>
	</div>

	<div class="flex items-center justify-end gap-2">
		<div class="flex items-center gap-1">
			<label class="sr-only" for={`duration-min-${item.id}`}>Minutes</label>
			<input
				id={`duration-min-${item.id}`}
				type="number"
				min="0"
				inputmode="numeric"
				value={minutes}
				disabled={locked}
				onchange={commitDuration}
				class="w-12 rounded border border-gray-200 px-1 py-1 text-center text-xs"
			/>
			<span class="text-xs text-gray-400">:</span>
			<label class="sr-only" for={`duration-sec-${item.id}`}>Seconds</label>
			<input
				id={`duration-sec-${item.id}`}
				type="number"
				min="0"
				max="59"
				inputmode="numeric"
				value={seconds}
				disabled={locked}
				onchange={commitDuration}
				class="w-12 rounded border border-gray-200 px-1 py-1 text-center text-xs"
			/>
		</div>
		<button
			type="button"
			onclick={() => dispatch('edit', { item })}
			class="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:text-gray-800"
		>
			<Pencil size={12} />
		</button>
	</div>
</div>
