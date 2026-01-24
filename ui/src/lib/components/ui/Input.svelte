<!-- /ui/src/lib/components/ui/Input.svelte -->
<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = HTMLInputAttributes;

	let el: HTMLInputElement | null = null;

	// Bindable value + props
	export let value: string = '';
	export let className: string = '';

	const { class: restClass = '', ...rest } = $$restProps as Props;

	// Optional class merging
	const composedClass = `${restClass} ${className}`.trim();

	export function focus() {
		el?.focus();
	}
</script>

<input
	bind:this={el}
	class={`w-full rounded-card border border-ui-border bg-ui-surface px-4 py-3 text-base text-ui-text placeholder:text-ui-text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface disabled:cursor-not-allowed disabled:bg-ui-surface-muted disabled:text-ui-text-muted ${composedClass}`}
	bind:value
	{...rest}
/>
