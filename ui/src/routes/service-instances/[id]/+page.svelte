<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  interface Assignment {
    id: string;
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

  interface ServiceDetail {
    id: string;
    service_time: string;
    campus_name: string | null;
    group_date: string;
    service_name: string;
    context_name: string;
  }

  interface AvailableSong {
    id: string;
    title: string;
    artist: string | null;
    key: string | null;
    bpm: number | null;
  }

  let service: ServiceDetail | null = null;
  let assignments: Assignment[] = [];
  let songs: Song[] = [];
  let loading = true;
  let error = '';

  // Add song modal
  let showAddSongModal = false;
  let availableSongs: AvailableSong[] = [];
  let searchQuery = '';
  let selectedSongId = '';
  let songKey = '';
  let songNotes = '';
  let addingSong = false;

  const ORG_ID = 'a8c2c7ab-836a-4ef1-a373-562e20babb76';
  const API_BASE = 'http://localhost:3000';

  onMount(async () => {
    const serviceId = $page.params.id;
    await loadServiceDetail(serviceId);
    await loadAvailableSongs();
  });

  async function loadServiceDetail(serviceId: string) {
    try {
      loading = true;

      // Load service basic info
      const serviceRes = await fetch(`${API_BASE}/service-instances/${serviceId}`);
      if (!serviceRes.ok) throw new Error('Failed to load service');
      service = await serviceRes.json();

      // Load assignments (roster)
      const assignmentsRes = await fetch(`${API_BASE}/service-instances/${serviceId}/roster`);
      if (!assignmentsRes.ok) throw new Error('Failed to load assignments');
      assignments = await assignmentsRes.json();

      // Load songs
      const songsRes = await fetch(`${API_BASE}/service-instances/${serviceId}/songs`);
      if (!songsRes.ok) throw new Error('Failed to load songs');
      songs = await songsRes.json();

      error = '';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load service details';
    } finally {
      loading = false;
    }
  }

  async function loadAvailableSongs() {
    try {
      const res = await fetch(`${API_BASE}/songs?org_id=${ORG_ID}`);
      if (!res.ok) throw new Error('Failed to load songs');
      availableSongs = await res.json();
    } catch (e) {
      console.error('Failed to load available songs:', e);
    }
  }

  function openAddSongModal() {
    showAddSongModal = true;
    selectedSongId = '';
    songKey = '';
    songNotes = '';
    searchQuery = '';
  }

  function closeAddSongModal() {
    showAddSongModal = false;
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

      const nextOrder = songs.length > 0
        ? Math.max(...songs.map(s => s.display_order)) + 1
        : 1;

      const res = await fetch(`${API_BASE}/service-instances/${service.id}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          song_id: selectedSongId,
          display_order: nextOrder,
          key: songKey || null,
          notes: songNotes || null
        })
      });

      if (!res.ok) throw new Error('Failed to add song');

      closeAddSongModal();
      await loadServiceDetail(service.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to add song');
    } finally {
      addingSong = false;
    }
  }

  async function removeSong(songInstanceId: string) {
    if (!confirm('Remove this song from the service?')) return;

    try {
      const res = await fetch(`${API_BASE}/service-instance-songs/${songInstanceId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to remove song');

      if (service) {
        await loadServiceDetail(service.id);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to remove song');
    }
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function formatTime(timeStr: string): string {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'confirmed': return 'green';
      case 'pending': return 'yellow';
      case 'declined': return 'red';
      case 'unfilled': return 'gray';
      default: return 'gray';
    }
  }

  function getStatusLabel(status: string): string {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'pending': return 'Pending';
      case 'declined': return 'Declined';
      case 'unfilled': return 'Unfilled';
      default: return status;
    }
  }

  $: assignmentsByMinistry = assignments.reduce((acc, assignment) => {
    const ministry = assignment.ministry_area || 'Other';
    if (!acc[ministry]) acc[ministry] = [];
    acc[ministry].push(assignment);
    return acc;
  }, {} as Record<string, Assignment[]>);

  $: filteredSongs = availableSongs.filter(song => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(query) ||
      (song.artist && song.artist.toLowerCase().includes(query))
    );
  });

  $: selectedSong = availableSongs.find(s => s.id === selectedSongId);
