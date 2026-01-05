<script lang="ts">
	import type { HTMLTextAreaAttributes } from 'svelte/elements';

	export let value: HTMLTextAreaAttributes['value'] = '';
	export let placeholder: string | undefined = undefined;
	export let name: string | undefined = undefined;
	export let id: string | undefined = undefined;
	export let rows: number | undefined = 4;
	export let disabled = false;
	export let required = false;
</script>

<textarea
	class="ui-textarea"
	{name}
	{id}
	{rows}
	{disabled}
	{required}
	{placeholder}
	bind:value
/>

<style>
	.ui-textarea {
		width: 100%;
		padding: var(--ui-space-3) var(--ui-space-4);
		border-radius: var(--ui-radius-md);
		border: 1px solid var(--ui-color-border);
		background: var(--ui-color-surface);
		font-size: var(--ui-font-size-md);
		color: var(--ui-color-text);
		font-family: inherit;
		box-sizing: border-box;
		resize: vertical;
		min-height: 120px;
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease;
	}

	.ui-textarea:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--ui-color-accent) 65%, white);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-color-accent) 20%, transparent);
	}

	.ui-textarea:disabled {
		background: var(--ui-color-surface-muted);
		color: var(--ui-color-text-muted);
		cursor: not-allowed;
	}
</style>
