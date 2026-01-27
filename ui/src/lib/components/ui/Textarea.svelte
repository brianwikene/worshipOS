<!-- /ui/src/lib/components/ui/Textarea.svelte -->
<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	type Props = HTMLTextareaAttributes & {
		value?: string;
	};

	let { value = $bindable(''), rows = 4, class: className, ...rest }: Props = $props();
</script>

<textarea
	class={`w-full min-h-[120px] resize-y rounded-card border border-ui-border bg-ui-surface px-4 py-3 text-base text-ui-text placeholder:text-ui-text-muted transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface disabled:cursor-not-allowed disabled:bg-ui-surface-muted disabled:text-ui-text-muted ${className ?? ''}`}
	{rows}
	bind:value
	{...rest}
></textarea>
