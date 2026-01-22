<!-- /ui/src/routes/login/+page.svelte -->
<!-- /src/routes/login/+page.svelte -->

<script lang="ts">
  import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public';
  import { createBrowserClient } from '@supabase/ssr';

  const supabase = createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY)

  let email = 'pastor@worship.os'
  let password = 'password123'
  let status = ''

  async function handleLogin() {
    status = 'Attempting login...'
    console.log('Logging in with:', email)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      console.error('Login Failed:', error)
      status = `Error: ${error.message}`
      alert(status)
    } else {
      console.log('Login Success:', data)
      status = 'Success! Redirecting...'
      // Force reload to pick up the new session cookie
      window.location.href = '/care'
    }
  }
</script>

<div class="p-10 max-w-md mx-auto">
  <h1 class="text-3xl font-bold mb-6">Dev Login 🔑</h1>

  <div class="bg-gray-100 p-6 rounded shadow-md space-y-4">
    <label class="block">
      <span class="text-sm font-bold mb-1">Email</span>
      <input type="text" bind:value={email} class="w-full p-2 border rounded" />
    </label>

    <label class="block">
      <span class="text-sm font-bold mb-1">Password</span>
      <input type="password" bind:value={password} class="w-full p-2 border rounded" />
    </label>

    <button
      onclick={handleLogin}
      class="w-full bg-indigo-600 text-white py-2 px-4 rounded hover:bg-indigo-700 font-bold">
      Log In
    </button>

    {#if status}
      <div class="p-3 bg-white border border-gray-300 text-sm font-mono mt-4">
        {status}
      </div>
    {/if}
  </div>
</div>
