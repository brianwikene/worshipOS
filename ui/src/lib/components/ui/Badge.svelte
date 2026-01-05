<script lang="ts">
	export let variant: 'default' | 'muted' | 'accent' | 'warning' | 'success' | 'danger' = 'default';
</script>

<span class={`ui-badge ui-badge--${variant}`}>
	<slot />
</span>

<style>
	.ui-badge {
		display: inline-flex;
		align-items: center;
		gap: var(--ui-space-1);
		padding: 0.1rem 0.55rem;
		border-radius: 999px;
		font-size: var(--ui-font-size-sm);
		font-weight: 600;
		border: 1px solid transparent;
		background: var(--ui-color-surface-muted);
		color: var(--ui-color-text);
	}

	.ui-badge--muted {
		background: var(--ui-color-surface-muted);
		color: var(--ui-color-text-muted);
		border-color: var(--ui-color-border);
		font-weight: 500;
	}

	.ui-badge--accent {
		background: var(--ui-color-accent-muted);
		color: var(--ui-color-accent);
		border-color: color-mix(in srgb, var(--ui-color-accent) 25%, white);
	}

	.ui-badge--warning {
		background: color-mix(in srgb, var(--ui-color-warning) 15%, #fff4db);
		color: var(--ui-color-warning);
		border-color: color-mix(in srgb, var(--ui-color-warning) 35%, white);
	}

	.ui-badge--success {
		background: color-mix(in srgb, var(--ui-color-success) 15%, #ecfdf3);
		color: var(--ui-color-success);
		border-color: color-mix(in srgb, var(--ui-color-success) 35%, white);
	}

	.ui-badge--danger {
		background: color-mix(in srgb, var(--ui-color-danger) 12%, #feeaea);
		color: var(--ui-color-danger);
		border-color: color-mix(in srgb, var(--ui-color-danger) 30%, white);
	}
</style>
