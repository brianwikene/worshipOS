<script lang="ts">
	import {
		ArrowLeft,
		Briefcase,
		Calendar,
		CircleAlert, // <--- MAKE SURE THIS IS HERE (Not AlertCircle)
		Clock,
		Mail,
		MapPin,
		Phone,
		Shield,
		Users
	} from '@lucide/svelte';
	// NEW IMPORT: Material Icon via unplugin-icons
	// If this name fails, try: '~icons/material-symbols/family-restroom'
	import FamilyHome from '~icons/material-symbols/family-home';

	import type { PageData } from './$types';
	import ConnectFamilyDrawer from './ConnectFamilyDrawer.svelte';
	import EditProfileDrawer from './EditProfileDrawer.svelte';

	let { data } = $props<{ data: PageData }>();
	let person = $derived(data.person);

	// Safe derivation for family members
	let familyMembers = $derived(person.family?.members?.filter((m) => m.id !== person.id) || []);

	let isEditProfileOpen = $state(false);
	let isConnectFamilyOpen = $state(false);

	function getComfortLabel(rating: number | null) {
		if (!rating) return 'Unrated';
		if (rating <= 2) return 'Learning';
		if (rating === 3) return 'Comfortable';
		return 'Leading';
	}
</script>

<div class="min-h-screen bg-stone-50 pb-20">
	<div class="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
		<div class="mb-6 flex items-center justify-between">
			<a
				href="/connections"
				class="inline-flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-slate-900"
			>
				<ArrowLeft size={16} />
				Back to People
			</a>
			<div class="flex gap-2">
				<button
					class="rounded-md px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-200 hover:text-stone-900"
				>
					Tend / Archive
				</button>
				<button
					onclick={() => (isEditProfileOpen = true)}
					class="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-slate-700"
				>
					Edit Profile
				</button>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
			<div class="space-y-6">
				<div class="rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm">
					<div
						class="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-stone-100 text-2xl font-bold text-stone-500"
					>
						{#if person.avatar_url}
							<img
								src={person.avatar_url}
								alt={person.first_name ?? 'Person'}
								class="h-full w-full object-cover"
							/>
						{:else}
							{person.first_name?.[0] ?? '?'}{person.last_name?.[0] ?? ''}
						{/if}
					</div>
					<h1 class="text-2xl font-bold text-slate-900">{person.first_name} {person.last_name}</h1>
					{#if person.occupation}
						<p class="mt-1 flex items-center justify-center gap-1 text-sm text-stone-500">
							<Briefcase size={12} />
							{person.occupation}
						</p>
					{/if}

					<div class="mt-6 space-y-3 text-left">
						{#if person.email}
							<div class="flex items-center gap-3 text-sm text-stone-600">
								<Mail size={16} class="text-stone-400" />
								<a href="mailto:{person.email}" class="transition-colors hover:text-slate-900"
									>{person.email}</a
								>
							</div>
						{/if}
						{#if person.phone}
							<div class="flex items-center gap-3 text-sm text-stone-600">
								<Phone size={16} class="text-stone-400" />
								<span>{person.phone}</span>
							</div>
						{/if}
					</div>
				</div>

				<div class="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
					<h3
						class="mb-4 flex items-center gap-2 text-xs font-bold tracking-wider text-stone-400 uppercase"
					>
						<FamilyHome class="h-3 w-3" /> Household
					</h3>

					{#if person.family}
						<div class="mb-4">
							<div class="text-sm font-bold text-slate-900">{person.family.name}</div>
							{#if person.family.address_city}
								<div class="mt-1 flex items-center gap-1 text-xs text-stone-500">
									<MapPin size={10} />
									{person.family.address_city}, {person.family.address_state}
								</div>
							{/if}
						</div>

						<div class="space-y-2">
							{#each familyMembers as member}
								<a
									href="/connections/{member.id}"
									class="-mx-2 flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-stone-50"
								>
									<div
										class="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-600"
									>
										{member.first_name?.[0] ?? '?'}
									</div>
									<span class="text-sm text-stone-700">{member.first_name}</span>
								</a>
							{/each}
						</div>
					{:else}
						<div class="py-4 text-center">
							<p class="text-xs text-stone-400 italic">Not connected to a household.</p>
							<button
								onclick={() => (isConnectFamilyOpen = true)}
								class="mt-2 text-xs font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
							>
								Connect Family
							</button>
						</div>
					{/if}
				</div>

				{#if person.relationships.length > 0}
					<div class="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
						<h3
							class="mb-4 flex items-center gap-2 text-xs font-bold tracking-wider text-stone-400 uppercase"
						>
							<Heart size={12} /> Connected Lives
						</h3>
						<div class="space-y-2">
							{#each person.relationships as rel}
								<a
									href="/connections/{rel.relatedPerson.id}"
									class="-mx-2 flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-stone-50"
								>
									<span class="text-sm text-stone-700">
										{rel.relatedPerson.first_name}
										{rel.relatedPerson.last_name}
									</span>
									<span
										class="rounded-full border border-stone-200 bg-stone-100 px-2 py-1 text-[10px] text-stone-600"
									>
										{rel.type}
									</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="space-y-6 lg:col-span-2">
				<div
					class="relative overflow-hidden rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm"
				>
					<div
						class="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-sky-100 opacity-50 blur-xl"
					></div>

					<div class="relative z-10">
						<div class="mb-3 flex items-center gap-2">
							{#if person.capacity_note}
								<Shield size={18} class="text-sky-600" />
								<h3 class="text-sm font-bold tracking-wide text-sky-900 uppercase">
									Current Season
								</h3>
							{:else}
								<Calendar size={18} class="text-sky-400" />
								<h3 class="text-sm font-bold tracking-wide text-sky-800 uppercase">
									Current Context
								</h3>
							{/if}
						</div>

						{#if person.bio}
							<p class="mb-4 leading-relaxed text-stone-700">{person.bio}</p>
						{:else}
							<p class="mb-4 text-sm text-stone-400 italic">No bio added yet.</p>
						{/if}

						{#if person.capacity_note}
							<div class="mt-4 rounded-lg border border-sky-200 bg-white/80 p-4 backdrop-blur-sm">
								<p class="text-xs font-semibold tracking-wider text-sky-800 uppercase opacity-70">
									Capacity Note
								</p>
								<p class="mt-1 text-sm font-medium text-slate-900 italic">
									"{person.capacity_note}"
								</p>
								<p class="mt-2 text-[10px] text-sky-700/60">
									* This note serves as a reminder to protect this person's season.
								</p>
							</div>
						{/if}
					</div>
				</div>

				<div class="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
					<h3 class="mb-6 flex items-center gap-2 text-base font-bold text-slate-900">
						<Users size={16} class="text-stone-400" />
						Teams & Serving
					</h3>

					{#if person.teamMemberships.length > 0}
						<div class="space-y-3">
							{#each person.teamMemberships as m}
								<div
									class="flex items-center justify-between rounded-lg border border-stone-100 bg-white p-3 transition-colors hover:border-stone-200"
								>
									<div class="flex items-center gap-3">
										<div
											class="flex h-10 w-10 items-center justify-center rounded bg-stone-100 font-bold text-stone-600"
										>
											{m.team.name[0]}
										</div>
										<div>
											<div class="text-sm font-bold text-slate-900">{m.team.name}</div>
											<div class="text-xs text-stone-500">{m.role || 'Team Member'}</div>
										</div>
									</div>
									<span
										class={`rounded px-2 py-1 text-[10px] font-bold tracking-wider uppercase ${
											m.status === 'active'
												? 'bg-green-50 text-green-700'
												: 'bg-stone-100 text-stone-500'
										}`}
									>
										{m.status}
									</span>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-stone-500 italic">Not currently serving on any teams.</p>
					{/if}
				</div>

				<div class="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
					<div class="mb-6 flex items-center justify-between">
						<h3 class="flex items-center gap-2 text-base font-bold text-slate-900">
							<Briefcase size={16} class="text-stone-400" />
							Capabilities
						</h3>
						<button class="text-xs font-bold text-stone-400 hover:text-slate-900"> Edit </button>
					</div>

					{#if person.capabilities.length > 0}
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							{#each person.capabilities as cap}
								<div class="flex flex-col gap-2 rounded-lg border border-stone-100 bg-stone-50 p-3">
									<div class="flex items-start justify-between">
										<span class="text-sm font-bold text-slate-800">{cap.capability}</span>
										<div class="flex gap-1" title="Comfort Level: {getComfortLabel(cap.rating)}">
											{#each Array(5) as _, i}
												<div
													class={`h-1.5 w-1.5 rounded-full ${
														i < (cap.rating || 0) ? 'bg-slate-800' : 'bg-stone-200'
													}`}
												></div>
											{/each}
										</div>
									</div>
									{#if cap.notes}
										<p class="text-xs text-stone-500 italic">"{cap.notes}"</p>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<div class="rounded-lg border-2 border-dashed border-stone-100 py-6 text-center">
							<p class="text-sm text-stone-400">No capabilities listed.</p>
							<button class="mt-2 text-xs font-medium text-slate-600 hover:text-slate-900">
								Add Capability
							</button>
						</div>
					{/if}
				</div>

				<div class="rounded-xl border border-amber-200 bg-amber-50/50 p-6">
					<div class="mb-4 flex items-center justify-between">
						<h3
							class="flex items-center gap-2 text-xs font-bold tracking-wider text-amber-800 uppercase"
						>
							<CircleAlert size={12} /> Care Notes (Admin Only)
						</h3>
						<button class="text-xs font-bold text-amber-700/60 hover:text-amber-900">
							+ Add Note
						</button>
					</div>

					{#if person.careNotes.length > 0}
						<div class="space-y-4">
							{#each person.careNotes as note}
								<div
									class="relative rounded-lg border border-amber-100 bg-white p-4 text-sm shadow-sm transition-shadow hover:shadow-md"
								>
									<p class="text-slate-800">{note.content}</p>
									<div class="mt-2 flex items-center gap-2 text-xs text-stone-400">
										<span class="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
											{note.category || 'General'}
										</span>
										<span>•</span>
										<span class="flex items-center gap-1">
											<Clock size={10} />
											{note.created_at ? new Date(note.created_at).toLocaleDateString() : 'Unknown'}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-sm text-amber-800/60 italic">No care notes recorded.</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<EditProfileDrawer bind:open={isEditProfileOpen} {person} />
<ConnectFamilyDrawer bind:open={isConnectFamilyOpen} allFamilies={data.allFamilies} />
