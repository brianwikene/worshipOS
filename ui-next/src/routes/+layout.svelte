<script lang="ts">
	import { page } from '$app/state';
	import DevToolbar from '$lib/components/dev/DevToolbar.svelte';
	import { installClientErrorCapture } from '$lib/client/error-capture';
	import { initTenant } from '$lib/tenant.svelte';
	import type { LayoutData } from './$types';
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';
	import {
		Calendar,
		Check,
		ChevronDown,
		HandHeart,
		LayoutDashboard,
		Menu,
		Music,
		Settings,
		Users,
		X
	} from '@lucide/svelte';

	import { slide } from 'svelte/transition';
	import '../app.css';

	// Install global client error capture
	onMount(() => {
		installClientErrorCapture();
	});
	// Note: Adjust path if app.css is in src/ (e.g. '../../app.css')

	// --- 3. Type the props explicitly ---
	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	// --- 1. TENANT LOGIC ---
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

	// --- 2. STATE & CONFIG ---
	// Hide top bar on admin, but we might want sidebar everywhere?
	let activeChurch = $derived(!page.url.pathname.startsWith('/admin') ? data.church : null);
	let activeCampus = $derived(data.campus);
	let allCampuses = $derived(data.allCampuses || []);

	let isCampusMenuOpen = $state(false);
	let isMobileNavOpen = $state(false);

	function switchCampus(campusId: string) {
		document.cookie = `campus_id=${campusId}; path=/; max-age=31536000`;
		window.location.reload();
	}

	// --- 3. NAVIGATION CONFIG ---
	const navItems = [
		{ label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
		{ label: 'Gatherings', href: '/gatherings', icon: Calendar },
		{ label: 'People', href: '/connections', icon: Users },
		{ label: 'Songs', href: '/songs', icon: Music },
		{ label: 'Teams', href: '/teams', icon: HandHeart }
	];

	function isActive(href: string) {
		if (href === '/dashboard') return page.url.pathname === '/dashboard';
		return page.url.pathname.startsWith(href);
	}
</script>

<div class="flex min-h-screen flex-col bg-stone-50 font-sans text-slate-900">
	{#if activeChurch}
		<div
			class="relative z-50 flex shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-xs text-slate-400 shadow-md print:hidden"
		>
			<div class="flex items-center gap-2">
				<div class="flex items-center gap-2 md:hidden">
					<button onclick={() => (isMobileNavOpen = !isMobileNavOpen)} class="text-slate-200">
						{#if isMobileNavOpen}
							<X size={18} />
						{:else}
							<Menu size={18} />
						{/if}
					</button>
					<div class="h-4 w-px bg-slate-700"></div>
				</div>

				<span class="hidden sm:inline">Building for</span>

				<button
					class="font-bold text-blue-400 decoration-blue-400/30 underline-offset-4 transition hover:text-blue-300 hover:underline"
				>
					{activeChurch.name}
				</button>

				{#if activeCampus}
					<span class="text-slate-600">at</span>
					<div class="relative">
						<button
							onclick={() => (isCampusMenuOpen = !isCampusMenuOpen)}
							class="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/20 transition-all hover:bg-emerald-500/20 hover:text-emerald-300 hover:ring-emerald-500/40"
						>
							{activeCampus.name}
							<ChevronDown size={12} class="opacity-70" />
						</button>

						{#if isCampusMenuOpen}
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
											<Check size={12} class="text-emerald-400" />
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="hidden items-center gap-4 sm:flex">
				<button class="transition hover:text-white">Switch Location</button>
				<span class="text-slate-700">|</span>
				<button class="transition hover:text-white">Get Help</button>
			</div>
		</div>
	{/if}

	<div class="flex min-h-0 flex-1">
		<aside class="hidden w-64 flex-col border-r border-stone-200 bg-stone-50 md:flex print:!hidden">
			<nav class="flex-1 space-y-1 p-4">
				{#each navItems as item}
					{@const active = isActive(item.href)}
					<a
						href={item.href}
						class={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
							active
								? 'bg-white text-slate-900 shadow-sm ring-1 ring-stone-200'
								: 'text-stone-500 hover:bg-stone-100 hover:text-slate-900'
						}`}
					>
						<item.icon
							size={18}
							class={`transition-colors ${active ? 'text-slate-900' : 'text-stone-400 group-hover:text-slate-600'}`}
						/>
						{item.label}
					</a>
				{/each}
			</nav>

			<div class="border-t border-stone-200 p-4">
				<a
					href="/admin"
					class={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all ${
						isActive('/admin')
							? 'bg-white text-slate-900 shadow-sm ring-1 ring-stone-200'
							: 'text-stone-500 hover:bg-stone-100 hover:text-slate-900'
					}`}
				>
					<Settings
						size={18}
						class={`transition-colors ${isActive('/admin') ? 'text-slate-900' : 'text-stone-400 group-hover:text-slate-600'}`}
					/>
					Administration
				</a>
			</div>
		</aside>

		{#if isMobileNavOpen}
			<div
				class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
				onclick={() => (isMobileNavOpen = false)}
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Escape' && (isMobileNavOpen = false)}
			></div>
			<aside
				transition:slide={{ axis: 'x', duration: 200 }}
				class="fixed inset-y-0 left-0 z-50 w-64 bg-stone-50 shadow-2xl md:hidden"
			>
				<div class="flex h-full flex-col">
					<div class="flex items-center justify-between p-4">
						<span class="font-bold text-slate-900">Menu</span>
						<button onclick={() => (isMobileNavOpen = false)} class="text-stone-400">
							<X size={20} />
						</button>
					</div>
					<nav class="flex-1 space-y-1 p-4">
						{#each navItems as item}
							<a
								href={item.href}
								onclick={() => (isMobileNavOpen = false)}
								class={`flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold ${
									isActive(item.href) ? 'bg-white text-slate-900 shadow-sm' : 'text-stone-500'
								}`}
							>
								<item.icon size={18} />
								{item.label}
							</a>
						{/each}
						<div class="my-2 border-t border-stone-200"></div>
						<a
							href="/admin"
							onclick={() => (isMobileNavOpen = false)}
							class="flex items-center gap-3 rounded-md px-3 py-3 text-sm font-bold text-stone-500"
						>
							<Settings size={18} />
							Administration
						</a>
					</nav>
				</div>
			</aside>
		{/if}

		<main class="flex-1 overflow-y-auto bg-stone-50/50">
			{@render children()}
		</main>
	</div>

	{#if import.meta.env.DEV}
		<DevToolbar />
	{/if}
</div>
