<script lang="ts">
	import { page } from '$app/state';
	import { ArrowLeft, Calendar, Database, LayoutDashboard, Settings, Users } from '@lucide/svelte';

	let { data, children } = $props();
</script>

<div class="flex min-h-screen bg-slate-50 font-sans text-slate-900">
	<aside class="fixed inset-y-0 left-0 z-10 w-64 border-r border-slate-200 bg-white pt-5 pb-4">
		<div class="mb-8 px-6">
			<h2
				class="flex items-center gap-2 text-xs font-bold tracking-widest text-slate-900 uppercase"
			>
				<Database size={14} class="text-pink-600" />
				<span>System Admin</span>
			</h2>
			<div class="mt-2 text-[10px] text-slate-400">
				Tenant: <span class="font-mono text-slate-600">{data?.church?.name ?? 'No tenant'}</span>
			</div>
		</div>

		<nav class="space-y-1 px-3">
			<a
				href="/admin"
				class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {page
					.url.pathname === '/admin'
					? 'bg-slate-100 text-slate-900'
					: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
			>
				<LayoutDashboard
					size={18}
					class={page.url.pathname === '/admin'
						? 'text-pink-600'
						: 'text-slate-400 group-hover:text-slate-600'}
				/>
				Overview
			</a>

			<div class="px-3 pt-4 pb-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
				Configuration
			</div>

			<a
				href="/admin/teams"
				class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {page.url.pathname.includes(
					'/teams'
				)
					? 'bg-slate-100 text-slate-900'
					: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
			>
				<Users
					size={18}
					class={page.url.pathname.includes('/teams')
						? 'text-pink-600'
						: 'text-slate-400 group-hover:text-slate-600'}
				/>
				Teams & Roles
			</a>
			<a
				href="/admin/templates"
				class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {page.url.pathname.includes(
					'/templates'
				)
					? 'bg-slate-100 text-slate-900'
					: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
			>
				<Calendar
					size={18}
					class={page.url.pathname.includes('/templates')
						? 'text-pink-600'
						: 'text-slate-400 group-hover:text-slate-600'}
				/>
				Gathering Types
			</a>
			<a
				href="/admin/settings"
				class="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {page.url.pathname.includes(
					'/settings'
				)
					? 'bg-slate-100 text-slate-900'
					: 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}"
			>
				<Settings
					size={18}
					class={page.url.pathname.includes('/settings')
						? 'text-pink-600'
						: 'text-slate-400 group-hover:text-slate-600'}
				/>
				Settings
			</a>
		</nav>

		<div class="absolute bottom-4 left-0 w-full px-3">
			<a
				href="/"
				class="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
			>
				<ArrowLeft size={14} /> Back to App
			</a>
		</div>
	</aside>

	<main class="ml-64 flex-1 p-8">
		<div class="mx-auto max-w-5xl">
			{@render children()}
		</div>
	</main>
</div>
