<!-- /ui/src/lib/components/ui/Button.svelte -->
<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type ButtonVariant = 'primary' | 'secondary' | 'ghost';
	type ButtonSize = 'md' | 'sm';

	export let variant: ButtonVariant = 'primary';
	export let size: ButtonSize = 'md';
	export let fullWidth = false;
	export let type: HTMLButtonAttributes['type'] = 'button';
	export let disabled = false;

	const variantClasses: Record<ButtonVariant, string> = {
		primary: 'border-transparent bg-ui-accent text-white shadow-card hover:shadow-card-hover',
		secondary: 'border-ui-border bg-ui-surface text-ui-text hover:bg-ui-surface-muted',
		ghost: 'border-transparent bg-transparent text-ui-text-muted hover:bg-ui-surface-muted hover:text-ui-text'
	};

	const sizeClasses: Record<ButtonSize, string> = {
		md: 'px-5 py-3 text-base',
		sm: 'px-3.5 py-2 text-sm font-medium'
	};
</script>

<button
	type={type}
	class={`inline-flex items-center justify-center gap-2 rounded-card border font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ui-surface disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''}`}
	{disabled}
	on:click
	on:keydown
	{...$$restProps}
>
	<slot />
</button>
