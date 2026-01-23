<!-- /ui/src/lib/components/FlowRowsTable.svelte -->
<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { apiFetch, apiJson } from '$lib/api';
	import { onMount } from 'svelte';

	type Song = {
		id: string;
		song_id: string;
		title: string;
		artist: string | null;
		key: string | null;
		bpm: number | null;
		display_order: number;
		notes: string | null;
	};

	type AvailableSong = {
		id: string;
		title: string;
		artist: string | null;
		key: string | null;
		bpm: number | null;
	};

	type Assignment = {
		id: string | null;
		role_id: string;
		role_name: string;
		ministry_area: string;
		person_id: string | null;
		person_name: string | null;
		status: string;
		is_lead: boolean;
		is_required: boolean;
		notes: string | null;
	};

	type PersonOption = {
		id: string;
		name: string;
	};

	type OrderItemType = 'header' | 'item' | 'note' | 'song';

	type OrderRow = {
		id: string;
		sort_order: number;
		item_type: OrderItemType | string;
		title: string | null;
		duration_seconds: number | null;
		notes: string | null;
		role_id: string | null;
		person_id: string | null;
		related_item_id: string | null;

		// optional convenience fields if your API provides them
		role_name?: string | null;
		person_name?: string | null;
	};

	type PageData = {
		service: { id: string } | null;
		songs: Song[];
		availableSongs: AvailableSong[];
		assignments?: Assignment[];
		people?: any[];
	};

	const { data } = $props<{ data: PageData }>();

	const service = $derived(data?.service ?? null);
	const songs = $derived((data?.songs ?? []) as Song[]);
	const availableSongs = $derived((data?.availableSongs ?? []) as AvailableSong[]);
	const assignments = $derived(((data?.assignments ?? []) as Assignment[]) ?? []);

	// People options
	let peopleOptions = $state<PersonOption[]>([]);

	// ===== Run Sheet state =====
	let orderItems = $state<OrderRow[]>([]);
	let loadingOrder = $state(false);
	let orderError = $state<string | null>(null);

	// Add Section modal
	let showAddSectionModal = $state(false);
	let sectionTitle = $state('');
	let sectionNotes = $state('');

	// Add Item modal
	let showAddItemModal = $state(false);
	let itemTitle = $state('');
	let itemDurationText = $state(''); // "4:00" or "240"
	let itemRoleId = $state('');
	let itemPersonId = $state('');
	let itemNotes = $state('');

	// Add Note modal
	let showAddNoteModal = $state(false);
	let noteParentId = $state<string | null>(null);
	let noteText = $state('');

	// Edit Row modal
	let showEditRowModal = $state(false);
	let editingRow = $state<OrderRow | null>(null);
	let editTitle = $state('');
	let editDurationText = $state('');
	let editRoleId = $state('');
	let editPersonId = $state('');
	let editNotes = $state('');
	let editNoteText = $state('');

	// Busy flags
	let creatingRow = $state(false);
	let updatingRow = $state(false);
	let deletingRowId = $state<string | null>(null);

	// ===== Setlist (existing) =====
	let showAddSongModal = $state(false);
	let searchQuery = $state('');
	let selectedSongId = $state('');
	let songKey = $state('');
	let songNotes = $state('');
	let addingSong = $state(false);

	// Edit song modal state
	let showEditSongModal = $state(false);
	let editingSong = $state<Song | null>(null);
	let editSongKey = $state('');
	let editSongNotes = $state('');
	let savingEdit = $state(false);

	// View chart modal state
	let showChartModal = $state(false);
	let chartSong = $state<Song | null>(null);

	// ===== Helpers =====
	function uniqPeopleFromAssignments(asgs: Assignment[] | null | undefined) {
		const safe = Array.isArray(asgs) ? asgs : [];
		const map = new Map<string, string>();

		for (const a of safe) {
			if (a?.person_id && a?.person_name) map.set(a.person_id, a.person_name);
		}

		return Array.from(map.entries())
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	function toPersonOptions(rows: any[]): PersonOption[] {
		const safe = Array.isArray(rows) ? rows : [];
		const map = new Map<string, string>();

		for (const p of safe) {
			const id = p?.id ?? p?.person_id ?? null;
			const name =
				p?.display_name ??
				p?.name ??
				([p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || null);

			if (id && name) map.set(id, name);
		}

		return Array.from(map.entries())
			.map(([id, name]) => ({ id, name }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	async function loadPeopleOptions() {
		// Prefer server-provided people if you ever add it to +layout.ts
		const fromData = (data as any)?.people;
		if (Array.isArray(fromData) && fromData.length) {
			peopleOptions = toPersonOptions(fromData);
			return;
		}

		// Fallback to your existing people API (same one People tab uses)
		try {
			const rows = await apiJson<any[]>('/api/people');
			peopleOptions = toPersonOptions(rows);
		} catch (e) {
			console.error('Order: failed to load /api/people', e);
			peopleOptions = [];
		}
	}

	function parseDurationToSeconds(input: string): number | null {
		const raw = (input ?? '').trim();
		if (!raw) return null;

		// allow "mm:ss" or "m:ss"
		if (raw.includes(':')) {
			const [mmStr, ssStr] = raw.split(':');
			const mm = Number(mmStr);
			const ss = Number(ssStr);
			if (!Number.isFinite(mm) || !Number.isFinite(ss) || mm < 0 || ss < 0 || ss >= 60) return null;
			return mm * 60 + ss;
		}

		// allow raw seconds "240"
		const n = Number(raw);
		if (!Number.isFinite(n) || n < 0) return null;
		return Math.floor(n);
	}

	function formatSeconds(secs: number | null): string {
		if (secs === null || secs === undefined) return '';
		const m = Math.floor(secs / 60);
		const s = secs % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function rowLabel(row: OrderRow) {
		if (row.item_type === 'header') return 'Section';
		if (row.item_type === 'item') return 'Item';
		if (row.item_type === 'note') return 'Note';
		return row.item_type;
	}

	function getTopLevelRows(rows: OrderRow[]) {
		// Render all non-note rows in order. Notes render under their parent via related_item_id.
		return rows.filter((r) => r.item_type !== 'note').sort((a, b) => a.sort_order - b.sort_order);
	}

	function notesForParent(rows: OrderRow[], parentId: string) {
		return rows
			.filter((r) => r.item_type === 'note' && r.related_item_id === parentId)
			.sort((a, b) => a.sort_order - b.sort_order);
	}

	function unattachedNotes(rows: OrderRow[]) {
		return rows
			.filter((r) => r.item_type === 'note' && !r.related_item_id)
			.sort((a, b) => a.sort_order - b.sort_order);
	}

	function personNameForId(personId: string | null) {
		if (!personId) return null;
		const found = peopleOptions.find((p) => p.id === personId);
		return found?.name ?? null;
	}

	const uniqPeople = $derived(uniqPeopleFromAssignments(assignments));

	// ===== API: Run Sheet =====
	async function loadOrder() {
		if (!service) return;
		try {
			loadingOrder = true;
			orderError = null;
			const res = await apiFetch(`/api/gatherings/${service.id}/order`, { method: 'GET' });
			orderItems = (await res.json()) as OrderRow[];
		} catch (e) {
			orderError = e instanceof Error ? e.message : 'Failed to load run sheet';
		} finally {
			loadingOrder = false;
		}
	}

	async function createOrderRow(
		payload: Partial<OrderRow> & { item_type: string; after_item_id?: string | null }
	) {
		if (!service) return;
		try {
			creatingRow = true;
			await apiFetch(`/api/gatherings/${service.id}/order`, {
				method: 'POST',
				body: JSON.stringify(payload)
			});
			await loadOrder();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to create row');
		} finally {
			creatingRow = false;
		}
	}

	async function patchOrderRow(id: string, payload: Partial<OrderRow>) {
		if (!service) return;
		try {
			updatingRow = true;
			await apiFetch(`/api/gatherings/${service.id}/order/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(payload)
			});
			await loadOrder();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to update row');
		} finally {
			updatingRow = false;
		}
	}

	async function deleteOrderRow(id: string) {
		if (!service) return;
		if (!confirm('Delete this row?')) return;

		try {
			deletingRowId = id;
			await apiFetch(`/api/gatherings/${service.id}/order/${id}`, { method: 'DELETE' });
			await loadOrder();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to delete row');
		} finally {
			deletingRowId = null;
		}
	}

	// Reorder: simple up/down by swapping sort_order
	async function moveRowUp(row: OrderRow) {
		const tops = getTopLevelRows(orderItems);
		const idx = tops.findIndex((r) => r.id === row.id);
		if (idx <= 0) return;

		const prev = tops[idx - 1];
		await swapSortOrders(row, prev);
	}

	async function moveRowDown(row: OrderRow) {
		const tops = getTopLevelRows(orderItems);
		const idx = tops.findIndex((r) => r.id === row.id);
		if (idx < 0 || idx >= tops.length - 1) return;

		const next = tops[idx + 1];
		await swapSortOrders(row, next);
	}

	async function swapSortOrders(a: OrderRow, b: OrderRow) {
		const aSort = a.sort_order;
		const bSort = b.sort_order;

		const temp = Math.max(aSort, bSort) + 1000;
		await patchOrderRow(a.id, { sort_order: temp });
		await patchOrderRow(b.id, { sort_order: aSort });
		await patchOrderRow(a.id, { sort_order: bSort });
	}

	// ===== UI actions: Run Sheet =====
	function openAddSectionModal() {
		sectionTitle = '';
		sectionNotes = '';
		showAddSectionModal = true;
	}

	function closeAddSectionModal() {
		showAddSectionModal = false;
		sectionTitle = '';
		sectionNotes = '';
	}

	async function addSection() {
		const t = sectionTitle.trim();
		if (!t) return alert('Section title is required');
		await createOrderRow({
			item_type: 'header',
			title: t,
			notes: sectionNotes.trim() || null
		});
		closeAddSectionModal();
	}

	function openAddItemModal() {
		itemTitle = '';
		itemDurationText = '';
		itemRoleId = '';
		itemPersonId = '';
		itemNotes = '';
		showAddItemModal = true;
	}

	function closeAddItemModal() {
		showAddItemModal = false;
		itemTitle = '';
		itemDurationText = '';
		itemRoleId = '';
		itemPersonId = '';
		itemNotes = '';
	}

	async function addItem() {
		const t = itemTitle.trim();
		if (!t) return alert('Item title is required');

		const secs = parseDurationToSeconds(itemDurationText);
		if (itemDurationText.trim() && secs === null)
			return alert('Duration must be mm:ss (e.g., 4:00) or seconds (e.g., 240)');

		await createOrderRow({
			item_type: 'item',
			title: t,
			duration_seconds: secs,
			role_id: itemRoleId || null,
			person_id: itemPersonId || null,
			notes: itemNotes.trim() || null
		});
		closeAddItemModal();
	}

	function openAddNoteModal(parentId: string) {
		noteParentId = parentId;
		noteText = '';
		showAddNoteModal = true;
	}

	function closeAddNoteModal() {
		showAddNoteModal = false;
		noteParentId = null;
		noteText = '';
	}

	async function addNote() {
		const text = noteText.trim();
		if (!text) return alert('Note text is required');
		if (!noteParentId) return alert('Missing note parent');

		const existing = notesForParent(orderItems, noteParentId);
		const last = existing.length ? existing[existing.length - 1] : null;

		await createOrderRow({
			item_type: 'note',
			related_item_id: noteParentId,
			notes: text,
			after_item_id: last ? last.id : noteParentId
		});
		closeAddNoteModal();
	}

	function openEditRowModal(row: OrderRow) {
		editingRow = row;
		showEditRowModal = true;

		editTitle = row.title ?? '';
		editDurationText = row.duration_seconds != null ? formatSeconds(row.duration_seconds) : '';
		editRoleId = row.role_id ?? '';
		editPersonId = row.person_id ?? '';
		editNotes = row.notes ?? '';
		editNoteText = row.notes ?? '';
	}

	function closeEditRowModal() {
		showEditRowModal = false;
		editingRow = null;
		editTitle = '';
		editDurationText = '';
		editRoleId = '';
		editPersonId = '';
		editNotes = '';
		editNoteText = '';
	}

	async function saveEditRow() {
		if (!editingRow) return;

		if (editingRow.item_type === 'note') {
			const t = editNoteText.trim();
			if (!t) return alert('Note text is required');
			await patchOrderRow(editingRow.id, { notes: t });
			closeEditRowModal();
			return;
		}

		if (editingRow.item_type === 'header') {
			const t = editTitle.trim();
			if (!t) return alert('Section title is required');
			await patchOrderRow(editingRow.id, { title: t, notes: editNotes.trim() || null });
			closeEditRowModal();
			return;
		}

		const t = editTitle.trim();
		if (!t) return alert('Item title is required');

		const secs = parseDurationToSeconds(editDurationText);
		if (editDurationText.trim() && secs === null)
			return alert('Duration must be mm:ss (e.g., 4:00) or seconds (e.g., 240)');

		await patchOrderRow(editingRow.id, {
			title: t,
			duration_seconds: secs,
			role_id: editRoleId || null,
			person_id: editPersonId || null,
			notes: editNotes.trim() || null
		});

		closeEditRowModal();
	}

	async function quickAssignPerson(row: OrderRow, personId: string) {
		await patchOrderRow(row.id, { person_id: personId || null });
	}

	// ===== Setlist existing logic =====
	const filteredSongs = $derived.by(() => {
		return availableSongs.filter((song) => {
			if (!searchQuery) return true;
			const query = searchQuery.toLowerCase();
			return (
				song.title.toLowerCase().includes(query) ||
				(song.artist && song.artist.toLowerCase().includes(query))
			);
		});
	});

	const selectedSong = $derived.by(() => availableSongs.find((s) => s.id === selectedSongId));

	function openAddSongModal() {
		showAddSongModal = true;
		searchQuery = '';
		selectedSongId = '';
		songKey = '';
		songNotes = '';
	}

	function closeAddSongModal() {
		showAddSongModal = false;
		searchQuery = '';
		selectedSongId = '';
		songKey = '';
		songNotes = '';
	}

	function selectSong(song: AvailableSong) {
		selectedSongId = song.id;
		songKey = song.key || '';
	}

	async function addSongToService() {
		if (!selectedSongId || !service) {
			alert('Please select a song');
			return;
		}

		try {
			addingSong = true;
			const nextOrder = songs.length > 0 ? Math.max(...songs.map((s) => s.display_order)) + 1 : 1;

			await apiFetch(`/api/gatherings/${service.id}/songs`, {
				method: 'POST',
				body: JSON.stringify({
					song_id: selectedSongId,
					display_order: nextOrder,
					key: songKey || null,
					notes: songNotes || null
				})
			});

			closeAddSongModal();
			await invalidateAll();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to add song');
		} finally {
			addingSong = false;
		}
	}

	async function removeSong(songInstanceId: string) {
		if (!confirm('Remove this song from the service?')) return;
		if (!service) return;

		try {
			await apiFetch(`/api/gatherings/${service.id}/songs/${songInstanceId}`, { method: 'DELETE' });
			await invalidateAll();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to remove song');
		}
	}

	function openEditSongModal(song: Song) {
		editingSong = song;
		editSongKey = song.key || '';
		editSongNotes = song.notes || '';
		showEditSongModal = true;
	}

	function closeEditSongModal() {
		showEditSongModal = false;
		editingSong = null;
		editSongKey = '';
		editSongNotes = '';
	}

	async function updateSongInService() {
		if (!editingSong || !service) return;

		try {
			savingEdit = true;
			await apiFetch(`/api/gatherings/${service.id}/songs/${editingSong.id}`, {
				method: 'PUT',
				body: JSON.stringify({
					key: editSongKey || null,
					notes: editSongNotes || null,
					display_order: editingSong.display_order
				})
			});

			closeEditSongModal();
			await invalidateAll();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to update song');
		} finally {
			savingEdit = false;
		}
	}

	function openChartModal(song: Song) {
		chartSong = song;
		showChartModal = true;
	}

	function closeChartModal() {
		showChartModal = false;
		chartSong = null;
	}

	onMount(async () => {
		await loadPeopleOptions();
		await loadOrder();
	});
</script>

<!-- ===== Run Sheet ===== -->
<div class="section runsheet-section">
	<div class="section-header">
		<h2>Run Sheet</h2>
		<div class="header-actions">
			<button class="secondary-btn" onclick={openAddSectionModal}>+ Section</button>
			<button class="primary-btn" onclick={openAddItemModal}>+ Item</button>
		</div>
	</div>

	{#if loadingOrder}
		<div class="empty-state"><p>Loading…</p></div>
	{:else if orderError}
		<div class="error-state">
			<p>{orderError}</p>
			<button class="secondary-btn" onclick={loadOrder}>Retry</button>
		</div>
	{:else if getTopLevelRows(orderItems).length === 0 && unattachedNotes(orderItems).length === 0}
		<div class="empty-state">
			<p>No run sheet items yet</p>
			<div class="empty-actions">
				<button class="secondary-btn" onclick={openAddSectionModal}>Add Section</button>
				<button class="primary-btn" onclick={openAddItemModal}>Add Item</button>
			</div>
		</div>
	{:else}
		<div class="rs-surface">
			{#each getTopLevelRows(orderItems) as row (row.id)}
				{#if row.item_type === 'header'}
					<div class="rs-row rs-header">
						<div class="rs-row-top">
							<div class="rs-title">{row.title}</div>

							<div class="rs-actions">
								<button
									class="icon-btn"
									onclick={() => moveRowUp(row)}
									title="Move up"
									aria-label="Move up">↑</button
								>
								<button
									class="icon-btn"
									onclick={() => moveRowDown(row)}
									title="Move down"
									aria-label="Move down">↓</button
								>
								<button
									class="icon-btn"
									onclick={() => openEditRowModal(row)}
									title="Edit"
									aria-label="Edit">✏️</button
								>
								<button
									class="icon-btn delete"
									onclick={() => deleteOrderRow(row.id)}
									title="Delete"
									aria-label="Delete"
									disabled={deletingRowId === row.id}
								>
									×
								</button>
							</div>
						</div>

						{#if row.notes}
							<div class="rs-note">{row.notes}</div>
						{/if}
					</div>
				{:else}
					<div
						class="rs-row item {row.title &&
						['pre', 'post', 'pre-service', 'post-service'].some((k) =>
							row.title?.toLowerCase().includes(k)
						)
							? 'prepost'
							: ''}"
					>
						<div class="rs-row-top">
							<div class="rs-title">{row.title || '(untitled item)'}</div>

							<div class="rs-meta">
								{#if row.duration_seconds != null}
									<div class="rs-duration">{formatSeconds(row.duration_seconds)}</div>
								{/if}

								<div class="rs-actions">
									<button
										class="icon-btn"
										onclick={() => moveRowUp(row)}
										title="Move up"
										aria-label="Move up">↑</button
									>
									<button
										class="icon-btn"
										onclick={() => moveRowDown(row)}
										title="Move down"
										aria-label="Move down">↓</button
									>
									<button
										class="icon-btn"
										onclick={() => openEditRowModal(row)}
										title="Edit"
										aria-label="Edit">✏️</button
									>
									<button
										class="icon-btn delete"
										onclick={() => deleteOrderRow(row.id)}
										title="Delete"
										aria-label="Delete"
										disabled={deletingRowId === row.id}
									>
										×
									</button>
								</div>
							</div>
						</div>

						<div class="rs-person-row">
							<label class="rs-label" for={'person-' + row.id}>Person</label>
							<select
								id={'person-' + row.id}
								value={row.person_id ?? ''}
								onchange={(e: Event) =>
									quickAssignPerson(row, (e.currentTarget as HTMLSelectElement).value)}
							>
								<option value="">Unassigned</option>
								{#each peopleOptions as p}
									<option value={p.id}>{p.name}</option>
								{/each}
							</select>
						</div>

						{#if row.notes}
							<div class="rs-note">{row.notes}</div>
						{/if}

						{#if notesForParent(orderItems, row.id).length > 0}
							<div class="rs-note">
								{#each notesForParent(orderItems, row.id) as note (note.id)}
									<div class="rs-note-item">
										<div class="rs-note-body">{note.notes}</div>
										<div class="rs-actions">
											<button
												class="icon-btn"
												onclick={() => openEditRowModal(note)}
												title="Edit note"
												aria-label="Edit note"
											>
												✏️
											</button>
											<button
												class="icon-btn delete"
												onclick={() => deleteOrderRow(note.id)}
												title="Delete note"
												aria-label="Delete note"
												disabled={deletingRowId === note.id}
											>
												×
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}

						<div class="rs-note-add">
							<button class="link-btn" onclick={() => openAddNoteModal(row.id)}>+ Add note</button>
						</div>
					</div>
				{/if}
			{/each}

			{#if unattachedNotes(orderItems).length > 0}
				<div class="rs-row item">
					<div class="rs-row-top">
						<div class="rs-title">Unattached notes</div>
					</div>

					<div class="rs-note">
						{#each unattachedNotes(orderItems) as note (note.id)}
							<div class="rs-note-item">
								<div class="rs-note-body">{note.notes}</div>
								<div class="rs-actions">
									<button
										class="icon-btn"
										onclick={() => openEditRowModal(note)}
										title="Edit note"
										aria-label="Edit note"
									>
										✏️
									</button>
									<button
										class="icon-btn delete"
										onclick={() => deleteOrderRow(note.id)}
										title="Delete note"
										aria-label="Delete note"
										disabled={deletingRowId === note.id}
									>
										×
									</button>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- ===== Setlist (existing) ===== -->
<div class="section songs-section">
	<div class="section-header">
		<h2>Setlist ({songs.length})</h2>
		<button class="icon-btn" onclick={openAddSongModal} title="Add song">+</button>
	</div>

	{#if songs.length === 0}
		<div class="empty-state">
			<p>No songs added yet</p>
			<button class="primary-btn" onclick={openAddSongModal}>Add First Song</button>
		</div>
	{:else}
		<div class="songs-list">
			{#each songs as song, index}
				<div class="song-item">
					<div class="song-number">{index + 1}</div>
					<div class="song-info">
						<div class="song-title">{song.title}</div>
						{#if song.artist}
							<div class="song-artist">by {song.artist}</div>
						{/if}
						<div class="song-details">
							{#if song.key}
								<span class="detail">Key: {song.key}</span>
							{/if}
							{#if song.bpm}
								<span class="detail">BPM: {song.bpm}</span>
							{/if}
						</div>
						{#if song.notes}
							<div class="song-notes">{song.notes}</div>
						{/if}
					</div>
					<div class="song-actions">
						<button class="icon-btn" onclick={() => openChartModal(song)} title="View chart"
							>📄</button
						>
						<button class="icon-btn" onclick={() => openEditSongModal(song)} title="Edit">✏️</button
						>
						<button class="icon-btn delete" onclick={() => removeSong(song.id)} title="Remove"
							>×</button
						>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- ===== Add Section Modal ===== -->
{#if showAddSectionModal}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		onclick={closeAddSectionModal}
		onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closeAddSectionModal()}
	>
		<div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Add Section</h2>
				<button class="close-btn" onclick={closeAddSectionModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="section-title">Title</label>
					<input
						id="section-title"
						type="text"
						bind:value={sectionTitle}
						placeholder="e.g., Worship"
					/>
				</div>

				<div class="form-group">
					<label for="section-notes">Notes (optional)</label>
					<textarea
						id="section-notes"
						bind:value={sectionNotes}
						rows="2"
						placeholder="Optional note…"
					></textarea>
				</div>
			</div>

			<div class="modal-actions">
				<button class="secondary-btn" onclick={closeAddSectionModal}>Cancel</button>
				<button class="primary-btn" onclick={addSection} disabled={creatingRow}>
					{creatingRow ? 'Adding…' : 'Add Section'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ===== Add Item Modal ===== -->
{#if showAddItemModal}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		onclick={closeAddItemModal}
		onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closeAddItemModal()}
	>
		<div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Add Item</h2>
				<button class="close-btn" onclick={closeAddItemModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="item-title">Title</label>
					<input
						id="item-title"
						type="text"
						bind:value={itemTitle}
						placeholder="e.g., Announcements"
					/>
				</div>

				<div class="form-group">
					<label for="item-duration">Duration</label>
					<input
						id="item-duration"
						type="text"
						bind:value={itemDurationText}
						placeholder="e.g., 4:00 (or 240)"
					/>
				</div>

				<div class="form-group">
					<label for="item-person">Person (optional)</label>
					<select id="item-person" bind:value={itemPersonId}>
						<option value="">Unassigned</option>
						{#each peopleOptions as p}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="item-notes">Notes (optional)</label>
					<textarea
						id="item-notes"
						bind:value={itemNotes}
						rows="2"
						placeholder="Optional overview note…"
					></textarea>
				</div>

				<div class="hint">
					Inline details like bullet lists should usually be added as a <strong>note row</strong> under
					the item.
				</div>
			</div>

			<div class="modal-actions">
				<button class="secondary-btn" onclick={closeAddItemModal}>Cancel</button>
				<button class="primary-btn" onclick={addItem} disabled={creatingRow}>
					{creatingRow ? 'Adding…' : 'Add Item'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ===== Add Note Modal ===== -->
{#if showAddNoteModal}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		onclick={closeAddNoteModal}
		onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closeAddNoteModal()}
	>
		<div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Add Note</h2>
				<button class="close-btn" onclick={closeAddNoteModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="note-text">Note</label>
					<textarea
						id="note-text"
						bind:value={noteText}
						rows="4"
						placeholder="Paste your announcements list, transitions, cues…"
					></textarea>
				</div>
			</div>

			<div class="modal-actions">
				<button class="secondary-btn" onclick={closeAddNoteModal}>Cancel</button>
				<button class="primary-btn" onclick={addNote} disabled={creatingRow}>
					{creatingRow ? 'Adding…' : 'Add Note'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ===== Edit Row Modal ===== -->
{#if showEditRowModal && editingRow}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		onclick={closeEditRowModal}
		onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closeEditRowModal()}
	>
		<div class="modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h2>Edit {rowLabel(editingRow)}</h2>
				<button class="close-btn" onclick={closeEditRowModal}>×</button>
			</div>

			<div class="modal-body">
				{#if editingRow.item_type === 'note'}
					<div class="form-group">
						<label for="edit-note-text">Note</label>
						<textarea id="edit-note-text" bind:value={editNoteText} rows="5"></textarea>
					</div>
				{:else if editingRow.item_type === 'header'}
					<div class="form-group">
						<label for="edit-section-title">Title</label>
						<input id="edit-section-title" type="text" bind:value={editTitle} />
					</div>

					<div class="form-group">
						<label for="edit-section-notes">Notes (optional)</label>
						<textarea id="edit-section-notes" bind:value={editNotes} rows="3"></textarea>
					</div>
				{:else}
					<div class="form-group">
						<label for="edit-item-title">Title</label>
						<input id="edit-item-title" type="text" bind:value={editTitle} />
					</div>

					<div class="form-group">
						<label for="edit-item-duration">Duration</label>
						<input
							id="edit-item-duration"
							type="text"
							bind:value={editDurationText}
							placeholder="e.g., 4:00 (or 240)"
						/>
					</div>

					<div class="form-group">
						<label for="edit-item-person">Person</label>
						<select id="edit-item-person" bind:value={editPersonId}>
							<option value="">Unassigned</option>
							{#each peopleOptions as p}
								<option value={p.id}>{p.name}</option>
							{/each}
						</select>
					</div>

					<div class="form-group">
						<label for="edit-item-notes">Notes (optional)</label>
						<textarea id="edit-item-notes" bind:value={editNotes} rows="3"></textarea>
					</div>
				{/if}
			</div>

			<div class="modal-actions">
				<button class="secondary-btn" onclick={closeEditRowModal}>Cancel</button>
				<button class="primary-btn" onclick={saveEditRow} disabled={updatingRow}>
					{updatingRow ? 'Saving…' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ===== Existing modals for Setlist ===== -->
{#if showAddSongModal}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		onclick={closeAddSongModal}
		onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closeAddSongModal()}
	>
		<div
			class="modal add-song-modal"
			role="dialog"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				<h2>Add Song to Service</h2>
				<button class="close-btn" onclick={closeAddSongModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="search-box">
					<input type="text" placeholder="Search songs..." bind:value={searchQuery} />
				</div>

				<div class="song-select-list">
					{#if filteredSongs.length === 0}
						<div class="empty-message">{searchQuery ? 'No songs found' : 'No songs available'}</div>
					{:else}
						{#each filteredSongs as song}
							<button
								type="button"
								class="song-select-item"
								class:selected={selectedSongId === song.id}
								onclick={() => selectSong(song)}
							>
								<div class="song-select-info">
									<div class="song-select-title">{song.title}</div>
									{#if song.artist}
										<div class="song-select-artist">by {song.artist}</div>
									{/if}
									<div class="song-select-meta">
										{#if song.key}
											<span>Key: {song.key}</span>
										{/if}
										{#if song.bpm}
											<span>BPM: {song.bpm}</span>
										{/if}
									</div>
								</div>
								{#if selectedSongId === song.id}
									<span class="checkmark">✓</span>
								{/if}
							</button>
						{/each}
					{/if}
				</div>

				{#if selectedSong}
					<div class="song-details-form">
						<h3>Song Details</h3>

						<div class="form-group">
							<label for="key">Key (optional override)</label>
							<input
								id="key"
								type="text"
								bind:value={songKey}
								placeholder={selectedSong.key || 'e.g., G'}
							/>
						</div>

						<div class="form-group">
							<label for="notes">Notes (optional)</label>
							<textarea
								id="notes"
								bind:value={songNotes}
								placeholder="e.g., Skip verse 2, extended intro"
								rows="2"
							></textarea>
						</div>
					</div>
				{/if}
			</div>

			<div class="modal-actions">
				<button class="secondary-btn" onclick={closeAddSongModal}>Cancel</button>
				<button
					class="primary-btn"
					onclick={addSongToService}
					disabled={!selectedSongId || addingSong}
				>
					{addingSong ? 'Adding...' : 'Add Song'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showEditSongModal && editingSong}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		onclick={closeEditSongModal}
		onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closeEditSongModal()}
	>
		<div
			class="modal edit-song-modal"
			role="dialog"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				<h2>Edit Song</h2>
				<button class="close-btn" onclick={closeEditSongModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="song-info-display">
					<div class="song-title-large">{editingSong.title}</div>
					{#if editingSong.artist}
						<div class="song-artist-display">by {editingSong.artist}</div>
					{/if}
				</div>

				<div class="form-group">
					<label for="edit-key">Key</label>
					<input id="edit-key" type="text" bind:value={editSongKey} placeholder="e.g., G, Am, Bb" />
				</div>

				<div class="form-group">
					<label for="edit-notes">Notes</label>
					<textarea
						id="edit-notes"
						bind:value={editSongNotes}
						placeholder="e.g., Skip verse 2, extended intro"
						rows="3"
					></textarea>
				</div>
			</div>

			<div class="modal-actions">
				<button class="secondary-btn" onclick={closeEditSongModal}>Cancel</button>
				<button class="primary-btn" onclick={updateSongInService} disabled={savingEdit}>
					{savingEdit ? 'Saving...' : 'Save Changes'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showChartModal && chartSong}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		onclick={closeChartModal}
		onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && closeChartModal()}
	>
		<div
			class="modal chart-modal"
			role="dialog"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="modal-header">
				<h2>{chartSong.title}</h2>
				<button class="close-btn" onclick={closeChartModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="chart-info">
					{#if chartSong.artist}
						<p class="chart-artist">by {chartSong.artist}</p>
					{/if}
					<div class="chart-meta">
						{#if chartSong.key}
							<span class="chart-detail"><strong>Key:</strong> {chartSong.key}</span>
						{/if}
						{#if chartSong.bpm}
							<span class="chart-detail"><strong>BPM:</strong> {chartSong.bpm}</span>
						{/if}
					</div>
					{#if chartSong.notes}
						<div class="chart-notes"><strong>Notes:</strong> {chartSong.notes}</div>
					{/if}
				</div>

				<div class="chart-placeholder">
					<div class="placeholder-icon">🎼</div>
					<p>Chart/lyrics viewer coming soon</p>
					<p class="placeholder-hint">Song charts will be displayed here</p>
				</div>
			</div>

			<div class="modal-actions">
				<button class="secondary-btn" onclick={closeChartModal}>Close</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* keep your existing styles */
</style>
