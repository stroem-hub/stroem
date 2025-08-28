import { describe, it, expect } from 'vitest';

// Import the components to verify they can be loaded
import MetricCard from './MetricCard.svelte';
import LineChart from './LineChart.svelte';
import ActivityFeed from './ActivityFeed.svelte';

describe('Dashboard Components', () => {
	it('should export MetricCard component', () => {
		expect(MetricCard).toBeDefined();
		expect(typeof MetricCard).toBe('function');
	});

	it('should export LineChart component', () => {
		expect(LineChart).toBeDefined();
		expect(typeof LineChart).toBe('function');
	});

	it('should export ActivityFeed component', () => {
		expect(ActivityFeed).toBeDefined();
		expect(typeof ActivityFeed).toBe('function');
	});

	it('should have proper component structure', () => {
		// Verify components have the expected Svelte component structure
		expect(MetricCard.name).toBe('MetricCard');
		expect(LineChart.name).toBe('LineChart');
		expect(ActivityFeed.name).toBe('ActivityFeed');
	});
});