import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Chart.js for tests
vi.mock('chart.js', () => ({
	Chart: vi.fn().mockImplementation(() => ({
		destroy: vi.fn(),
		update: vi.fn(),
		render: vi.fn()
	})),
	CategoryScale: vi.fn(),
	LinearScale: vi.fn(),
	PointElement: vi.fn(),
	LineElement: vi.fn(),
	LineController: vi.fn(),
	Title: vi.fn(),
	Tooltip: vi.fn(),
	Legend: vi.fn()
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation(query => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // deprecated
		removeListener: vi.fn(), // deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// Mock browser environment for Svelte 5
if (typeof globalThis !== 'undefined' && typeof window === 'undefined') {
	Object.defineProperty(globalThis, 'window', {
		value: {},
		writable: true
	});
}