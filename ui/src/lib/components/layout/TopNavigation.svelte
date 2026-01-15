<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy } from 'svelte';

  type Tenant = { id: string; name: string };

  // Props (keeps your layout call working)
  let {
    tenants = [],
    activeChurchId = '',
    onTenantChange,
    loginHref = '/login',
    appName = 'Worship OS'
  } = $props<{
    tenants?: Tenant[];
    activeChurchId?: string;
    onTenantChange?: (e: Event) => void;
    loginHref?: string;
    appName?: string;
  }>();

  let mobileOpen = false;
  let buttonEl: HTMLButtonElement | null = null;
  let menuEl: HTMLElement | null = null;

  // Basic auth link logic (swap to avatar/profile later)
  const authItem = {
    href: loginHref,
    label: 'Log in'
  };

  // Primary nav (desktop)
  // NOTE: Connections & Care are rendered as dropdowns (not in this list)
  const navItems = [
    { href: '/start', label: 'Start' },
    { href: '/gatherings', label: 'Gatherings' },
    { href: '/songs', label: 'Songs' }
  ];

  const adminItem = { href: '/admin', label: 'Admin' };

  const connections = {
    label: 'Connections',
    defaultHref: '/connections/people',
    items: [
      { href: '/connections/people', label: 'People' },
      { href: '/connections/families', label: 'Families' },
      { href: '/connections/teams', label: 'Teams' }
    ]
  };

  const care = {
    label: 'Care',
    defaultHref: '/care',
    items: [
      { href: '/care', label: 'Care' },
      { href: '/tend', label: 'Tend' }
    ]
  };

  // Active helpers
  const isActive = (href: string) => {
    const path = $page.url.pathname;
    if (href === '/start') return path === '/' || path === '/start';
    return path === href || path.startsWith(href + '/');
  };

  const isPrefixActive = (prefix: string) => {
    const path = $page.url.pathname;
    return path === prefix || path.startsWith(prefix + '/');
  };

  const activeTenantName =
    tenants.find((t) => t.id === activeChurchId)?.name ?? (activeChurchId ? 'Selected' : 'None');

  function closeMobileMenu() {
    mobileOpen = false;
    queueMicrotask(() => buttonEl?.focus());
  }

  function toggleMobileMenu() {
    mobileOpen = !mobileOpen;
    if (!mobileOpen) {
      queueMicrotask(() => buttonEl?.focus());
    } else {
      queueMicrotask(() => {
        const firstFocusable = menuEl?.querySelector<HTMLElement>(
          'a, button, select, input, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus?.();
      });
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeMobileMenu();
  };

  const onDocClick = (e: MouseEvent) => {
    if (!mobileOpen) return;
    const target = e.target as Node;
    if (menuEl && menuEl.contains(target)) return;
    if (buttonEl && buttonEl.contains(target)) return;
    closeMobileMenu();
  };

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
    const _path = $page.url.pathname;
    if (mobileOpen) closeMobileMenu();
  });

  // Shared classes (keeps visual consistency)
  const baseLink =
    'px-3 py-1.5 rounded-md text-[0.9375rem] font-medium whitespace-nowrap transition-all duration-200';
  const activeLink =
    'bg-[var(--ui-color-hover)] text-[var(--gatherings-accent)] font-semibold shadow-sm ring-1 ring-black/5';
  const idleLink =
    'text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]';

  const dropdownPanel =
    'absolute left-0 mt-2 w-52 bg-white border border-[var(--sys-border)] rounded-md shadow-lg overflow-hidden z-50';
  const dropdownItem =
    'block px-3 py-2 text-sm text-[var(--ui-color-text-strong)] hover:bg-[var(--ui-color-hover)]';
</script>

