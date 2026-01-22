<!-- /ui/src/lib/components/identity/Avatar.svelte -->
<script lang="ts">
  type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

  const sizeClasses: Record<AvatarSize, string> = {
    xs: 'w-6 h-6 text-[0.60rem]',
    sm: 'w-8 h-8 text-[0.70rem]',
    md: 'w-12 h-12 text-[0.95rem]',
    lg: 'w-16 h-16 text-[1.15rem]'
  };

  export let size: AvatarSize = 'md';
  export let firstName: string | null = null;
  export let lastName: string | null = null;
  export let fallback: string | null = null;
  export let photoUrl: string | null = null;
  export let alt = '';
  export let className = '';

  const baseClasses =
    'inline-flex items-center justify-center rounded-[14px] bg-[var(--people-accent)] text-[#fdfdfd] font-semibold uppercase tracking-wide ring-1 ring-black/5 select-none';

  $: initials = getInitials().slice(0, 2);

  function getInitials() {
    const safeFirst = firstName?.trim();
    const safeLast = lastName?.trim();

    if (safeFirst && safeLast) {
      return `${safeFirst[0]}${safeLast[0]}`.toUpperCase();
    }

    const fromSingle = safeFirst || safeLast;
    if (fromSingle) {
      return fromSingle.slice(0, 2).toUpperCase();
    }

    const fromFallback = fallback?.trim();
    if (fromFallback) {
      return fromFallback
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    }

    return '??';
  }
</script>

<span class={`${baseClasses} ${sizeClasses[size] ?? sizeClasses.md} ${className}`.trim()}>
  {#if photoUrl}
    <img
      src={photoUrl}
      alt={alt}
      class="w-full h-full object-cover rounded-[14px]"
      draggable="false"
    />
  {:else}
    {initials}
  {/if}
</span>
