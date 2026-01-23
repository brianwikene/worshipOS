<!-- /ui/src/lib/components/PersonModal.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let open = false;
	export let person: {
		id?: string;
		first_name?: string | null;
		last_name?: string | null;
		goes_by?: string | null;
	} | null = null;

	const dispatch = createEventDispatcher<{
		close: void;
		save: { first_name: string; last_name: string; goes_by: string };
	}>();

	let firstName = '';
	let lastName = '';
	let goesBy = '';
	let saving = false;
	let error = '';

	// Reset form when modal opens
	$: if (open) {
		firstName = person?.first_name ?? '';
		lastName = person?.last_name ?? '';
		goesBy = person?.goes_by ?? '';
		error = '';
		saving = false;
	}

	$: isEdit = !!person?.id;
	$: title = isEdit ? 'Edit Person' : 'Add Person';
	$: canSave = (firstName.trim() || lastName.trim()) && !saving;

	// Compute preview of display name
	$: displayPreview = computeDisplayName(firstName, lastName, goesBy);

	function computeDisplayName(first: string, last: string, goes: string): string {
		const preferred = goes.trim() || first.trim();
		const surname = last.trim();
		if (preferred && surname) return `${preferred} ${surname}`;
		return preferred || surname || '';
	}

	function handleClose() {
		if (!saving) {
			dispatch('close');
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		if (!canSave) return;

		error = '';
		saving = true;

		dispatch('save', {
			first_name: firstName.trim(),
			last_name: lastName.trim(),
			goes_by: goesBy.trim()
		});
	}

	export function setError(msg: string) {
		error = msg;
		saving = false;
	}

	export function setSaving(val: boolean) {
		saving = val;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
		<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
			<header class="modal-header">
				<h2 id="modal-title">{title}</h2>
				<button class="close-btn" onclick={handleClose} aria-label="Close" disabled={saving}>
					✕
				</button>
			</header>

			<form onsubmit={handleSubmit}>
				<div class="modal-body">
					{#if error}
						<div class="error-message">{error}</div>
					{/if}

					<div class="form-row">
						<div class="form-group">
							<label for="first_name">First Name</label>
							<input
								type="text"
								id="first_name"
								bind:value={firstName}
								placeholder="e.g. Brian"
								disabled={saving}
							/>
						</div>

						<div class="form-group">
							<label for="last_name">Last Name</label>
							<input
								type="text"
								id="last_name"
								bind:value={lastName}
								placeholder="e.g. Wikene"
								disabled={saving}
							/>
						</div>
					</div>

					<div class="form-group">
						<label for="goes_by">Goes By <span class="optional">(optional)</span></label>
						<input
							type="text"
							id="goes_by"
							bind:value={goesBy}
							placeholder="e.g. AJ, Pastor Mike"
							disabled={saving}
						/>
						<span class="hint">If different from first name</span>
					</div>

					{#if displayPreview}
						<div class="preview">
							<span class="preview-label">Will display as:</span>
							<span class="preview-name">{displayPreview}</span>
						</div>
					{/if}
				</div>

				<footer class="modal-footer">
					<button type="button" class="btn-secondary" onclick={handleClose} disabled={saving}>
						Cancel
					</button>
					<button type="submit" class="btn-primary" disabled={!canSave}>
						{#if saving}
							Saving...
						{:else}
							{isEdit ? 'Save Changes' : 'Add Person'}
						{/if}
					</button>
				</footer>
			</form>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
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
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		width: 100%;
		max-width: 480px;
		max-height: 90vh;
		overflow: auto;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1a1a1a;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.25rem;
		color: #666;
		cursor: pointer;
		padding: 0.25rem;
		line-height: 1;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-btn:hover:not(:disabled) {
		background: #f0f0f0;
		color: #1a1a1a;
	}

	.close-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.modal-body {
		padding: 1.5rem;
	}

	.error-message {
		background: #fee;
		color: #c00;
		padding: 0.75rem 1rem;
		border-radius: 6px;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	label {
		display: block;
		font-size: 0.875rem;
		font-weight: 500;
		color: #333;
		margin-bottom: 0.375rem;
	}

	.optional {
		font-weight: 400;
		color: #888;
	}

	input {
		width: 100%;
		padding: 0.625rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 6px;
		font-size: 1rem;
		transition: all 0.2s;
		box-sizing: border-box;
	}

	input:focus {
		outline: none;
		border-color: #0066cc;
		box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
	}

	input:disabled {
		background: #f5f5f5;
		cursor: not-allowed;
	}

	.hint {
		display: block;
		font-size: 0.75rem;
		color: #888;
		margin-top: 0.25rem;
	}

	.preview {
		background: #f0f7ff;
		border: 1px solid #cce0ff;
		border-radius: 6px;
		padding: 0.75rem 1rem;
		margin-top: 0.5rem;
	}

	.preview-label {
		font-size: 0.75rem;
		color: #666;
		display: block;
		margin-bottom: 0.25rem;
	}

	.preview-name {
		font-size: 1.1rem;
		font-weight: 600;
		color: #0066cc;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid #e0e0e0;
		background: #fafafa;
		border-radius: 0 0 12px 12px;
	}

	button {
		padding: 0.625rem 1.25rem;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-secondary {
		background: white;
		border: 1px solid #ddd;
		color: #333;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #f5f5f5;
		border-color: #ccc;
	}

	.btn-primary {
		background: #0066cc;
		border: 1px solid #0066cc;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: #0055aa;
	}

	.btn-primary:disabled,
	.btn-secondary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	@media (max-width: 500px) {
		.form-row {
			grid-template-columns: 1fr;
		}
	}
</style>
