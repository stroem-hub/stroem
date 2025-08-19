import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface User {
	user_id: string;
	email: string;
	name: string | null;
}

export interface Toast {
	id: string;
	type: 'success' | 'error' | 'warning' | 'info';
	title: string;
	message?: string;
	duration?: number;
}

export interface AppError {
	id: string;
	message: string;
	details?: string;
	timestamp: Date;
	recoverable: boolean;
}

// Auth stores
export const authUser = writable<User | null>(null);
export const accessToken = writable<string | null>(null);

// Theme store with persistence
function createThemeStore() {
	const defaultTheme = 'light';
	const initialTheme = browser ? localStorage.getItem('theme') || defaultTheme : defaultTheme;
	
	const { subscribe, set, update } = writable<'light' | 'dark'>(initialTheme as 'light' | 'dark');

	return {
		subscribe,
		set: (theme: 'light' | 'dark') => {
			if (browser) {
				localStorage.setItem('theme', theme);
				document.documentElement.classList.toggle('dark', theme === 'dark');
			}
			set(theme);
		},
		toggle: () => {
			update(current => {
				const newTheme = current === 'light' ? 'dark' : 'light';
				if (browser) {
					localStorage.setItem('theme', newTheme);
					document.documentElement.classList.toggle('dark', newTheme === 'dark');
				}
				return newTheme;
			});
		}
	};
}

export const theme = createThemeStore();

// Loading state store
export const isLoading = writable<boolean>(false);

// Toast notifications store
function createToastStore() {
	const { subscribe, update } = writable<Toast[]>([]);

	return {
		subscribe,
		add: (toast: Omit<Toast, 'id'>) => {
			const id = crypto.randomUUID();
			const newToast: Toast = { ...toast, id };
			
			update(toasts => [...toasts, newToast]);
			
			// Auto-remove toast after duration
			const duration = toast.duration || 5000;
			setTimeout(() => {
				update(toasts => toasts.filter(t => t.id !== id));
			}, duration);
			
			return id;
		},
		remove: (id: string) => {
			update(toasts => toasts.filter(t => t.id !== id));
		},
		clear: () => {
			update(() => []);
		}
	};
}

export const toasts = createToastStore();

// Error store
function createErrorStore() {
	const { subscribe, update } = writable<AppError[]>([]);

	return {
		subscribe,
		add: (error: Omit<AppError, 'id' | 'timestamp'>) => {
			const id = crypto.randomUUID();
			const newError: AppError = { 
				...error, 
				id, 
				timestamp: new Date() 
			};
			
			update(errors => [...errors, newError]);
			return id;
		},
		remove: (id: string) => {
			update(errors => errors.filter(e => e.id !== id));
		},
		clear: () => {
			update(() => []);
		}
	};
}

export const errors = createErrorStore();