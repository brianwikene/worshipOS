<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { format, addSeconds } from 'date-fns';
	import PlanSegment from '$lib/components/planning/PlanSegment.svelte';
	import {
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
		Baby
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
		offset_minutes?: number | null; // For pre/post: minutes before start or after end
		song?: { title?: string | null; original_key?: string | null } | null;
		leader?: { id: string; first_name: string; last_name: string | null } | null;
	};

	type SongOption = { id: string; title: string; artist: string | null; original_key: string | null };
	type PersonOption = { id: string; first_name: string; last_name: string | null };

	const ITEM_TYPES: { value: ItemType; label: string; icon: typeof Music }[] = [
		{ value: 'header', label: 'Header', icon: Bookmark },
		{ value: 'song', label: 'Song', icon: Music },
		{ value: 'sermon', label: 'Sermon', icon: BookOpen },
		{ value: 'announcement', label: 'Announcement', icon: Megaphone },
		{ value: 'prayer', label: 'Prayer', icon: HandHeart },
		{ value: 'reading', label: 'Reading', icon: BookOpen },
		{ value: 'media', label: 'Media', icon: Video },
		{ value: 'offering', label: 'Offering', icon: Heart },
		{ value: 'communion', label: 'Communion', icon: Wine },
		{ value: 'baptism', label: 'Baptism', icon: Droplets },
		{ value: 'dedication', label: 'Dedication', icon: Baby },
		{ value: 'other', label: 'Other', icon: CircleDot }
	];

	let { data } = $props();

	let items = $state<PlanItem[]>([]);
	const songs = $derived<SongOption[]>(data.songs ?? []);
	const people = $derived<PersonOption[]>(data.people ?? []);

	$effect(() => {
		items = data.items ?? [];
	});

	const isLocked = $derived(data.plan.status === 'locked');

	const preItems = $derived(
		items
			.filter((item) => item.segment === 'pre')
			.slice()
			.sort((a, b) => a.order - b.order)
	);
	const coreItems = $derived(
		items
			.filter((item) => item.segment === 'core')
			.slice()
			.sort((a, b) => a.order - b.order)
	);
	const postItems = $derived(
		items
			.filter((item) => item.segment === 'post')
			.slice()
			.sort((a, b) => a.order - b.order)
	);

	function formatDuration(seconds: number) {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	// Pre-gathering: Sort by offset (highest first = earliest), show T-XX:XX
	const decoratedPre = $derived.by(() => {
		// Sort by offset descending (T-20 before T-5)
		const sorted = [...preItems].sort((a, b) => (b.offset_minutes ?? 0) - (a.offset_minutes ?? 0));
		return sorted.map((item) => {
			const offset = item.offset_minutes ?? 0;
			const mins = Math.floor(offset);
			const secs = Math.round((offset - mins) * 60);
			return { ...item, timeLabel: `T-${mins}:${secs.toString().padStart(2, '0')}` };
		});
	});

	const decoratedCore = $derived.by(() => {
		let cursor = new Date(data.plan.date);
		return coreItems.map((item) => {
			const label = format(cursor, 'h:mm a');
			cursor = addSeconds(cursor, item.duration ?? 0);
			return { ...item, timeLabel: label };
		});
	});

	// Post-gathering: Sort by offset (lowest first), show +XX:XX
	const decoratedPost = $derived.by(() => {
		// Sort by offset ascending (+0 before +5)
		const sorted = [...postItems].sort((a, b) => (a.offset_minutes ?? 0) - (b.offset_minutes ?? 0));
		return sorted.map((item) => {
			const offset = item.offset_minutes ?? 0;
			const mins = Math.floor(offset);
			const secs = Math.round((offset - mins) * 60);
			return { ...item, timeLabel: `+${mins}:${secs.toString().padStart(2, '0')}` };
		});
	});

	function applySegmentOrder(segment: Segment, itemIds: string[]) {
		const orderMap = new Map(itemIds.map((id, index) => [id, index + 1]));
		items = items.map((item) =>
			item.segment === segment && orderMap.has(item.id)
				? { ...item, order: orderMap.get(item.id) ?? item.order }
				: item
		);
	}

	async function persistReorder(segment: Segment, itemIds: string[]) {
		applySegmentOrder(segment, itemIds);
		const formData = new FormData();
		formData.set('itemIds', JSON.stringify(itemIds));
		formData.set('segment', segment);
		await fetch('?/reorderItems', { method: 'POST', body: formData });
	}

	async function createItem(segment: Segment, title: string) {
		const tempId = `temp-${crypto.randomUUID()}`;
		const defaultDuration = segment === 'core' ? 300 : 60;
		const tempItem: PlanItem = {
			id: tempId,
			title,
			segment,
			type: 'other',
			duration: defaultDuration,
			order: (items.filter((item) => item.segment === segment).length ?? 0) + 1
		};

		items = [...items, tempItem];

		const formData = new FormData();
		formData.set('segment', segment);
		formData.set('title', title);
		formData.set('type', 'other');

		const response = await fetch('?/createItem', { method: 'POST', body: formData });
		const result = deserialize(await response.text());

		if (result.type === 'success') {
			// Reload to get fresh data with relations
			await invalidateAll();
		} else {
			// Remove temp item on failure
			items = items.filter((item) => item.id !== tempId);
		}
	}

	async function updateDuration(itemId: string, duration: number) {
		const item = items.find((candidate) => candidate.id === itemId);
		if (!item) return;
		items = items.map((candidate) =>
			candidate.id === itemId ? { ...candidate, duration } : candidate
		);

		const formData = new FormData();
		formData.set('id', itemId);
		formData.set('title', item.title);
		formData.set('segment', item.segment);
		formData.set('type', item.type);
		formData.set('duration', String(duration));
		formData.set('song_id', item.song_id ?? '');
		formData.set('leader_id', item.leader_id ?? '');
		formData.set('is_audible', item.is_audible ? 'on' : '');

		const response = await fetch('?/editItem', { method: 'POST', body: formData });
		deserialize(await response.text()); // Just validate response, optimistic update already done
	}

	let isModalOpen = $state(false);
	let editingItem = $state<PlanItem | null>(null);
	let editTitle = $state('');
	let editType = $state<ItemType>('other');
	let editMinutes = $state(0);
	let editSeconds = $state(0);
	let editAudible = $state(false);
	let editSongId = $state('');
	let editLeaderId = $state('');
	let editOffset = $state<number | null>(null); // For pre/post: minutes before/after
	let songSearchQuery = $state('');
	let showSongDropdown = $state(false);

	const filteredSongs = $derived(
		songSearchQuery.trim()
			? songs.filter((s) =>
					s.title.toLowerCase().includes(songSearchQuery.toLowerCase()) ||
					(s.artist?.toLowerCase().includes(songSearchQuery.toLowerCase()) ?? false)
				)
			: songs
	);

	const selectedSong = $derived(songs.find((s) => s.id === editSongId));

	function openEdit(item: PlanItem) {
		editingItem = item;
		editTitle = item.title;
		editType = item.type ?? 'other';
		editMinutes = Math.floor((item.duration ?? 0) / 60);
		editSeconds = (item.duration ?? 0) % 60;
		editAudible = item.is_audible ?? false;
		editSongId = item.song_id ?? '';
		editLeaderId = item.leader_id ?? '';
		editOffset = item.offset_minutes ?? null;
		songSearchQuery = item.song?.title ?? '';
		showSongDropdown = false;
		isModalOpen = true;
	}

	function selectSong(song: SongOption) {
		editSongId = song.id;
		songSearchQuery = song.title;
		editTitle = song.title;
		showSongDropdown = false;
	}

	function clearSong() {
		editSongId = '';
		songSearchQuery = '';
		showSongDropdown = false;
	}

	function closeModal() {
		isModalOpen = false;
		editingItem = null;
	}

	async function submitEdit(event: SubmitEvent) {
		event.preventDefault();
		if (!editingItem) return;
		const minValue = Number(editMinutes);
		const secValue = Number(editSeconds);
		const duration = Math.max(0, minValue) * 60 + Math.min(59, Math.max(0, secValue));
		const formData = new FormData();
		formData.set('id', editingItem.id);
		formData.set('title', editTitle.trim());
		formData.set('segment', editingItem.segment);
		formData.set('type', editType);
		formData.set('duration', String(duration));
		formData.set('song_id', editSongId.trim());
		formData.set('leader_id', editLeaderId.trim());
		formData.set('is_audible', editAudible || editType === 'song' ? 'on' : '');
		if (editOffset != null) {
			formData.set('offset_minutes', String(editOffset));
		}

		const response = await fetch('?/editItem', { method: 'POST', body: formData });
		const result = deserialize(await response.text());

		if (result.type === 'success' && result.data?.item) {
			// Reload to get fresh data with relations
			await invalidateAll();
		}
		closeModal();
	}

	function trapFocus(node: HTMLElement) {
		function getFocusable() {
			return Array.from(
				node.querySelectorAll<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
				)
			).filter((el) => !el.hasAttribute('disabled'));
		}

		const focusables = getFocusable();
		queueMicrotask(() => focusables[0]?.focus());

		function handleKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeModal();
				return;
			}
			if (event.key !== 'Tab') return;
			const current = getFocusable();
			if (current.length === 0) return;
			const first = current[0];
			const last = current[current.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		}

		node.addEventListener('keydown', handleKeydown);

		return {
			destroy() {
				node.removeEventListener('keydown', handleKeydown);
			}
		};
	}
