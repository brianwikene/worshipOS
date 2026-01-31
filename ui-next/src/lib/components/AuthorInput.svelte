<script lang="ts">
	import { X } from '@lucide/svelte';

	// Props
	let { selectedAuthors = $bindable([]) } = $props<{
		selectedAuthors: { id?: string; name: string }[];
	}>();

	let inputValue = $state('');
	let suggestions = $state<{ id: string; name: string }[]>([]);
	let isFocused = $state(false);
	let searchTimeout: NodeJS.Timeout;

	async function handleInput(e: Event) {
		const val = (e.target as HTMLInputElement).value;
		inputValue = val;

		clearTimeout(searchTimeout);
		if (val.length < 2) {
			suggestions = [];
			return;
		}

		// Debounce search
		searchTimeout = setTimeout(async () => {
			try {
				const res = await fetch(`/api/authors?q=${encodeURIComponent(val)}`);
				if (res.ok) {
					suggestions = await res.json();
				} else {
					suggestions = [];
				}
			} catch {
				// Silently fail - user can still create new authors
				suggestions = [];
			}
		}, 300);
	}

	function selectAuthor(author: { id?: string; name: string }) {
		// Prevent duplicates
		if (!selectedAuthors.find((a) => a.name === author.name)) {
			selectedAuthors = [...selectedAuthors, author];
		}
		inputValue = '';
		suggestions = [];
	}

	function createNew() {
		if (!inputValue.trim()) return;
		// Create a "temporary" author object (no ID yet)
		selectAuthor({ name: inputValue.trim() });
	}

	function remove(index: number) {
		selectedAuthors = selectedAuthors.filter((_, i) => i !== index);
	}
</script>

<div class="relative">
	<div class="mb-2 flex flex-wrap gap-2">
		{#each selectedAuthors as author, i}
			<span
				class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
			>
				{author.name}
				<button type="button" onclick={() => remove(i)} class="text-slate-400 hover:text-red-500">
					<X size={14} />
				</button>
			</span>
		{/each}
	</div>

	<div class="relative">
		<input
			type="text"
			id="author-input"
			bind:value={inputValue}
			oninput={handleInput}
			onfocus={() => (isFocused = true)}
			onblur={() => setTimeout(() => (isFocused = false), 200)}
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					if (suggestions.length > 0) selectAuthor(suggestions[0]);
					else createNew();
				}
			}}
			placeholder="Type an author name..."
			class="block w-full rounded-md border-stone-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
		/>

		{#if isFocused && inputValue.length > 1}
			<div
				class="ring-opacity-5 absolute z-50 mt-1 w-full rounded-md bg-white py-1 shadow-lg ring-1 ring-black"
			>
				{#each suggestions as s}
					<button
						type="button"
						onclick={() => selectAuthor(s)}
						class="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
					>
						{s.name}
					</button>
				{/each}
				{#if suggestions.length === 0}
					<button
						type="button"
						onclick={createNew}
						class="block w-full px-4 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50"
					>
						Create "{inputValue}"
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<input type="hidden" name="authors_json" value={JSON.stringify(selectedAuthors)} />
</div>
