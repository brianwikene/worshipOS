<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';

	export let value: HTMLSelectAttributes['value'] = '';
	export let name: string | undefined = undefined;
	export let id: string | undefined = undefined;
	export let disabled = false;
	export let required = false;
</script>

<select class="ui-select" {name} {id} {disabled} {required} bind:value>
	<slot />
</select>

<style>
	.ui-select {
		width: 100%;
		padding: var(--ui-space-3) var(--ui-space-4);
		border-radius: var(--ui-radius-md);
		border: 1px solid var(--ui-color-border);
		background: var(--ui-color-surface);
		font-size: var(--ui-font-size-md);
		color: var(--ui-color-text);
		box-sizing: border-box;
		appearance: none;
		background-image: linear-gradient(45deg, transparent 50%, var(--ui-color-text-muted) 50%),
			linear-gradient(135deg, var(--ui-color-text-muted) 50%, transparent 50%);
		background-position:
			calc(100% - 16px) calc(50% - 3px),
			calc(100% - 10px) calc(50% - 3px);
		background-size:
			6px 6px,
			6px 6px;
		background-repeat: no-repeat;
	}

	.ui-select:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--ui-color-accent) 65%, white);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-color-accent) 20%, transparent);
	}

	.ui-select:disabled {
		background-color: var(--ui-color-surface-muted);
		color: var(--ui-color-text-muted);
		cursor: not-allowed;
	}
</style>
