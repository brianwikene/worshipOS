import { getContext, setContext } from 'svelte';

// A unique key to ensure we don't clash with other contexts
const TENANT_KEY = Symbol('TENANT_CTX');

// Define what your Tenant object looks like
interface TenantState {
	church: { name: string; slug: string; id: string } | undefined;
	campus: { name: string; id: string } | null;
}

// 1. The Setter (Call this in your Root Layout)
export function initTenant(church: TenantState['church'], campus: TenantState['campus']) {
	// $state() makes this object deeply reactive!
	const state = $state({ church, campus });

	setContext(TENANT_KEY, state);

	return state;
}

// 2. The Getter (Call this in any component to get the data)
export function useTenant() {
	const context = getContext<TenantState>(TENANT_KEY);
	if (!context) {
		throw new Error('useTenant must be used within a component wrapped by the Tenant Context.');
	}
	return context;
}
