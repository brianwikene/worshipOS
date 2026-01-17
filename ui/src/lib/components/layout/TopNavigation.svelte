<script lang="ts">
  import { page } from '$app/stores';
  import { onDestroy } from 'svelte';

  type Tenant = { id: string; name: string };

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

  const authItem = { href: loginHref, label: 'Log in' };

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

  $effect(() => {
    const _path = $page.url.pathname;
    if (mobileOpen) closeMobileMenu();
  });

  // --- Styling helpers (dark + underline active) ---
  const baseLink =
    'px-1 py-2 text-[0.95rem] font-medium whitespace-nowrap transition-colors border-b-2 border-transparent';
  const activeLink =
    'text-white border-white';
  const idleLink =
    'text-white/70 hover:text-white hover:border-white/40';

  const dropdownPanel =
    'absolute left-0 mt-2 w-56 bg-[#111317] border border-white/10 rounded-md shadow-xl overflow-hidden z-50';
  const dropdownItem =
    'block px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white';
</script>

<header class="w-full sticky top-0 z-50 bg-[#1f2428] border-b border-white/10">
  <div class="sys-shell sys-shell--nav">
    <!-- Row 1: Brand + Primary Nav + Mobile hamburger -->
    <div class="py-3 flex items-center justify-between gap-4">
      <div class="flex items-center gap-6 min-w-0">
        <a
          href="/"
          class="shrink-0 text-lg font-extrabold tracking-tight text-white hover:opacity-80 transition-opacity"
        >
          {appName}
        </a>

        <nav class="hidden md:block min-w-0" aria-label="Primary">
          <ul class="flex flex-wrap items-center gap-5">
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
                  <a href={item.href} class={dropdownItem} role="menuitem">{item.label}</a>
                {/each}
              </div>
            </li>

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
                  <a href={item.href} class={dropdownItem} role="menuitem">{item.label}</a>
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
          class="md:hidden inline-flex items-center justify-center rounded-md px-2 py-2 text-white/70 hover:text-white hover:bg-white/10 focus:ring-2 focus:ring-offset-0 focus:ring-white/40 focus:outline-none"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-controls="mobile-menu"
          aria-expanded={mobileOpen}
          onclick={toggleMobileMenu}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
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
    <div class="hidden md:flex items-center justify-end gap-3 pb-3 pt-1 border-t border-white/10">
      <a
        href={adminItem.href}
        class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
          {isActive(adminItem.href) ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/10'}"
      >
        Admin
      </a>

      <div class="w-px h-6 bg-white/10 mx-1"></div>

      <!-- Tenant selector (dev cookie) -->
      <div class="relative">
        <label class="sr-only" for="tenant-select">Active church</label>
        <select
          id="tenant-select"
          value={activeChurchId}
          onchange={onTenantChange}
          class="
            cursor-pointer appearance-none
            pl-3 pr-8 py-1.5
            bg-[#111317] border border-white/15 rounded-md
            text-sm font-semibold text-white/90
            hover:border-white/30
            focus:ring-2 focus:ring-white/30 focus:border-white/30 focus:outline-none
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

        <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/60">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      <div class="w-px h-6 bg-white/10 mx-1"></div>

      <a
        href={authItem.href}
        class="flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors
          {isActive(authItem.href) ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/10'}"
      >
        {authItem.label}
      </a>
    </div>
  </div>

  <!-- Mobile menu panel -->
  {#if mobileOpen}
    <div id="mobile-menu" bind:this={menuEl} class="md:hidden border-t border-white/10 bg-[#1f2428]">
      <nav aria-label="Mobile Primary" class="sys-shell sys-shell--mobile">
        <ul class="flex flex-col gap-1">
          <li><a href="/start" class="block px-3 py-2 rounded-md text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white" onclick={closeMobileMenu}>Start</a></li>
          <li><a href="/gatherings" class="block px-3 py-2 rounded-md text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white" onclick={closeMobileMenu}>Gatherings</a></li>

          <li class="mt-1">
            <div class="px-3 py-2 text-xs font-semibold text-white/60">Connections</div>
            {#each connections.items as item}
              <a href={item.href} class="block px-6 py-2 rounded-md text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white" onclick={closeMobileMenu}>{item.label}</a>
            {/each}
          </li>

          <li><a href="/songs" class="block px-3 py-2 rounded-md text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white" onclick={closeMobileMenu}>Songs</a></li>

          <li class="mt-1">
            <div class="px-3 py-2 text-xs font-semibold text-white/60">Care</div>
            {#each care.items as item}
              <a href={item.href} class="block px-6 py-2 rounded-md text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white" onclick={closeMobileMenu}>{item.label}</a>
            {/each}
          </li>

          <li><div class="h-px bg-white/10 my-2"></div></li>

          <li><a href={adminItem.href} class="block px-3 py-2 rounded-md text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white" onclick={closeMobileMenu}>Admin</a></li>
          <li><a href={authItem.href} class="block px-3 py-2 rounded-md text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white" onclick={closeMobileMenu}>{authItem.label}</a></li>

          <li><div class="h-px bg-white/10 my-2"></div></li>

          <li>
            <div class="px-3 py-2">
              <label class="block text-xs font-semibold text-white/60 mb-1" for="tenant-select-mobile">
                Active church
              </label>

              <select
                id="tenant-select-mobile"
                value={activeChurchId}
                onchange={onTenantChange}
                class="w-full cursor-pointer appearance-none pl-3 pr-8 py-2 bg-[#111317] border border-white/15 rounded-md text-sm font-medium text-white/90 focus:ring-2 focus:ring-white/30 focus:border-white/30 focus:outline-none"
              >
                {#if tenants.length === 0}
                  <option value="">No churches</option>
                {:else}
                  {#each tenants as tenant}
                    <option value={tenant.id}>{tenant.name}</option>
                  {/each}
                {/if}
              </select>

              <div class="mt-1 text-xs text-white/60 truncate">
                {activeTenantName}
              </div>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  {/if}
</header>
