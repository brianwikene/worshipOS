// ui/src/lib/tenant.ts

import tenants from '../../../dev/tenants.json';

const STORAGE_KEY = 'worshipos:active_church_id';

export type Tenant = {
  id: string;
  slug: string;
  name: string;
};

export function listTenants(): Tenant[] {
  return tenants.tenants;
}

export function getDefaultChurchId(): string {
  return tenants.defaultChurchId;
}

export function getActiveChurchId(): string {
  if (typeof window === 'undefined') {
    return getDefaultChurchId();
  }

  return localStorage.getItem(STORAGE_KEY) ?? getDefaultChurchId();
}

export function setActiveChurchId(churchId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, churchId);
}
