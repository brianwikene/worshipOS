<!-- /ui/src/routes/gatherings/[id]/order/+page.svelte -->
<!-- /src/routes/gatherings/[id]/order/+page.svelte -->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { apiFetch, apiJson } from '$lib/api';
  import { onMount } from 'svelte';

  export let data;

  interface Song {
    id: string;
    song_id: string;
    title: string;
    artist: string | null;
    key: string | null;
    bpm: number | null;
    display_order: number;
    notes: string | null;
  }

  interface AvailableSong {
    id: string;
    title: string;
    artist: string | null;
    key: string | null;
    bpm: number | null;
  }

  interface Assignment {
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
  }
  interface PersonOption {
  id: string;
  name: string;
}

let peopleOptions: PersonOption[] = [];


  type OrderItemType = 'header' | 'item' | 'note' | 'song';

  interface OrderRow {
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
  }

  $: service = data.service;
  $: songs = data.songs as Song[];
  $: availableSongs = data.availableSongs as AvailableSong[];
  $: assignments = (data.assignments as Assignment[]) ?? [];

  // ===== Run Sheet state =====
  let orderItems: OrderRow[] = [];
  let loadingOrder = false;
  let orderError: string | null = null;

  // Add Section modal
  let showAddSectionModal = false;
  let sectionTitle = '';
  let sectionNotes = '';

  // Add Item modal
  let showAddItemModal = false;
  let itemTitle = '';
  let itemDurationText = ''; // "4:00" or "240"
  let itemRoleId = '';
  let itemPersonId = '';
  let itemNotes = '';

  // Add Note modal
  let showAddNoteModal = false;
  let noteParentId: string | null = null;
  let noteText = '';

  // Edit Row modal
  let showEditRowModal = false;
  let editingRow: OrderRow | null = null;
  let editTitle = '';
  let editDurationText = '';
  let editRoleId = '';
  let editPersonId = '';
  let editNotes = '';
  let editNoteText = '';

  // Busy flags
  let creatingRow = false;
  let updatingRow = false;
  let deletingRowId: string | null = null;

  // ===== Setlist (existing) =====
  // Add song modal state
  let showAddSongModal = false;
  let searchQuery = '';
  let selectedSongId = '';
  let songKey = '';
  let songNotes = '';
  let addingSong = false;

  // Edit song modal state
  let showEditSongModal = false;
  let editingSong: Song | null = null;
  let editSongKey = '';
  let editSongNotes = '';
  let savingEdit = false;

  // View chart modal state
  let showChartModal = false;
  let chartSong: Song | null = null;

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
    return rows
      .filter((r) => r.item_type !== 'note')
      .sort((a, b) => a.sort_order - b.sort_order);
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

  $: uniqPeople = uniqPeopleFromAssignments(Array.isArray(assignments) ? assignments : []);

  // ===== API: Run Sheet =====
  async function loadOrder() {
    if (!service) return;
    try {
      loadingOrder = true;
      orderError = null;
      const res = await apiFetch(`/api/gatherings/${service.id}/order`, { method: 'GET' });
      orderItems = await res.json();
    } catch (e) {
      orderError = e instanceof Error ? e.message : 'Failed to load run sheet';
    } finally {
      loadingOrder = false;
    }
  }

  async function createOrderRow(payload: Partial<OrderRow> & { item_type: string; after_item_id?: string | null }) {
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
    // Swap top-level sort_orders; notes remain attached by related_item_id and will still render under parent
    const aSort = a.sort_order;
    const bSort = b.sort_order;

    // Two-step to avoid unique collisions (no unique constraint currently, but safe anyway)
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
    if (itemDurationText.trim() && secs === null) return alert('Duration must be mm:ss (e.g., 4:00) or seconds (e.g., 240)');

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

    // Insert immediately after the parent (server should handle shifting sort_order)
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

    // item
    const t = editTitle.trim();
    if (!t) return alert('Item title is required');

    const secs = parseDurationToSeconds(editDurationText);
    if (editDurationText.trim() && secs === null) return alert('Duration must be mm:ss (e.g., 4:00) or seconds (e.g., 240)');

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
  $: filteredSongs = availableSongs.filter((song) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(query) ||
      (song.artist && song.artist.toLowerCase().includes(query))
    );
  });

  $: selectedSong = availableSongs.find((s) => s.id === selectedSongId);

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
      <button class="secondary-btn" on:click={openAddSectionModal}>+ Section</button>
      <button class="primary-btn" on:click={openAddItemModal}>+ Item</button>
    </div>
  </div>

  {#if loadingOrder}
    <div class="empty-state"><p>Loading…</p></div>
  {:else if orderError}
    <div class="error-state">
      <p>{orderError}</p>
      <button class="secondary-btn" on:click={loadOrder}>Retry</button>
    </div>
  {:else}
    {#if getTopLevelRows(orderItems).length === 0 && unattachedNotes(orderItems).length === 0}
      <div class="empty-state">
        <p>No run sheet items yet</p>
        <div class="empty-actions">
          <button class="secondary-btn" on:click={openAddSectionModal}>Add Section</button>
          <button class="primary-btn" on:click={openAddItemModal}>Add Item</button>
        </div>
      </div>
    {:else}
      <!-- Replacement for the whole runsheet list block -->
<div class="rs-surface">
  {#each getTopLevelRows(orderItems) as row (row.id)}
    {#if row.item_type === 'header'}
      <div class="rs-row rs-header">
        <div class="rs-row-top">
          <div class="rs-title">{row.title}</div>

          <div class="rs-actions">
            <button class="icon-btn" on:click={() => moveRowUp(row)} title="Move up" aria-label="Move up">↑</button>
            <button class="icon-btn" on:click={() => moveRowDown(row)} title="Move down" aria-label="Move down">↓</button>
            <button class="icon-btn" on:click={() => openEditRowModal(row)} title="Edit" aria-label="Edit">✏️</button>
            <button
              class="icon-btn delete"
              on:click={() => deleteOrderRow(row.id)}
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
        class="rs-row item {row.title && ['pre', 'post', 'pre-service', 'post-service'].some((k) => row.title?.toLowerCase().includes(k)) ? 'prepost' : ''}"
      >
        <div class="rs-row-top">
          <div class="rs-title">{row.title || '(untitled item)'}</div>

          <div class="rs-meta">
            {#if row.duration_seconds != null}
              <div class="rs-duration">{formatSeconds(row.duration_seconds)}</div>
            {/if}

            <div class="rs-actions">
              <button class="icon-btn" on:click={() => moveRowUp(row)} title="Move up" aria-label="Move up">↑</button>
              <button class="icon-btn" on:click={() => moveRowDown(row)} title="Move down" aria-label="Move down">↓</button>
              <button class="icon-btn" on:click={() => openEditRowModal(row)} title="Edit" aria-label="Edit">✏️</button>
              <button
                class="icon-btn delete"
                on:click={() => deleteOrderRow(row.id)}
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
          <label class="rs-label" for={"person-" + row.id}>Person</label>
          <select
            id={"person-" + row.id}
            value={row.person_id ?? ''}
            on:change={(e) => quickAssignPerson(row, (e.target as HTMLSelectElement).value)}
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
                    on:click={() => openEditRowModal(note)}
                    title="Edit note"
                    aria-label="Edit note"
                  >
                    ✏️
                  </button>
                  <button
                    class="icon-btn delete"
                    on:click={() => deleteOrderRow(note.id)}
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
          <button class="link-btn" on:click={() => openAddNoteModal(row.id)}>+ Add note</button>
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
              <button class="icon-btn" on:click={() => openEditRowModal(note)} title="Edit note" aria-label="Edit note">
                ✏️
              </button>
              <button
                class="icon-btn delete"
                on:click={() => deleteOrderRow(note.id)}
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
  {/if}
</div>

<!-- ===== Setlist (existing) ===== -->
<div class="section songs-section">
  <div class="section-header">
    <h2>Setlist ({songs.length})</h2>
    <button class="icon-btn" on:click={openAddSongModal} title="Add song">+</button>
  </div>

  {#if songs.length === 0}
    <div class="empty-state">
      <p>No songs added yet</p>
      <button class="primary-btn" on:click={openAddSongModal}>Add First Song</button>
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
            <button class="icon-btn" on:click={() => openChartModal(song)} title="View chart">📄</button>
            <button class="icon-btn" on:click={() => openEditSongModal(song)} title="Edit">✏️</button>
            <button class="icon-btn delete" on:click={() => removeSong(song.id)} title="Remove">×</button>
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
    on:click={closeAddSectionModal}
    on:keydown={(e) => e.key === 'Escape' && closeAddSectionModal()}
  >
    <div class="modal" role="dialog" aria-modal="true" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Add Section</h2>
        <button class="close-btn" on:click={closeAddSectionModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="section-title">Title</label>
          <input id="section-title" type="text" bind:value={sectionTitle} placeholder="e.g., Worship Service" />
        </div>

        <div class="form-group">
          <label for="section-notes">Notes (optional)</label>
          <textarea id="section-notes" bind:value={sectionNotes} rows="2" placeholder="Optional note…"></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="secondary-btn" on:click={closeAddSectionModal}>Cancel</button>
        <button class="primary-btn" on:click={addSection} disabled={creatingRow}>
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
    on:click={closeAddItemModal}
    on:keydown={(e) => e.key === 'Escape' && closeAddItemModal()}
  >
    <div class="modal" role="dialog" aria-modal="true" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Add Item</h2>
        <button class="close-btn" on:click={closeAddItemModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="item-title">Title</label>
          <input id="item-title" type="text" bind:value={itemTitle} placeholder="e.g., Announcements" />
        </div>

        <div class="form-group">
          <label for="item-duration">Duration</label>
          <input id="item-duration" type="text" bind:value={itemDurationText} placeholder="e.g., 4:00 (or 240)" />
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
          <textarea id="item-notes" bind:value={itemNotes} rows="2" placeholder="Optional overview note…"></textarea>
        </div>

        <div class="hint">
          Inline details like bullet lists should usually be added as a <strong>note row</strong> under the item.
        </div>
      </div>

      <div class="modal-actions">
        <button class="secondary-btn" on:click={closeAddItemModal}>Cancel</button>
        <button class="primary-btn" on:click={addItem} disabled={creatingRow}>
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
    on:click={closeAddNoteModal}
    on:keydown={(e) => e.key === 'Escape' && closeAddNoteModal()}
  >
    <div class="modal" role="dialog" aria-modal="true" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Add Note</h2>
        <button class="close-btn" on:click={closeAddNoteModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label for="note-text">Note</label>
          <textarea id="note-text" bind:value={noteText} rows="4" placeholder="Paste your announcements list, transitions, cues…"></textarea>
        </div>
      </div>

      <div class="modal-actions">
        <button class="secondary-btn" on:click={closeAddNoteModal}>Cancel</button>
        <button class="primary-btn" on:click={addNote} disabled={creatingRow}>
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
    on:click={closeEditRowModal}
    on:keydown={(e) => e.key === 'Escape' && closeEditRowModal()}
  >
    <div class="modal" role="dialog" aria-modal="true" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Edit {rowLabel(editingRow)}</h2>
        <button class="close-btn" on:click={closeEditRowModal}>×</button>
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
            <input id="edit-item-duration" type="text" bind:value={editDurationText} placeholder="e.g., 4:00 (or 240)" />
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
        <button class="secondary-btn" on:click={closeEditRowModal}>Cancel</button>
        <button class="primary-btn" on:click={saveEditRow} disabled={updatingRow}>
          {updatingRow ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- ===== Existing modals for Setlist ===== -->

<!-- Add Song Modal -->
{#if showAddSongModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    on:click={closeAddSongModal}
    on:keydown={(e) => e.key === 'Escape' && closeAddSongModal()}
  >
    <div
      class="modal add-song-modal"
      role="dialog"
      aria-modal="true"
      on:click|stopPropagation
      on:keydown={(e) => e.key === 'Escape' && closeAddSongModal()}
    >
      <div class="modal-header">
        <h2>Add Song to Service</h2>
        <button class="close-btn" on:click={closeAddSongModal}>×</button>
      </div>

      <div class="modal-body">
        <div class="search-box">
          <input type="text" placeholder="Search songs..." bind:value={searchQuery} />
        </div>

        <div class="song-select-list">
          {#if filteredSongs.length === 0}
            <div class="empty-message">
              {searchQuery ? 'No songs found' : 'No songs available'}
            </div>
          {:else}
            {#each filteredSongs as song}
              <button
                type="button"
                class="song-select-item"
                class:selected={selectedSongId === song.id}
                on:click={() => selectSong(song)}
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
              <input id="key" type="text" bind:value={songKey} placeholder={selectedSong.key || 'e.g., G'} />
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
        <button class="secondary-btn" on:click={closeAddSongModal}> Cancel </button>
        <button class="primary-btn" on:click={addSongToService} disabled={!selectedSongId || addingSong}>
          {addingSong ? 'Adding...' : 'Add Song'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Edit Song Modal -->
{#if showEditSongModal && editingSong}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    on:click={closeEditSongModal}
    on:keydown={(e) => e.key === 'Escape' && closeEditSongModal()}
  >
    <div
      class="modal edit-song-modal"
      role="dialog"
      aria-modal="true"
      on:click|stopPropagation
      on:keydown={(e) => e.key === 'Escape' && closeEditSongModal()}
    >
      <div class="modal-header">
        <h2>Edit Song</h2>
        <button class="close-btn" on:click={closeEditSongModal}>×</button>
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
        <button class="secondary-btn" on:click={closeEditSongModal}> Cancel </button>
        <button class="primary-btn" on:click={updateSongInService} disabled={savingEdit}>
          {savingEdit ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- View Chart Modal -->
{#if showChartModal && chartSong}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    on:click={closeChartModal}
    on:keydown={(e) => e.key === 'Escape' && closeChartModal()}
  >
    <div class="modal chart-modal" role="dialog" aria-modal="true" on:click|stopPropagation>
      <div class="modal-header">
        <h2>{chartSong.title}</h2>
        <button class="close-btn" on:click={closeChartModal}>×</button>
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
            <div class="chart-notes">
              <strong>Notes:</strong>
              {chartSong.notes}
            </div>
          {/if}
        </div>

        <div class="chart-placeholder">
          <div class="placeholder-icon">🎼</div>
          <p>Chart/lyrics viewer coming soon</p>
          <p class="placeholder-hint">Song charts will be displayed here</p>
        </div>
      </div>

      <div class="modal-actions">
        <button class="secondary-btn" on:click={closeChartModal}> Close </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .section {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #f0f0f0;
    gap: 1rem;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    color: #1a1a1a;
  }

  .icon-btn {
    background: none;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 0.375rem 0.75rem;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    background: #f5f5f5;
    border-color: #1976d2;
  }

  .icon-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .icon-btn.delete:hover {
    background: #ffebee;
    border-color: #c62828;
    color: #c62828;
  }

  .primary-btn {
    padding: 0.75rem 1.1rem;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .primary-btn:hover:not(:disabled) {
    background: #1565c0;
  }

  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .secondary-btn {
    padding: 0.75rem 1.1rem;
    background: white;
    color: #666;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .secondary-btn:hover {
    background: #f5f5f5;
  }

  .empty-state {
    text-align: center;
    padding: 2.5rem 1rem;
    color: #999;
  }

  .empty-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .error-state {
    padding: 1rem;
    border: 1px solid #ffe0e0;
    background: #fff5f5;
    border-radius: 10px;
    color: #8a1f1f;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  /* ===== Run Sheet ===== */
  .runsheet-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .rs-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    border: 1px solid #e0e0e0;
    border-radius: 10px;
    padding: 0.9rem;
    background: #fff;
  }

  .rs-header {
    background: #f7f7f8;
    border-color: #e6e6e8;
  }

  /* Section/Header rows (like "Enfolding") */
.rs-row.rs-header {
  background: #f1f3f5;           /* darker than items */
  border: 1px solid #e3e7ee;
  border-radius: 12px;
  padding: 14px 14px;
  margin: 10px 0 8px;
}

/* Big header title */
.rs-row.rs-header .rs-title {
  font-size: 1.05rem;            /* bigger */
  font-weight: 700;
  color: #1f2937;
  letter-spacing: 0.2px;
}

/* Optional subnote under the header title */
.rs-row.rs-header .rs-subnote {
  margin-top: 6px;
  color: #4b5563;
  font-size: 0.92rem;
  font-style: italic;
}

  .rs-main {
    flex: 1;
  }

  .rs-title {
    font-weight: 650;
    color: #1a1a1a;
  }

  .rs-subnote {
    margin-top: 0.35rem;
    color: #666;
    font-size: 0.9rem;
    white-space: pre-wrap;
  }

  .rs-item {
    background: #fafafa;
  }

  .rs-row.rs-item {
    border: 1px solid #e8edf3;
    border-radius: 12px;
    padding: 12px 12px;
    margin: 8px 0;
    background: #fff;
  }

  .rs-left,
  .rs-main {
    min-width: 0;
  }

  .rs-title-line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .rs-duration {
    font-variant-numeric: tabular-nums;
    color: #666;
    font-size: 0.9rem;
    white-space: nowrap;
  }

  .rs-meta {
    margin-top: 0.6rem;
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .rs-person {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .rs-label {
    font-size: 0.85rem;
    color: #666;
  }

  .rs-select {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 0.45rem 0.6rem;
    background: #fff;
    min-width: 180px;
  }

/* Notes inline under an item (the gray-ish “subtext” box) */
  .rs-notes-inline {
    flex: 1;
    min-width: 240px;

    color: #555;
    font-size: 0.92rem;
    line-height: 1.25;
    white-space: pre-wrap;

    background: rgba(0, 0, 0, 0.03);
    border: 1px solid rgba(0, 0, 0, 0.06);
    border-radius: 10px;

    padding: 0.35rem 0.55rem; /* tighter */
    margin-top: 6px;          /* tighter */
  }

  /* Note rows rendered under a parent item */
  .rs-note {
    margin-top: 8px;          /* tighter than 0.6rem */
    margin-left: 0.25rem;

    background: transparent;  /* stops “table cell” vibe */
    border: none;             /* stops “table cell” vibe */
    padding: 0;               /* let note items handle spacing */

    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Note list row (one bullet note row) */
  .rs-note-item {
    display: flex;
    align-items: center;          /* <- tighter vertical alignment */
    justify-content: space-between;
    gap: 10px;

    padding: 4px 0;               /* <- tighter than 6px */
    margin: 0;                    /* <- kill any inherited margins */
    line-height: 1.25;            /* <- prevents tall rows */
  }

  /* Separator between bullet notes */
  .rs-note-item + .rs-note-item {
    border-top: 1px dashed rgba(0, 0, 0, 0.12);
    padding-top: 6px;             /* <- reduced from 8px */
    margin-top: 2px;              /* <- subtle breathing room */
  }

  /* Ensure long note text wraps correctly and doesn't force width */
  .rs-note-item > div:first-child {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  /* Remove extra bottom gap specifically for the last note line */
  .rs-note-item:last-child {
    padding-bottom: 2px;
  }

  /* Add-note link spacing (single source of truth) */
  .rs-note-add {
    margin-top: 6px;
  }

  .rs-note-add .link-btn {
    padding: 4px 0;
  }

  .rs-actions {
    display: flex;
    gap: 0.35rem;
  }

  .rs-note-body {
    flex: 1;
    white-space: pre-wrap;
    color: #444;
    font-size: 0.9rem;
    line-height: 1.3;
    margin: 0;
  }

  .rs-note-actions {
    display: flex;
    gap: 0.35rem;
  }

  .link-btn {
    background: none;
    border: none;
    color: #1976d2;
    cursor: pointer;
    padding: 0.25rem 0;
    font-weight: 500;
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .rs-unattached {
    margin-top: 0.25rem;
    padding-top: 0.75rem;
    border-top: 1px dashed #e0e0e0;

  }
  .rs-unattached .rs-note {
    background: #fafafa;
 }

.rs-unattached-title {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.hint {
  margin-top: 0.75rem;
  color: #666;
  font-size: 0.9rem;
  background: #f7f9ff;
  border: 1px solid #e4ecff;
  border-radius: 10px;
  padding: 0.75rem;
}

  /* ===== Setlist (existing styles) ===== */
  .songs-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .song-item {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    padding: 1rem;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .song-item:hover {
    background: #e3f2fd;
    border-color: #1976d2;
  }

  .song-number {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1976d2;
    color: white;
    border-radius: 50%;
    font-weight: 600;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .song-info {
    flex: 1;
  }

  .song-title {
    font-weight: 600;
    font-size: 1rem;
    color: #1a1a1a;
    margin-bottom: 0.25rem;
  }

  .song-artist {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.375rem;
  }

  .song-details {
    display: flex;
    gap: 1rem;
    font-size: 0.8125rem;
    color: #666;
  }

  .detail {
    font-weight: 500;
  }

  .song-notes {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: white;
    border-radius: 4px;
    font-size: 0.8125rem;
    color: #666;
    font-style: italic;
    white-space: pre-wrap;
  }

  .song-actions {
    display: flex;
    gap: 0.375rem;
  }

  /* ===== Modal styles (existing) ===== */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: white;
    border-radius: 12px;
    width: 100%;
    max-width: 640px;
    max-height: 90vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .add-song-modal {
    max-width: 700px;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .modal-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #666;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #f5f5f5;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .search-box {
    margin-bottom: 1rem;
  }

  .search-box input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
  }

  .search-box input:focus {
    outline: none;
    border-color: #1976d2;
  }

  .song-select-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .empty-message {
    padding: 2rem;
    text-align: center;
    color: #999;
  }

  .song-select-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 1rem;
    border: none;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
    text-align: left;
  }

  .song-select-item:last-child {
    border-bottom: none;
  }

  .song-select-item:hover {
    background: #f8f9fa;
  }

  .song-select-item.selected {
    background: #e3f2fd;
    border-left: 3px solid #1976d2;
  }

  .song-select-info {
    flex: 1;
  }

  .song-select-title {
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 0.25rem;
  }

  .song-select-artist {
    font-size: 0.875rem;
    color: #666;
    margin-bottom: 0.25rem;
  }

  .song-select-meta {
    font-size: 0.8125rem;
    color: #999;
    display: flex;
    gap: 1rem;
  }

  .checkmark {
    font-size: 1.5rem;
    color: #1976d2;
    font-weight: bold;
  }

  .song-details-form {
    border-top: 2px solid #f0f0f0;
    padding-top: 1.5rem;
  }

  .song-details-form h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 1rem;
    color: #1a1a1a;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: #1a1a1a;
    font-size: 0.9375rem;
  }

  .form-group input,
  .form-group textarea,
  .form-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    background: #fff;
  }

  .form-group input:focus,
  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: #1976d2;
  }

  textarea {
    resize: vertical;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e0e0e0;
    background: #fafafa;
  }
  /* --- Runsheet: stop horizontal weirdness --- */

.rs-row.item,
.rs-row.header {
  overflow: hidden; /* prevent subtle horizontal scrollbars */
  display: block; /* nuke any inherited flex row behavior */
}

.rs-row-top {
  display: grid;
  grid-template-columns: 1fr auto; /* left content, right meta+actions */
  align-items: center;
  gap: 12px;
}

.rs-title {
  min-width: 0;              /* allow wrapping */
  overflow-wrap: anywhere;   /* break long strings */
}

.rs-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;           /* allow wrap instead of pushing sideways */
  justify-content: flex-end;
}

.rs-duration {
  white-space: nowrap;
  flex: 0 0 auto;
}

.rs-actions {
  display: flex;
  gap: 0px;
  flex: 0 0 auto;
}

.rs-person-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.rs-person-row select {
  min-width: 220px;
  max-width: 100%;
}

/* Notes / sub-items should STACK vertically (not a horizontal grid) */
.rs-note {
  display: block;            /* <- critical */
  margin-top: 10px;
  padding: 10px 12px;
  border-left: 3px solid rgba(0,0,0,0.12);
  background: rgba(0,0,0,0.03);
  border-radius: 10px;
  font-style: italic;
}

/* Keep the "+ Add note" from drifting into weird right gutters */
.rs-note-add {
  margin-top: 10px;
}

.rs-note-add .link-btn {
  padding: 6px 0;
}

/* Optional: make the item “cards” feel less like a table */
.rs-surface {
  display: flex;
  flex-direction: column;
  gap: 12px;                 /* space between rows, not “cell gaps” */
}
</style>
