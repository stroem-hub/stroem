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
}

export const authUser = writable<Stores | null>(null);
export const accessToken = writable<string | null>(null);

// Theme store
export const theme = writable<'light' | 'dark' | 'auto'>('auto');

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
			const errorWithTimestamp = { ...error, timestamp: new Date() };
			update(errors => [...errors, errorWithTimestamp]);
		},
		remove: (index: number) => {
			update(errors => errors.filter((_, i) => i !== index));
		},
		clear: () => set([])
	};
}

export const errors = createErrorStore();

// Loading state store
export const isLoading = writable<boolean>(false);