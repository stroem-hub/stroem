import { describe, it, expect } from 'vitest';
import { parseUrlParams, buildCleanUrl, createShareableUrl } from '$lib/utils';

describe('URL State Management', () => {
	describe('parseUrlParams', () => {
		it('should parse valid parameters correctly', () => {
			const searchParams = new URLSearchParams('page=2&limit=50&sort=lastExecution&order=desc&search=test');
			
			const schema = {
				page: {
					default: 1,
					parse: (value: string) => Math.max(1, parseInt(value) || 1),
					validate: (value: number) => value >= 1
				},
				limit: {
					default: 25,
					parse: (value: string) => parseInt(value) || 25,
					validate: (value: number) => [10, 25, 50, 100].includes(value)
				},
				sort: {
					default: 'name' as const,
					validate: (value: string) => ['name', 'lastExecution', 'successRate'].includes(value)
				},
				order: {
					default: 'asc' as const,
					validate: (value: string) => ['asc', 'desc'].includes(value)
				},
				search: {
					default: '',
					validate: (value: string) => typeof value === 'string'
				}
			};

			const result = parseUrlParams(searchParams, schema);

			expect(result).toEqual({
				page: 2,
				limit: 50,
				sort: 'lastExecution',
				order: 'desc',
				search: 'test'
			});
		});

		it('should use defaults for invalid parameters', () => {
			const searchParams = new URLSearchParams('page=0&limit=999&sort=invalid&order=invalid');
			
			const schema = {
				page: {
					default: 1,
					parse: (value: string) => Math.max(1, parseInt(value) || 1),
					validate: (value: number) => value >= 1
				},
				limit: {
					default: 25,
					parse: (value: string) => parseInt(value) || 25,
					validate: (value: number) => [10, 25, 50, 100].includes(value)
				},
				sort: {
					default: 'name' as const,
					validate: (value: string) => ['name', 'lastExecution', 'successRate'].includes(value)
				},
				order: {
					default: 'asc' as const,
					validate: (value: string) => ['asc', 'desc'].includes(value)
				},
				search: {
					default: '',
					validate: (value: string) => typeof value === 'string'
				}
			};

			const result = parseUrlParams(searchParams, schema);

			expect(result).toEqual({
				page: 1,
				limit: 25,
				sort: 'name',
				order: 'asc',
				search: ''
			});
		});
	});

	describe('buildCleanUrl', () => {
		it('should build clean URL with only non-default parameters', () => {
			const params = {
				page: 1,
				limit: 25,
				sort: 'name',
				order: 'asc',
				search: ''
			};

			const defaults = {
				page: 1,
				limit: 25,
				sort: 'name',
				order: 'asc',
				search: ''
			};

			// Mock window.location for the test
			Object.defineProperty(window, 'location', {
				value: { origin: 'http://localhost:3000' },
				writable: true
			});

			const result = buildCleanUrl('/tasks', params, defaults);
			expect(result).toBe('/tasks');
		});

		it('should include non-default parameters in URL', () => {
			const params = {
				page: 2,
				limit: 50,
				sort: 'lastExecution',
				order: 'desc',
				search: 'test'
			};

			const defaults = {
				page: 1,
				limit: 25,
				sort: 'name',
				order: 'asc',
				search: ''
			};

			// Mock window.location for the test
			Object.defineProperty(window, 'location', {
				value: { origin: 'http://localhost:3000' },
				writable: true
			});

			const result = buildCleanUrl('/tasks', params, defaults);
			expect(result).toBe('/tasks?page=2&limit=50&sort=lastExecution&order=desc&search=test');
		});

		it('should exclude empty search parameter', () => {
			const params = {
				page: 2,
				limit: 25,
				sort: 'name',
				order: 'asc',
				search: ''
			};

			const defaults = {
				page: 1,
				limit: 25,
				sort: 'name',
				order: 'asc',
				search: ''
			};

			// Mock window.location for the test
			Object.defineProperty(window, 'location', {
				value: { origin: 'http://localhost:3000' },
				writable: true
			});

			const result = buildCleanUrl('/tasks', params, defaults);
			expect(result).toBe('/tasks?page=2');
		});
	});

	describe('createShareableUrl', () => {
		it('should create shareable URL same as buildCleanUrl', () => {
			const params = {
				page: 2,
				limit: 50,
				sort: 'lastExecution',
				order: 'desc',
				search: 'test'
			};

			const defaults = {
				page: 1,
				limit: 25,
				sort: 'name',
				order: 'asc',
				search: ''
			};

			// Mock window.location for the test
			Object.defineProperty(window, 'location', {
				value: { origin: 'http://localhost:3000' },
				writable: true
			});

			const result1 = createShareableUrl('/tasks', params, defaults);
			const result2 = buildCleanUrl('/tasks', params, defaults);
			
			expect(result1).toBe(result2);
		});
	});
});