// /ui/src/app.d.ts
// src/app.d.ts
import { Session, SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			getSession(): Promise<Session | null>;
			user: User | null;
			churchId: string | null;
		}
		// ... other interfaces
	}
}

export { };

