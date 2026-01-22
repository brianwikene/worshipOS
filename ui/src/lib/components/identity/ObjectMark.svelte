<!-- /ui/src/lib/components/identity/ObjectMark.svelte -->
<script lang="ts">
  type MarkSize = 'xs' | 'sm' | 'md' | 'lg';
  type MarkVariant = 'songs' | 'families' | 'teams' | 'gatherings' | 'default';

  const sizeClasses: Record<MarkSize, string> = {
    xs: 'w-6 h-6 text-[0.55rem]',
    sm: 'w-8 h-8 text-[0.7rem]',
    md: 'w-12 h-12 text-[0.95rem]',
    lg: 'w-16 h-16 text-[1.15rem]'
  };

  const variantColors: Record<MarkVariant, string> = {
    songs: 'var(--songs-accent)',
    families: 'var(--families-accent)',
    teams: '#2563eb',
    gatherings: 'var(--gatherings-accent-start)',
    default: 'var(--sys-border-strong)'
  };

  export let label: string | null = null;
  export let size: MarkSize = 'md';
  export let variant: MarkVariant = 'default';
  export let className = '';
</script>

<span
  class={`inline-flex items-center justify-center rounded-full text-white font-semibold tracking-wide ring-1 ring-black/10 select-none ${sizeClasses[size] ?? sizeClasses.md} ${className}`.trim()}
  style={`background:${variantColors[variant] ?? variantColors.default}`}
>
  <slot>{label}</slot>
</span>
