<script lang="ts">
	import { initTenant } from '$lib/tenant.svelte';
	import '../app.css';

	let { data, children } = $props();

	// 1. Initialize once (Captures the first load)
	// svelte-ignore state_referenced_locally
	const tenant = initTenant(data.church, data.campus);

	// 2. Keep it in sync (Fixes the warning & navigation bugs)
	// Whenever 'data' changes, this code runs automatically.
	$effect(() => {
		tenant.church = data.church;
		tenant.campus = data.campus;
	});

	// State for the Debug Modal
	let showDevModal = $state(false);

	// Mock User Data (We will connect this to real Auth later)
	const currentUser = {
		name: 'Brian Wikene',
		email: 'brian@worshipos.dev',
		roles: ['sys_admin', 'worship_leader', 'editor']
	};
</script>

<div class="relative flex min-h-screen flex-col font-sans">
	{#if tenant.church}
		<div
			class="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-4 py-2.5 text-xs text-gray-400"
		>
			<div class="flex items-center gap-2">
				<button
					onclick={() => (showDevModal = true)}
					class="cursor-pointer rounded border border-blue-800/50 bg-blue-900/50 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-blue-400 transition hover:bg-blue-800 hover:text-white"
					title="Open Developer Context"
				>
					DEV
				</button>

				<span class="ml-1">Building for</span>

				<button
					class="font-bold text-blue-400 decoration-blue-400/30 underline-offset-4 transition hover:text-blue-300 hover:underline"
				>
					{tenant.church.name}
				</button>

				{#if tenant.campus}
					<span>at</span>
					<button
						class="font-bold text-green-400 decoration-green-400/30 underline-offset-4 transition hover:text-green-300 hover:underline"
					>
						{tenant.campus.name}
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-4">
				<button class="flex items-center gap-1 transition hover:text-white">
					<span>Switch Location</span>
				</button>
				<span class="text-gray-700">|</span>
				<button class="transition hover:text-white"> Get Help </button>
			</div>
		</div>
	{/if}

	<main class="flex-1 bg-white">
		{@render children()}
	</main>

	{#if showDevModal}
		<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div
				class="absolute inset-0 bg-gray-900/80 backdrop-blur-sm"
				onclick={() => (showDevModal = false)}
				aria-hidden="true"
			></div>

			<div
				class="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl"
			>
				<div
					class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4"
				>
					<h2 class="text-sm font-bold tracking-wide text-gray-500 uppercase">Developer Context</h2>
					<button onclick={() => (showDevModal = false)} class="text-gray-400 hover:text-gray-600">
						✕
					</button>
				</div>

				<div class="space-y-6 p-6">
					<div>
						<h3 class="mb-2 text-xs font-semibold text-blue-600 uppercase">Current Tenant</h3>
						<div
							class="space-y-1 rounded border border-slate-100 bg-slate-50 p-3 font-mono text-xs"
						>
							<div class="flex justify-between">
								<span class="text-gray-500">Name:</span>
								<span class="font-medium text-gray-900">{tenant.church?.name}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-500">Slug:</span>
								<span class="text-gray-900">{tenant.church?.slug}</span>
							</div>
							<div class="mt-1 flex justify-between border-t border-slate-200 pt-1">
								<span class="text-gray-500">Slug:</span>
								<span class="text-purple-600 select-all">{tenant.church?.slug}</span>
							</div>
						</div>
					</div>

					{#if tenant.campus}
						<div>
							<h3 class="mb-2 text-xs font-semibold text-green-600 uppercase">Active Campus</h3>
							<div
								class="space-y-1 rounded border border-slate-100 bg-slate-50 p-3 font-mono text-xs"
							>
								<div class="flex justify-between">
									<span class="text-gray-500">Name:</span>
									<span class="font-medium text-gray-900">{tenant.campus.name}</span>
								</div>
								<div class="mt-1 flex justify-between border-t border-slate-200 pt-1">
									<span class="text-gray-500">UUID:</span>
									<span class="text-purple-600 select-all">{tenant.campus.id}</span>
								</div>
							</div>
						</div>
					{/if}

					<div>
						<h3 class="mb-2 text-xs font-semibold text-amber-600 uppercase">User Session (Mock)</h3>
						<div
							class="space-y-1 rounded border border-slate-100 bg-slate-50 p-3 font-mono text-xs"
						>
							<div class="flex justify-between">
								<span class="text-gray-500">User:</span>
								<span class="text-gray-900">{currentUser.name}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray-500">Email:</span>
								<span class="text-gray-900">{currentUser.email}</span>
							</div>
							<div class="mt-2 border-t border-slate-200 pt-2">
								<span class="mb-1 block text-gray-500">RBAC Roles:</span>
								<div class="flex flex-wrap gap-1">
									{#each currentUser.roles as role}
										<span
											class="rounded border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-amber-800"
										>
											{role}
										</span>
									{/each}
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="bg-gray-50 px-6 py-3 text-right">
					<button
						onclick={() => (showDevModal = false)}
						class="rounded border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
					>
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
