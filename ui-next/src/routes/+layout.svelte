<script lang="ts">
	import { page } from '$app/state';
	import DevToolbar from '$lib/components/dev/DevToolbar.svelte';
	import { initTenant } from '$lib/tenant.svelte';
	import { Check, ChevronDown } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import '../app.css';

	let { data, children } = $props();

	// Initialize Tenant State
	// svelte-ignore state_referenced_locally
	const tenant = initTenant(
		data.church
			? { id: data.church.id, name: data.church.name, slug: data.church.subdomain || '' }
			: undefined,
		data.campus ? { id: data.campus.id, name: data.campus.name } : null
	);

	$effect(() => {
		tenant.church = data.church
			? { id: data.church.id, name: data.church.name, slug: data.church.subdomain || '' }
			: undefined;
		tenant.campus = data.campus ? { id: data.campus.id, name: data.campus.name } : null;
	});

	// FIX: Hide the top bar when in Admin routes
	let activeChurch = $derived(!page.url.pathname.startsWith('/admin') ? data.church : null);
	let activeCampus = $derived(data.campus);
	let allCampuses = $derived(data.allCampuses || []);

	let isCampusMenuOpen = $state(false);

	function switchCampus(campusId: string) {
		// Set cookie via JS (easiest for layout switching)
		document.cookie = `campus_id=${campusId}; path=/; max-age=31536000`; // 1 year
		window.location.reload();
	}
</script>

<div class="relative flex min-h-screen flex-col bg-slate-50 font-sans">
	{#if activeChurch}
		<div
			class="flex shrink-0 items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5 text-xs text-gray-400"
		>
			<div class="flex items-center gap-2">
				<span class="ml-1">Building for</span>

				<button
					class="font-bold text-blue-400 decoration-blue-400/30 underline-offset-4 transition hover:text-blue-300 hover:underline"
				>
					{activeChurch.name}
				</button>

				{#if activeCampus}
					<span>at</span>
					<div class="relative">
						<button
							onclick={() => (isCampusMenuOpen = !isCampusMenuOpen)}
							class="flex items-center gap-1 font-bold text-green-400 decoration-green-400/30 underline-offset-4 transition hover:text-green-300 hover:underline"
						>
							{activeCampus.name}
							<ChevronDown size={10} />
						</button>

						{#if isCampusMenuOpen}
							<!-- Backdrop -->
							<button
								class="fixed inset-0 z-40 cursor-default"
								onclick={() => (isCampusMenuOpen = false)}
								aria-label="Close menu"
							></button>

							<div
								transition:slide={{ axis: 'y', duration: 150 }}
								class="absolute top-full left-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-slate-700 bg-slate-800 py-1 shadow-xl"
							>
								<div
									class="px-3 py-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase"
								>
									Switch Campus
								</div>
								{#each allCampuses as c}
									<button
										onclick={() => switchCampus(c.id)}
										class="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white"
									>
										{c.name}
										{#if c.id === activeCampus.id}
											<Check size={12} class="text-green-400" />
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="flex items-center gap-4">
				<button
					onclick={() => (isCampusMenuOpen = !isCampusMenuOpen)}
					class="flex items-center gap-1 transition hover:text-white"
				>
					<span>Switch Location</span>
				</button>
				<span class="text-gray-700">|</span>
				<button class="transition hover:text-white"> Get Help </button>
			</div>
		</div>
	{/if}

	<main class="flex-1 overflow-y-auto">
		{@render children()}
	</main>

	{#if import.meta.env.DEV}
		<DevToolbar />
	{/if}
</div>
