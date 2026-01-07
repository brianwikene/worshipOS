<script lang="ts">
  import { page } from '$app/stores';

  // Props to receive from the layout
  export let tenants: { id: string; name: string }[] = [];
  export let activeChurchId: string = '';
  export let onTenantChange: (e: Event) => void;

  // The "Spine" - Daily Ministry Contexts
  const navItems = [
    { label: 'Start', href: '/start' },
    { label: 'Gatherings', href: '/gatherings' },
    { label: 'Connections', href: '/connections' },
    { label: 'Songs', href: '/songs' },
    { label: 'Care', href: '/care' },
    { label: 'Tend', href: '/tend' }
  ];

  const adminItem = { label: 'Admin', href: '/admin' };

  $: isActive = (path: string) => $page.url.pathname.startsWith(path);

  // Find the active tenant name for display
  $: activeTenantName = tenants.find(t => t.id === activeChurchId)?.name || 'Select Church';
</script>

<header class="w-full bg-white border-b border-[var(--sys-border)] sticky top-0 z-50">
  <div class="max-w-[1200px] mx-auto px-4 h-16 flex items-center justify-between gap-4">

    <div class="flex items-center gap-6 overflow-x-auto no-scrollbar">
      <a href="/" class="shrink-0 text-lg font-extrabold tracking-tight text-[var(--ui-color-text-strong)] hover:opacity-70 transition-opacity">
        Worship OS
      </a>

      <nav class="hidden md:flex items-center gap-1">
        {#each navItems as item}
          <a
            href={item.href}
            class="
              px-3 py-1.5 rounded-md text-[0.9375rem] font-medium whitespace-nowrap transition-all duration-200
              {isActive(item.href)
                ? 'bg-[var(--ui-color-hover)] text-[var(--gatherings-accent)] font-semibold shadow-sm ring-1 ring-black/5'
                : 'text-[var(--ui-color-text-muted)] hover:bg-[var(--ui-color-hover)] hover:text-[var(--ui-color-text-strong)]'
              }
            "
            aria-current={isActive(item.href) ? 'page' : undefined}
          >
            {item.label}
          </a>
        {/each}
      </nav>
    </div>

    <div class="flex items-center gap-3 shrink-0">

      <a
        href={adminItem.href}
        class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors {isActive(adminItem.href) ? 'text-[var(--ui-color-text-strong)] bg-gray-100' : 'text-[var(--ui-color-text-muted)] hover:text-[var(--ui-color-text-strong)]'}"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-4 h-4"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        Admin
      </a>

      <div class="hidden md:block w-px h-6 bg-[var(--sys-border)] mx-1"></div>

      <div class="relative group">
        <select
          value={activeChurchId}
          on:change={onTenantChange}
          class="
            appearance-none
            flex items-center gap-2 pl-3 pr-8 py-1.5
            bg-white border border-[var(--sys-border)] rounded-md
            text-sm font-medium text-[var(--ui-color-text-muted)]
            hover:border-[var(--gatherings-accent)] hover:text-[var(--ui-color-text-strong)]
            focus:ring-2 focus:ring-offset-1 focus:ring-[var(--gatherings-accent)] focus:outline-none
            cursor-pointer
            transition-all
            max-w-[200px] truncate
          "
        >
          {#each tenants as tenant}
            <option value={tenant.id}>{tenant.name}</option>
          {/each}
        </select>

        <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-3.5 h-3.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

    </div>
  </div>
</header>
