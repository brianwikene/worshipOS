<script lang="ts">
	import { enhance } from '$app/forms';
	import { Bookmark, Clock, GripVertical } from '@lucide/svelte';
	import { addSeconds, format, subSeconds } from 'date-fns';
	import { toZonedTime } from 'date-fns-tz';
	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	// MDI Icons
	import MdiBullhorn from '~icons/mdi/bullhorn';
	import MdiFlash from '~icons/mdi/flash';
	import MdiHandsPray from '~icons/mdi/hands-pray';
	import MdiMicrophone from '~icons/mdi/microphone';
	import MdiMovieOpen from '~icons/mdi/movie-open';
	import MdiMusic from '~icons/mdi/music';
	import MdiWater from '~icons/mdi/water';

	let { data } = $props();

	// --- 1. SEGMENTATION ENGINE ---
	// let preItems = $state<any[]>([]);
	// let coreItems = $state<any[]>([]);
	// let postItems = $state<any[]>([]);

	// $effect(() => {
	// 	preItems = data.items.filter((i: any) => i.segment === 'pre');
	// 	coreItems = data.items.filter((i: any) => i.segment === 'core');
	// 	postItems = data.items.filter((i: any) => i.segment === 'post');
	// });
	// svelte-ignore state_referenced_locally
	let preItems = $state(data.items.filter((i: any) => i.segment === 'pre'));
	// svelte-ignore state_referenced_locally
	let coreItems = $state(data.items.filter((i: any) => i.segment === 'core'));
	// svelte-ignore state_referenced_locally
	let postItems = $state(data.items.filter((i: any) => i.segment === 'post'));

	$effect(() => {
		preItems = data.items.filter((i: any) => i.segment === 'pre');
		coreItems = data.items.filter((i: any) => i.segment === 'core');
		postItems = data.items.filter((i: any) => i.segment === 'post');
	});
	// --- 2. TIME ENGINE ---
	let timeCalculations = $derived.by(() => {
		const tz = data.gathering?.campus?.timezone || 'America/Los_Angeles';
		const planStart = toZonedTime(new Date(data.plan.starts_at), tz);

		// A. PRE (Back-timed)
		const totalPreSeconds = preItems.reduce(
			(acc: number, i: any) => acc + (i.duration_seconds || 0),
			0
		);
		let preClock = subSeconds(planStart, totalPreSeconds);
		const calculatedPre = preItems.map((item: any) => {
			const time = preClock;
			preClock = addSeconds(preClock, item.duration_seconds || 0);
			return { ...item, _time: time };
		});

		// B. CORE (Forward-timed)
		let coreClock = planStart;
		const calculatedCore = coreItems.map((item: any) => {
			const time = coreClock;
			coreClock = addSeconds(coreClock, item.duration_seconds || 0);
			return { ...item, _time: time };
		});

		// C. POST (After Core)
		let postClock = coreClock;
		const calculatedPost = postItems.map((item: any) => {
			const time = postClock;
			postClock = addSeconds(postClock, item.duration_seconds || 0);
			return { ...item, _time: time };
		});

		return { pre: calculatedPre, core: calculatedCore, post: calculatedPost };
	});

	// --- 3. DRAG & DROP HANDLERS ---
	function handleDndPre(e: CustomEvent) {
		preItems = e.detail.items;
	}
	function handleDndCore(e: CustomEvent) {
		coreItems = e.detail.items;
	}
	function handleDndPost(e: CustomEvent) {
		postItems = e.detail.items;
	}

	async function finalizeDnd(segment: 'pre' | 'core' | 'post', newItems: any[]) {
		if (segment === 'pre') preItems = newItems;
		if (segment === 'core') coreItems = newItems;
		if (segment === 'post') postItems = newItems;

		const formData = new FormData();
		formData.append('items', JSON.stringify(newItems.map((i) => i.id)));
		formData.append('segment', segment);
		await fetch('?/reorderItems', { method: 'POST', body: formData });
	}

	// --- MODAL & STATE ---
	let showModal = $state(false);
	let editingItem = $state<any>(null);
	let selectedSegment = $state('core');

	let songSearchTerm = $state('');
	let selectedSong = $state<any>(null);
	let songMatches = $derived(
		songSearchTerm.length > 1 && songSearchTerm !== selectedSong?.title
			? data.songLibrary.filter((s: any) =>
					s.title.toLowerCase().includes(songSearchTerm.toLowerCase())
				)
			: []
	);

	function selectSong(song: any) {
		selectedSong = song;
		if (editingItem) editingItem.title = song.title;
		else songSearchTerm = song.title;
	}

	function openAdd(segment: string) {
		editingItem = null;
		selectedSegment = segment;
		selectedSong = null;
		songSearchTerm = '';
		showModal = true;
	}
	function openEdit(item: any) {
		editingItem = item;
		selectedSong = null;
		songSearchTerm = '';
		showModal = true;
	}
	function formatDuration(seconds: number) {
		if (!seconds) return '';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}
