<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import {
		GripVertical,
		Pencil,
		Music,
		Megaphone,
		BookOpen,
		HandHeart,
		Video,
		Heart,
		CircleDot,
		Bookmark,
		Wine,
		Droplets,
		Baby,
		User
	} from '@lucide/svelte';

	type Segment = 'pre' | 'core' | 'post';
	type ItemType = 'header' | 'song' | 'sermon' | 'announcement' | 'prayer' | 'reading' | 'media' | 'offering' | 'communion' | 'baptism' | 'dedication' | 'other';
	type PlanItem = {
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

	const TYPE_ICONS: Record<ItemType, typeof Music> = {
		header: Bookmark,
		song: Music,
		sermon: BookOpen,
		announcement: Megaphone,
		prayer: HandHeart,
		reading: BookOpen,
		media: Video,
		offering: Heart,
		communion: Wine,
		baptism: Droplets,
		dedication: Baby,
		other: CircleDot
	};

	const TYPE_COLORS: Record<ItemType, string> = {
		header: 'text-white bg-gray-700 border-gray-700',
		song: 'text-indigo-600 bg-indigo-50 border-indigo-100',
		sermon: 'text-amber-600 bg-amber-50 border-amber-100',
		announcement: 'text-sky-600 bg-sky-50 border-sky-100',
		prayer: 'text-rose-600 bg-rose-50 border-rose-100',
		reading: 'text-emerald-600 bg-emerald-50 border-emerald-100',
		media: 'text-purple-600 bg-purple-50 border-purple-100',
		offering: 'text-pink-600 bg-pink-50 border-pink-100',
		communion: 'text-red-700 bg-red-50 border-red-100',
		baptism: 'text-cyan-600 bg-cyan-50 border-cyan-100',
		dedication: 'text-orange-500 bg-orange-50 border-orange-100',
		other: 'text-gray-600 bg-gray-50 border-gray-200'
	};

	let { item, locked = false } = $props<{
		item: PlanItem;
		locked?: boolean;
	}>();

	const dispatch = createEventDispatcher<{
		edit: { item: PlanItem };
		durationChange: { itemId: string; duration: number };
	}>();

	let minutes = $derived(Math.floor((item.duration ?? 0) / 60));
	let seconds = $derived((item.duration ?? 0) % 60);

	const TypeIcon = $derived(TYPE_ICONS[item.type] ?? CircleDot);
	const typeColor = $derived(TYPE_COLORS[item.type] ?? TYPE_COLORS.other);
	const leaderName = $derived(
		item.leader ? `${item.leader.first_name} ${item.leader.last_name ?? ''}`.trim() : null
	);

	function commitDuration(event: Event) {
		const form = (event.target as HTMLElement).closest('.flex.items-center.gap-1');
		if (!form) return;
		const minInput = form.querySelector<HTMLInputElement>('[id^="duration-min-"]');
		const secInput = form.querySelector<HTMLInputElement>('[id^="duration-sec-"]');
		const minValue = Number(minInput?.value ?? 0);
		const secValue = Number(secInput?.value ?? 0);
		const min = Number.isFinite(minValue) ? Math.max(0, minValue) : 0;
		const sec = Number.isFinite(secValue) ? Math.min(59, Math.max(0, secValue)) : 0;
		const duration = min * 60 + sec;
		dispatch('durationChange', { itemId: item.id, duration });
	}
</script>

{#if item.type === 'header'}
	<!-- Header: Full-width dark bar -->
	<div class="flex w-full items-center gap-3 bg-gray-700 px-4 py-2">
		<div class="flex w-7 items-center justify-center text-gray-400">
			{#if !locked}
				<GripVertical size={16} />
			{/if}
		</div>

		<div class="w-16 text-center font-mono text-xs text-gray-400">
			{item.timeLabel ?? '--:--'}
		</div>

		<button
			type="button"
			onclick={() => dispatch('edit', { item })}
			class="flex min-w-0 flex-1 items-center gap-2 text-left"
		>
			<Bookmark size={14} class="shrink-0 text-gray-400" />
			<span class="truncate text-sm font-bold text-gray-100">{item.title}</span>
		</button>

		<button
			type="button"
			onclick={() => dispatch('edit', { item })}
			class="rounded-md border border-gray-600 px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
		>
			<Pencil size={12} />
		</button>
	</div>
{:else}
	<!-- Standard item row -->
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
				<!-- Type Icon -->
				<span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border {typeColor}">
					<TypeIcon size={14} />
				</span>

				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="truncate text-sm font-semibold text-gray-900">{item.title}</span>
						{#if item.type === 'song' && item.song?.original_key}
							<span class="shrink-0 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
								{item.song.original_key}
							</span>
						{/if}
					</div>
					{#if leaderName}
						<div class="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
							<User size={10} />
							{leaderName}
						</div>
					{/if}
				</div>
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
{/if}
