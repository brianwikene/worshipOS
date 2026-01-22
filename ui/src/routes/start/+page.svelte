<!-- /ui/src/routes/start/+page.svelte -->
<!-- /src/routes/start/+page.svelte -->

<script lang="ts">
	// Placeholder flags — wire these later
	const hasRecentActivity = false;
</script>

<section class="sys-page sys-page--narrow start">
<header class="sys-page-header">
  <h1 class="sys-title">Start</h1>

  <p class="sys-subtitle">
    Everything starts here.
  </p>

  <p class="sys-context">
    You’re not alone. You belong. We’re building this together to serve people well.
  </p>
</header>

	<section class="sys-grid sys-grid--cards">
  <a href="/connections/people" class="sys-card people sys-card-link">
    <h2 class="sys-card-title">People</h2>
    <p class="sys-card-body">
      View, update, or add people in your community.
    </p>
  </a>

  <a href="/gatherings" class="sys-card gatherings sys-card-link">
    <h2 class="sys-card-title">Gatherings</h2>
    <p class="sys-card-body">
      Plan and manage services, events, and weekly rhythms.
    </p>
  </a>

  <a href="/connections/families" class="sys-card families sys-card-link">
    <h2 class="sys-card-title">Families</h2>
    <p class="sys-card-body">
      See households and shared contact details.
    </p>
  </a>

  <a href="/songs" class="sys-card songs sys-card-link">
    <h2 class="sys-card-title">Songs</h2>
    <p class="sys-card-body">
      Organize music and resources for worship.
    </p>
  </a>
</section>


	{#if hasRecentActivity}
	<section class="recent">
		<h2>Recent activity</h2>
		<!-- Render only when data exists -->
	</section>
	{/if}
</section>

<style>
	.recent {
		margin-top: 3rem;
	}
</style>
