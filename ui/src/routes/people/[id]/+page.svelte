<script lang="ts">
  export let data; // Data comes from +page.ts automatically
  $: person = data.person; // Reactive variable

  // You can keep your helper functions (formatType, formatAddress, etc.) here
</script>

<div class="container">
  <a href="/people" class="back-link">← Back to People</a>

  <div class="profile-card">
     <div class="profile-header">
        <div class="avatar-large">
          {person.display_name.charAt(0).toUpperCase()}
        </div>
        <h1>{person.display_name}</h1>
     </div>
     </div>
</div>
