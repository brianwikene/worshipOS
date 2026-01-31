<!-- ui-next/src/lib/components/ui/Drawer.svelte -->
<script lang="ts">
	import { X } from '@lucide/svelte';
	import type { Snippet } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	type Props = {
		open?: boolean;
		title?: string;
		children?: Snippet;
	};

	let { open = $bindable(false), title, children } = $props<Props>();

	// Generate unique ID for aria-labelledby
	const titleId = `drawer-title-${Math.random().toString(36).slice(2, 9)}`;

	let drawerElement = $state<HTMLElement | null>(null);
	let previouslyFocusedElement: HTMLElement | null = null;

	function close() {
		open = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (!open) return;

		// Close on Escape
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}

		// Focus trap on Tab
		if (event.key === 'Tab' && drawerElement) {
			const focusableElements = drawerElement.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];

			if (event.shiftKey && document.activeElement === firstElement) {
				event.preventDefault();
				lastElement?.focus();
			} else if (!event.shiftKey && document.activeElement === lastElement) {
				event.preventDefault();
				firstElement?.focus();
			}
		}
	}

	// Focus management when drawer opens/closes
	$effect(() => {
		if (open) {
			// Store the currently focused element to restore later
			previouslyFocusedElement = document.activeElement as HTMLElement;
			// Focus the drawer after it renders
			requestAnimationFrame(() => {
				const firstFocusable = drawerElement?.querySelector<HTMLElement>(
					'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
				);
				firstFocusable?.focus();
			});
		} else if (previouslyFocusedElement) {
			// Restore focus when drawer closes
			previouslyFocusedElement.focus();
			previouslyFocusedElement = null;
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm transition-opacity"
		transition:fade={{ duration: 200 }}
		onclick={close}
		aria-hidden="true"
	></div>

	<div
		bind:this={drawerElement}
		role="dialog"
		aria-modal="true"
		aria-labelledby={titleId}
		class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
		transition:fly={{ x: 400, duration: 300, opacity: 1 }}
	>
		<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
			<h2 id={titleId} class="text-lg font-bold text-gray-900">{title}</h2>
			<button
				type="button"
				onclick={close}
				class="-mr-2 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
				aria-label="Close drawer"
			>
				<X size={20} />
			</button>
		</div>

		<div class="flex-1 overflow-y-auto p-6">
			{@render children?.()}
		</div>
	</div>
{/if}
