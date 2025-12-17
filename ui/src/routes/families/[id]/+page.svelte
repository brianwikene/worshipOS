<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';

  interface FamilyMember {
    membership_id: string;
    person_id: string;
    display_name: string;
    relationship: string;
    is_active: boolean;
    is_temporary: boolean;
    is_primary_contact: boolean;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
  }

  interface Family {
    id: string;
    name: string;
    notes: string | null;
    is_active: boolean;
    church_id: string;
    street: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    members: FamilyMember[];
  }

  let family: Family | null = null;
  let loading = true;
  let error = '';

  const API_BASE = 'http://localhost:3000';

  onMount(async () => {
    const familyId = $page.params.id;

    try {
      const res = await fetch(`${API_BASE}/families/${familyId}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.statusText}`);
      }
      family = await res.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load family details';
    } finally {
      loading = false;
    }
  });

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '';

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
      });
    } catch (e) {
      return dateStr;
    }
  }

  function getRelationshipIcon(relationship: string): string {
    const icons: Record<string, string> = {
      parent: '👨‍👩',
      guardian: '🛡️',
      spouse: '💑',
      child: '👶',
      foster_child: '🧸',
      other: '👤'
    };
    return icons[relationship] || '👤';
  }

  function getRelationshipLabel(relationship: string): string {
    return relationship.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  $: parents = family?.members.filter(m =>
    ['parent', 'guardian'].includes(m.relationship) && m.is_active
  ) || [];

  $: children = family?.members.filter(m =>
    m.relationship === 'child' && m.is_active
  ) || [];

  $: fosterChildren = family?.members.filter(m =>
    m.relationship === 'foster_child' && m.is_active
  ) || [];

  $: inactiveMembers = family?.members.filter(m => !m.is_active) || [];
</script>

<div class="container">
  <a href="/families" class="back-link">← Back to Families</a>

  {#if loading}
    <div class="loading">Loading family details...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={() => window.location.reload()}>Retry</button>
    </div>
  {:else if family}
    <div class="detail-card">
      <div class="header">
        <div class="title-section">
          <h1>{family.name}</h1>
          {#if !family.is_active}
            <span class="inactive-badge">Inactive</span>
          {/if}
        </div>

        {#if family.street}
          <div class="address">
            <span class="icon">📍</span>
            <div class="address-text">
              <div>{family.street}</div>
              <div>{family.city}, {family.state} {family.postal_code}</div>
            </div>
          </div>
        {/if}
      </div>

      {#if family.notes}
        <div class="family-notes">
          {family.notes}
        </div>
      {/if}

      <!-- Parents/Guardians -->
      {#if parents.length > 0}
        <div class="members-section">
          <h2>Parents & Guardians</h2>
          <div class="members-list">
            {#each parents as member}
              <a href={`/people/${member.person_id}`} class="member-card">
                <div class="member-info">
                  <span class="relationship-icon">{getRelationshipIcon(member.relationship)}</span>
                  <div>
                    <div class="member-name">{member.display_name}</div>
                    <div class="member-role">{getRelationshipLabel(member.relationship)}</div>
                  </div>
                </div>
                {#if member.is_primary_contact}
                  <span class="primary-badge">Primary Contact</span>
                {/if}
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Children -->
      {#if children.length > 0}
        <div class="members-section">
          <h2>Children</h2>
          <div class="members-list">
            {#each children as member}
              <a href={`/people/${member.person_id}`} class="member-card">
                <div class="member-info">
                  <span class="relationship-icon">{getRelationshipIcon(member.relationship)}</span>
                  <div>
                    <div class="member-name">{member.display_name}</div>
                    <div class="member-role">Child</div>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Foster Children -->
      {#if fosterChildren.length > 0}
        <div class="members-section foster">
          <h2>Foster Children</h2>
          <div class="members-list">
            {#each fosterChildren as member}
              <a href={`/people/${member.person_id}`} class="member-card foster">
                <div class="member-info">
                  <span class="relationship-icon">{getRelationshipIcon(member.relationship)}</span>
                  <div>
                    <div class="member-name">{member.display_name}</div>
                    <div class="member-role">
                      Foster Child
                      {#if member.start_date}
                        · Since {formatDate(member.start_date)}
                      {/if}
                    </div>
                    {#if member.notes}
                      <div class="member-notes">{member.notes}</div>
                    {/if}
                  </div>
                </div>
                {#if member.is_temporary}
                  <span class="temp-badge">Temporary</span>
                {/if}
              </a>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Inactive Members -->
      {#if inactiveMembers.length > 0}
        <div class="members-section inactive">
          <h2>Previous Members</h2>
          <div class="members-list">
            {#each inactiveMembers as member}
              <a href={`/people/${member.person_id}`} class="member-card inactive">
                <div class="member-info">
                  <span class="relationship-icon">{getRelationshipIcon(member.relationship)}</span>
                  <div>
                    <div class="member-name">{member.display_name}</div>
                    <div class="member-role">
                      {getRelationshipLabel(member.relationship)}
                      {#if member.start_date && member.end_date}
                        · {formatDate(member.start_date)} - {formatDate(member.end_date)}
                      {:else if member.end_date}
                        · Until {formatDate(member.end_date)}
                      {/if}
                    </div>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem;
  }

  .back-link {
    display: inline-block;
    margin-bottom: 1.5rem;
    color: #666;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }

  .back-link:hover {
    color: #1976d2;
  }

  .loading, .error {
    text-align: center;
    padding: 3rem;
    background: #f5f5f5;
    border-radius: 8px;
    margin-top: 2rem;
  }

  .error {
    background: #fee;
    color: #c00;
  }

  .error button {
    margin-top: 1rem;
    padding: 0.5rem 1.5rem;
    background: #c00;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
  }

  .error button:hover {
    background: #a00;
  }

  .detail-card {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    overflow: hidden;
  }

  .header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
  }

  .title-section {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
  }

  .inactive-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .address {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    opacity: 0.95;
  }

  .icon {
    font-size: 1.25rem;
  }

  .address-text {
    line-height: 1.5;
  }

  .family-notes {
    padding: 1.5rem;
    background: #fff3e0;
    border-left: 4px solid #f57c00;
    font-style: italic;
    color: #333;
  }

  .members-section {
    padding: 2rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .members-section:last-child {
    border-bottom: none;
  }

  .members-section.foster {
    background: #fffbf5;
  }

  .members-section.inactive {
    background: #f5f5f5;
  }

  h2 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: #1a1a1a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 0.875rem;
    color: #666;
  }

  .members-list {
    display: grid;
    gap: 0.75rem;
  }

  .member-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s;
  }

  .member-card:hover {
    border-color: #1976d2;
    transform: translateX(4px);
  }

  .member-card.foster {
    background: #fffbf5;
    border-color: #ffe0b2;
  }

  .member-card.inactive {
    background: #fafafa;
    opacity: 0.7;
  }

  .member-info {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .relationship-icon {
    font-size: 2rem;
  }

  .member-name {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .member-role {
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .member-notes {
    font-size: 0.875rem;
    color: #999;
    font-style: italic;
    margin-top: 0.375rem;
  }

  .primary-badge {
    background: #e3f2fd;
    color: #1976d2;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .temp-badge {
    background: #fff3e0;
    color: #f57c00;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    h1 {
      font-size: 1.5rem;
    }

    .title-section {
      flex-direction: column;
      align-items: flex-start;
    }

    .member-card {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
  }
</style>
