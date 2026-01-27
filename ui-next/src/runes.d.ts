export {};

declare global {
	function $props<T = Record<string, any>>(): T;
	function $state<T>(initial: T): T;
	function $state<T>(): T;
	function $derived<T>(fn: () => T): T;
	function $bindable<T>(initial?: T): T;
}
