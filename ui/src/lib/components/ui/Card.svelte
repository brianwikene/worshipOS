<!-- /ui/src/lib/components/ui/Card.svelte -->
<script lang="ts">
	export let elevated = false;
</script>

<div class={`rounded-card border border-ui-border bg-ui-surface ${elevated ? 'shadow-card-hover' : 'shadow-card'} overflow-hidden transition-shadow`}>
	{#if $$slots.header}
		<div class="border-b border-ui-border px-6 pb-3 pt-6">
			<slot name="header" />
		</div>
	{/if}
	<div class="px-6 pb-6 pt-4">
		<slot />
	</div>
</div>
