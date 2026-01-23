<!-- /ui/src/routes/gatherings/[id]/people/+page.svelte -->
<!-- ui/src/routes/gatherings/[id]/people/+page.svelte -->

<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { apiFetch, apiJson } from '$lib/api';

	export let data;

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

	interface Person {
		id: string;
		first_name: string;
		last_name: string;
		proficiency?: number;
		is_primary?: boolean;
	}

	$: service = data.service;
	$: assignments = data.assignments as Assignment[];

	// --- Calm urgency: only escalate near the gathering date/time ---
	function parseServiceStartAt(svc: any): Date | null {
		// Try common shapes without exploding if fields change
		// Prefer full timestamp if present
		const ts = svc?.service_start_at || svc?.start_at || svc?.starts_at || svc?.scheduled_at;

		if (ts && typeof ts === 'string') {
			const d = new Date(ts);
			if (!isNaN(d.getTime())) return d;
		}

		// Try date + time combos (service_date/service_time are common for instances)
		const dateStr = svc?.service_date || svc?.group_date || svc?.date;
		const timeStr = svc?.service_time || svc?.time;

		if (dateStr && timeStr) {
			// timeStr may be "HH:MM" or "HH:MM:SS"
			const t = String(timeStr).length === 5 ? `${timeStr}:00` : String(timeStr);
			const d = new Date(`${dateStr}T${t}`);
			if (!isNaN(d.getTime())) return d;
		}

		// If we can’t determine, don’t escalate urgency
		return null;
	}

	$: serviceStartAt = parseServiceStartAt(service);

	$: msUntil = serviceStartAt ? serviceStartAt.getTime() - Date.now() : null;
	$: hoursUntil = msUntil != null ? msUntil / (1000 * 60 * 60) : null;
	$: daysUntil = hoursUntil != null ? hoursUntil / 24 : null;

	// Escalate only within 48 hours
	$: isWithin48Hours = hoursUntil != null ? hoursUntil <= 48 : false;
	// Gentle “soon” (optional hook if you want it later)
	$: isWithin7Days = daysUntil != null ? daysUntil <= 7 : false;

	// “Required” badge is only shown when we’re actually close
	$: showRequiredBadges = isWithin48Hours;

	// --- Grouping + attention list ---
	$: openAssignments = assignments.filter((a) => !a.person_id);
	$: pendingAssignments = assignments.filter((a) => a.status === 'pending' && !!a.person_id);
	$: confirmedAssignments = assignments.filter((a) => a.status === 'confirmed');

	// Needs attention = required + open, but only when within 48h
	$: attentionItems = isWithin48Hours
		? assignments.filter((a) => a.is_required && !a.person_id)
		: [];

	$: assignmentsByMinistry = assignments.reduce(
		(acc, assignment) => {
			const ministry = assignment.ministry_area || 'Other';
			if (!acc[ministry]) acc[ministry] = [];
			acc[ministry].push(assignment);
			return acc;
		},
		{} as Record<string, Assignment[]>
	);

	// Assign person modal state
	let showAssignModal = false;
	let assigningToAssignment: Assignment | null = null;
	let availablePeople: Person[] = [];
	let capablePeople: Person[] = [];
	let selectedPersonId = '';
	let assigningPerson = false;
	let peopleSearchQuery = '';

	$: filteredCapablePeople = capablePeople.filter((p) => {
		if (!peopleSearchQuery) return true;
		const query = peopleSearchQuery.toLowerCase();
		return `${p.first_name} ${p.last_name}`.toLowerCase().includes(query);
	});

	$: filteredOtherPeople = availablePeople.filter((p) => {
		if (capablePeople.some((cp) => cp.id === p.id)) return false;
		if (!peopleSearchQuery) return true;
		const query = peopleSearchQuery.toLowerCase();
		return `${p.first_name} ${p.last_name}`.toLowerCase().includes(query);
	});

	async function openAssignModal(assignment: Assignment) {
		assigningToAssignment = assignment;
		selectedPersonId = '';
		peopleSearchQuery = '';
		showAssignModal = true;

		try {
			const [capable, all] = await Promise.all([
				apiJson<Person[]>(`/api/roles/${assignment.role_id}/capable-people`),
				apiJson<Person[]>('/api/people')
			]);
			capablePeople = capable;
			availablePeople = all;
		} catch {
			try {
				availablePeople = await apiJson<Person[]>('/api/people');
				capablePeople = [];
			} catch {
				console.error('Failed to load people');
			}
		}
	}

	function closeAssignModal() {
		showAssignModal = false;
		assigningToAssignment = null;
		selectedPersonId = '';
		peopleSearchQuery = '';
		capablePeople = [];
		availablePeople = [];
	}

	async function assignPerson() {
		if (!selectedPersonId || !assigningToAssignment || !service) return;

		try {
			assigningPerson = true;

			if (assigningToAssignment.id) {
				await apiFetch(`/api/gatherings/${service.id}/assignments/${assigningToAssignment.id}`, {
					method: 'PUT',
					body: JSON.stringify({
						person_id: selectedPersonId,
						status: 'pending'
					})
				});
			} else {
				await apiFetch(`/api/gatherings/${service.id}/assignments`, {
					method: 'POST',
					body: JSON.stringify({
						role_id: assigningToAssignment.role_id,
						person_id: selectedPersonId,
						status: 'pending'
					})
				});
			}

			closeAssignModal();
			await invalidateAll();
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to assign person';
			alert(message);
		} finally {
			assigningPerson = false;
		}
	}

	async function removeAssignment(assignment: Assignment) {
		if (!assignment.id || !assignment.person_id) return;
		if (!confirm(`Remove ${assignment.person_name} from ${assignment.role_name}?`)) return;
		if (!service) return;

		try {
			await apiFetch(`/api/gatherings/${service.id}/assignments/${assignment.id}`, {
				method: 'PUT',
				body: JSON.stringify({
					person_id: null,
					status: 'unfilled'
				})
			});

			await invalidateAll();
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : 'Failed to remove assignment';
			alert(message);
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'confirmed':
				return 'green';
			case 'pending':
				return 'yellow';
			case 'declined':
				return 'red';
			case 'unfilled':
				return 'gray';
			default:
				return 'gray';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'confirmed':
				return 'Confirmed';
			case 'pending':
				return 'Pending';
			case 'declined':
				return 'Declined';
			case 'unfilled':
				return 'Open';
			default:
				return status;
		}
	}
