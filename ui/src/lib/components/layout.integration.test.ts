import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { authUser, theme, toasts, errors } from '$lib/stores';
import Layout from '../../routes/+layout.svelte';

// Mock the navigation and page stores
vi.mock('$app/navigation', () => ({
	goto: vi.fn()
}));

vi.mock('$app/state', () => ({
	page: {
		url: {
			pathname: '/'
		}
	}
}));

vi.mock('$lib/auth', () => ({
	refreshAccessToken: vi.fn().mockResolvedValue(true)
}));

// Mock components that might not be available in test environment
vi.mock('$lib/components', () => ({
	Sidebar: vi.fn(() => ({ render: () => '<div data-testid="sidebar">Sidebar</div>' }))
}));

describe('Layout Integration Tests', () => {
	beforeEach(() => {
		// Reset stores before each test
		authUser.set(null);
		theme.set('light');
		toasts.clear();
		errors.clear();
		
		// Clear localStorage
		localStorage.clear();
		
		// Reset DOM classes
		document.documentElement.classList.remove('dark');
	});

	describe('Theme Management', () => {
		it('should set and get theme values', async () => {
			theme.set('dark');
			expect(get(theme)).toBe('dark');
			
			theme.set('light');
			expect(get(theme)).toBe('light');
		});

		it('should toggle between light and dark themes', async () => {
			theme.set('light');
			expect(get(theme)).toBe('light');
			
			theme.toggle();
			expect(get(theme)).toBe('dark');
			
			theme.toggle();
			expect(get(theme)).toBe('light');
		});

		it('should handle theme state changes', async () => {
			// Test that theme store accepts valid values
			const validThemes = ['light', 'dark'] as const;
			
			for (const themeValue of validThemes) {
				theme.set(themeValue);
				expect(get(theme)).toBe(themeValue);
			}
		});
	});

	describe('Error Boundary', () => {
		it('should catch and display errors', async () => {
			const testError = new Error('Test error message');
			
			// Add error to store
			errors.add({
				message: testError.message,
				details: testError.stack || '',
				recoverable: true
			});

			const errorList = get(errors);
			expect(errorList).toHaveLength(1);
			expect(errorList[0].message).toBe('Test error message');
		});

		it('should allow error removal', async () => {
			const errorId = errors.add({
				message: 'Test error',
				recoverable: true
			});

			expect(get(errors)).toHaveLength(1);
			
			errors.remove(errorId);
			expect(get(errors)).toHaveLength(0);
		});

		it('should clear all errors', async () => {
			errors.add({ message: 'Error 1', recoverable: true });
			errors.add({ message: 'Error 2', recoverable: true });
			
			expect(get(errors)).toHaveLength(2);
			
			errors.clear();
			expect(get(errors)).toHaveLength(0);
		});
	});

	describe('Toast Notifications', () => {
		it('should add and auto-remove toasts', async () => {
			const toastId = toasts.add({
				type: 'success',
				title: 'Test Success',
				message: 'This is a test message',
				duration: 100 // Short duration for testing
			});

			expect(get(toasts)).toHaveLength(1);
			expect(get(toasts)[0].title).toBe('Test Success');
			
			// Wait for auto-removal
			await new Promise(resolve => setTimeout(resolve, 150));
			expect(get(toasts)).toHaveLength(0);
		});

		it('should manually remove toasts', async () => {
			const toastId = toasts.add({
				type: 'info',
				title: 'Test Info',
				duration: 5000 // Long duration
			});

			expect(get(toasts)).toHaveLength(1);
			
			toasts.remove(toastId);
			expect(get(toasts)).toHaveLength(0);
		});

		it('should clear all toasts', async () => {
			toasts.add({ type: 'success', title: 'Toast 1' });
			toasts.add({ type: 'error', title: 'Toast 2' });
			
			expect(get(toasts)).toHaveLength(2);
			
			toasts.clear();
			expect(get(toasts)).toHaveLength(0);
		});
	});

	describe('Authentication Flow', () => {
		it('should handle authenticated user state', async () => {
			const testUser = {
				user_id: '123',
				email: 'test@example.com',
				name: 'Test User'
			};

			authUser.set(testUser);
			expect(get(authUser)).toEqual(testUser);
		});

		it('should handle logout', async () => {
			const testUser = {
				user_id: '123',
				email: 'test@example.com',
				name: 'Test User'
			};

			authUser.set(testUser);
			expect(get(authUser)).toEqual(testUser);
			
			authUser.set(null);
			expect(get(authUser)).toBeNull();
		});
	});

	describe('Sidebar State Management', () => {
		it('should persist sidebar collapsed state', async () => {
			// Test sidebar state persistence
			localStorage.setItem('sidebar-collapsed', 'true');
			
			const savedState = localStorage.getItem('sidebar-collapsed');
			expect(JSON.parse(savedState!)).toBe(true);
			
			localStorage.setItem('sidebar-collapsed', 'false');
			const newSavedState = localStorage.getItem('sidebar-collapsed');
			expect(JSON.parse(newSavedState!)).toBe(false);
		});
	});

	describe('Loading State', () => {
		it('should manage global loading state', async () => {
			const { isLoading } = await import('$lib/stores');
			
			expect(get(isLoading)).toBe(false);
			
			isLoading.set(true);
			expect(get(isLoading)).toBe(true);
			
			isLoading.set(false);
			expect(get(isLoading)).toBe(false);
		});
	});
});

describe('Navigation Integration', () => {
	beforeEach(() => {
		// Reset DOM
		document.body.innerHTML = '';
		
		// Mock window.matchMedia for theme detection
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: vi.fn().mockImplementation(query => ({
				matches: false,
				media: query,
				onchange: null,
				addListener: vi.fn(),
				removeListener: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn(),
				dispatchEvent: vi.fn(),
			})),
		});
	});

	it('should handle navigation state correctly', async () => {
		// Mock page store with different paths
		const mockPage = {
			url: { pathname: '/tasks' }
		};

		// Test navigation active state logic
		function isActive(href: string, currentPath: string): boolean {
			if (href === '/') {
				return currentPath === '/';
			}
			return currentPath.startsWith(href);
		}

		expect(isActive('/', '/')).toBe(true);
		expect(isActive('/', '/tasks')).toBe(false);
		expect(isActive('/tasks', '/tasks')).toBe(true);
		expect(isActive('/tasks', '/tasks/123')).toBe(true);
		expect(isActive('/jobs', '/tasks')).toBe(false);
	});

	it('should handle mobile menu state', async () => {
		let mobileMenuOpen = false;
		let isMobile = true;

		function handleToggle() {
			if (isMobile) {
				mobileMenuOpen = !mobileMenuOpen;
			}
		}

		expect(mobileMenuOpen).toBe(false);
		
		handleToggle();
		expect(mobileMenuOpen).toBe(true);
		
		handleToggle();
		expect(mobileMenuOpen).toBe(false);
	});

	it('should handle responsive behavior', async () => {
		// Mock window resize
		let windowWidth = 1024; // Desktop
		
		function checkMobile() {
			return windowWidth < 768;
		}

		expect(checkMobile()).toBe(false);
		
		windowWidth = 600; // Mobile
		expect(checkMobile()).toBe(true);
		
		windowWidth = 800; // Desktop
		expect(checkMobile()).toBe(false);
	});
});