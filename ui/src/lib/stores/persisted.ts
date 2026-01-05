// src/lib/stores/persisted.ts
export function persisted<T>(key: string, initial: T) {
	let start = initial;

	// SSR-safe: only touch localStorage in the browser
	if (typeof localStorage !== 'undefined') {
		try {
			const raw = localStorage.getItem(key);
			if (raw != null) start = JSON.parse(raw) as T;
		} catch {
			// ignore bad JSON / storage issues
		}
	}

	let value = start;
	const subs = new Set<(v: T) => void>();

	function notify(v: T) {
		for (const fn of subs) fn(v);
	}

	function set(v: T) {
		value = v;
		if (typeof localStorage !== 'undefined') {
			try {
				localStorage.setItem(key, JSON.stringify(v));
			} catch {
				// ignore quota / privacy mode errors
			}
		}
		notify(value);
	}

	function update(fn: (v: T) => T) {
		set(fn(value));
	}

	function subscribe(run: (v: T) => void) {
		subs.add(run);
		run(value);
		return () => subs.delete(run);
	}

	return { subscribe, set, update };
}
