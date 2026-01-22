<!-- /ui/src/lib/components/ui/Select.svelte -->
<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';

	export let value: HTMLSelectAttributes['value'] = '';
	export let name: string | undefined = undefined;
	export let id: string | undefined = undefined;
	export let disabled = false;
	export let required = false;
</script>

<select
	class="w-full rounded-card border border-ui-border bg-ui-surface px-4 py-3 text-base text-ui-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface disabled:cursor-not-allowed disabled:bg-ui-surface-muted disabled:text-ui-text-muted"
	{name}
	{id}
	{disabled}
	{required}
	bind:value
>
	<slot />
</select>
