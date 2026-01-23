<!-- /ui/src/routes/admin/duplicates/+page.svelte -->
<script lang="ts">
	import { apiFetch, apiJson } from '$lib/api';
	import { onMount } from 'svelte';

	interface Person {
		id: string;
		display_name: string;
		first_name: string | null;
		last_name: string | null;
		goes_by: string | null;
		email: string | null;
		phone: string | null;
		created_at: string;
	}

	interface MatchReason {
		field: string;
		reason: string;
		weight: number;
		details?: string;
	}

	interface DuplicateLink {
		id: string;
		person_a: Person;
		person_b: Person;
		confidence_score: number;
		match_reasons: MatchReason[];
		status: string;
		detected_at: string;
		reviewed_at: string | null;
		reviewer_name: string | null;
	}

	let duplicates: DuplicateLink[] = [];
	let loading = true;
	let error = '';
	let total = 0;

	// Filters
	let statusFilter = 'suggested';
	let minScore = 50;

	// Scanning
	let scanning = false;
	let scanResult: { new_candidates: number; scan_duration_ms: number } | null = null;

	// Review modal
	let showReviewModal = false;
	let selectedLink: DuplicateLink | null = null;
	let reviewNotes = '';
	let saving = false;

	// Merge modal
	let showMergeModal = false;
	let mergeStep = 1;
	let survivorId = '';
	let mergeReason = '';
	let merging = false;

	onMount(() => {
		loadDuplicates();
	});

	async function loadDuplicates() {
		loading = true;
		error = '';

		try {
			const params = new URLSearchParams({
				status: statusFilter,
				min_score: minScore.toString(),
				limit: '100'
			});

			const result = await apiJson<{ duplicates: DuplicateLink[]; total: number }>(
				`/api/admin/duplicates?${params}`
			);

			duplicates = result.duplicates;
			total = result.total;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load duplicates';
		} finally {
			loading = false;
		}
	}

	async function runScan() {
		scanning = true;
		scanResult = null;

		try {
			const result = await apiJson<{ new_candidates: number; scan_duration_ms: number }>(
				'/api/admin/duplicates/scan',
				{ method: 'POST', body: JSON.stringify({ min_score: 50 }) }
			);

			scanResult = result;
			await loadDuplicates();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Scan failed';
		} finally {
			scanning = false;
		}
	}

	function openReview(link: DuplicateLink) {
		selectedLink = link;
		reviewNotes = '';
		showReviewModal = true;
		showMergeModal = false;
		mergeStep = 1;
	}

	function closeReview() {
		showReviewModal = false;
		selectedLink = null;
	}

	async function markNotMatch() {
		if (!selectedLink) return;
		saving = true;

		try {
			await apiFetch(`/api/admin/duplicates/${selectedLink.id}`, {
				method: 'PUT',
				body: JSON.stringify({
					status: 'not_match',
					review_notes: reviewNotes || 'Marked as not a match',
					suppress_duration_days: 365
				})
			});

			closeReview();
			await loadDuplicates();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to update');
		} finally {
			saving = false;
		}
	}

	async function confirmDuplicate() {
		if (!selectedLink) return;
		saving = true;

		try {
			await apiFetch(`/api/admin/duplicates/${selectedLink.id}`, {
				method: 'PUT',
				body: JSON.stringify({
					status: 'confirmed',
					review_notes: reviewNotes || 'Confirmed as duplicate'
				})
			});

			closeReview();
			await loadDuplicates();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to update');
		} finally {
			saving = false;
		}
	}

	function startMerge() {
		if (!selectedLink) return;
		// Default to older record as survivor
		const aDate = new Date(selectedLink.person_a.created_at);
		const bDate = new Date(selectedLink.person_b.created_at);
		survivorId = aDate < bDate ? selectedLink.person_a.id : selectedLink.person_b.id;
		mergeReason = '';
		showMergeModal = true;
		mergeStep = 1;
	}

	async function performMerge() {
		if (!selectedLink || !survivorId) return;
		merging = true;

		try {
			await apiFetch(`/api/admin/duplicates/${selectedLink.id}/merge`, {
				method: 'POST',
				body: JSON.stringify({
					survivor_id: survivorId,
					reason: mergeReason || null
				})
			});

			showMergeModal = false;
			closeReview();
			await loadDuplicates();
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Merge failed');
		} finally {
			merging = false;
		}
	}

	function getScoreColor(score: number): string {
		if (score >= 80) return 'high';
		if (score >= 60) return 'medium';
		return 'low';
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString();
	}

	$: if (statusFilter || minScore) {
		loadDuplicates();
	}
