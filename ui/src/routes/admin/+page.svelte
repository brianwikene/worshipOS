<script lang="ts">
  const adminSections = [
    {
      title: 'Ministry Teams',
      description: 'Organize roles into teams like Worship, Hospitality, Kids, Tech, Security, etc.',
      href: '/admin/teams',
      icon: '👥',
      color: '#667eea'
    },
    {
      title: 'Manage Roles',
      description: 'Define positions like Electric Guitar, Worship Leader, Sound Engineer, etc. Set body parts for conflict detection.',
      href: '/admin/roles',
      icon: '🎭',
      color: '#764ba2'
    },
    {
      title: 'Service Types',
      description: 'Create service types (Sunday AM, Youth, Midweek) and define which roles are needed for each.',
      href: '/admin/service-types',
      icon: '📋',
      color: '#3b82f6'
    }
  ];
</script>

<div class="container">
  <header>
    <h1>Admin Settings</h1>
    <p>Manage roles, service types, and scheduling configuration</p>
  </header>

  <div class="sections-grid">
    {#each adminSections as section}
      <a href={section.href} class="section-card">
        <div class="section-icon" style="background: {section.color}">{section.icon}</div>
        <div class="section-content">
          <h2>{section.title}</h2>
          <p>{section.description}</p>
        </div>
        <div class="section-arrow">→</div>
      </a>
    {/each}
  </div>
</div>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }

  header {
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: #1a1a1a;
  }

  header p {
    color: #6b7280;
    margin: 0;
  }

  .sections-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-card {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.5rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .section-card:hover {
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    transform: translateY(-2px);
  }

  .section-icon {
    width: 3.5rem;
    height: 3.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .section-content {
    flex: 1;
  }

  .section-content h2 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0 0 0.25rem 0;
    color: #1a1a1a;
  }

  .section-content p {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.5;
  }

  .section-arrow {
    font-size: 1.25rem;
    color: #9ca3af;
    transition: all 0.2s;
  }

  .section-card:hover .section-arrow {
    color: #667eea;
    transform: translateX(4px);
  }

  @media (max-width: 640px) {
    .section-card {
      flex-direction: column;
      text-align: center;
    }

    .section-arrow {
      transform: rotate(90deg);
    }

    .section-card:hover .section-arrow {
      transform: rotate(90deg) translateX(4px);
    }
  }
</style>
