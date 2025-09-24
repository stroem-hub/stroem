import { writable } from 'svelte/store';

export interface Stores {
	user_id: string;
	email: string;
	name: string | null;
}

export interface Toast {
	id: string;
	title: string;
	message?: string;
	type: 'success' | 'error' | 'warning' | 'info';
	duration?: number;
}

export interface ErrorItem {
	message: string;
	details?: string;
	recoverable?: boolean;
	timestamp?: Date;
	id?: string;
}

export const authUser = writable<Stores | null>(null);
export const accessToken = writable<string | null>(null);

// Theme store
function createThemeStore() {
	const { subscribe, set, update } = writable<'light' | 'dark' | 'auto'>('auto');

	return {
		subscribe,
		set,
		update,
		toggle: () => {
			update(current => {
				if (current === 'light') return 'dark';
				if (current === 'dark') return 'light';
				return 'light'; // default for 'auto'
			});
		}
	};
}

export const theme = createThemeStore();

// Toast notifications store
function createToastStore() {
	const { subscribe, set, update } = writable<Toast[]>([]);

	return {
		subscribe,
		add: (toast: Omit<Toast, 'id'>) => {
			const id = Math.random().toString(36).substr(2, 9);
			const newToast: Toast = { ...toast, id };
			update(toasts => [...toasts, newToast]);
			
			// Auto-remove after duration
			if (toast.duration !== 0) {
				setTimeout(() => {
					update(toasts => toasts.filter(t => t.id !== id));
				}, toast.duration || 5000);
			}
			
			return id;
		},
		remove: (id: string) => {
			update(toasts => toasts.filter(t => t.id !== id));
		},
		clear: () => set([])
	};
}

export const toasts = createToastStore();

// Error store
function createErrorStore() {
	const { subscribe, set, update } = writable<ErrorItem[]>([]);

	return {
		subscribe,
		add: (error: ErrorItem) => {
			const id = Math.random().toString(36).substr(2, 9);
			const errorWithTimestamp = { ...error, timestamp: new Date(), id };
			update(errors => [...errors, errorWithTimestamp]);
			return id;
		},
		remove: (id: string) => {
			update(errors => errors.filter(error => (error as any).id !== id));
		},
		clear: () => set([])
	};
}

export const errors = createErrorStore();

// Loading state store
export const isLoading = writable<boolean>(false);