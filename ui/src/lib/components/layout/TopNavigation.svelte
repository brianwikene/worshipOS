<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy } from 'svelte';

  type Tenant = { id: string; name: string };

  // Svelte 5 props (keeps your current layout call working)
  let {
    tenants = [],
    activeChurchId = '',
    onTenantChange,
    loginHref = '/login',
    appName = 'Worship OS'
  } = $props<{
    tenants?: Tenant[];
    activeChurchId?: string;
    onTenantChange: (e: Event) => void;
    loginHref?: string;
    appName?: string;
  }>();

  const navItems = [
    { label: 'Start', href: '/start' },
    { label: 'Gatherings', href: '/gatherings' },
    { label: 'Connections', href: '/connections' },
    { label: 'Songs', href: '/songs' },
    { label: 'Care', href: '/care' },
    { label: 'Tend', href: '/tend' }
  ];

  const adminItem = { label: 'Admin', href: '/admin' };
  const authItem = $derived(() => ({ label: 'Login', href: loginHref }));

  const isActive = (path: string) => $page.url.pathname.startsWith(path);

  const activeTenantName = $derived(
    () => tenants.find((t) => t.id === activeChurchId)?.name ?? 'Select Church'
  );

  // Mobile menu state
  let mobileOpen = $state(false);
  let menuEl: HTMLElement | null = null;
  let buttonEl: HTMLButtonElement | null = null;

  function closeMobileMenu() {
    if (!mobileOpen) return;
    mobileOpen = false;
    // return focus to the toggle for accessibility
    queueMicrotask(() => buttonEl?.focus());
  }

  function toggleMobileMenu() {
    mobileOpen = !mobileOpen;
    if (!mobileOpen) {
      queueMicrotask(() => buttonEl?.focus());
    } else {
      // optionally focus first link/select inside menu
      queueMicrotask(() => {
        const firstFocusable = menuEl?.querySelector<HTMLElement>(
          'a, button, select, input, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus?.();
      });
    }
  }

  // Close on Escape + close on click outside
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeMobileMenu();
  };

  const onDocClick = (e: MouseEvent) => {
    if (!mobileOpen) return;
    const target = e.target as Node | null;
    if (!target) return;

    // if click is outside both button and menu, close
    const clickedButton = !!buttonEl && buttonEl.contains(target);
    const clickedMenu = !!menuEl && menuEl.contains(target);
    if (!clickedButton && !clickedMenu) closeMobileMenu();
  };

  // Attach listeners (only in browser)
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onDocClick, { capture: true });
    onDestroy(() => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onDocClick, { capture: true } as any);
    });
  }

// Close mobile menu when route changes
$effect(() => {
  // This makes the effect re-run whenever the route changes
  const _path = $page.url.pathname;

  if (mobileOpen) closeMobileMenu();
});

</script>

