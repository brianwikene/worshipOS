<script lang="ts">
	export let elevated = false;
</script>

<div class={`ui-card ${elevated ? 'ui-card--elevated' : ''}`}>
	{#if $$slots.header}
		<div class="ui-card__header">
			<slot name="header" />
		</div>
	{/if}
	<div class="ui-card__body">
		<slot />
	</div>
</div>

<style>
	.ui-card {
		border-radius: var(--ui-radius-lg);
		border: 1px solid var(--ui-color-border);
		background: var(--ui-color-surface);
		box-shadow: var(--ui-shadow-sm);
		overflow: hidden;
	}

	.ui-card--elevated {
		box-shadow: var(--ui-shadow-md);
	}

	.ui-card__header {
		padding: var(--ui-space-4) var(--ui-space-5) var(--ui-space-2);
		border-bottom: 1px solid var(--ui-color-border);
	}

	.ui-card__body {
		padding: var(--ui-space-4) var(--ui-space-5) var(--ui-space-5);
	}
</style>
