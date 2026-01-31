<script lang="ts">
	import { enhance } from '$app/forms';
	import { Bookmark, ClipboardList, Clock, GripVertical, Plus, User } from '@lucide/svelte';
	// MDI Icons
	import MdiBullhorn from '~icons/mdi/bullhorn';
	import MdiFlash from '~icons/mdi/flash';
	import MdiHandsPray from '~icons/mdi/hands-pray';
	import MdiMicrophone from '~icons/mdi/microphone';
	import MdiMovieOpen from '~icons/mdi/movie-open';
	import MdiMusic from '~icons/mdi/music';
	import MdiWater from '~icons/mdi/water';

	import { dndzone } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';

	let { data } = $props();

	// FIX: Define a type that includes the extra calculated fields
	type ExtendedPlanItem = (typeof data.items)[number] & {
		duration_seconds?: number;
		leader_name?: string;
		private_notes?: string;
	};

	// Use a derived value to cast the data to this new type
	let planItems = $derived(data.items as ExtendedPlanItem[]);

	// svelte-ignore state_referenced_locally
	let items = $state(planItems);
	let showModal = $state(false);
	let editingItem = $state<any>(null);

	let showTemplateModal = $state(false);
	let showSaveTemplateModal = $state(false);

	// --- SONG PICKER STATE ---
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
		if (editingItem) {
			editingItem.title = song.title;
		} else {
			songSearchTerm = song.title;
		}
	}

	// --- NEW: PERSON PICKER STATE ---
	let personSearchTerm = $state('');
	let selectedPerson = $state<any>(null);

	let personMatches = $derived(
		personSearchTerm.length > 0 &&
			personSearchTerm !== (selectedPerson?.preferred_name || selectedPerson?.first_name)
			? data.peopleDirectory.filter(
					(p: any) =>
						p.first_name.toLowerCase().includes(personSearchTerm.toLowerCase()) ||
						(p.preferred_name &&
							p.preferred_name.toLowerCase().includes(personSearchTerm.toLowerCase()))
				)
			: []
	);

	function selectPerson(person: any) {
		selectedPerson = person;
		const nameToUse = person.preferred_name || person.first_name;

		if (editingItem) {
			editingItem.leader_name = nameToUse;
		} else {
			personSearchTerm = nameToUse;
		}
	}

	$effect(() => {
		items = planItems;
	});

	// --- SMART TIME ENGINE ---
	let calculatedItems = $derived.by(() => {
		const startStr = data.instance.start_time || '09:00:00';
		const [startH, startM] = startStr.split(':').map(Number);
		const serviceStartTime = new Date();
		serviceStartTime.setHours(startH, startM, 0, 0);

		let preServiceSeconds = 0;
		let foundGatheringHeader = false;

		for (const item of items) {
			const title = (item.title || '').toLowerCase();
			const isHeader = item.type === 'header';

			if (title.includes('pre-') || title.includes('pre ')) {
				if (!foundGatheringHeader) {
					preServiceSeconds += item.duration_seconds || 0;
				}
				continue;
			}

			const isMainStart =
				isHeader &&
				(title.includes('gathering') ||
					title.includes('service') ||
					title.includes('flow') ||
					title.includes('welcome') ||
					title.includes('worship'));

			if (isMainStart) {
				foundGatheringHeader = true;
				break;
			}

			if (!foundGatheringHeader) {
				preServiceSeconds += item.duration_seconds || 0;
			}
		}

		let currentClock = new Date(serviceStartTime);
		if (foundGatheringHeader) {
			currentClock.setSeconds(currentClock.getSeconds() - preServiceSeconds);
		}

		return items.map((item) => {
			const timeString = currentClock
				.toLocaleTimeString([], {
					hour: 'numeric',
					minute: '2-digit'
				})
				.toLowerCase()
				.replace(' ', '');

			currentClock.setSeconds(currentClock.getSeconds() + (item.duration_seconds || 0));

			return { ...item, formatted_time: timeString };
		});
	});

	// --- DRAG AND DROP ---
	const flipDurationMs = 200;
	function handleDndConsider(e: CustomEvent) {
		items = e.detail.items;
	}
	async function handleDndFinalize(e: CustomEvent) {
		items = e.detail.items;
		const formData = new FormData();
		formData.append('itemIds', JSON.stringify(items.map((i: any) => i.id)));
		await fetch('?/reorderItems', { method: 'POST', body: formData });
	}

	// --- ACTIONS ---
	function openAdd() {
		editingItem = null;
		// Clear searches
		selectedSong = null;
		songSearchTerm = '';
		selectedPerson = null;
		personSearchTerm = '';
		showModal = true;
	}

	function openEdit(item: any) {
		editingItem = item;
		// Clear searches
		selectedSong = null;
		songSearchTerm = '';
		selectedPerson = null;
		personSearchTerm = '';
		showModal = true;
	}

	function focusOnMount(node: HTMLInputElement) {
		node.focus();
	}

	function formatDuration(seconds: number) {
		if (!seconds) return '';
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
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

<div class="mx-auto max-w-5xl pb-32">
	<div class="mb-6 flex items-center justify-between pt-6">
		<div>
			<h2 class="text-2xl font-bold tracking-tight text-gray-900">Worship Order</h2>
			<p class="mt-1 font-mono text-sm text-gray-500">
				Start Time: {data.instance.start_time?.slice(0, 5)}
			</p>
		</div>

		<div class="flex gap-2">
			<button
				onclick={() => (showSaveTemplateModal = true)}
				class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50"
			>
				Save as Template
			</button>

			<button
				onclick={() => (showTemplateModal = true)}
				class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-100"
			>
				Apply Template
			</button>
		</div>
	</div>

	<div class="relative isolate rounded-xl border border-gray-200 bg-white shadow-sm">
		<div
			class="sticky top-0 z-40 grid grid-cols-[30px_60px_60px_50px_1fr] gap-4 rounded-t-xl border-b border-gray-200 bg-gray-50 px-4 py-3 text-[11px] font-bold tracking-wider text-gray-400 uppercase shadow-sm"
		>
			<div></div>
			<div class="text-center">Time</div>
			<div class="text-center">Dur</div>
			<div></div>
			<div>Item</div>
		</div>

		<section
			use:dndzone={{ items, flipDurationMs, dropTargetStyle: {} }}
			onconsider={handleDndConsider}
			onfinalize={handleDndFinalize}
			class="divide-y divide-gray-100"
		>
			{#each calculatedItems as item (item.id)}
				<div
					animate:flip={{ duration: flipDurationMs }}
					class="group relative grid w-full grid-cols-[30px_60px_60px_50px_1fr] items-center gap-4 px-4 text-left transition-colors
                    {item.type === 'header'
						? 'sticky top-10.25 z-30 border-y border-gray-900 bg-gray-900 py-3 shadow-md'
						: 'z-10 bg-white py-3 hover:bg-blue-50/30'}"
				>
					<div
						class="flex cursor-grab justify-center text-gray-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-500"
					>
						<GripVertical size={16} class={item.type === 'header' ? 'text-gray-600' : ''} />
					</div>

					<div
						class="text-center font-mono text-xs {item.type === 'header'
							? 'text-gray-500'
							: 'font-medium text-gray-500'}"
					>
						{item.type === 'header' ? '' : item.formatted_time}
					</div>

					<div
						class="text-center text-xs font-medium {item.type === 'header'
							? 'text-gray-500'
							: 'text-gray-400 group-hover:text-gray-600'}"
					>
						{formatDuration(item.duration_seconds || 0)}
					</div>

					<div class="flex justify-center">
						{@render itemIcon(item.type || 'element')}
					</div>

					<button
						onclick={() => openEdit(item)}
						class="w-full min-w-0 text-left focus:outline-none"
					>
						<div class="flex flex-col justify-center">
							<div class="flex flex-col items-start gap-0.5">
								<div class="flex w-full items-center gap-2">
									<span
										class="truncate text-sm leading-tight {item.type === 'header'
											? 'pl-1 text-sm font-bold tracking-wider text-white uppercase'
											: 'font-bold text-gray-900'} {item.type === 'media'
											? 'font-medium text-gray-700 italic'
											: ''}"
									>
										{item.title}
									</span>

									{#if item.leader_name}
										<span
											class="inline-flex shrink-0 items-center gap-1 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600"
										>
											<User size={10} />
											{item.leader_name}
										</span>
									{/if}
								</div>

								{#if item.song}
									<div class="mt-0.5 flex items-center gap-2">
										{#if item.song.original_key}
											<span
												class="rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-blue-600"
											>
												Key: {item.song.original_key}
											</span>
										{/if}
										{#if item.song.tempo}
											<span class="font-mono text-[10px] text-gray-500">
												{item.song.tempo} bpm
											</span>
										{/if}
										{#if item.song.author}
											<span class="max-w-40 truncate text-[10px] text-gray-400">
												by {item.song.author}
											</span>
										{/if}
									</div>
								{/if}
							</div>

							{#if item.private_notes && item.type !== 'header'}
								<div class="mt-0.5">
									<span
										class="block text-xs leading-relaxed font-normal whitespace-pre-wrap text-gray-500 italic"
									>
										{item.private_notes}
									</span>
								</div>
							{/if}
						</div>
					</button>
				</div>
			{/each}
		</section>

		{#if items.length === 0}
			<div class="flex flex-col items-center gap-3 p-16 text-center text-gray-400 italic">
				<div class="rounded-full bg-gray-50 p-4">
					<ClipboardList size={32} class="text-gray-300" strokeWidth={1.5} />
				</div>
				<span class="text-sm">The plan is empty. Click "Add Item" to start.</span>
			</div>
		{/if}
	</div>
</div>

<div class="fixed right-6 bottom-6 z-50">
	<button
		onclick={openAdd}
		class="flex items-center gap-2 rounded-full bg-gray-900 px-5 py-3 font-bold text-white shadow-lg ring-2 ring-white transition-all hover:scale-105 hover:bg-gray-800"
	>
		<Plus size={20} />
		Add Item
	</button>
</div>

{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			class="absolute inset-0 h-full w-full cursor-default bg-gray-900/40 backdrop-blur-sm"
			onclick={() => (showModal = false)}
			aria-label="Close modal"
		></button>

		<div
			class="relative z-10 w-full max-w-lg overflow-visible rounded-xl border border-gray-200 bg-white shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
				<h3 class="font-bold text-gray-800">
					{editingItem ? 'Edit Item' : 'Add to Plan'}
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
				{#if editingItem}
					<input type="hidden" name="id" value={editingItem.id} />
				{/if}

				<div class="grid grid-cols-3 gap-4">
					<div class="relative col-span-2 space-y-1">
						<label for="title" class="text-xs font-bold text-gray-500 uppercase">Title</label>

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
							autocomplete="off"
							value={editingItem ? editingItem.title : songSearchTerm}
							oninput={(e) => {
								const val = e.currentTarget.value;
								if (editingItem) editingItem.title = val;
								else songSearchTerm = val;

								// Clear selection if user types something new
								if (selectedSong && val !== selectedSong.title) selectedSong = null;
							}}
							placeholder="e.g. Way Maker"
							class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
						/>

						{#if songMatches.length > 0}
							<div
								class="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl"
							>
								{#each songMatches as song}
									<button
										type="button"
										onclick={() => selectSong(song)}
										class="flex w-full items-center justify-between border-b border-gray-100 px-4 py-2 text-left text-sm last:border-0 hover:bg-blue-50"
									>
										<span class="font-bold text-gray-800">{song.title}</span>
										<span class="text-xs text-gray-400"
											>{song.original_key || '-'} • {song.tempo || '-'} bpm</span
										>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<div class="space-y-1">
						<label for="type" class="text-xs font-bold text-gray-500 uppercase">Type</label>
						<select
							name="type"
							class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
							value={editingItem?.type || 'song'}
						>
							<option value="song">Song</option>
							<option value="announcements">Announcements</option>
							<option value="speech">Speech</option>
							<option value="prayer">Prayer</option>
							<option value="baptism">Baptism</option>
							<option value="media">Media</option>
							<option value="element">Element</option>
							<option value="header" class="bg-gray-100 font-bold text-gray-900"
								>--- Section Header ---</option
							>
						</select>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div class="space-y-1">
						<label for="duration" class="text-xs font-bold text-gray-500 uppercase">Duration</label>
						<div class="flex items-center gap-2">
							<Clock size={16} class="text-gray-400" />
							<input
								type="number"
								name="duration_min"
								value={editingItem ? Math.floor(editingItem.duration_seconds / 60) : 5}
								class="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
							/>
							<span class="text-xs text-gray-400">min</span>
							<input
								type="number"
								name="duration_sec"
								value={editingItem ? editingItem.duration_seconds % 60 : 0}
								class="w-16 rounded-lg border border-gray-300 px-2 py-2 text-center text-sm"
							/>
						</div>
					</div>

					<div class="relative space-y-1">
						<label for="leader" class="text-xs font-bold text-gray-500 uppercase"
							>Who is leading?</label
						>

						<input
							type="hidden"
							name="person_id"
							value={selectedPerson?.id || editingItem?.person_id || ''}
						/>

						<div class="relative">
							<div class="absolute top-2.5 left-3 text-gray-400">
								<User size={16} />
							</div>
							<input
								type="text"
								name="leader"
								autocomplete="off"
								value={editingItem ? editingItem.leader_name : personSearchTerm}
								oninput={(e) => {
									const val = e.currentTarget.value;
									if (editingItem) editingItem.leader_name = val;
									else personSearchTerm = val;

									if (
										selectedPerson &&
										val !== (selectedPerson.preferred_name || selectedPerson.first_name)
									) {
										selectedPerson = null;
									}
								}}
								placeholder="e.g. Kenny"
								class="w-full rounded-lg border border-gray-300 py-2 pr-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						{#if personMatches.length > 0}
							<div
								class="absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl"
							>
								{#each personMatches as person}
									<button
										type="button"
										onclick={() => selectPerson(person)}
										class="flex w-full items-center gap-2 border-b border-gray-100 px-4 py-2 text-left text-sm last:border-0 hover:bg-blue-50"
									>
										<div
											class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-600"
										>
											{person.first_name[0]}{person.last_name[0]}
										</div>
										<div>
											<span class="font-bold text-gray-800"
												>{person.preferred_name || person.first_name}</span
											>
											<span class="ml-1 text-xs text-gray-400">{person.last_name}</span>
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<div class="space-y-1">
					<label for="notes" class="text-xs font-bold text-gray-500 uppercase">Notes</label>
					<textarea
						name="notes"
						rows="3"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
						placeholder="Technical details, key change, etc..."
						value={editingItem?.private_notes || ''}
					></textarea>
				</div>

				<div class="flex items-center justify-between pt-4">
					<div>
						{#if editingItem}
							<input
								type="hidden"
								name="current_order"
								value={JSON.stringify(items.map((i) => i.id))}
							/>
							<button
								type="submit"
								formaction="?/deleteItem"
								class="text-sm font-medium text-red-500 transition hover:text-red-700"
								onclick={(e) => {
									if (!confirm('Remove this item from the plan?')) e.preventDefault();
								}}
							>
								Remove Item
							</button>
						{/if}
					</div>

					<div class="flex gap-3">
						<button
							type="button"
							onclick={() => (showModal = false)}
							class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
							>Cancel</button
						>
						<button
							type="submit"
							class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800"
						>
							{editingItem ? 'Save Changes' : 'Add Item'}
						</button>
					</div>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if showTemplateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			class="absolute inset-0 h-full w-full cursor-default bg-gray-900/40 backdrop-blur-sm"
			onclick={() => (showTemplateModal = false)}
			aria-label="Close modal"
		></button>

		<div
			class="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
		>
			<h3 class="mb-4 text-lg font-bold text-gray-900">Choose a Template</h3>
			<form
				method="POST"
				action="?/applyTemplate"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						showTemplateModal = false;
					};
				}}
			>
				<div class="max-h-[60vh] space-y-3 overflow-y-auto">
					{#if data.availableTemplates && data.availableTemplates.length > 0}
						{#each data.availableTemplates as template}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 transition hover:bg-blue-50"
							>
								<input
									type="radio"
									name="template_id"
									value={template.id}
									class="text-blue-600 focus:ring-blue-500"
									required
								/>
								<span class="font-medium text-gray-700">{template.name}</span>
							</label>
						{/each}
					{:else}
						<div
							class="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center"
						>
							<p class="text-sm text-gray-500 italic">No templates found.</p>
							<p class="mt-1 text-xs text-gray-400">Save a plan as a template to see it here.</p>
						</div>
					{/if}
				</div>
				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showTemplateModal = false)}
						class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button
					>
					<button
						type="submit"
						class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
						>Load Template</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if showSaveTemplateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<button
			class="absolute inset-0 h-full w-full cursor-default bg-gray-900/40 backdrop-blur-sm"
			onclick={() => (showSaveTemplateModal = false)}
			aria-label="Close modal"
		></button>

		<div
			class="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl"
		>
			<h3 class="mb-2 text-lg font-bold text-gray-900">Save as Template</h3>
			<p class="mb-6 text-sm text-gray-500">
				This will save the current order (items, times, and notes) as a new template for future use.
			</p>

			<form
				method="POST"
				action="?/saveAsTemplate"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						showSaveTemplateModal = false;
					};
				}}
			>
				<div class="mb-6 space-y-1">
					<label for="template_name" class="text-xs font-bold text-gray-500 uppercase"
						>Template Name</label
					>
					<input
						type="text"
						name="template_name"
						required
						placeholder="e.g. Standard Sunday Service"
						class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
				<div class="flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (showSaveTemplateModal = false)}
						class="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button
					>
					<button
						type="submit"
						class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800"
						>Save Template</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