<header class="w-full bg-white border-b border-[var(--sys-border)] sticky top-0 z-50">
  <div class="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between gap-4">
    <!-- Left: Brand + Desktop Nav -->
    <div class="flex items-center gap-6 min-w-0">
      <a
        href="/"
        class="shrink-0 text-lg font-extrabold tracking-tight text-[var(--ui-color-text-strong)] hover:opacity-70 transition-opacity"
      >
        {appName}
      </a>

      <nav class="hidden md:block min-w-0" aria-label="Primary">
        <ul class="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {#each navItems as item}
            <li>
              <a
                href={item.href}
                class="
                  px-3 py-1.5 rounded-md text-[0.9375rem] font-medium whitespace-nowrap transition-all duration-200
                  {isActive(item.href)
                    ? 'bg-[var(--ui-color-hover)] text-[var(--gatherings-accent)] font-semibold shadow-sm ring-1 ring-black/5'
                    : 'text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]'}
                "
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </a>
            </li>
          {/each}
        </ul>
      </nav>
    </div>

    <!-- Right: Actions -->
    <div class="flex items-center gap-3 shrink-0">
      <!-- Mobile hamburger -->
      <button
        bind:this={buttonEl}
        type="button"
        class="md:hidden inline-flex items-center justify-center rounded-md border border-[var(--sys-border)] px-3 py-2 text-sm font-medium text-[var(--ui-color-text-muted)] hover:text-[var(--ui-color-text-strong)] hover:border-[var(--gatherings-accent)] focus:ring-2 focus:ring-offset-1 focus:ring-[var(--gatherings-accent)] focus:outline-none"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        aria-controls="mobile-menu"
        aria-expanded={mobileOpen}
        onclick={toggleMobileMenu}
      >
        <!-- icon -->
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
          {#if mobileOpen}
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          {:else}
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          {/if}
        </svg>
      </button>

      <!-- Desktop auth -->
      <a
        href={authItem.href}
        class="hidden md:flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors
          {isActive(authItem.href)
            ? 'text-[var(--ui-color-text-strong)] bg-[var(--ui-color-hover)]'
            : 'text-[var(--ui-color-text-muted)] hover:text-[var(--ui-color-text-strong)] hover:bg-[var(--ui-color-hover)]'}"
      >
        {authItem.label}
      </a>

      <!-- Desktop admin -->
      <a
        href={adminItem.href}
        class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
          {isActive(adminItem.href)
            ? 'text-[var(--ui-color-text-strong)] bg-[var(--ui-color-hover)]'
            : 'text-[var(--ui-color-text-muted)] hover:text-[var(--ui-color-text-strong)] hover:bg-[var(--ui-color-hover)]'}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Admin
      </a>

      <div class="hidden md:block w-px h-6 bg-[var(--sys-border)] mx-1"></div>

      <!-- Tenant select (Desktop) -->
      <div class="hidden md:block relative">
        <label class="sr-only" for="tenant-select">Active church</label>
        <select
          id="tenant-select"
          value={activeChurchId}
          onchange={onTenantChange}
          class="
            appearance-none
            pl-3 pr-8 py-1.5
            bg-white border border-[var(--sys-border)] rounded-md
            text-sm font-medium text-[var(--ui-color-text-muted)]
            hover:border-[var(--gatherings-accent)] hover:text-[var(--ui-color-text-strong)]
            focus:ring-2 focus:ring-offset-1 focus:ring-[var(--gatherings-accent)] focus:outline-none
            cursor-pointer transition-all
            max-w-[220px] truncate
          "
        >
          {#if tenants.length === 0}
            <option value="">No churches</option>
          {:else}
            {#each tenants as tenant}
              <option value={tenant.id}>{tenant.name}</option>
            {/each}
          {/if}
        </select>

        <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile menu panel -->
  {#if mobileOpen}
    <div
      id="mobile-menu"
      bind:this={menuEl}
      class="md:hidden border-t border-[var(--sys-border)] bg-white"
    >
      <nav aria-label="Mobile Primary" class="max-w-[1200px] mx-auto px-4 py-3">
        <ul class="flex flex-col gap-1">
          {#each navItems as item}
            <li>
              <a
                href={item.href}
                class="
                  block px-3 py-2 rounded-md text-sm font-medium transition-colors
                  {isActive(item.href)
                    ? 'bg-[var(--ui-color-hover)] text-[var(--gatherings-accent)]'
                    : 'text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]'}
                "
                aria-current={isActive(item.href) ? 'page' : undefined}
                onclick={closeMobileMenu}
              >
                {item.label}
              </a>
            </li>
          {/each}

          <li class="mt-2 pt-2 border-t border-[var(--sys-border)]">
            <a
              href={adminItem.href}
              class="block px-3 py-2 rounded-md text-sm font-medium text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]"
              onclick={closeMobileMenu}
            >
              Admin
            </a>
          </li>

          <li>
            <a
              href={authItem.href}
              class="block px-3 py-2 rounded-md text-sm font-medium text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]"
              onclick={closeMobileMenu}
            >
              {authItem.label}
            </a>
          </li>

          <li class="mt-2 pt-2 border-t border-[var(--sys-border)]">
            <label class="sr-only" for="tenant-select-mobile">Active church</label>
            <div class="px-3">
              <div class="text-xs text-[var(--ui-color-text-muted)] mb-1">Active church</div>
              <select
                id="tenant-select-mobile"
                value={activeChurchId}
                onchange={onTenantChange}
                class="
                  w-full appearance-none
                  pl-3 pr-8 py-2
                  bg-white border border-[var(--sys-border)] rounded-md
                  text-sm font-medium text-[var(--ui-color-text-strong)]
                  hover:border-[var(--gatherings-accent)]
                  focus:ring-2 focus:ring-offset-1 focus:ring-[var(--gatherings-accent)] focus:outline-none
                  cursor-pointer transition-all
                "
              >
                {#if tenants.length === 0}
                  <option value="">No churches</option>
                {:else}
                  {#each tenants as tenant}
                    <option value={tenant.id}>{tenant.name}</option>
                  {/each}
                {/if}
              </select>
              <div class="mt-1 text-xs text-[var(--ui-color-text-muted)] truncate">
                {activeTenantName}
              </div>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  {/if}
</header>
