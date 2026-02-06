<script lang="ts">
	import { page } from '$app/stores';
	import { Building2, ChevronUp, Copy, Database, User, X } from '@lucide/svelte';
	import { slide } from 'svelte/transition';

	interface Tenant {
		name: string;
		slug: string;
	}

	interface Props {
		tenants?: Tenant[];
	}

	let { tenants = [] }: Props = $props();

	// Live context from +layout.server.ts
	let church = $derived($page.data?.church);

	// Logged-in identity (WHO AM I)
	let actor = $derived($page.data?.actor);

	// Page subject (WHO AM I LOOKING AT)
	let person = $derived($page.data?.person);

	let isOpen = $state(false);
	let copiedField = $state<string | null>(null);

	async function copyToClipboard(text: string | undefined, label: string) {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			copiedField = label;
			setTimeout(() => (copiedField = null), 2000);
		} catch {}
	}

	function switchTenant(slug: string) {
		const protocol = window.location.protocol;
		const port = window.location.port;
		const hostname = window.location.hostname;

		if (hostname.includes('localhost') || hostname === '127.0.0.1') {
			window.location.href = `${protocol}//${slug}.localhost:${port}`;
		} else {
			const baseDomain = 'worshipos.dev';
			window.location.href = `${protocol}//${slug}.${baseDomain}`;
		}
	}
</script>

<div class="pointer-events-none fixed inset-x-0 bottom-0 z-[9999] flex justify-center print:hidden">
	{#if !isOpen}
		<button
			onclick={() => (isOpen = true)}
			aria-label="Open dev toolbar"
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
			<div class="mx-auto max-w-5xl px-4 py-4">
				<div class="flex items-start justify-between gap-8">
					<div class="flex gap-8">
						<!-- Tenant -->
						<div class="space-y-2">
							<h4
								class="flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase"
							>
								<Building2 size={12} /> Tenant
							</h4>
							<div class="group">
								<button
									onclick={() => copyToClipboard(church?.id, 'church_id')}
									class="flex items-center gap-2 font-mono text-xs text-blue-400 hover:text-white"
								>
									<span>{church?.id || 'Undefined'}</span>
									<Copy size={10} class="opacity-0 group-hover:opacity-100" />
								</button>
								<div class="text-[10px] text-slate-500">
									Slug: <span class="text-slate-300">{church?.subdomain || 'none'}</span>
								</div>
							</div>
						</div>

						<!-- Actor -->
						<div class="space-y-2">
							<h4
								class="flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase"
							>
								<User size={12} /> Actor (Logged In)
							</h4>
							<div class="group">
								<button
									onclick={() => copyToClipboard(actor?.id, 'actor_id')}
									class="flex items-center gap-2 font-mono text-xs text-emerald-400 hover:text-white"
								>
									<span>{actor?.id || 'Not Logged In'}</span>
									<Copy size={10} class="opacity-0 group-hover:opacity-100" />
								</button>
								<div class="text-[10px] text-slate-500">
									Role: <span class="text-slate-300">{actor?.role || 'visitor'}</span>
								</div>
							</div>
						</div>

						<!-- Page Subject -->
						{#if person}
							<div class="space-y-2">
								<h4
									class="flex items-center gap-2 text-[10px] font-bold tracking-wider text-slate-500 uppercase"
								>
									<User size={12} /> Viewing
								</h4>
								<div class="group">
									<button
										onclick={() => copyToClipboard(person.id, 'person_id')}
										class="flex items-center gap-2 font-mono text-xs text-amber-400 hover:text-white"
									>
										<span>{person.id}</span>
										<Copy size={10} class="opacity-0 group-hover:opacity-100" />
									</button>
									<div class="text-[10px] text-slate-500">
										Name:{' '}
										<span class="text-slate-300">
											{person.first_name}
											{person.last_name}
										</span>
									</div>
								</div>
							</div>
						{/if}
					</div>

					<div class="flex items-start gap-4">
						<a
							href="/admin"
							class="flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white"
						>
							<Database size={14} /> Admin
						</a>
						<button
							onclick={() => (isOpen = false)}
							aria-label="Close dev toolbar"
							class="text-slate-500 hover:text-white"
						>
							<X size={20} />
						</button>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
