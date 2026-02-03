<script>
	import { List, Plus, Settings } from '@lucide/svelte';
</script>

<div class="mb-8">
	<h1 class="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
	<p class="text-slate-500">Manage tenant settings, teams, and permissions.</p>
</div>

<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
	<a
		href="/admin/teams"
		class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
	>
		<div
			class="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-blue-50 transition-transform group-hover:scale-110"
		></div>
		<div class="relative">
			<div class="mb-4 inline-flex rounded-lg bg-blue-100 p-3 text-blue-600">
				<List size={24} />
			</div>
			<h3 class="mb-1 text-lg font-bold text-slate-900">Manage Teams</h3>
			<p class="text-sm text-slate-500">View rosters, assign members, and edit team structures.</p>
		</div>
	</a>

	<a
		href="/admin/teams/bulk"
		class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-pink-200 hover:shadow-md"
	>
		<div
			class="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-pink-50 transition-transform group-hover:scale-110"
		></div>
		<div class="relative">
			<div class="mb-4 inline-flex rounded-lg bg-pink-100 p-3 text-pink-600">
				<Plus size={24} />
			</div>
			<h3 class="mb-1 text-lg font-bold text-slate-900">Bulk Creator</h3>
			<p class="text-sm text-slate-500">Rapidly build new teams by pasting lists of roles.</p>
		</div>
	</a>

	<a
		href="/admin/settings"
		class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
	>
		<div
			class="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-slate-100 transition-transform group-hover:scale-110"
		></div>
		<div class="relative">
			<div class="mb-4 inline-flex rounded-lg bg-slate-100 p-3 text-slate-600">
				<Settings size={24} />
			</div>
			<h3 class="mb-1 text-lg font-bold text-slate-900">System Settings</h3>
			<p class="text-sm text-slate-500">Update church details, campuses, and staff access.</p>
		</div>
	</a>
</div>
