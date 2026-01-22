<!-- /ui/src/lib/components/connections/ConnectionsHeader.svelte -->
<script lang="ts">
  import { page } from '$app/stores';

  const tabs = [
    {
      label: 'People',
      href: '/connections/people',
      desc: 'Directory & Profiles'
    },
    {
      label: 'Families',
      href: '/connections/families',
      desc: 'Households'
    },
    {
      label: 'Teams',
      href: '/connections/teams',
      desc: 'Volunteer Groups'
    }
  ];

  // Check if the current URL starts with the tab's href
  $: isActive = (path: string) => $page.url.pathname.startsWith(path);
</script>

<div class="w-full bg-white border-b border-[var(--sys-border)] mb-6">
  <div class="max-w-[1200px] mx-auto px-4 pt-8 pb-0">

    <div class="flex items-end justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold text-[var(--ui-color-text-strong)] tracking-tight">
          Connections
        </h1>
        <p class="text-[var(--ui-color-text-muted)] mt-1">
          The people, families, and teams that make up your community.
        </p>
      </div>

      <div class="mb-1">
        <slot name="actions" />
      </div>
    </div>

    <div class="flex items-center gap-8">
      {#each tabs as tab}
        <a
          href={tab.href}
          class="
            relative pb-3 text-[0.95rem] font-medium transition-colors duration-200
            hover:text-[var(--connections-accent)]
            {isActive(tab.href)
              ? 'text-[var(--connections-accent)]'
              : 'text-[var(--ui-color-text-muted)]'
            }
          "
        >
          {tab.label}

          {#if isActive(tab.href)}
            <div
              class="absolute bottom-0 left-0 w-full h-[2px] bg-[var(--connections-accent)]"
            ></div>
          {/if}
        </a>
      {/each}
    </div>

  </div>
</div>
