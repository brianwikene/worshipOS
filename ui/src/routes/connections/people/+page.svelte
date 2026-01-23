<!-- /ui/src/routes/connections/people/+page.svelte -->
<!-- /src/routes/connections/people/+page.svelte -->

<script lang="ts">
	import { apiFetch, apiJson } from '$lib/api';
	import PersonModal from '$lib/components/PersonModal.svelte';
	import Avatar from '$lib/components/identity/Avatar.svelte';
	import type { PeopleSortField, PeopleViewMode, SortDir } from '$lib/stores/peoplePrefs';
	import { peoplePrefs } from '$lib/stores/peoplePrefs';
	import type { TableAffordances, TableRowAction, TableSortField } from '$lib/types/table';
	import { onMount } from 'svelte';

	interface Person {
		id: string;
		first_name: string | null;
		last_name: string | null;
		goes_by: string | null;
		display_name: string;
		has_contact_info: boolean;
	}

	let people: Person[] = [];
	let loading = true;
	let error = '';
	let searchQuery = '';
	let viewMode: PeopleViewMode = 'cards';
	let sortBy: PeopleSortField = 'last_name';
	let sortDir: SortDir = 'asc';

	$: viewMode = $peoplePrefs.viewMode;
	$: sortBy = $peoplePrefs.sortBy;
	$: sortDir = $peoplePrefs.sortDir;

	function setViewMode(mode: PeopleViewMode) {
		peoplePrefs.update((p) => ({ ...p, viewMode: mode }));
	}

	function setSortBy(by: PeopleSortField) {
		peoplePrefs.update((p) => ({ ...p, sortBy: by }));
	}

	function setSortDir(dir: SortDir) {
		peoplePrefs.update((p) => ({ ...p, sortDir: dir }));
	}

	// Modal state
	let modalOpen = false;
	let editingPerson: Person | null = null;
	let modalComponent: PersonModal;

	let mounted = false;
	let lastSortKey: string | null = null;

	onMount(() => {
		mounted = true;
		lastSortKey = sortBy && sortDir ? `${sortBy}:${sortDir}` : null;
		loadPeople();
	});

	$: if (mounted && sortBy && sortDir) {
		const sortKey = `${sortBy}:${sortDir}`;
		if (sortKey !== lastSortKey) {
			lastSortKey = sortKey;
			loadPeople();
		}
	}

	async function loadPeople() {
		loading = true;
		error = '';
		try {
			const params = new URLSearchParams();

			if (searchQuery) params.set('search', searchQuery);
			params.set('sort', sortBy);
			params.set('dir', sortDir);
			const url = `/api/people?${params.toString()}`;

			people = await apiJson<Person[]>(url);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load people';
		} finally {
			loading = false;
		}
	}

	function handleSearch() {
		loadPeople();
	}

	function openAddModal() {
		editingPerson = null;
		modalOpen = true;
	}

	function openEditModal(person: Person) {
		editingPerson = person;
		modalOpen = true;
	}

	function closeModal() {
		modalOpen = false;
		editingPerson = null;
	}

	async function handleSave(
		e: CustomEvent<{ first_name: string; last_name: string; goes_by: string }>
	) {
		const { first_name, last_name, goes_by } = e.detail;

		try {
			modalComponent.setSaving(true);

			if (editingPerson?.id) {
				// Update existing
				await apiFetch(`/api/people/${editingPerson.id}`, {
					method: 'PUT',
					body: JSON.stringify({ first_name, last_name, goes_by })
				});
			} else {
				// Create new
				await apiFetch('/api/people', {
					method: 'POST',
					body: JSON.stringify({ first_name, last_name, goes_by })
				});
			}

			closeModal();
			await loadPeople();
		} catch (err) {
			modalComponent.setError(err instanceof Error ? err.message : 'Failed to save');
		}
	}

	async function handleDelete(person: Person) {
		if (!confirm(`Archive "${person.display_name}"? They can be restored later.`)) {
			return;
		}

		try {
			await apiFetch(`/api/people/${person.id}`, { method: 'DELETE' });
			await loadPeople();
		} catch (err) {
			alert(err instanceof Error ? err.message : 'Failed to archive person');
		}
	}

	function togglePeopleSort(field: PeopleSortField) {
		const nextDir = sortBy === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
		setSortBy(field);
		setSortDir(nextDir);
	}

	type PeopleSortOption = TableSortField<
		PeopleSortField,
		{ columnLabel: string | null; columnClass: string }
	>;

	type PeopleRowAction = TableRowAction<Person>;

	// Table affordances define how users interact with this domain.
	// This is intentionally explicit to distinguish relational (People)
	// from operational/catalog (Songs) behaviors.
	const peopleTableAffordances: TableAffordances<Person, PeopleSortOption, PeopleRowAction> = {
		searchPlaceholder: 'Search people...',
		rowLink: (person: Person) => ({
			href: `/connections/people/${person.id}`,
			label: `Open ${person.display_name}`
		}),
		sortFields: [
			{ field: 'last_name', label: 'Last name', columnLabel: 'Last', columnClass: 'col-last' },
			{ field: 'first_name', label: 'First name', columnLabel: 'First', columnClass: 'col-first' },
			{ field: 'created_at', label: 'Recently added', columnLabel: null, columnClass: '' }
		],
		rowActions: [
			{
				key: 'edit',
				title: 'Edit',
				icon: '✏️',
				variant: '',
				type: 'button',
				handler: openEditModal
			},
			{
				key: 'archive',
				title: 'Archive',
				icon: '🗑️',
				variant: 'sys-icon-btn--danger',
				type: 'button',
				handler: handleDelete
			}
		]
	};

	const peopleColumnSorts = peopleTableAffordances.sortFields.filter(
		(field): field is PeopleSortOption & { columnLabel: string } => Boolean(field.columnLabel)
	);