</script>

{#snippet itemIcon(type: string)}
	{#if type === 'song'}
		<div
			class="flex items-center justify-center rounded-md border border-blue-100 bg-blue-50 p-1.5 text-blue-600"
		>
			<MdiMusic class="text-lg" />
		</div>
	{:else if type === 'speech'}
		<div
			class="flex items-center justify-center rounded-md border border-stone-200 bg-stone-100 p-1.5 text-stone-600"
		>
			<MdiMicrophone class="text-lg" />
		</div>
	{:else if type === 'announcements'}
		<div
			class="flex items-center justify-center rounded-md border border-teal-100 bg-teal-50 p-1.5 text-teal-600"
		>
			<MdiBullhorn class="text-lg" />
		</div>
	{:else if type === 'baptism'}
		<div
			class="flex items-center justify-center rounded-md border border-cyan-100 bg-cyan-50 p-1.5 text-cyan-600"
		>
			<MdiWater class="text-lg" />
		</div>
	{:else if type === 'prayer'}
		<div
			class="flex items-center justify-center rounded-md border border-rose-100 bg-rose-50 p-1.5 text-rose-600"
		>
			<MdiHandsPray class="text-lg" />
		</div>
	{:else if type === 'media'}
		<div
			class="flex items-center justify-center rounded-md border border-purple-100 bg-purple-50 p-1.5 text-purple-600"
		>
			<MdiMovieOpen class="text-lg" />
		</div>
	{:else if type === 'header'}
		<div class="flex items-center justify-center text-white">
			<Bookmark size={16} strokeWidth={2.5} />
		</div>
	{:else}
		<div
			class="flex items-center justify-center rounded-md border border-amber-100 bg-amber-50 p-1.5 text-amber-600"
		>
			<MdiFlash class="text-lg" />
		</div>
	{/if}
{/snippet}

<div class="mx-auto max-w-5xl pt-6 pb-32">
	<div class="mb-8 flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold tracking-tight text-gray-900">Worship Order</h2>
			<p class="mt-1 font-mono text-sm text-gray-500">
				Start: {data.gathering?.date ? format(new Date(data.gathering.date), 'h:mm a') : 'Unknown'}
			</p>
		</div>
	</div>

	<section class="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-slate-50">
		<header class="flex items-center justify-between bg-slate-800 px-4 py-2 text-white">
			<h3 class="text-xs font-bold tracking-wider uppercase opacity-80">Pre-Service</h3>
			<button
				onclick={() => openAdd('pre')}
				class="text-xs font-bold text-blue-200 hover:text-white">+ Add Item</button
			>
		</header>
		<div
			use:dndzone={{ items: preItems, flipDurationMs: 200 }}
			onconsider={handleDndPre}
			onfinalize={(e) => finalizeDnd('pre', e.detail.items)}
			class="min-h-[50px]"
		>
			{#each timeCalculations.pre as item (item.id)}
				<div
					animate:flip={{ duration: 200 }}
					class="group relative grid w-full grid-cols-[30px_60px_60px_50px_1fr] items-center gap-4 px-4 text-left transition-colors
                      {item.type === 'header'
						? 'border-y border-slate-700 bg-slate-600 py-3 text-white'
						: 'border-b border-gray-100 bg-white py-3 hover:bg-blue-50/30'}"
				>
					<div
						class="flex cursor-grab justify-center {item.type === 'header'
							? 'text-slate-400'
							: 'text-gray-300 opacity-0 group-hover:opacity-100'}"
					>
						<GripVertical size={16} />
					</div>
					<div
						class="text-center font-mono text-xs {item.type === 'header'
							? 'invisible'
							: 'font-medium text-gray-500'}"
					>
						{format(item._time, 'h:mm a').toLowerCase().replace(' ', '')}
					</div>
					<div
						class="text-center text-xs font-medium {item.type === 'header'
							? 'invisible'
							: 'text-gray-400'}"
					>
						{formatDuration(item.duration_seconds || 0)}
					</div>
					<div class="flex justify-center">{@render itemIcon(item.type || 'element')}</div>

					<button
						onclick={() => openEdit(item)}
						class="w-full min-w-0 text-left focus:outline-none"
					>
						<div class="flex flex-col justify-center">
							<span
								class="truncate text-sm leading-tight {item.type === 'header'
									? 'font-bold tracking-wider text-white uppercase'
									: 'font-bold text-gray-900'}"
							>
								{item.title}
							</span>
							{#if item.private_notes && item.type !== 'header'}
								<div class="mt-0.5">
									<span class="block truncate text-xs font-normal text-gray-500 italic"
										>{item.private_notes}</span
									>
								</div>
							{/if}
						</div>
					</button>
				</div>
			{/each}
			{#if preItems.length === 0}
				<div class="py-4 text-center text-xs text-gray-400 italic">Empty</div>
			{/if}
		</div>
	</section>

	<section class="mb-4 overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-xl">
		<header class="flex items-center justify-between bg-slate-900 px-4 py-3">
			<div class="flex items-center gap-2">
				<Clock size={16} class="text-pink-500" />
				<h3 class="text-sm font-black tracking-wider text-white uppercase">The Gathering</h3>
			</div>
			<button
				onclick={() => openAdd('core')}
				class="rounded bg-white/20 px-3 py-1 text-xs font-bold text-white hover:bg-white/30"
				>+ Add Item</button
			>
		</header>
		<div
			use:dndzone={{ items: coreItems, flipDurationMs: 200 }}
			onconsider={handleDndCore}
			onfinalize={(e) => finalizeDnd('core', e.detail.items)}
			class="min-h-[100px] bg-white"
		>
			{#each timeCalculations.core as item (item.id)}
				<div
					animate:flip={{ duration: 200 }}
					class="group relative grid w-full grid-cols-[30px_60px_60px_50px_1fr] items-center gap-4 px-4 text-left transition-colors
                      {item.type === 'header'
						? 'border-y border-slate-700 bg-slate-600 py-3 text-white'
						: 'border-b border-gray-100 bg-white py-3 hover:bg-blue-50/30'}"
				>
					<div
						class="flex cursor-grab justify-center {item.type === 'header'
							? 'text-slate-400'
							: 'text-gray-300 opacity-0 group-hover:opacity-100'}"
					>
						<GripVertical size={16} />
					</div>
					<div
						class="text-center font-mono text-xs {item.type === 'header'
							? 'invisible'
							: 'font-medium text-gray-500'}"
					>
						{format(item._time, 'h:mm a').toLowerCase().replace(' ', '')}
					</div>
					<div
						class="text-center text-xs font-medium {item.type === 'header'
							? 'invisible'
							: 'text-gray-400'}"
					>
						{formatDuration(item.duration_seconds || 0)}
					</div>
					<div class="flex justify-center">{@render itemIcon(item.type || 'element')}</div>

					<button
						onclick={() => openEdit(item)}
						class="w-full min-w-0 text-left focus:outline-none"
					>
						<div class="flex flex-col justify-center">
							<span
								class="truncate text-sm leading-tight {item.type === 'header'
									? 'font-bold tracking-wider text-white uppercase'
									: 'font-bold text-gray-900'}"
							>
								{item.title}
							</span>
							{#if item.private_notes && item.type !== 'header'}
								<div class="mt-0.5">
									<span class="block truncate text-xs font-normal text-gray-500 italic"
										>{item.private_notes}</span
									>
								</div>
							{/if}
						</div>
					</button>
				</div>
			{/each}
			{#if coreItems.length === 0}
				<div class="py-12 text-center text-gray-400 italic">No items yet.</div>
			{/if}
		</div>
	</section>

	<section class="mb-12 overflow-hidden rounded-xl border border-gray-200 bg-slate-50 opacity-90">
		<header class="flex items-center justify-between bg-slate-800 px-4 py-2 text-white">
			<h3 class="text-xs font-bold tracking-wider uppercase opacity-80">Post-Service</h3>
			<button
				onclick={() => openAdd('post')}
				class="text-xs font-bold text-blue-200 hover:text-white">+ Add Item</button
			>
		</header>
		<div
			use:dndzone={{ items: postItems, flipDurationMs: 200 }}
			onconsider={handleDndPost}
			onfinalize={(e) => finalizeDnd('post', e.detail.items)}
			class="min-h-[50px]"
		>
			{#each timeCalculations.post as item (item.id)}
				<div
					animate:flip={{ duration: 200 }}
					class="group relative grid w-full grid-cols-[30px_60px_60px_50px_1fr] items-center gap-4 px-4 text-left transition-colors
                      {item.type === 'header'
						? 'border-y border-slate-700 bg-slate-600 py-3 text-white'
						: 'border-b border-gray-100 bg-white py-3 hover:bg-blue-50/30'}"
				>
					<div
						class="flex cursor-grab justify-center {item.type === 'header'
							? 'text-slate-400'
							: 'text-gray-300 opacity-0 group-hover:opacity-100'}"
					>
						<GripVertical size={16} />
					</div>
					<div
						class="text-center font-mono text-xs {item.type === 'header'
							? 'invisible'
							: 'font-medium text-gray-500'}"
					>
						{format(item._time, 'h:mm a').toLowerCase().replace(' ', '')}
					</div>
					<div
						class="text-center text-xs font-medium {item.type === 'header'
							? 'invisible'
							: 'text-gray-400'}"
					>
						{formatDuration(item.duration_seconds || 0)}
					</div>
					<div class="flex justify-center">{@render itemIcon(item.type || 'element')}</div>

					<button
						onclick={() => openEdit(item)}
						class="w-full min-w-0 text-left focus:outline-none"
					>
						<div class="flex flex-col justify-center">
							<span
								class="truncate text-sm leading-tight {item.type === 'header'
									? 'font-bold tracking-wider text-white uppercase'
									: 'font-bold text-gray-900'}"
							>
								{item.title}
							</span>
							{#if item.private_notes && item.type !== 'header'}
								<div class="mt-0.5">
									<span class="block truncate text-xs font-normal text-gray-500 italic"
										>{item.private_notes}</span
									>
								</div>
							{/if}
						</div>
					</button>
				</div>
			{/each}
			{#if postItems.length === 0}
				<div class="py-4 text-center text-xs text-gray-400 italic">Empty</div>
			{/if}
		</div>
	</section>
</div>

{#if showModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<button
			class="absolute inset-0 h-full w-full cursor-default bg-gray-900/50 backdrop-blur-sm"
			onclick={() => (showModal = false)}
			aria-label="Close modal"
		></button>

		<div class="relative z-10 w-full max-w-lg rounded-xl bg-white shadow-2xl">
			<div class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
				<h3 class="font-bold text-gray-800">
					{editingItem ? 'Edit Item' : `Add to ${selectedSegment.toUpperCase()}`}
				</h3>
				<button onclick={() => (showModal = false)} class="text-gray-400 hover:text-gray-600"
					>✕</button
				>
			</div>

			<form
				method="POST"
				action={editingItem ? '?/editItem' : '?/addItem'}
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						showModal = false;
					};
				}}
				class="space-y-4 p-6"
			>
				<input
					type="hidden"
					name="segment"
					value={editingItem ? editingItem.segment : selectedSegment}
				/>
				{#if editingItem}
					<input type="hidden" name="id" value={editingItem.id} />
				{/if}

				<label class="block space-y-1">
					<span class="text-xs font-bold text-gray-500 uppercase">Title</span>
					<input
						type="hidden"
						name="song_id"
						value={selectedSong?.id || editingItem?.song_id || ''}
					/>
					<input
						use:focusOnMount
						type="text"
						name="title"
						required
						value={editingItem ? editingItem.title : songSearchTerm}
						oninput={(e) => {
							const val = e.currentTarget.value;
							if (editingItem) editingItem.title = val;
							else songSearchTerm = val;
							if (selectedSong && val !== selectedSong.title) selectedSong = null;
						}}
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold"
						placeholder="Item title..."
					/>
				</label>

				{#if songMatches.length > 0}
					<div
						class="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border bg-white shadow-xl"
					>
						{#each songMatches as song}
							<button
								type="button"
								onclick={() => selectSong(song)}
								class="block w-full px-4 py-2 text-left text-sm hover:bg-blue-50"
							>
								<span class="font-bold">{song.title}</span>
							</button>
						{/each}
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-4">
					<label class="block space-y-1">
						<span class="text-xs font-bold text-gray-500 uppercase">Type</span>
						<select
							name="type"
							class="w-full rounded-lg border border-gray-300 p-2 text-sm"
							value={editingItem?.type || 'song'}
						>
							<option value="song">Song</option>
							<option value="announcements">Announcements</option>
							<option value="speech">Speech</option>
							<option value="element">Element</option>
							<option value="header" class="bg-slate-200 font-bold">-- Section Header --</option>
						</select>
					</label>

					<div class="space-y-1">
						<span class="text-xs font-bold text-gray-500 uppercase">Duration (Min/Sec)</span>
						<div class="flex gap-2">
							<input
								type="number"
								name="duration_min"
								value={editingItem ? Math.floor(editingItem.duration_seconds / 60) : 5}
								class="w-full rounded-lg border p-2 text-center text-sm"
								aria-label="Minutes"
							/>
							<input
								type="number"
								name="duration_sec"
								value={editingItem ? editingItem.duration_seconds % 60 : 0}
								class="w-full rounded-lg border p-2 text-center text-sm"
								aria-label="Seconds"
							/>
						</div>
					</div>
				</div>

				<div class="flex justify-end gap-3 pt-4">
					<button
						type="button"
						onclick={() => (showModal = false)}
						class="px-4 py-2 text-sm text-gray-500">Cancel</button
					>
					<button
						class="rounded-lg bg-gray-900 px-6 py-2 text-sm font-bold text-white hover:bg-gray-800"
						>Save</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
