<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	export let value: HTMLInputAttributes['value'] = '';
	export let type: HTMLInputAttributes['type'] = 'text';
	export let disabled = false;
	export let placeholder: string | undefined = undefined;
	export let name: string | undefined = undefined;
	export let id: string | undefined = undefined;
	export let required = false;
	export let autocomplete: string | undefined = undefined;
	export let autofocus = false;
	export let inputmode: HTMLInputElement['inputMode'] | undefined = undefined;
	export let min: number | string | undefined = undefined;
	export let max: number | string | undefined = undefined;
	export let step: number | string | undefined = undefined;
	export let maxlength: number | undefined = undefined;
</script>

<input
	class="ui-input"
	{type}
	{name}
	{id}
	{disabled}
	{required}
	{placeholder}
	{autocomplete}
	{autofocus}
	{inputmode}
	{min}
	{max}
	{step}
	{maxlength}
	bind:value
/>

<style>
	.ui-input {
		width: 100%;
		padding: var(--ui-space-3) var(--ui-space-4);
		border-radius: var(--ui-radius-md);
		border: 1px solid var(--ui-color-border);
		background: var(--ui-color-surface);
		font-size: var(--ui-font-size-md);
		color: var(--ui-color-text);
		transition:
			border-color 0.2s ease,
			box-shadow 0.2s ease,
			background 0.2s ease;
		box-sizing: border-box;
	}

	.ui-input:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--ui-color-accent) 65%, white);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-color-accent) 20%, transparent);
	}

	.ui-input:disabled {
		background: var(--ui-color-surface-muted);
		color: var(--ui-color-text-muted);
		cursor: not-allowed;
	}
</style>
