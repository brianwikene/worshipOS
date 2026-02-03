<script lang="ts">
	import { enhance } from '$app/forms';
	import { Calendar, FileText, Layers, Plus, Trash2 } from '@lucide/svelte';
	import type { PageData } from './$types';

	let { data } = $props<{ data: PageData }>();

	let isAddingType = $state(false);
	let isAddingTemplate = $state(false);
</script>

<div class="mb-8">
	<h1 class="text-2xl font-bold text-slate-900">Gathering Configuration</h1>
	<p class="text-slate-500">Define your gathering types and standard templates.</p>
</div>

<div class="grid grid-cols-1 gap-8 lg:grid-cols-2">
	<div class="space-y-6">
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<div class="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
				<h2
					class="flex items-center gap-2 text-sm font-bold tracking-wider text-slate-900 uppercase"
				>
					<Calendar size={18} class="text-slate-400" />
					Gathering Types
				</h2>
				<button
					onclick={() => (isAddingType = !isAddingType)}
					class="text-slate-400 hover:text-slate-900"
				>
					<Plus size={18} />
				</button>
			</div>

			<div class="space-y-3">
				{#each data.types as type}
					<div
						class="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700"
					>
						{type.name}
					</div>
				{/each}

				{#if isAddingType}
					<form method="POST" action="?/createType" use:enhance class="flex gap-2">
						<input
							type="text"
							name="name"
							placeholder="e.g. Sunday Morning"
							class="w-full rounded-md border-slate-300 text-sm"
							required
						/>
						<button class="rounded bg-slate-900 px-3 py-1 text-xs font-bold text-white">Save</button
						>
					</form>
				{/if}
			</div>
		</div>
	</div>

	<div class="space-y-6">
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<div class="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
				<h2
					class="flex items-center gap-2 text-sm font-bold tracking-wider text-slate-900 uppercase"
				>
					<FileText size={18} class="text-slate-400" />
					Templates
				</h2>
				<button
					onclick={() => (isAddingTemplate = !isAddingTemplate)}
					class="text-slate-400 hover:text-slate-900"
				>
					<Plus size={18} />
				</button>
			</div>

			<div class="space-y-3">
				{#each data.allTemplates as tmpl}
					<div
						class="group flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:border-pink-200 hover:shadow-sm"
					>
						<div class="flex items-center gap-3">
							<div
								class="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-500"
							>
								{#if tmpl.is_partial}
									<Layers size={14} />
								{:else}
									<FileText size={14} />
								{/if}
							</div>
							<div>
								<div class="font-bold text-slate-900">{tmpl.name}</div>
								{#if tmpl.is_partial}
									<div class="text-[10px] font-bold tracking-wide text-pink-600 uppercase">
										Partial / Module
									</div>
								{/if}
							</div>
						</div>

						<form method="POST" action="?/deleteTemplate" use:enhance>
							<input type="hidden" name="id" value={tmpl.id} />
							<button
								class="p-2 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
							>
								<Trash2 size={16} />
							</button>
						</form>
					</div>
				{/each}

				{#if isAddingTemplate}
					<form
						method="POST"
						action="?/createTemplate"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								isAddingTemplate = false;
							};
						}}
						class="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-4"
					>
						<div class="space-y-3">
							<div>
								<label for="t_name" class="mb-1 block text-xs font-bold text-blue-800 uppercase"
									>Template Name</label
								>
								<input
									id="t_name"
									type="text"
									name="name"
									class="w-full rounded-md border-blue-200 text-sm"
									required
								/>
							</div>

							<div>
								<label for="t_type" class="mb-1 block text-xs font-bold text-blue-800 uppercase"
									>Gathering Type</label
								>
								<select
									id="t_type"
									name="type_id"
									class="w-full rounded-md border-blue-200 text-sm"
								>
									<option value="">-- Generic / None --</option>
									{#each data.types as t}
										<option value={t.id}>{t.name}</option>
									{/each}
								</select>
							</div>

							<div class="flex items-center gap-2">
								<input
									type="checkbox"
									name="is_partial"
									id="is_partial"
									class="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
								/>
								<label for="is_partial" class="text-sm text-blue-900"
									>Is this a Partial Module? (e.g. Communion)</label
								>
							</div>

							<div class="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onclick={() => (isAddingTemplate = false)}
									class="px-3 py-1 text-xs font-bold text-blue-400">Cancel</button
								>
								<button class="rounded bg-blue-600 px-3 py-1 text-xs font-bold text-white"
									>Create Template</button
								>
							</div>
						</div>
					</form>
				{/if}
			</div>
		</div>
	</div>
</div>
