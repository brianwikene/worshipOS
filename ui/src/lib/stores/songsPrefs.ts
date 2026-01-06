import { persisted } from './persisted';

export type SongsViewMode = 'cards' | 'table';

type SongsPrefs = {
	viewMode: SongsViewMode;
};

function coercePrefs(p: Partial<SongsPrefs> | null | undefined): SongsPrefs {
	return {
		viewMode: p?.viewMode === 'cards' ? 'cards' : 'table'
	};
}

const base = persisted<SongsPrefs>('worshipos:songs:prefs', {
	viewMode: 'table'
});

base.update((value) => coercePrefs(value));

export const songsPrefs = {
	subscribe: base.subscribe,
	set(value: SongsPrefs) {
		base.set(coercePrefs(value));
	},
	update(updater: (value: SongsPrefs) => SongsPrefs) {
		base.update((value) => coercePrefs(updater(value)));
	}
};
