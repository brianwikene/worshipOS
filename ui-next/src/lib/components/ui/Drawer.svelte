<script lang="ts">
	import { X } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';

	let { open = $bindable(false), title, children } = $props();

	function close() {
		open = false;
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm transition-opacity"
		transition:fade={{ duration: 200 }}
		onclick={close}
		role="presentation"
	></div>

	<div
		class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
		transition:fly={{ x: 400, duration: 300, opacity: 1 }}
	>
		<div class="flex items-center justify-between border-b border-gray-100 px-6 py-4">
			<h2 class="text-lg font-bold text-gray-900">{title}</h2>
			<button
				onclick={close}
				class="-mr-2 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
			>
				<X size={20} />
			</button>
		</div>

		<div class="flex-1 overflow-y-auto p-6">
			{@render children?.()}
		</div>
	</div>
{/if}