</script>

<div class="mx-auto max-w-5xl space-y-6 px-4 py-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-semibold text-gray-900">Run Sheet</h1>
			<p class="mt-1 text-sm text-gray-500">
				Start: {format(new Date(data.plan.date), 'h:mm a')}
			</p>
		</div>
		{#if isLocked}
			<span class="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-500">
				Locked
			</span>
		{/if}
	</div>

	<div class="grid gap-6">
		<PlanSegment
			title="Pre-Gathering"
			segment="pre"
			items={decoratedPre}
			locked={isLocked}
			on:reorder={(event) => persistReorder('pre', event.detail.itemIds)}
			on:create={(event) => createItem('pre', event.detail.title)}
			on:edit={(event) => openEdit(event.detail.item)}
			on:durationChange={(event) => updateDuration(event.detail.itemId, event.detail.duration)}
		/>

		<PlanSegment
			title="During Gathering"
			segment="core"
			items={decoratedCore}
			locked={isLocked}
			on:reorder={(event) => persistReorder('core', event.detail.itemIds)}
			on:create={(event) => createItem('core', event.detail.title)}
			on:edit={(event) => openEdit(event.detail.item)}
			on:durationChange={(event) => updateDuration(event.detail.itemId, event.detail.duration)}
		/>

		<PlanSegment
			title="Post-Gathering"
			segment="post"
			items={decoratedPost}
			locked={isLocked}
			on:reorder={(event) => persistReorder('post', event.detail.itemIds)}
			on:create={(event) => createItem('post', event.detail.title)}
			on:edit={(event) => openEdit(event.detail.item)}
			on:durationChange={(event) => updateDuration(event.detail.itemId, event.detail.duration)}
		/>
	</div>
</div>

{#if isModalOpen && editingItem}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<button
			type="button"
			class="absolute inset-0 h-full w-full bg-black/50"
			aria-label="Close dialog"
			onclick={closeModal}
		></button>

		<div
			use:trapFocus
			aria-labelledby="edit-item-title"
			class="relative z-10 w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
		>
			<h2 id="edit-item-title" class="text-lg font-semibold text-gray-900">Edit Item</h2>

			<form class="mt-4 space-y-4" onsubmit={submitEdit}>
				<!-- Item Type Selector -->
				<div>
					<span class="text-xs font-semibold text-gray-500 uppercase">Type</span>
					<div class="mt-2 flex flex-wrap gap-2">
						{#each ITEM_TYPES as itemType}
							<button
								type="button"
								onclick={() => {
									editType = itemType.value;
									if (itemType.value !== 'song') {
										editSongId = '';
										songSearchQuery = '';
									}
								}}
								class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors {editType === itemType.value
									? 'border-indigo-500 bg-indigo-50 text-indigo-700'
									: 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
							>
								<itemType.icon size={14} />
								{itemType.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Title -->
				<label class="block space-y-1">
					<span class="text-xs font-semibold text-gray-500 uppercase">Title</span>
					<input
						type="text"
						required
						bind:value={editTitle}
						class="w-full rounded-lg border border-gray-200 px-3 py-2"
					/>
				</label>

				<!-- Song Autocomplete (only visible when type is 'song') -->
				{#if editType === 'song'}
					<div class="relative">
						<span class="text-xs font-semibold text-gray-500 uppercase">Song</span>
						<div class="mt-1 flex items-center gap-2">
							<div class="relative flex-1">
								<input
									type="text"
									placeholder="Search songs..."
									bind:value={songSearchQuery}
									onfocus={() => (showSongDropdown = true)}
									class="w-full rounded-lg border border-gray-200 px-3 py-2"
								/>
								{#if showSongDropdown && filteredSongs.length > 0}
									<div class="absolute top-full z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
										{#each filteredSongs.slice(0, 10) as song}
											<button
												type="button"
												onclick={() => selectSong(song)}
												class="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50 {song.id === editSongId ? 'bg-indigo-50' : ''}"
											>
												<div>
													<div class="font-medium text-gray-900">{song.title}</div>
													{#if song.artist}
														<div class="text-xs text-gray-500">{song.artist}</div>
													{/if}
												</div>
												{#if song.original_key}
													<span class="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600">
														{song.original_key}
													</span>
												{/if}
											</button>
										{/each}
									</div>
								{/if}
							</div>
							{#if selectedSong}
								<button
									type="button"
									onclick={clearSong}
									class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
								>
									Clear
								</button>
							{/if}
						</div>
						{#if selectedSong}
							<div class="mt-2 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-2">
								<Music size={16} class="text-indigo-600" />
								<span class="flex-1 text-sm font-medium text-indigo-900">{selectedSong.title}</span>
								{#if selectedSong.original_key}
									<span class="rounded bg-white px-1.5 py-0.5 text-xs font-bold text-indigo-600">
										{selectedSong.original_key}
									</span>
								{/if}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Leader Picker -->
				<label class="block space-y-1">
					<span class="text-xs font-semibold text-gray-500 uppercase">Leader</span>
					<select
						bind:value={editLeaderId}
						class="w-full rounded-lg border border-gray-200 px-3 py-2"
					>
						<option value="">No leader assigned</option>
						{#each people as person}
							<option value={person.id}>
								{person.first_name} {person.last_name ?? ''}
							</option>
						{/each}
					</select>
				</label>

				<!-- Offset (for pre/post segments only) -->
				{#if editingItem?.segment === 'pre' || editingItem?.segment === 'post'}
					<label class="block space-y-1">
						<span class="text-xs font-semibold text-gray-500 uppercase">
							{editingItem.segment === 'pre' ? 'Minutes Before Start' : 'Minutes After End'}
						</span>
						<p class="text-xs text-gray-400">
							{editingItem.segment === 'pre'
								? 'How many minutes before service this item triggers (items can overlap)'
								: 'How many minutes after service ends this item triggers (items can overlap)'}
						</p>
						<input
							type="number"
							min="0"
							bind:value={editOffset}
							placeholder="0"
							class="w-32 rounded-lg border border-gray-200 px-3 py-2"
						/>
					</label>
				{/if}

				<!-- Duration -->
				<div>
					<span class="text-xs font-semibold text-gray-500 uppercase">Duration</span>
					<div class="mt-2 flex items-center gap-2">
						<label class="sr-only" for="edit-duration-min">Minutes</label>
						<input
							id="edit-duration-min"
							type="number"
							min="0"
							bind:value={editMinutes}
							class="w-20 rounded-lg border border-gray-200 px-3 py-2 text-center"
						/>
						<span class="text-sm text-gray-400">:</span>
						<label class="sr-only" for="edit-duration-sec">Seconds</label>
						<input
							id="edit-duration-sec"
							type="number"
							min="0"
							max="59"
							bind:value={editSeconds}
							class="w-20 rounded-lg border border-gray-200 px-3 py-2 text-center"
						/>
					</div>
				</div>

				<!-- Audible checkbox (hidden if song type, auto-set) -->
				{#if editType !== 'song'}
					<label class="flex items-center gap-2 text-sm text-gray-600">
						<input type="checkbox" bind:checked={editAudible} class="h-4 w-4" />
						Audible element (produces sound)
					</label>
				{/if}

				<div class="flex justify-end gap-3 pt-2">
					<button
						type="button"
						class="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
						onclick={closeModal}
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
					>
						Save
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
