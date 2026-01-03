# TODO

## Architecture Improvements

### Migrate from `$page` store to `data` load functions
**Priority:** Medium
**Benefit:** SSR support, testability, type safety

Pages that fetch API data should move fetching from `onMount` to `+page.ts` load functions.

**Pattern to follow:**
```typescript
// +page.ts
export const load = async ({ params, fetch }) => {
  const gathering = await apiJson(fetch, `/api/gatherings/${params.id}`);
  const roster = await apiJson(fetch, `/api/gatherings/${params.id}/roster`);
  return { gathering, roster };
};
```

**Pages to migrate:**
- [ ] `/gatherings/[id]/+page.svelte` - fetches gathering, roster, songs
- [ ] `/gatherings/+page.svelte` - fetches services list (partially done in +page.ts)
- [ ] `/people/[id]/+page.svelte` - fetches person details
- [ ] `/families/[id]/+page.svelte` - fetches family details
- [ ] `/+page.svelte` - fetches services for homepage

**Benefits:**
- Server-side rendering (faster initial load, better SEO)
- Auto-generated `PageData` types
- Easier to test load functions in isolation
- Explicit data dependencies

---

## Database Migration (Future)

### Rename `service_instances` to `gatherings`
**Priority:** Low
**Status:** API layer already uses "gatherings" naming

Tables to consider renaming:
- [ ] `service_instances` → `gatherings`
- [ ] `service_groups` → `gathering_groups`
- [ ] `service_instance_songs` → `gathering_songs`
- [ ] `service_assignments` → `gathering_assignments`

**Note:** This requires a database migration script and updating all SQL queries in API routes.
