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
	class="w-full min-h-[120px] resize-y rounded-card border border-ui-border bg-ui-surface px-4 py-3 text-base text-ui-text placeholder:text-ui-text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface disabled:cursor-not-allowed disabled:bg-ui-surface-muted disabled:text-ui-text-muted"
	{name}
	{id}
	{rows}
	{disabled}
	{required}
	{placeholder}
	bind:value
	{...$$restProps}
></textarea>
