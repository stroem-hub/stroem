import { writable } from 'svelte/store';

export interface Stores {
	user_id: string;
	email: string;
	name: string | null;
}

export const authUser = writable<Stores | null>(null);
export const accessToken = writable<string | null>(null);