<header class="w-full bg-white border-b border-[var(--sys-border)] sticky top-0 z-50">
  <div class="max-w-[1400px] mx-auto px-4">
    <!-- Row 1: Brand + Primary Nav + Mobile hamburger -->
    <div class="py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-6 min-w-0">
        <a
          href="/"
          class="shrink-0 text-lg font-extrabold tracking-tight text-[var(--ui-color-text-strong)] hover:opacity-70 transition-opacity"
        >
          {appName}
        </a>

        <nav class="hidden md:block min-w-0" aria-label="Primary">
          <!-- flex-wrap prevents the horizontal scrollbar problem -->
          <ul class="flex flex-wrap items-center gap-1">
            {#each navItems as item}
              <li>
                <a
                  href={item.href}
                  class={`${baseLink} ${isActive(item.href) ? activeLink : idleLink}`}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {item.label}
                </a>
              </li>
            {/each}

            <!-- Connections dropdown -->
            <li class="relative group">
              <a
                href={connections.defaultHref}
                class={`${baseLink} ${isPrefixActive('/connections') ? activeLink : idleLink}`}
                aria-haspopup="menu"
              >
                {connections.label}
              </a>

              <div class={`hidden group-hover:block ${dropdownPanel}`} role="menu" aria-label="Connections menu">
                {#each connections.items as item}
                  <a href={item.href} class={dropdownItem} role="menuitem">
                    {item.label}
                  </a>
                {/each}
              </div>
            </li>

            <!-- Care dropdown -->
            <li class="relative group">
              <a
                href={care.defaultHref}
                class={`${baseLink} ${isPrefixActive('/care') || isPrefixActive('/tend') ? activeLink : idleLink}`}
                aria-haspopup="menu"
              >
                {care.label}
              </a>

              <div class={`hidden group-hover:block ${dropdownPanel}`} role="menu" aria-label="Care menu">
                {#each care.items as item}
                  <a href={item.href} class={dropdownItem} role="menuitem">
                    {item.label}
                  </a>
                {/each}
              </div>
            </li>
          </ul>
        </nav>
      </div>

      <!-- Right (Row 1): Mobile hamburger only -->
      <div class="flex items-center gap-3 shrink-0">
        <button
          bind:this={buttonEl}
          type="button"
          class="md:hidden inline-flex items-center justify-center rounded-md px-2 py-2 text-[var(--ui-color-text-muted)] hover:text-[var(--ui-color-text-strong)] hover:bg-[var(--ui-color-hover)] focus:ring-2 focus:ring-offset-1 focus:ring-[var(--gatherings-accent)] focus:outline-none"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-controls="mobile-menu"
          aria-expanded={mobileOpen}
          onclick={toggleMobileMenu}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="w-5 h-5"
          >
            {#if mobileOpen}
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            {:else}
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            {/if}
          </svg>
        </button>
      </div>
    </div>

    <!-- Row 2 (Desktop): Admin + tenant + auth/profile -->
    <div class="hidden md:flex items-center justify-end gap-3 pb-3 pt-1 border-t border-[var(--sys-border)]">
      <a
        href={adminItem.href}
        class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
          {isActive(adminItem.href)
            ? 'text-[var(--ui-color-text-strong)] bg-[var(--ui-color-hover)]'
            : 'text-[var(--ui-color-text-muted)] hover:text-[var(--ui-color-text-strong)] hover:bg-[var(--ui-color-hover)]'}"
      >
        Admin
      </a>

      <div class="w-px h-6 bg-[var(--sys-border)] mx-1"></div>

      <div class="relative">
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
            focus:ring-2 focus:ring-[var(--gatherings-accent)] focus:border-[var(--gatherings-accent)] focus:outline-none
            max-w-[260px]
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

      <div class="w-px h-6 bg-[var(--sys-border)] mx-1"></div>

      <a
        href={authItem.href}
        class="flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors
          {isActive(authItem.href)
            ? 'text-[var(--ui-color-text-strong)] bg-[var(--ui-color-hover)]'
            : 'text-[var(--ui-color-text-muted)] hover:text-[var(--ui-color-text-strong)] hover:bg-[var(--ui-color-hover)]'}"
      >
        {authItem.label}
      </a>
    </div>
  </div>

  <!-- Mobile menu panel -->
  {#if mobileOpen}
    <div
      id="mobile-menu"
      bind:this={menuEl}
      class="md:hidden border-t border-[var(--sys-border)] bg-white"
    >
      <nav aria-label="Mobile Primary" class="max-w-[1400px] mx-auto px-4 py-3">
        <ul class="flex flex-col gap-1">
          <li>
            <a
              href="/start"
              class="block px-3 py-2 rounded-md text-sm font-medium text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]"
              onclick={closeMobileMenu}
            >
              Start
            </a>
          </li>

          <li>
            <a
              href="/gatherings"
              class="block px-3 py-2 rounded-md text-sm font-medium text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]"
              onclick={closeMobileMenu}
            >
              Gatherings
            </a>
          </li>

          <!-- Connections (mobile: expand as a simple grouped list) -->
          <li class="mt-1">
            <div class="px-3 py-2 text-xs font-semibold text-[var(--ui-color-text-muted)]">
              Connections
            </div>
            {#each connections.items as item}
              <a
                href={item.href}
                class="block px-6 py-2 rounded-md text-sm font-medium text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]"
                onclick={closeMobileMenu}
              >
                {item.label}
              </a>
            {/each}
          </li>

          <li>
            <a
              href="/songs"
              class="block px-3 py-2 rounded-md text-sm font-medium text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]"
              onclick={closeMobileMenu}
            >
              Songs
            </a>
          </li>

          <!-- Care (mobile grouped list) -->
          <li class="mt-1">
            <div class="px-3 py-2 text-xs font-semibold text-[var(--ui-color-text-muted)]">
              Care
            </div>
            {#each care.items as item}
              <a
                href={item.href}
                class="block px-6 py-2 rounded-md text-sm font-medium text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]"
                onclick={closeMobileMenu}
              >
                {item.label}
              </a>
            {/each}
          </li>

          <li><div class="h-px bg-[var(--sys-border)] my-2"></div></li>

          <li>
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

          <li><div class="h-px bg-[var(--sys-border)] my-2"></div></li>

          <li>
            <div class="px-3 py-2">
              <label class="block text-xs font-semibold text-[var(--ui-color-text-muted)] mb-1" for="tenant-select-mobile">
                Active church
              </label>

              <select
                id="tenant-select-mobile"
                value={activeChurchId}
                onchange={onTenantChange}
                class="w-full appearance-none pl-3 pr-8 py-2 bg-white border border-[var(--sys-border)] rounded-md text-sm font-medium text-[var(--ui-color-text-strong)] focus:ring-2 focus:ring-[var(--gatherings-accent)] focus:border-[var(--gatherings-accent)] focus:outline-none"
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
