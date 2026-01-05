<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	export let variant: 'primary' | 'secondary' | 'ghost' = 'primary';
	export let size: 'md' | 'sm' = 'md';
	export let fullWidth = false;
	export let type: HTMLButtonAttributes['type'] = 'button';
	export let disabled = false;
</script>

<button
	type={type}
	class={`ui-button ui-button--${variant} ui-button--${size} ${fullWidth ? 'ui-button--full' : ''}`}
	{disabled}
>
	<slot />
</button>

<style>
	.ui-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--ui-space-2);
		padding: var(--ui-space-3) var(--ui-space-5);
		border-radius: var(--ui-radius-md);
		border: 1px solid transparent;
		font-size: 0.95rem;
		font-weight: 600;
		cursor: pointer;
		background: var(--ui-color-accent);
		color: #fff;
		transition:
			background 0.2s ease,
			color 0.2s ease,
			box-shadow 0.2s ease,
			transform 0.1s ease;
		box-shadow: var(--ui-shadow-sm);
	}

	.ui-button--sm {
		padding: var(--ui-space-2) var(--ui-space-4);
		font-size: 0.85rem;
		font-weight: 500;
	}

	.ui-button--full {
		width: 100%;
	}

	.ui-button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
		box-shadow: none;
	}

	.ui-button:not(:disabled):hover {
		box-shadow: var(--ui-shadow-md);
		transform: translateY(-1px);
	}

	.ui-button:not(:disabled):focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-color-accent) 35%, transparent);
	}

	.ui-button--secondary {
		background: var(--ui-color-surface);
		color: var(--ui-color-text);
		border-color: var(--ui-color-border);
		box-shadow: none;
	}

	.ui-button--secondary:not(:disabled):hover {
		background: var(--ui-color-surface-muted);
	}

	.ui-button--ghost {
		background: transparent;
		color: var(--ui-color-text-muted);
		border-color: transparent;
		box-shadow: none;
	}

	.ui-button--ghost:not(:disabled):hover {
		background: var(--ui-color-surface-muted);
		color: var(--ui-color-text);
	}
</style>
