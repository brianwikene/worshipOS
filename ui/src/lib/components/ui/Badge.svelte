<!-- /ui/src/lib/components/ui/Badge.svelte -->
<script lang="ts">
	type BadgeVariant = 'default' | 'muted' | 'accent' | 'warning' | 'success' | 'danger';

	const props = $props<{ variant?: BadgeVariant; children?: () => unknown }>();
	const variant: BadgeVariant = props.variant ?? 'default';

	const variantClasses: Record<BadgeVariant, string> = {
		default: 'border-ui-border bg-ui-surface text-ui-text',
		muted: 'border-ui-border bg-ui-surface-muted text-ui-text-muted font-medium',
		accent: 'border-[#cfd8ff] bg-ui-accent-muted text-ui-accent',
		warning: 'border-[#f4c38a] bg-[#fff8e7] text-[#b45309]',
		success: 'border-[#b7e4cc] bg-[#ecfdf3] text-[#0f9d58]',
		danger: 'border-[#f8b4b4] bg-[#feeaea] text-[#b91c1c]'
	};
</script>

<span
	class={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${variantClasses[variant]}`}
>
	{@render props.children?.()}
</span>
