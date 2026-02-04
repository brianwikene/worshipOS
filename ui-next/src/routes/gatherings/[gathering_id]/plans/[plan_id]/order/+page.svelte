<script lang="ts">
	import { format, addSeconds } from 'date-fns';
	import PlanSegment from '$lib/components/planning/PlanSegment.svelte';

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
	};

	let { data } = $props<{
		plan: { id: string; date: string | Date; status: string };
		items: PlanItem[];
	}>();

	let items = $state<PlanItem[]>(data.items ?? []);

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

	const decoratedPre = $derived(() => {
		const totalPre = preItems.reduce((acc, item) => acc + (item.duration ?? 0), 0);
		let elapsed = 0;
		return preItems.map((item) => {
			const remaining = Math.max(0, totalPre - elapsed);
			elapsed += item.duration ?? 0;
			return { ...item, timeLabel: `T-${formatDuration(remaining)}` };
		});
	});

	const decoratedCore = $derived(() => {
		let cursor = new Date(data.plan.date);
		return coreItems.map((item) => {
			const label = format(cursor, 'h:mm a');
			cursor = addSeconds(cursor, item.duration ?? 0);
			return { ...item, timeLabel: label };
		});
	});

	const decoratedPost = $derived(() => {
		let cursor = new Date(data.plan.date);
		for (const item of coreItems) {
			cursor = addSeconds(cursor, item.duration ?? 0);
		}
		return postItems.map((item) => {
			const label = format(cursor, 'h:mm a');
			cursor = addSeconds(cursor, item.duration ?? 0);
			return { ...item, timeLabel: label };
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
			duration: defaultDuration,
			order: (items.filter((item) => item.segment === segment).length ?? 0) + 1
		};

		items = [...items, tempItem];

		const formData = new FormData();
		formData.set('segment', segment);
		formData.set('title', title);

		const response = await fetch('?/createItem', { method: 'POST', body: formData });
		if (!response.ok) return;
		const result = await response.json();
		if (!result?.item) return;

		items = items.map((item) => (item.id === tempId ? result.item : item));
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
		formData.set('duration', String(duration));
		formData.set('song_id', item.song_id ?? '');
		formData.set('is_audible', item.is_audible ? 'on' : '');

		await fetch('?/editItem', { method: 'POST', body: formData });
	}

	let isModalOpen = $state(false);
	let editingItem = $state<PlanItem | null>(null);
	let editTitle = $state('');
	let editMinutes = $state(0);
	let editSeconds = $state(0);
	let editAudible = $state(false);
	let editSongId = $state('');

	function openEdit(item: PlanItem) {
		editingItem = item;
		editTitle = item.title;
		editMinutes = Math.floor((item.duration ?? 0) / 60);
		editSeconds = (item.duration ?? 0) % 60;
		editAudible = item.is_audible ?? false;
		editSongId = item.song_id ?? '';
		isModalOpen = true;
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
		formData.set('duration', String(duration));
		formData.set('song_id', editSongId.trim());
		formData.set('is_audible', editAudible ? 'on' : '');

		const response = await fetch('?/editItem', { method: 'POST', body: formData });
		if (!response.ok) return;
		const result = await response.json();
		if (result?.item) {
			items = items.map((item) => (item.id === result.item.id ? result.item : item));
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
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
		<button
			type="button"
			class="absolute inset-0 h-full w-full bg-black/50"
			aria-label="Close dialog"
			onclick={closeModal}
		></button>

		<div
			use:trapFocus
			aria-labelledby="edit-item-title"
			class="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
		>
			<h2 id="edit-item-title" class="text-lg font-semibold text-gray-900">Edit Item</h2>

			<form class="mt-4 space-y-4" onsubmit={submitEdit}>
				<label class="block space-y-1">
					<span class="text-xs font-semibold uppercase text-gray-500">Title</span>
					<input
						type="text"
						required
						bind:value={editTitle}
						class="w-full rounded-lg border border-gray-200 px-3 py-2"
					/>
				</label>

				<div>
					<span class="text-xs font-semibold uppercase text-gray-500">Duration</span>
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

				<label class="block space-y-1">
					<span class="text-xs font-semibold uppercase text-gray-500">Song ID</span>
					<input
						type="text"
						bind:value={editSongId}
						class="w-full rounded-lg border border-gray-200 px-3 py-2"
					/>
				</label>

				<label class="flex items-center gap-2 text-sm text-gray-600">
					<input type="checkbox" bind:checked={editAudible} class="h-4 w-4" />
					Audible element
				</label>

				<div class="flex justify-end gap-3">
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