</script>

<div class="sys-page">
	<div class="sys-page-header">
		<div>
			<h1 class="sys-title">People</h1>
			<p class="sys-subtitle">Team members and volunteers</p>
		</div>
		<button class="sys-btn sys-btn--primary" onclick={openAddModal}> + Add Person </button>
	</div>

	<div class="sys-toolbar">
		<input
			class="sys-input"
			placeholder={peopleTableAffordances.searchPlaceholder}
			bind:value={searchQuery}
			onkeydown={(e) => e.key === 'Enter' && handleSearch()}
		/>
		<button class="sys-btn sys-btn--secondary" onclick={handleSearch}>Search</button>
	</div>

	<div class="people-controls">
		<!-- view toggle -->
		<div class="sys-toggle" role="group" aria-label="People view">
			<button
				type="button"
				class="sys-toggle-btn"
				class:active={viewMode === 'cards'}
				onclick={() => setViewMode('cards')}
				aria-label="Card view"
				title="Card view"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill="currentColor"
						d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"
					/>
				</svg>
			</button>

			<button
				type="button"
				class="sys-toggle-btn"
				class:active={viewMode === 'table'}
				onclick={() => setViewMode('table')}
				aria-label="Table view"
				title="Table view"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
					<path fill="currentColor" d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />
				</svg>
			</button>
		</div>

		<!-- sort controls -->
		<div class="people-sort-group">
			<select
				class="sys-select people-sort-select"
				value={sortBy}
				onchange={(event) => {
					const selected = (event.target as HTMLSelectElement).value as PeopleSortField;
					setSortBy(selected);
				}}
			>
				{#each peopleTableAffordances.sortFields as option (option.field)}
					<option value={option.field}>{option.label}</option>
				{/each}
			</select>

			<button
				type="button"
				class="sys-btn sys-btn--secondary sort-dir-btn"
				onclick={() => {
					const nextDir = sortDir === 'asc' ? 'desc' : 'asc';
					setSortDir(nextDir);
				}}
			>
				{sortDir === 'asc' ? 'A–Z' : 'Z–A'}
			</button>
		</div>
	</div>

	{#if loading}
		<div class="sys-state">Loading people...</div>
	{:else if error}
		<div class="sys-state sys-state--error">
			<p>Error: {error}</p>
			<button class="sys-btn sys-btn--danger" onclick={loadPeople}>Retry</button>
		</div>
	{:else if people.length === 0}
		<div class="sys-state sys-state--empty">
			{#if searchQuery}
				<p>No people found matching "{searchQuery}"</p>
				<button
					class="sys-btn sys-btn--secondary"
					onclick={() => {
						searchQuery = '';
						loadPeople();
					}}>Clear search</button
				>
			{:else}
				<p>No people found.</p>
				<button class="sys-btn sys-btn--primary" onclick={openAddModal}
					>Add your first person</button
				>
			{/if}
		</div>
	{:else if viewMode === 'cards'}
		<div class="sys-grid sys-grid--cards">
			{#each people as person}
				{@const rowLink = peopleTableAffordances.rowLink(person)}
				<div class="sys-card person-card">
					<a href={rowLink.href} class="person-link" aria-label={rowLink.label}>
						<Avatar
							size="lg"
							className="flex-shrink-0"
							firstName={person.first_name}
							lastName={person.last_name}
							fallback={person.display_name}
						/>
						<div class="person-info">
							<h2>{person.display_name}</h2>
							{#if person.goes_by && person.first_name && person.goes_by !== person.first_name}
								<div class="legal-name">({person.first_name})</div>
							{/if}
							{#if person.has_contact_info}
								<div class="contact-badge">☎ Contact methods</div>
							{:else}
								<div class="no-info">No contact methods</div>
							{/if}
						</div>
					</a>
					<div class="card-actions">
						{#each peopleTableAffordances.rowActions as action (action.key)}
							{#if action.type === 'link'}
								<a
									class={`sys-icon-btn ${action.variant ?? ''}`.trim()}
									href={action.href(person)}
									title={action.title}
									aria-label={`${action.title} ${person.display_name}`}
								>
									{action.icon}
								</a>
							{:else}
								<button
									class={`sys-icon-btn ${action.variant ?? ''}`.trim()}
									onclick={() => action.handler(person)}
									title={action.title}
									type="button"
								>
									{action.icon}
								</button>
							{/if}
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Table view placeholder for now -->
		<div class="sys-card people-table-card">
			<div class="sys-table-wrap">
				<table class="sys-table" aria-label="People table">
					<thead>
						<tr>
							<th scope="col" class="col-photo">Photo</th>

							{#each peopleColumnSorts as column (column.field)}
								<th scope="col" class={column.columnClass}>
									<button
										type="button"
										class="th-btn"
										onclick={() => togglePeopleSort(column.field)}
										aria-label={`Sort by ${column.label.toLowerCase()}`}
									>
										{column.columnLabel}
										<span class="sort-indicator">
											{sortBy === column.field ? (sortDir === 'asc' ? '▲' : '▼') : ''}
										</span>
									</button>
								</th>
							{/each}

							<th scope="col" class="col-goes">Goes by</th>

							<th scope="col" class="col-contact">Contact methods</th>

							<th scope="col" class="col-actions">Actions</th>
						</tr>
					</thead>

					<tbody>
						{#each people as person (person.id)}
							{@const rowLink = peopleTableAffordances.rowLink(person)}
							<tr>
								<td class="col-photo">
									<a href={rowLink.href} class="row-link" aria-label={rowLink.label}>
										<Avatar
											size="sm"
											firstName={person.first_name}
											lastName={person.last_name}
											fallback={person.display_name}
										/>
									</a>
								</td>

								{#each peopleColumnSorts as column (column.field)}
									{#if column.field === 'last_name'}
										<td class={column.columnClass}>
											<a href={rowLink.href} class="row-link">
												<div class="primary">{person.last_name ?? '—'}</div>
											</a>
										</td>
									{:else if column.field === 'first_name'}
										<td class={column.columnClass}>
											<a href={rowLink.href} class="row-link">
												<div class="primary">{person.first_name ?? '—'}</div>
											</a>
										</td>
									{/if}
								{/each}

								<td class="col-goes">
									<span class="muted">{person.goes_by ?? '—'}</span>
								</td>

								<td class="col-contact">
									{#if person.has_contact_info}
										<span class="badge">📞 Contact methods</span>
									{:else}
										<span class="muted">No contact methods</span>
									{/if}
								</td>

								<td class="col-actions">
									{#each peopleTableAffordances.rowActions as action (action.key)}
										{#if action.type === 'link'}
											<a
												class={`sys-icon-btn ${action.variant ?? ''}`.trim()}
												href={action.href(person)}
												title={action.title}
												aria-label={`${action.title} ${person.display_name}`}
											>
												{action.icon}
											</a>
										{:else}
											<button
												class={`sys-icon-btn ${action.variant ?? ''}`.trim()}
												onclick={() => action.handler(person)}
												title={action.title}
												type="button"
											>
												{action.icon}
											</button>
										{/if}
									{/each}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<PersonModal
		bind:this={modalComponent}
		bind:open={modalOpen}
		person={editingPerson}
		on:close={closeModal}
		on:save={handleSave}
	/>
</div>

<style>
	/* People-specific styles only - layout handled by sys-* classes */
	.person-card {
		display: flex;
		align-items: center;
	}

	.person-link {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		text-decoration: none;
		color: inherit;
	}

	.person-info {
		flex: 1;
		min-width: 0;
	}

	.person-info h2 {
		font-size: 1.1rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		color: var(--sys-text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.legal-name {
		font-size: 0.8rem;
		color: var(--sys-muted);
		margin-bottom: 0.25rem;
	}

	.contact-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		background: #e8f5e9;
		color: #2e7d32;
		padding: 0.2rem 0.5rem;
		border-radius: 4px;
		font-size: 0.8rem;
		font-weight: 500;
	}

	.no-info {
		color: var(--sys-muted);
		font-size: 0.8rem;
		font-style: italic;
	}

	.card-actions {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		border-left: 1px solid var(--sys-border);
	}

	.people-controls {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 10px;
	}

	.people-sort-group .sys-select {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding-right: 32px; /* space for the native arrow */
		text-overflow: ellipsis;
		white-space: nowrap;
		overflow: hidden;
	}
	.people-sort-select {
		box-sizing: border-box;
	}

	.people-sort-select {
		height: 40px; /* give it a little more breathing room */
		line-height: 40px; /* vertically centers the text */
		padding: 0 36px 0 12px; /* zero vertical padding so nothing gets clipped */
	}

	.people-sort-group .sys-select,
	.people-sort-group .sys-btn,
	.people-view-btn {
		height: 36px;
	}

	.people-sort-group .sys-select {
		width: 220px; /* pick a size you like */
		min-width: 220px; /* prevents flex from crushing it */
	}
	.sys-table-wrap {
		margin-top: 1.5rem;
		overflow: hidden;
		overflow-x: auto;
		border: 1px solid var(--sys-border);
		border-radius: var(--sys-radius-lg);
		background: white;
	}

	.people-table-card {
		margin-top: 1.5rem;
	}

	.people-table-card .sys-table-wrap {
		margin-top: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
	}

	.sys-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
	}

	.sys-table thead {
		background: var(--sys-panel);
	}

	.sys-table th,
	.sys-table td {
		padding: 12px 14px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
		vertical-align: middle;
		text-align: left;
	}

	.sys-table tbody tr:last-child td {
		border-bottom: none;
	}

	.col-photo {
		width: 64px;
	}
	.col-actions {
		width: 120px;
	}

	.th-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		background: transparent;
		border: 0;
		padding: 0;
		font: inherit;
		cursor: pointer;
	}

	.sort-indicator {
		font-size: 12px;
		opacity: 0.7;
	}

	.row-link {
		color: inherit;
		text-decoration: none;
	}

	.row-link:hover .primary {
		text-decoration: underline;
	}

	.primary {
		font-weight: 600;
	}

	.muted {
		opacity: 0.7;
		font-size: 13px;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 8px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.04);
		font-size: 12px;
	}
</style>