</script>

<div class="container">
	<div class="header">
		<div class="header-left">
			<h1>Duplicate Detection</h1>
			<p class="subtitle">Review and merge potential duplicate records</p>
		</div>
		<div class="header-actions">
			<a href="/admin/merges" class="btn-secondary">View Merge History</a>
			<button class="btn-primary" onclick={runScan} disabled={scanning}>
				{scanning ? 'Scanning...' : 'Run Scan'}
			</button>
		</div>
	</div>

	{#if scanResult}
		<div class="scan-result">
			Found {scanResult.new_candidates} new candidates in {scanResult.scan_duration_ms}ms
			<button class="dismiss" onclick={() => (scanResult = null)}>×</button>
		</div>
	{/if}

	<div class="filters">
		<div class="filter-group">
			<label for="status">Status</label>
			<select id="status" bind:value={statusFilter}>
				<option value="suggested">Pending Review</option>
				<option value="confirmed">Confirmed</option>
				<option value="not_match">Not a Match</option>
				<option value="all">All</option>
			</select>
		</div>
		<div class="filter-group">
			<label for="score">Min Score</label>
			<select id="score" bind:value={minScore}>
				<option value={80}>80+ (High)</option>
				<option value={60}>60+ (Medium)</option>
				<option value={50}>50+ (Low)</option>
				<option value={0}>All</option>
			</select>
		</div>
		<div class="filter-info">
			Showing {duplicates.length} of {total} results
		</div>
	</div>

	{#if loading}
		<div class="loading">Loading duplicates...</div>
	{:else if error}
		<div class="error">
			<p>{error}</p>
			<button onclick={loadDuplicates}>Retry</button>
		</div>
	{:else if duplicates.length === 0}
		<div class="empty">
			<p>No duplicate candidates found.</p>
			<button class="btn-primary" onclick={runScan}>Run a Scan</button>
		</div>
	{:else}
		<div class="duplicates-list">
			{#each duplicates as link}
				<div class="duplicate-card">
					<div class="score-badge {getScoreColor(link.confidence_score)}">
						{Math.round(link.confidence_score)}%
					</div>

					<div class="people-comparison">
						<div class="person-card">
							<div class="person-name">{link.person_a.display_name}</div>
							{#if link.person_a.goes_by}
								<div class="person-detail">Goes by: {link.person_a.goes_by}</div>
							{/if}
							{#if link.person_a.email}
								<div class="person-detail">{link.person_a.email}</div>
							{/if}
							{#if link.person_a.phone}
								<div class="person-detail">{link.person_a.phone}</div>
							{/if}
							<div class="person-meta">Created {formatDate(link.person_a.created_at)}</div>
						</div>

						<div class="vs-divider">
							<span>vs</span>
						</div>

						<div class="person-card">
							<div class="person-name">{link.person_b.display_name}</div>
							{#if link.person_b.goes_by}
								<div class="person-detail">Goes by: {link.person_b.goes_by}</div>
							{/if}
							{#if link.person_b.email}
								<div class="person-detail">{link.person_b.email}</div>
							{/if}
							{#if link.person_b.phone}
								<div class="person-detail">{link.person_b.phone}</div>
							{/if}
							<div class="person-meta">Created {formatDate(link.person_b.created_at)}</div>
						</div>
					</div>

					<div class="match-reasons">
						{#each link.match_reasons as reason}
							<span class="reason-tag" title={reason.details || ''}>
								{reason.reason} (+{reason.weight})
							</span>
						{/each}
					</div>

					<div class="card-actions">
						{#if link.status === 'suggested'}
							<button class="btn-review" onclick={() => openReview(link)}>Review</button>
						{:else}
							<span class="status-badge {link.status}">{link.status.replace('_', ' ')}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- Review Modal -->
{#if showReviewModal && selectedLink}
	<div
		class="modal-overlay"
		onclick={closeReview}
		onkeydown={(e) => e.key === 'Escape' && closeReview()}
	>
		<div class="modal review-modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
			<div class="modal-header">
				<h2>Review Potential Duplicate</h2>
				<button class="close-btn" onclick={closeReview}>×</button>
			</div>

			<div class="modal-body">
				{#if !showMergeModal}
					<!-- Comparison View -->
					<div class="comparison-grid">
						<div class="comparison-column">
							<h3>Person A</h3>
							<div class="field-row">
								<span class="field-label">Name</span>
								<span class="field-value">{selectedLink.person_a.display_name}</span>
							</div>
							{#if selectedLink.person_a.first_name}
								<div class="field-row">
									<span class="field-label">First Name</span>
									<span class="field-value">{selectedLink.person_a.first_name}</span>
								</div>
							{/if}
							{#if selectedLink.person_a.last_name}
								<div class="field-row">
									<span class="field-label">Last Name</span>
									<span class="field-value">{selectedLink.person_a.last_name}</span>
								</div>
							{/if}
							{#if selectedLink.person_a.goes_by}
								<div class="field-row">
									<span class="field-label">Goes By</span>
									<span class="field-value">{selectedLink.person_a.goes_by}</span>
								</div>
							{/if}
							{#if selectedLink.person_a.email}
								<div class="field-row highlight">
									<span class="field-label">Email</span>
									<span class="field-value">{selectedLink.person_a.email}</span>
								</div>
							{/if}
							{#if selectedLink.person_a.phone}
								<div class="field-row highlight">
									<span class="field-label">Phone</span>
									<span class="field-value">{selectedLink.person_a.phone}</span>
								</div>
							{/if}
							<div class="field-row">
								<span class="field-label">Created</span>
								<span class="field-value">{formatDate(selectedLink.person_a.created_at)}</span>
							</div>
						</div>

						<div class="comparison-column">
							<h3>Person B</h3>
							<div class="field-row">
								<span class="field-label">Name</span>
								<span class="field-value">{selectedLink.person_b.display_name}</span>
							</div>
							{#if selectedLink.person_b.first_name}
								<div class="field-row">
									<span class="field-label">First Name</span>
									<span class="field-value">{selectedLink.person_b.first_name}</span>
								</div>
							{/if}
							{#if selectedLink.person_b.last_name}
								<div class="field-row">
									<span class="field-label">Last Name</span>
									<span class="field-value">{selectedLink.person_b.last_name}</span>
								</div>
							{/if}
							{#if selectedLink.person_b.goes_by}
								<div class="field-row">
									<span class="field-label">Goes By</span>
									<span class="field-value">{selectedLink.person_b.goes_by}</span>
								</div>
							{/if}
							{#if selectedLink.person_b.email}
								<div class="field-row highlight">
									<span class="field-label">Email</span>
									<span class="field-value">{selectedLink.person_b.email}</span>
								</div>
							{/if}
							{#if selectedLink.person_b.phone}
								<div class="field-row highlight">
									<span class="field-label">Phone</span>
									<span class="field-value">{selectedLink.person_b.phone}</span>
								</div>
							{/if}
							<div class="field-row">
								<span class="field-label">Created</span>
								<span class="field-value">{formatDate(selectedLink.person_b.created_at)}</span>
							</div>
						</div>
					</div>

					<div class="reasons-section">
						<h4>Match Reasons</h4>
						<div class="reasons-list">
							{#each selectedLink.match_reasons as reason}
								<div class="reason-item">
									<span class="reason-field">{reason.field}</span>
									<span class="reason-text">{reason.reason}</span>
									{#if reason.details}
										<span class="reason-details">{reason.details}</span>
									{/if}
									<span class="reason-weight">+{reason.weight}</span>
								</div>
							{/each}
							<div class="reason-total">
								Total Score: {selectedLink.confidence_score}%
							</div>
						</div>
					</div>

					<div class="notes-section">
						<label for="review-notes">Notes (optional)</label>
						<textarea
							id="review-notes"
							bind:value={reviewNotes}
							placeholder="Add any notes about this decision..."
						></textarea>
					</div>
				{:else}
					<!-- Merge View -->
					<div class="merge-wizard">
						<h3>Choose Survivor Record</h3>
						<p class="merge-info">
							The survivor record will remain active. The other record will be archived but can be
							restored.
						</p>

						<div class="survivor-options">
							<label
								class="survivor-option"
								class:selected={survivorId === selectedLink.person_a.id}
							>
								<input type="radio" bind:group={survivorId} value={selectedLink.person_a.id} />
								<div class="option-content">
									<strong>{selectedLink.person_a.display_name}</strong>
									<span class="option-meta"
										>Created {formatDate(selectedLink.person_a.created_at)}</span
									>
								</div>
							</label>

							<label
								class="survivor-option"
								class:selected={survivorId === selectedLink.person_b.id}
							>
								<input type="radio" bind:group={survivorId} value={selectedLink.person_b.id} />
								<div class="option-content">
									<strong>{selectedLink.person_b.display_name}</strong>
									<span class="option-meta"
										>Created {formatDate(selectedLink.person_b.created_at)}</span
									>
								</div>
							</label>
						</div>

						<div class="merge-notes">
							<label for="merge-reason">Reason for merge (optional)</label>
							<textarea
								id="merge-reason"
								bind:value={mergeReason}
								placeholder="e.g., Same person - AJ is Armani's nickname"
							></textarea>
						</div>

						<div class="merge-warning">
							<strong>What will happen:</strong>
							<ul>
								<li>Service assignments will be transferred to survivor</li>
								<li>Role capabilities will be merged</li>
								<li>Contact methods will be combined</li>
								<li>This can be undone from Merge History</li>
							</ul>
						</div>
					</div>
				{/if}
			</div>

			<div class="modal-actions">
				{#if !showMergeModal}
					<button class="btn-not-match" onclick={markNotMatch} disabled={saving}>
						Not a Match
					</button>
					<button class="btn-confirm" onclick={confirmDuplicate} disabled={saving}>
						Confirm Duplicate
					</button>
					<button class="btn-merge" onclick={startMerge} disabled={saving}>
						Merge Records →
					</button>
				{:else}
					<button class="btn-secondary" onclick={() => (showMergeModal = false)}> ← Back </button>
					<button class="btn-merge" onclick={performMerge} disabled={merging || !survivorId}>
						{merging ? 'Merging...' : 'Confirm Merge'}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.container {
		max-width: 1000px;
		margin: 40px auto;
		padding: 0 20px;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 1.5rem;
	}

	.header h1 {
		margin: 0;
		font-size: 1.75rem;
		color: #1a1a1a;
	}

	.subtitle {
		margin: 0.25rem 0 0;
		color: #666;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.625rem 1.25rem;
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		font-size: 0.9rem;
	}

	.btn-primary {
		background: #0066cc;
		color: white;
		border: none;
	}

	.btn-primary:hover:not(:disabled) {
		background: #0055aa;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background: white;
		color: #333;
		border: 1px solid #ddd;
	}

	.btn-secondary:hover {
		background: #f5f5f5;
	}

	.scan-result {
		background: #e8f5e9;
		border: 1px solid #a5d6a7;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		margin-bottom: 1rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: #2e7d32;
	}

	.scan-result .dismiss {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		color: #2e7d32;
	}

	.filters {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		margin-bottom: 1.5rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 8px;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.filter-group label {
		font-size: 0.8rem;
		font-weight: 500;
		color: #666;
	}

	.filter-group select {
		padding: 0.5rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 0.9rem;
		background: white;
	}

	.filter-info {
		margin-left: auto;
		color: #666;
		font-size: 0.9rem;
	}

	.loading,
	.error,
	.empty {
		text-align: center;
		padding: 3rem;
		background: #f5f5f5;
		border-radius: 12px;
	}

	.error {
		background: #fef2f2;
		color: #dc2626;
	}

	.duplicates-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.duplicate-card {
		background: white;
		border: 1px solid #e5e7eb;
		border-radius: 12px;
		padding: 1.25rem;
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: 1rem;
		align-items: center;
	}

	.score-badge {
		width: 50px;
		height: 50px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 0.9rem;
	}

	.score-badge.high {
		background: #dcfce7;
		color: #166534;
	}

	.score-badge.medium {
		background: #fef3c7;
		color: #92400e;
	}

	.score-badge.low {
		background: #f3f4f6;
		color: #4b5563;
	}

	.people-comparison {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.person-card {
		flex: 1;
		min-width: 150px;
	}

	.person-name {
		font-weight: 600;
		color: #1a1a1a;
		margin-bottom: 0.25rem;
	}

	.person-detail {
		font-size: 0.85rem;
		color: #666;
	}

	.person-meta {
		font-size: 0.75rem;
		color: #999;
		margin-top: 0.25rem;
	}

	.vs-divider {
		color: #999;
		font-size: 0.8rem;
	}

	.match-reasons {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.reason-tag {
		background: #e0f2fe;
		color: #0369a1;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
	}

	.card-actions {
		display: flex;
		gap: 0.5rem;
	}

	.btn-review {
		padding: 0.5rem 1rem;
		background: #0066cc;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
	}

	.btn-review:hover {
		background: #0055aa;
	}

	.status-badge {
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.8rem;
		font-weight: 500;
		text-transform: capitalize;
	}

	.status-badge.confirmed {
		background: #dcfce7;
		color: #166534;
	}

	.status-badge.not_match {
		background: #f3f4f6;
		color: #4b5563;
	}

	.status-badge.merged {
		background: #e0e7ff;
		color: #4338ca;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		inset: 0;
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

	.review-modal {
		max-width: 700px;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #e5e7eb;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.125rem;
	}

	.close-btn {
		background: rgba(255, 255, 255, 0.2);
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		color: white;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-body {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.comparison-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.comparison-column h3 {
		margin: 0 0 1rem;
		font-size: 1rem;
		color: #333;
	}

	.field-row {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid #f3f4f6;
	}

	.field-row.highlight {
		background: #fef3c7;
		margin: 0 -0.5rem;
		padding: 0.5rem;
		border-radius: 4px;
	}

	.field-label {
		color: #666;
		font-size: 0.85rem;
	}

	.field-value {
		font-weight: 500;
		color: #1a1a1a;
	}

	.reasons-section {
		background: #f9fafb;
		border-radius: 8px;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.reasons-section h4 {
		margin: 0 0 0.75rem;
		font-size: 0.9rem;
	}

	.reason-item {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		padding: 0.5rem 0;
		border-bottom: 1px solid #e5e7eb;
	}

	.reason-field {
		background: #e0e7ff;
		color: #4338ca;
		padding: 0.125rem 0.375rem;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.reason-text {
		flex: 1;
		font-size: 0.9rem;
	}

	.reason-details {
		color: #666;
		font-size: 0.8rem;
	}

	.reason-weight {
		color: #059669;
		font-weight: 600;
		font-size: 0.85rem;
	}

	.reason-total {
		text-align: right;
		font-weight: 600;
		padding-top: 0.75rem;
		margin-top: 0.5rem;
		border-top: 2px solid #e5e7eb;
	}

	.notes-section label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
	}

	.notes-section textarea,
	.merge-notes textarea {
		width: 100%;
		min-height: 80px;
		padding: 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-family: inherit;
		resize: vertical;
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid #e5e7eb;
		background: #f9fafb;
	}

	.btn-not-match {
		padding: 0.625rem 1.25rem;
		background: white;
		color: #666;
		border: 1px solid #ddd;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
	}

	.btn-not-match:hover:not(:disabled) {
		background: #fef2f2;
		border-color: #fca5a5;
		color: #dc2626;
	}

	.btn-confirm {
		padding: 0.625rem 1.25rem;
		background: #059669;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
	}

	.btn-confirm:hover:not(:disabled) {
		background: #047857;
	}

	.btn-merge {
		padding: 0.625rem 1.25rem;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 600;
	}

	.btn-merge:hover:not(:disabled) {
		opacity: 0.9;
	}

	.btn-merge:disabled,
	.btn-confirm:disabled,
	.btn-not-match:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Merge Wizard */
	.merge-wizard h3 {
		margin: 0 0 0.5rem;
	}

	.merge-info {
		color: #666;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	.survivor-options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 1.5rem;
	}

	.survivor-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border: 2px solid #e5e7eb;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.survivor-option:hover {
		border-color: #667eea;
	}

	.survivor-option.selected {
		border-color: #667eea;
		background: #f0f4ff;
	}

	.survivor-option input {
		display: none;
	}

	.option-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.option-meta {
		font-size: 0.8rem;
		color: #666;
	}

	.merge-notes {
		margin-bottom: 1.5rem;
	}

	.merge-notes label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
	}

	.merge-warning {
		background: #fef3c7;
		border: 1px solid #fcd34d;
		border-radius: 8px;
		padding: 1rem;
	}

	.merge-warning strong {
		display: block;
		margin-bottom: 0.5rem;
		color: #92400e;
	}

	.merge-warning ul {
		margin: 0;
		padding-left: 1.25rem;
		color: #78350f;
		font-size: 0.9rem;
	}

	.merge-warning li {
		margin-bottom: 0.25rem;
	}

	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			gap: 1rem;
		}

		.duplicate-card {
			grid-template-columns: 1fr;
		}

		.people-comparison {
			flex-direction: column;
		}

		.comparison-grid {
			grid-template-columns: 1fr;
		}

		.filters {
			flex-direction: column;
			align-items: stretch;
		}

		.filter-info {
			margin-left: 0;
			text-align: center;
		}
	}
</style>
