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

  function formatType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  function formatAddress(addr: Address) {
    const parts = [
      addr.street,
      addr.city ? `${addr.city},` : null,
      addr.state,
      addr.postal_code
    ].filter(Boolean);
    return parts.join(' ');
  }

  function getLink(method: ContactMethod) {
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
    transition: color 0.2s;
  }
  
  .back-link:hover {
    color: #0066cc;
  }

  /* Loading and Error States */
  .loading,
  .error {
    text-align: center;
    padding: 3rem;
    background: #f5f5f5;
    border-radius: 12px;
    margin-top: 2rem;
  }

  .error {
    background: #fee;
    color: #c00;
  }

  .error p {
    margin: 0 0 1rem 0;
  }

  .error button {
    padding: 0.5rem 1.5rem;
    background: #c00;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    transition: background 0.2s;
  }

  .error button:hover {
    background: #a00;
  }

  /* Profile Card */
  .profile-card {
    background: white;
    border: 1px solid #e3e3e3;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
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

  h1 {
    margin: 0;
    font-size: 24px;
    color: #1a1a1a;
  }

  .info-section {
    padding: 32px;
  }

  h2 {
    font-size: 14px;
    text-transform: uppercase;
    color: #888;
    margin: 24px 0 12px 0;
    letter-spacing: 0.05em;
    font-weight: 600;
  }

  h2:first-child {
    margin-top: 0;
  }

  .info-row {
    padding: 12px 0;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .label-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .label {
    font-size: 13px;
    color: #666;
    font-weight: 500;
  }

  .value,
  .value-link {
    font-size: 16px;
    color: #1a1a1a;
  }

  .value-link {
    color: #0066cc;
    text-decoration: none;
    transition: text-decoration 0.2s;
  }

  .value-link:hover {
    text-decoration: underline;
  }

  .badge {
    background: #e3f2fd;
    color: #0066cc;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .empty-row {
    color: #999;
    font-style: italic;
    padding: 10px 0;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .container {
      padding: 0 16px;
      margin: 20px auto;
    }

    .info-section {
      padding: 24px;
    }

    .profile-header {
      padding: 24px;
    }

    h1 {
      font-size: 20px;
    }

    .avatar-large {
      width: 64px;
      height: 64px;
      font-size: 28px;
    }
  }
</style>