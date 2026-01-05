// src/lib/stores/peoplePrefs.ts
import { persisted } from './persisted';

export type PeopleViewMode = 'cards' | 'table';
export type SortDir = 'asc' | 'desc';
export type PeopleSortField = 'last_name' | 'first_name' | 'created_at'; // only what API supports

export type PeoplePrefs = {
	viewMode: PeopleViewMode;
	sortBy: PeopleSortField;
	sortDir: SortDir;
};

const allowedSort: PeopleSortField[] = ['last_name', 'first_name', 'created_at'];

function coerceSortBy(v: unknown): PeopleSortField {
	return allowedSort.includes(v as PeopleSortField) ? (v as PeopleSortField) : 'last_name';
}

function coercePrefs(p: Partial<PeoplePrefs> | null | undefined): PeoplePrefs {
	return {
		viewMode: p?.viewMode === 'table' ? 'table' : 'cards',
		sortBy: coerceSortBy(p?.sortBy),
		sortDir: p?.sortDir === 'desc' ? 'desc' : 'asc'
	};
}

const base = persisted<PeoplePrefs>('worshipos:people:prefs', {
	viewMode: 'cards',
	sortBy: 'last_name',
	sortDir: 'asc'
});

// Sanitize whatever may already be in storage
base.update((value) => coercePrefs(value));

export const peoplePrefs = {
	subscribe: base.subscribe,
	set(value: PeoplePrefs) {
		base.set(coercePrefs(value));
	},
	update(updater: (value: PeoplePrefs) => PeoplePrefs) {
		base.update((value) => coercePrefs(updater(value)));
	}
};
