<script lang="ts">
	import { supabase } from '$lib/supabase';
	import { Loader2, Mail, ShieldCheck } from '@lucide/svelte';

	let loading = $state(false);
	let message = $state('');
	let email = $state('');

	async function handleGoogleLogin() {
		loading = true;
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback`
			}
		});
		if (error) {
			message = error.message;
			loading = false;
		}
	}

	async function handleMagicLink() {
		loading = true;
		message = '';
		const { error } = await supabase.auth.signInWithOtp({
			email,
			options: {
				emailRedirectTo: `${window.location.origin}/auth/callback`
			}
		});

		if (error) {
			message = error.message;
		} else {
			message = 'Check your email for the login link!';
		}
		loading = false;
	}
</script>

<div class="flex min-h-screen flex-col justify-center bg-stone-50 px-6 py-12 lg:px-8">
	<div class="sm:mx-auto sm:w-full sm:max-w-md">
		<div
			class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xl"
		>
			<span class="text-xl font-bold">W</span>
		</div>
		<h2 class="mt-6 text-center text-3xl font-bold tracking-tight text-slate-900">
			Welcome to WorshipOS
		</h2>
		<p class="mt-2 text-center text-sm text-stone-600">Sign in to access your church dashboard</p>
	</div>

	<div class="mt-10 sm:mx-auto sm:w-full sm:max-w-[400px]">
		<div class="rounded-2xl bg-white px-6 py-12 shadow-sm ring-1 ring-stone-200 sm:px-10">
			<div>
				<button
					onclick={handleGoogleLogin}
					disabled={loading}
					class="flex w-full items-center justify-center gap-3 rounded-md bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-stone-300 ring-inset hover:bg-stone-50 disabled:opacity-50"
				>
					{#if loading}
						<Loader2 class="animate-spin text-stone-400" size={20} />
					{:else}
						<svg class="h-5 w-5" viewBox="0 0 24 24">
							<path
								d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								fill="#4285F4"
							/>
							<path
								d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								fill="#34A853"
							/>
							<path
								d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								fill="#FBBC05"
							/>
							<path
								d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								fill="#EA4335"
							/>
						</svg>
					{/if}
					Continue with Google
				</button>
			</div>

			<div class="relative my-8">
				<div class="absolute inset-0 flex items-center" aria-hidden="true">
					<div class="w-full border-t border-stone-200"></div>
				</div>
				<div class="relative flex justify-center">
					<span class="bg-white px-2 text-xs text-stone-500 uppercase">Or continue with email</span>
				</div>
			</div>

			<form
				class="space-y-4"
				onsubmit={(e) => {
					e.preventDefault();
					handleMagicLink();
				}}
			>
				<div>
					<label for="email" class="block text-sm leading-6 font-medium text-slate-900"
						>Email address</label
					>
					<div class="mt-2">
						<input
							id="email"
							name="email"
							type="email"
							autocomplete="email"
							required
							bind:value={email}
							class="block w-full rounded-md border-0 py-2 text-slate-900 shadow-sm ring-1 ring-stone-300 ring-inset placeholder:text-stone-400 focus:ring-2 focus:ring-slate-600 focus:ring-inset sm:text-sm sm:leading-6"
						/>
					</div>
				</div>

				<div>
					<button
						type="submit"
						disabled={loading}
						class="flex w-full justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600 disabled:opacity-70"
					>
						{#if loading}
							<Loader2 class="mr-2 animate-spin" size={18} />
							Sending...
						{:else}
							<Mail class="mr-2" size={18} />
							Send Magic Link
						{/if}
					</button>
				</div>
			</form>

			{#if message}
				<div class="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-700">
					{message}
				</div>
			{/if}
		</div>

		<p class="mt-10 text-center text-xs text-stone-500">
			<ShieldCheck class="mr-1 inline-block h-3 w-3 text-stone-400" />
			Secure access restricted to authorized personnel.
		</p>
	</div>
</div>
