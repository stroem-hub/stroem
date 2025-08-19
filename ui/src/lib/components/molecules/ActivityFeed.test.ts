import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import ActivityFeed from './ActivityFeed.svelte';

describe('ActivityFeed', () => {
	const sampleItems = [
		{
			id: '1',
			type: 'job_completed' as const,
			title: 'Job completed successfully',
			description: 'Task "backup-database" finished',
			timestamp: new Date('2024-01-01T10:00:00Z'),
			user: 'admin'
		},
		{
			id: '2',
			type: 'job_failed' as const,
			title: 'Job failed',
			description: 'Task "sync-data" encountered an error',
			timestamp: new Date('2024-01-01T09:30:00Z'),
			user: 'system'
		},
		{
			id: '3',
			type: 'task_created' as const,
			title: 'New task created',
			timestamp: new Date('2024-01-01T09:00:00Z')
		}
	];

	it('renders activity feed with items', () => {
		render(ActivityFeed, {
			props: {
				items: sampleItems
			}
		});

		expect(screen.getByText('Recent Activity')).toBeInTheDocument();
		expect(screen.getByText('Job completed successfully')).toBeInTheDocument();
		expect(screen.getByText('Job failed')).toBeInTheDocument();
		expect(screen.getByText('New task created')).toBeInTheDocument();
	});

	it('displays item descriptions when provided', () => {
		render(ActivityFeed, {
			props: {
				items: sampleItems
			}
		});

		expect(screen.getByText('Task "backup-database" finished')).toBeInTheDocument();
		expect(screen.getByText('Task "sync-data" encountered an error')).toBeInTheDocument();
	});

	it('displays user information when provided', () => {
		render(ActivityFeed, {
			props: {
				items: sampleItems
			}
		});

		expect(screen.getByText('by admin')).toBeInTheDocument();
		expect(screen.getByText('by system')).toBeInTheDocument();
	});

	it('renders loading state', () => {
		render(ActivityFeed, {
			props: {
				items: [],
				loading: true
			}
		});

		// Should show loading skeletons
		const loadingElements = screen.getAllByRole('generic');
		expect(loadingElements.some(el => el.classList.contains('animate-pulse'))).toBe(true);
	});

	it('renders empty state when no items', () => {
		render(ActivityFeed, {
			props: {
				items: []
			}
		});

		expect(screen.getByText('No recent activity')).toBeInTheDocument();
		expect(screen.getByText('Activity will appear here as it happens.')).toBeInTheDocument();
	});

	it('renders load more button when hasMore is true', () => {
		const onLoadMore = vi.fn();
		
		render(ActivityFeed, {
			props: {
				items: sampleItems,
				hasMore: true,
				onLoadMore
			}
		});

		const loadMoreButton = screen.getByText('Load more activity');
		expect(loadMoreButton).toBeInTheDocument();
	});

	it('calls onLoadMore when load more button is clicked', async () => {
		const onLoadMore = vi.fn();
		
		render(ActivityFeed, {
			props: {
				items: sampleItems,
				hasMore: true,
				onLoadMore
			}
		});

		const loadMoreButton = screen.getByText('Load more activity');
		await fireEvent.click(loadMoreButton);

		expect(onLoadMore).toHaveBeenCalledOnce();
	});

	it('disables load more button when loading', () => {
		const onLoadMore = vi.fn();
		
		render(ActivityFeed, {
			props: {
				items: sampleItems,
				hasMore: true,
				onLoadMore,
				loading: true
			}
		});

		const loadMoreButton = screen.getByRole('button');
		expect(loadMoreButton).toBeDisabled();
	});

	it('formats timestamps correctly', () => {
		// Mock current time to make timestamp formatting predictable
		const mockNow = new Date('2024-01-01T10:05:00Z');
		vi.setSystemTime(mockNow);

		const recentItems = [
			{
				id: '1',
				type: 'job_completed' as const,
				title: 'Recent job',
				timestamp: new Date('2024-01-01T10:04:30Z') // 30 seconds ago
			},
			{
				id: '2',
				type: 'job_completed' as const,
				title: 'Job from minutes ago',
				timestamp: new Date('2024-01-01T10:00:00Z') // 5 minutes ago
			},
			{
				id: '3',
				type: 'job_completed' as const,
				title: 'Job from hours ago',
				timestamp: new Date('2024-01-01T08:00:00Z') // 2 hours ago
			}
		];

		render(ActivityFeed, {
			props: {
				items: recentItems
			}
		});

		expect(screen.getByText('Just now')).toBeInTheDocument();
		expect(screen.getByText('5m ago')).toBeInTheDocument();
		expect(screen.getByText('2h ago')).toBeInTheDocument();

		vi.useRealTimers();
	});

	it('applies correct icon and color for different activity types', () => {
		const activityTypes = [
			{ type: 'job_started' as const, title: 'Job started' },
			{ type: 'job_completed' as const, title: 'Job completed' },
			{ type: 'job_failed' as const, title: 'Job failed' },
			{ type: 'task_created' as const, title: 'Task created' },
			{ type: 'worker_connected' as const, title: 'Worker connected' },
			{ type: 'worker_disconnected' as const, title: 'Worker disconnected' }
		];

		const items = activityTypes.map((item, index) => ({
			id: String(index),
			type: item.type,
			title: item.title,
			timestamp: new Date()
		}));

		const { container } = render(ActivityFeed, {
			props: { items }
		});

		// Check that different colored icons are rendered
		const icons = container.querySelectorAll('svg');
		expect(icons.length).toBeGreaterThan(0);
	});

	it('applies custom max height', () => {
		const { container } = render(ActivityFeed, {
			props: {
				items: sampleItems,
				maxHeight: '600px'
			}
		});

		const scrollContainer = container.querySelector('[style*="max-height"]');
		expect(scrollContainer).toHaveStyle('max-height: 600px');
	});

	it('handles items without descriptions gracefully', () => {
		const itemsWithoutDescription = [
			{
				id: '1',
				type: 'job_completed' as const,
				title: 'Job completed',
				timestamp: new Date()
			}
		];

		render(ActivityFeed, {
			props: {
				items: itemsWithoutDescription
			}
		});

		expect(screen.getByText('Job completed')).toBeInTheDocument();
		// Should not crash or show undefined
	});

	it('handles items without users gracefully', () => {
		const itemsWithoutUser = [
			{
				id: '1',
				type: 'job_completed' as const,
				title: 'Job completed',
				timestamp: new Date()
			}
		];

		render(ActivityFeed, {
			props: {
				items: itemsWithoutUser
			}
		});

		expect(screen.getByText('Job completed')).toBeInTheDocument();
		expect(screen.queryByText(/^by /)).not.toBeInTheDocument();
	});
});