</script>

<div class="container">
  <a href="/services" class="back-link">← Back to Services</a>

  {#if loading}
    <div class="loading">Loading service details...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={() => service && loadServiceDetail(service.id)}>Retry</button>
    </div>
  {:else if service}
    <!-- Service Header -->
    <div class="service-header">
      <div class="header-content">
        <h1>{service.service_name}</h1>
        {#if service.campus_name}
          <span class="campus-badge">📍 {service.campus_name}</span>
        {/if}
      </div>
      <div class="service-meta">
        <div class="meta-item">
          <span class="label">Date:</span> {formatDate(service.group_date)}
        </div>
        <div class="meta-item">
          <span class="label">Time:</span> {formatTime(service.service_time)}
        </div>
        <div class="meta-item">
          <span class="label">Type:</span> {service.context_name}
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="content-grid">
      <!-- Songs Section -->
      <div class="section songs-section">
        <div class="section-header">
          <h2>🎵 Setlist ({songs.length})</h2>
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
                  <button class="icon-btn" title="View chart">📄</button>
                  <button class="icon-btn" title="Edit">✏️</button>
                  <button class="icon-btn delete" on:click={() => removeSong(song.id)} title="Remove">×</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Team Roster Section -->
      <div class="section roster-section">
        <div class="section-header">
          <h2>👥 Team Roster</h2>
          <div class="roster-stats">
            <span class="stat confirmed">
              ● {assignments.filter(a => a.status === 'confirmed').length} Confirmed
            </span>
            <span class="stat pending">
              ● {assignments.filter(a => a.status === 'pending' && a.person_id).length} Pending
            </span>
            <span class="stat unfilled">
              ● {assignments.filter(a => !a.person_id).length} Unfilled
            </span>
          </div>
        </div>

        {#if assignments.length === 0}
          <div class="empty-state">
            <p>No positions defined</p>
          </div>
        {:else}
          <div class="roster-by-ministry">
            {#each Object.entries(assignmentsByMinistry) as [ministry, ministryAssignments]}
              <div class="ministry-group">
                <h3 class="ministry-name">{ministry}</h3>
                <div class="assignments-list">
                  {#each ministryAssignments as assignment}
                    <div class="assignment-item" class:unfilled={!assignment.person_id}>
                      <div class="assignment-info">
                        <div class="role-name">
                          {assignment.role_name}
                          {#if assignment.is_lead}
                            <span class="lead-badge">Lead</span>
                          {/if}
                          {#if assignment.is_required}
                            <span class="required-badge">Required</span>
                          {/if}
                        </div>

                        {#if assignment.person_id}
                          <div class="person-info">
                            <span class="status-dot {getStatusColor(assignment.status)}"
                                  title={getStatusLabel(assignment.status)}>
                            </span>
                            <span class="person-name">{assignment.person_name}</span>
                          </div>
                          {#if assignment.notes}
                            <div class="assignment-notes">{assignment.notes}</div>
                          {/if}
                        {:else}
                          <div class="person-info unfilled">
                            <span class="status-dot gray"></span>
                            <span class="unfilled-text">Not assigned</span>
                          </div>
                        {/if}
                      </div>

                      <div class="assignment-actions">
                        {#if assignment.person_id}
                          <button class="icon-btn" title="Change person">↻</button>
                          <button class="icon-btn delete" title="Remove">×</button>
                        {:else}
                          <button class="icon-btn primary" title="Assign person">+</button>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<!-- Add Song Modal -->
{#if showAddSongModal}
  <div class="modal-overlay" on:click={closeAddSongModal}>
    <div class="modal add-song-modal" on:click|stopPropagation>
      <div class="modal-header">
        <h2>Add Song to Service</h2>
        <button class="close-btn" on:click={closeAddSongModal}>×</button>
      </div>

      <div class="modal-body">
        <!-- Search -->
        <div class="search-box">
          <input
            type="text"
            placeholder="Search songs..."
            bind:value={searchQuery}
          />
        </div>

        <!-- Song List -->
        <div class="song-select-list">
          {#if filteredSongs.length === 0}
            <div class="empty-message">
              {searchQuery ? 'No songs found' : 'No songs available'}
            </div>
          {:else}
            {#each filteredSongs as song}
              <div
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
              </div>
            {/each}
          {/if}
        </div>

        <!-- Song Details (when selected) -->
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
        <button class="secondary-btn" on:click={closeAddSongModal}>
          Cancel
        </button>
        <button
          class="primary-btn"
          on:click={addSongToService}
          disabled={!selectedSongId || addingSong}
        >
          {addingSong ? 'Adding...' : 'Add Song'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  .back-link {
    display: inline-block;
    margin-bottom: 1.5rem;
    color: #666;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .back-link:hover {
    color: #1976d2;
  }

  .loading, .error {
    text-align: center;
    padding: 3rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .error {
    background: #fee;
    color: #c00;
  }

  .error button {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: #c00;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  /* Service Header */
  .service-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 12px;
    margin-bottom: 2rem;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
  }

  .campus-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.375rem 0.875rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .service-meta {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
    opacity: 0.95;
  }

  .meta-item {
    font-size: 0.9375rem;
  }

  .label {
    opacity: 0.8;
    margin-right: 0.375rem;
  }

  /* Content Grid */
  .content-grid {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 2rem;
  }

  .section {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    padding: 1.5rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #f0f0f0;
  }

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    color: #1a1a1a;
  }

  .roster-stats {
    display: flex;
    gap: 1rem;
    font-size: 0.875rem;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .stat.confirmed { color: #2e7d32; }
  .stat.pending { color: #f57c00; }
  .stat.unfilled { color: #999; }

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

  .icon-btn.primary {
    background: #1976d2;
    color: white;
    border-color: #1976d2;
  }

  .icon-btn.primary:hover {
    background: #1565c0;
  }

  .icon-btn.delete:hover {
    background: #ffebee;
    border-color: #c62828;
    color: #c62828;
  }

  .primary-btn {
    padding: 0.75rem 1.5rem;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .primary-btn:hover:not(:disabled) {
    background: #1565c0;
  }

  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .secondary-btn {
    padding: 0.75rem 1.5rem;
    background: white;
    color: #666;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .secondary-btn:hover {
    background: #f5f5f5;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #999;
  }

  /* Songs Section */
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
  }

  .song-actions {
    display: flex;
    gap: 0.375rem;
  }

  /* Roster Section (keeping existing styles) */
  .roster-by-ministry {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .ministry-group {
    border-left: 3px solid #1976d2;
    padding-left: 1rem;
  }

  .ministry-name {
    font-size: 0.875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #666;
    margin-bottom: 0.75rem;
  }

  .assignments-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .assignment-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 0.875rem;
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .assignment-item:hover {
    background: white;
    border-color: #1976d2;
  }

  .assignment-item.unfilled {
    background: #fafafa;
    border-style: dashed;
  }

  .assignment-info {
    flex: 1;
  }

  .role-name {
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 0.375rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .lead-badge {
    background: #e3f2fd;
    color: #1976d2;
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .required-badge {
    background: #ffebee;
    color: #c62828;
    padding: 0.125rem 0.5rem;
    border-radius: 10px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .person-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9375rem;
  }

  .person-info.unfilled {
    opacity: 0.6;
    font-style: italic;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-dot.green { background: #2e7d32; }
  .status-dot.yellow { background: #f57c00; }
  .status-dot.red { background: #c62828; }
  .status-dot.gray { background: #999; }

  .person-name {
    color: #1a1a1a;
  }

  .unfilled-text {
    color: #999;
  }

  .assignment-notes {
    margin-top: 0.375rem;
    font-size: 0.8125rem;
    color: #666;
    font-style: italic;
  }

  .assignment-actions {
    display: flex;
    gap: 0.375rem;
    margin-left: 1rem;
  }

  /* Modal Styles */
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
    padding: 1rem;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    transition: all 0.2s;
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
  .form-group textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 1rem;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group textarea:focus {
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
    padding: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  @media (max-width: 1024px) {
    .content-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 1.5rem;
    }

    .service-meta {
      flex-direction: column;
      gap: 0.5rem;
    }

    .roster-stats {
      flex-direction: column;
      gap: 0.375rem;
    }
  }
</style>
