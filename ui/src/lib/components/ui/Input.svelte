<!-- /ui/src/lib/components/ui/Input.svelte -->
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
	export let inputmode: HTMLInputElement['inputMode'] | undefined = undefined;
	export let min: number | string | undefined = undefined;
	export let max: number | string | undefined = undefined;
	export let step: number | string | undefined = undefined;
	export let maxlength: number | undefined = undefined;
</script>

<input
	class="w-full rounded-card border border-ui-border bg-ui-surface px-4 py-3 text-base text-ui-text placeholder:text-ui-text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface disabled:cursor-not-allowed disabled:bg-ui-surface-muted disabled:text-ui-text-muted"
	{type}
	{name}
	{id}
	{disabled}
	{required}
	{placeholder}
	{autocomplete}
	{inputmode}
	{min}
	{max}
	{step}
	{maxlength}
	bind:value
	{...$$restProps}
/>
