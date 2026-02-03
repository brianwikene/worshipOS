<script lang="ts">
	import { page } from '$app/state'; // <--- NEW Svelte 5 Import
	import { Building2, ChevronUp, Copy, Database, User, X } from '@lucide/svelte';

	import { slide } from 'svelte/transition';

	// State
	let isOpen = $state(false);
	let copiedField = $state<string | null>(null);

	// Derived Data (Note: No '$' prefix needed anymore)
	let church = $derived(page.data.church);
	let person = $derived(page.data.person);

	// MOCK DATA (Update this with real data fetch if needed later)
	const availableTenants = [
		{ name: 'WorshipNext Church', slug: 'worshipnext' },
		{ name: 'Mountain Vineyard', slug: 'mountain' },
		{ name: 'North Creek', slug: 'northcreek' }
	];

	function copyToClipboard(text: string | undefined, label: string) {
		if (!text) return;
		navigator.clipboard.writeText(text);
		copiedField = label;
		setTimeout(() => (copiedField = null), 2000);
	}

	function switchTenant(slug: string) {
		// Forces a browser redirect to the subdomain
		const protocol = window.location.protocol;
		const host = window.location.host.split('.').slice(-1)[0];
		const baseDomain = host.includes('localhost') ? 'localhost:5174' : 'worshipos.dev';

		window.location.href = `${protocol}//${slug}.${baseDomain}`;
	}
</script>

<div class="pointer-events-none fixed right-0 bottom-0 left-0 z-[9999] flex justify-center">
	{#if !isOpen}
		<button
			onclick={() => (isOpen = true)}
			class="pointer-events-auto mb-2 flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/90 px-4 py-1.5 text-xs font-bold text-stone-400 shadow-xl backdrop-blur-md transition-all hover:scale-105 hover:bg-slate-800 hover:text-white"
		>
			<span class="rounded bg-pink-600 px-1 text-[9px] text-white">DEV</span>
			<span class="max-w-[150px] truncate">{church?.name || 'No Context'}</span>
			<ChevronUp size={14} />
		</button>
	{/if}

	{#if isOpen}
		<div
			transition:slide={{ axis: 'y', duration: 200 }}
			class="pointer-events-auto w-full border-t border-slate-700 bg-slate-900 shadow-2xl"
		>
			<div class="mx-auto max-w-5xl px-4 py-4 sm:px-6 lg:px-8">
				<div class="flex items-start justify-between">
					<div class="flex gap-8">
						<div class="space-y-2">
							<h4
								class="flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase"
							>
								<Building2 size={12} /> Tenant Context
							</h4>
							<div class="group relative">
								<button
									onclick={() => copyToClipboard(church?.id, 'church_id')}
									class="flex items-center gap-2 font-mono text-xs text-blue-400 hover:text-white"
								>
									<span class="select-all">{church?.id || 'Undefined'}</span>
									{#if copiedField === 'church_id'}
										<span class="text-[10px] text-emerald-500">Copied!</span>
									{:else}
										<Copy size={10} class="opacity-0 group-hover:opacity-100" />
									{/if}
								</button>
								<div class="text-[10px] text-slate-500">
									Slug: <span class="text-slate-300">{church?.subdomain || 'none'}</span>
								</div>
							</div>
						</div>

						<div class="space-y-2">
							<h4
								class="flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase"
							>
								<User size={12} /> Session Context
							</h4>
							<div class="group relative">
								<button
									onclick={() => copyToClipboard(person?.id, 'user_id')}
									class="flex items-center gap-2 font-mono text-xs text-emerald-400 hover:text-white"
								>
									<span class="select-all">{person?.id || 'Not Logged In'}</span>
									{#if copiedField === 'user_id'}
										<span class="text-[10px] text-emerald-500">Copied!</span>
									{:else}
										<Copy size={10} class="opacity-0 group-hover:opacity-100" />
									{/if}
								</button>
								<div class="text-[10px] text-slate-500">
									Role: <span class="text-slate-300">{person?.role || 'visitor'}</span>
								</div>
							</div>
						</div>
					</div>

					<div class="hidden sm:block">
						<h4
							class="mb-2 text-center text-[10px] font-bold tracking-wider text-slate-500 uppercase"
						>
							Switch Environment
						</h4>
						<div class="flex items-center gap-2">
							{#each availableTenants as t}
								<button
									onclick={() => switchTenant(t.slug)}
									class={`rounded px-2 py-1 text-xs font-bold transition-colors ${
										church?.subdomain === t.slug
											? 'cursor-default bg-blue-600 text-white'
											: 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
									}`}
								>
									{t.name}
								</button>
							{/each}
						</div>
					</div>

					<div class="flex items-start gap-4">
						<a
							href="/admin"
							class="flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
						>
							<Database size={14} /> Admin Data
						</a>
						<button onclick={() => (isOpen = false)} class="text-slate-500 hover:text-white">
							<X size={20} />
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
