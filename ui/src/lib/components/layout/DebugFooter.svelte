<script lang="ts">
	// ui/src/lib/components/layout/DebugFooter.svelte
	import { onDestroy } from 'svelte';

	type RolesShape = string | string[] | null;

	let {
		churchId = null,
		churchName = null,
		userEmail = null,
		roles = null
	} = $props<{
		churchId?: string | null;
		churchName?: string | null;
		userEmail?: string | null;
		roles?: RolesShape;
	}>();

	let open = $state(false);
	let buttonEl = $state<HTMLButtonElement | null>(null);
	let panelEl = $state<HTMLElement | null>(null);

	const sessionLabel = $derived(userEmail ? `logged in as ${userEmail}` : 'not logged in');

	const roleLabel = $derived.by(() => {
		if (!roles) return '—';
		if (Array.isArray(roles)) return roles.length ? roles.join(', ') : '—';
		return roles || '—';
	});

	const churchLabel = $derived.by(() => {
		// prefer name; if no name but we have id, show "Selected"; else em dash
		if (churchName) return churchName;
		if (churchId) return 'Selected';
		return '—';
	});

	function close() {
		open = false;
		queueMicrotask(() => buttonEl?.focus());
	}

	function toggle() {
		open = !open;
		if (!open) queueMicrotask(() => buttonEl?.focus());
	}

	const onKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Escape' && open) close();
	};

	const onDocClick = (e: MouseEvent) => {
		if (!open) return;
		const target = e.target as Node;

		if (panelEl && panelEl.contains(target)) return;
		if (buttonEl && buttonEl.contains(target)) return;

		close();
	};

	if (typeof window !== 'undefined') {
		window.addEventListener('keydown', onKeyDown);
		document.addEventListener('click', onDocClick, { capture: true });

		onDestroy(() => {
			window.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('click', onDocClick, { capture: true } as any);
		});
	}

	$effect(() => {
		if (!open) return;
		queueMicrotask(() => {
			const firstFocusable = panelEl?.querySelector<HTMLElement>(
				'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			firstFocusable?.focus?.();
		});
	});
</script>

<!-- fixed bottom-right -->
<div class="fixed bottom-4 right-4 z-50">
	<div class="relative">
		<button
			bind:this={buttonEl}
			type="button"
			class="inline-flex items-center gap-2 rounded-full border border-[var(--ui-color-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--ui-color-text)] shadow-sm hover:bg-[var(--ui-color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--ui-color-border-strong)]"
			aria-haspopup="dialog"
			aria-expanded={open}
			aria-controls="debug-panel"
			onclick={toggle}
		>
			Debug
			<svg class="h-4 w-4 opacity-70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
					clip-rule="evenodd"
				/>
			</svg>
		</button>

		{#if open}
			<div
				id="debug-panel"
				bind:this={panelEl}
				role="dialog"
				aria-label="Debug info"
				class="absolute bottom-12 right-0 w-[320px] rounded-2xl border border-[var(--ui-color-border)] bg-white p-4 shadow-lg"
			>
				<div class="grid gap-3 text-sm">
					<div class="grid grid-cols-[96px_1fr] items-start gap-3">
						<div class="text-[var(--ui-color-text-muted)]">Session</div>
						<div class="text-[var(--ui-color-text)]">{sessionLabel}</div>
					</div>

					<div class="grid grid-cols-[96px_1fr] items-start gap-3">
						<div class="text-[var(--ui-color-text-muted)]">Church</div>
						<div class="text-[var(--ui-color-text)]">
							<div>{churchLabel}</div>
							{#if churchId}
								<div class="mt-0.5 text-xs text-[var(--ui-color-text-muted)] font-mono truncate">
									{churchId}
								</div>
							{/if}
						</div>
					</div>

					<div class="grid grid-cols-[96px_1fr] items-start gap-3">
						<div class="text-[var(--ui-color-text-muted)]">Role</div>
						<div class="text-[var(--ui-color-text)]">{roleLabel}</div>
					</div>

					<div class="pt-2 border-t border-[var(--ui-color-border)] flex justify-end">
						<button
							type="button"
							class="text-xs font-medium text-[var(--ui-color-text-muted)] hover:text-[var(--ui-color-text)]"
							onclick={close}
						>
							Hide
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