</script>

// ui/src/routes/gatherings/[id]/people/+page.svelte

<div class="section roster-section">
	<div class="section-header">
		<h2>Team</h2>
		<div class="roster-stats">
			<span class="stat confirmed">{confirmedAssignments.length} Confirmed</span>
			<span class="stat pending">{pendingAssignments.length} Pending</span>
			<span class="stat open">{openAssignments.length} Open</span>
		</div>
	</div>

	{#if attentionItems.length > 0}
		<div class="attention-card" aria-label="Needs attention">
			<div class="attention-title">Needs attention</div>
			<div class="attention-subtitle">
				This gathering is coming up soon. These required roles are still open:
			</div>
			<ul class="attention-list">
				{#each attentionItems.slice(0, 6) as a}
					<li class="attention-item">
						<span class="dot"></span>
						<span class="role">{a.role_name}</span>
						<button class="small-btn" type="button" onclick={() => openAssignModal(a)}
							>Assign</button
						>
					</li>
				{/each}
			</ul>
			{#if attentionItems.length > 6}
				<div class="attention-more">+ {attentionItems.length - 6} more</div>
			{/if}
		</div>
	{/if}

	{#if assignments.length === 0}
		<div class="empty-state">
			<p>No team needs yet.</p>
			<p class="muted">Add needs later (template or as-you-go).</p>
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
										{#if showRequiredBadges && assignment.is_required}
											<span class="required-badge">Required</span>
										{/if}
									</div>

									{#if assignment.person_id}
										<div class="person-info">
											<span
												class="status-dot {getStatusColor(assignment.status)}"
												title={getStatusLabel(assignment.status)}
											/>
											<span class="person-name">{assignment.person_name}</span>
										</div>
										{#if assignment.notes}
											<div class="assignment-notes">{assignment.notes}</div>
										{/if}
									{:else}
										<div class="person-info open">
											<span class="status-dot gray"></span>
											<span class="open-text">Open</span>
											{#if isWithin48Hours && assignment.is_required}
												<span class="hint">— needed to run the gathering</span>
											{/if}
										</div>
									{/if}
								</div>

								<div class="assignment-actions">
									{#if assignment.person_id}
										<button
											class="icon-btn"
											title="Change person"
											onclick={() => openAssignModal(assignment)}
										>
											↻
										</button>
										<button
											class="icon-btn delete"
											title="Remove"
											onclick={() => removeAssignment(assignment)}
										>
											×
										</button>
									{:else}
										<button
											class="icon-btn primary"
											title="Assign person"
											onclick={() => openAssignModal(assignment)}
										>
											+
										</button>
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

<!-- Assign Person Modal -->
{#if showAssignModal && assigningToAssignment}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		onclick={closeAssignModal}
		onkeydown={(e) => e.key === 'Escape' && closeAssignModal()}
	>
		<div
			class="modal assign-modal"
			role="dialog"
			aria-modal="true"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.key === 'Escape' && closeAssignModal()}
		>
			<div class="modal-header">
				<h2>Assign {assigningToAssignment.role_name}</h2>
				<button class="close-btn" onclick={closeAssignModal}>×</button>
			</div>

			<div class="modal-body">
				<div class="search-box">
					<input type="text" placeholder="Search people..." bind:value={peopleSearchQuery} />
				</div>

				<div class="people-list">
					{#if filteredCapablePeople.length > 0}
						<div class="people-section">
							<h3 class="people-section-title">Qualified for this role</h3>
							{#each filteredCapablePeople as person}
								<button
									type="button"
									class="person-select-item"
									class:selected={selectedPersonId === person.id}
									onclick={() => (selectedPersonId = person.id)}
								>
									<div class="person-select-info">
										<div class="person-select-name">{person.first_name} {person.last_name}</div>
										<div class="person-select-meta">
											{#if person.proficiency}
												<span class="proficiency-badge">
													{'★'.repeat(person.proficiency)}{'☆'.repeat(5 - person.proficiency)}
												</span>
											{/if}
											{#if person.is_primary}
												<span class="primary-role-badge">Primary</span>
											{/if}
										</div>
									</div>
									{#if selectedPersonId === person.id}
										<span class="checkmark">✓</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}

					{#if filteredOtherPeople.length > 0}
						<div class="people-section">
							<h3 class="people-section-title">
								{filteredCapablePeople.length > 0 ? 'Other people' : 'All people'}
							</h3>
							{#each filteredOtherPeople as person}
								<button
									type="button"
									class="person-select-item"
									class:selected={selectedPersonId === person.id}
									onclick={() => (selectedPersonId = person.id)}
								>
									<div class="person-select-info">
										<div class="person-select-name">{person.first_name} {person.last_name}</div>
									</div>
									{#if selectedPersonId === person.id}
										<span class="checkmark">✓</span>
									{/if}
								</button>
							{/each}
						</div>
					{/if}

					{#if filteredCapablePeople.length === 0 && filteredOtherPeople.length === 0}
						<div class="empty-message">
							{peopleSearchQuery ? 'No people found' : 'No people available'}
						</div>
					{/if}
				</div>
			</div>

			<div class="modal-actions">
				<button class="secondary-btn" onclick={closeAssignModal}> Cancel </button>
				<button
					class="primary-btn"
					onclick={assignPerson}
					disabled={!selectedPersonId || assigningPerson}
				>
					{assigningPerson ? 'Assigning...' : 'Assign'}
				</button>
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
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 1rem;
		border-bottom: 2px solid #f0f0f0;
		flex-wrap: wrap;
		gap: 1rem;
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
	.stat.confirmed {
		color: #2e7d32;
	}
	.stat.pending {
		color: #f57c00;
	}
	.stat.open {
		color: #6b7280;
	}

	.attention-card {
		border: 1px solid #fee2e2;
		background: #fff7f7;
		border-radius: 10px;
		padding: 1rem;
		margin: 0 0 1.25rem 0;
	}
	.attention-title {
		font-weight: 700;
		color: #991b1b;
		margin-bottom: 0.25rem;
	}
	.attention-subtitle {
		color: #6b7280;
		font-size: 0.875rem;
		margin-bottom: 0.75rem;
	}
	.attention-list {
		margin: 0;
		padding-left: 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.attention-item {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.attention-item .role {
		font-weight: 600;
		color: #111827;
	}
	.attention-item .dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: #ef4444;
		display: inline-block;
	}
	.small-btn {
		margin-left: auto;
		padding: 0.25rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 8px;
		background: white;
		cursor: pointer;
		font-size: 0.8125rem;
	}
	.small-btn:hover {
		background: #f9fafb;
	}

	.empty-state {
		text-align: center;
		padding: 2.5rem 1rem;
		color: #6b7280;
	}
	.muted {
		color: #9ca3af;
		font-size: 0.875rem;
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

	/* Required badge is now calmer (and shown only near the date) */
	.required-badge {
		background: #fff1f2;
		color: #b91c1c;
		padding: 0.125rem 0.5rem;
		border-radius: 10px;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.person-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9375rem;
	}
	.person-info.open {
		color: #6b7280;
	}
	.status-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.status-dot.green {
		background: #2e7d32;
	}
	.status-dot.yellow {
		background: #f57c00;
	}
	.status-dot.red {
		background: #c62828;
	}
	.status-dot.gray {
		background: #9ca3af;
	}

	.person-name {
		color: #1a1a1a;
	}
	.open-text {
		color: #6b7280;
		font-weight: 500;
	}
	.hint {
		color: #9ca3af;
		font-size: 0.875rem;
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

	/* Modal Styles (unchanged) */
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

	.assign-modal {
		max-width: 500px;
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

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1.5rem;
		border-top: 1px solid #e0e0e0;
	}

	.people-list {
		max-height: 400px;
		overflow-y: auto;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
	}

	.people-section {
		padding: 0.5rem 0;
	}
	.people-section:not(:last-child) {
		border-bottom: 1px solid #e0e0e0;
	}

	.people-section-title {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #666;
		padding: 0.5rem 1rem;
		margin: 0;
		background: #f8f9fa;
	}

	.person-select-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0.875rem 1rem;
		cursor: pointer;
		transition: all 0.2s;
		background: white;
		border: none;
		text-align: left;
	}
	.person-select-item:hover {
		background: #f8f9fa;
	}
	.person-select-item.selected {
		background: #e3f2fd;
	}

	.person-select-info {
		flex: 1;
	}
	.person-select-name {
		font-weight: 500;
		color: #1a1a1a;
	}

	.person-select-meta {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.proficiency-badge {
		font-size: 0.75rem;
		color: #f59e0b;
	}

	.primary-role-badge {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		padding: 0.125rem 0.375rem;
		background: #e3f2fd;
		color: #1976d2;
		border-radius: 4px;
	}

	.checkmark {
		font-size: 1.5rem;
		color: #1976d2;
		font-weight: bold;
	}
	.empty-message {
		padding: 2rem;
		text-align: center;
		color: #999;
	}
</style>
