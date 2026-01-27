<script lang="ts">
	import { page } from '$app/stores';

	let { data, children } = $props();

	// Helper to check active tab for the underline effect
	let activeTab = $derived($page.url.pathname);

	function formatTime(timeStr: string) {
		const [hours, minutes] = timeStr.split(':');
		const h = parseInt(hours);
		const ampm = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 || 12;
		return `${h12}:${minutes} ${ampm}`;
	}
</script>

<div class="flex h-full min-h-[calc(100vh-50px)] flex-col bg-white">
	<header class="sticky top-0 z-10 border-b border-gray-100 bg-white px-8 pt-8 pb-0">
		<div class="mb-6 flex items-start justify-between">
			<div>
				<div class="mb-1 flex items-center gap-3 text-sm text-gray-500">
					<a href="/gatherings" class="transition hover:text-gray-900">← Back to Gatherings</a>
					<span>/</span>
					<span
						>{new Date(data.gathering.date).toLocaleDateString('en-US', {
							weekday: 'long',
							month: 'long',
							day: 'numeric',
							timeZone: 'UTC'
						})}</span
					>
				</div>

				<div class="flex items-baseline gap-4">
					<h1 class="text-3xl font-bold tracking-tight text-gray-900">
						{formatTime(data.instance.start_time)}
						<span class="ml-1 font-sans text-lg font-medium text-gray-400"
							>{data.instance.name}</span
						>
					</h1>
				</div>
			</div>

			<div class="flex gap-3">
				<button
					class="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100"
				>
					View as Public
				</button>
				<button
					class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800"
				>
					Edit Plan
				</button>
			</div>
		</div>

		<nav class="flex gap-8">
			<a
				href="./order"
				class="border-b-2 pb-4 text-sm font-medium transition-colors {activeTab.includes('/order')
					? 'border-gray-900 text-gray-900'
					: 'border-transparent text-gray-500 hover:text-gray-800'}"
			>
				Gathering Order
			</a>
			<a
				href="./people"
				class="border-b-2 pb-4 text-sm font-medium transition-colors {activeTab.includes('/people')
					? 'border-gray-900 text-gray-900'
					: 'border-transparent text-gray-500 hover:text-gray-800'}"
			>
				Teams & People
			</a>
			<a
				href="./rehearse"
				class="border-b-2 pb-4 text-sm font-medium transition-colors {activeTab.includes(
					'/rehearse'
				)
					? 'border-gray-900 text-gray-900'
					: 'border-transparent text-gray-500 hover:text-gray-800'}"
			>
				Rehearsal Mode
			</a>
		</nav>
	</header>

	<main class="flex-1 bg-gray-50 p-8">
		{@render children()}
	</main>
</div>
