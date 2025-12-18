<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { apiJson } from '$lib/api';

  interface ContactMethod {
    type: string;
    value: string;
    label: string | null;
    is_primary: boolean;
  }

  interface Address {
    street: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    label: string | null;
  }

  interface Person {
    id: string;
    display_name: string;
    contact_methods: ContactMethod[];
    addresses: Address[];
  }

  let person: Person | null = null;
  let loading = true;
  let error = '';

  onMount(async () => {
    const personId = $page.params.id;

    try {
      person = await apiJson<Person>(`/people/${personId}`);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load person details';
    } finally {
      loading = false;
    }
  });

  // --- HELPER FUNCTIONS ---
  function formatType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function formatAddress(addr: any) {
    const parts = [
      addr.street,
      addr.city ? `${addr.city},` : null,
      addr.state,
      addr.postal_code
    ].filter(Boolean);
    return parts.join(' ');
  }

  function getLink(method: any) {
    if (method.type.includes('email')) return `mailto:${method.value}`;
    if (method.type.includes('phone')) return `tel:${method.value}`;
    return null;
  }
</script>

<div class="container">
  <a href="/people" class="back-link">← Back to People</a>

  {#if loading}
    <div class="loading">Loading person details...</div>
  {:else if error}
    <div class="error">
      <p>Error: {error}</p>
      <button on:click={() => window.location.reload()}>Retry</button>
    </div>
  {:else if person}
    <div class="profile-card">
      <div class="profile-header">
      <div class="avatar-large">
        {person.display_name.charAt(0).toUpperCase()}
      </div>
      <h1>{person.display_name}</h1>
    </div>

    <div class="info-section">
      <h2>Contact Information</h2>

      {#if person.contact_methods.length === 0}
        <div class="empty-row">No contact information available.</div>
      {:else}
        {#each person.contact_methods as contact}
          <div class="info-row">
            <div class="label-group">
              <span class="label">
                {contact.label || formatType(contact.type)}
              </span>

              {#if getLink(contact)}
                <a href={getLink(contact)} class="value-link">
                  {contact.value}
                </a>
              {:else}
                <span class="value">{contact.value}</span>
              {/if}
            </div>

            {#if contact.is_primary}
              <span class="badge">Primary</span>
            {/if}
          </div>
        {/each}
      {/if}

      <h2>Addresses</h2>
      {#if person.addresses.length === 0}
        <div class="empty-row">No addresses available.</div>
      {:else}
        {#each person.addresses as addr}
          <div class="info-row">
            <div class="label-group">
              <span class="label">{addr.label || 'Address'}</span>
              <span class="value">{formatAddress(addr)}</span>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </div>
  {/if}
</div>

<style>
  .container {
    max-width: 600px;
    margin: 40px auto;
    padding: 0 20px;
    font-family: system-ui, sans-serif;
  }

  .back-link {
    display: inline-block;
    margin-bottom: 20px;
    color: #666;
    text-decoration: none;
    font-weight: 500;
  }
  .back-link:hover { color: #000; }

  .profile-card {
    background: white;
    border: 1px solid #e3e3e3;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  }

  .profile-header {
    background: #f9fafb;
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    border-bottom: 1px solid #eee;
  }

  .avatar-large {
    width: 80px;
    height: 80px;
    background: #0066cc;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  h1 { margin: 0; font-size: 24px; color: #1a1a1a; }

  .info-section { padding: 32px; }

  h2 {
    font-size: 14px;
    text-transform: uppercase;
    color: #888;
    margin: 24px 0 12px 0;
    letter-spacing: 0.05em;
  }
  h2:first-child { margin-top: 0; }

  .info-row {
    padding: 12px 0;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .info-row:last-child { border-bottom: none; }

  .label-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label { font-size: 13px; color: #666; }

  .value, .value-link { font-size: 16px; color: #1a1a1a; }

  .value-link { color: #0066cc; text-decoration: none; }
  .value-link:hover { text-decoration: underline; }

  .badge {
    background: #e3f2fd;
    color: #0066cc;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 12px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .empty-row { color: #999; font-style: italic; padding: 10px 0; }
</style>
