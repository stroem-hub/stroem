import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import TaskHeader from './TaskHeader.svelte';
import type { EnhancedTask } from '$lib/types';

describe('TaskHeader', () => {
	const mockTask: EnhancedTask = {
		id: 'test-task-1',
		name: 'Test Task',
		description: 'A test task for demonstration',
		input: {},
		flow: {},
		statistics: {
			totalExecutions: 42,
			successRate: 85.5,
			averageDuration: 125.5,
			lastExecution: {
				timestamp: '2024-01-15T10:30:00Z',
				status: 'success',
				triggeredBy: 'user:john.doe',
				duration: 98
			}
		}
	};

	it('renders task information correctly', () => {
		render(TaskHeader, { task: mockTask });

		// Check task name and description
		expect(screen.getByText('Test Task')).toBeInTheDocument();
		expect(screen.getByText('A test task for demonstration')).toBeInTheDocument();

		// Check breadcrumb
		expect(screen.getByText('Tasks')).toBeInTheDocument();
	});

	it('renders key statistics correctly', () => {
		render(TaskHeader, { task: mockTask });

		// Check statistics
		expect(screen.getByText('Total Runs')).toBeInTheDocument();
		expect(screen.getByText('42')).toBeInTheDocument();

		expect(screen.getByText('Success Rate')).toBeInTheDocument();
		expect(screen.getByText('86%')).toBeInTheDocument();

		expect(screen.getByText('Last Run')).toBeInTheDocument();
		expect(screen.getByText('Avg Duration')).toBeInTheDocument();
		expect(screen.getByText('2m 6s')).toBeInTheDocument();
	});

	it('renders run task button and handles click', async () => {
		const component = render(TaskHeader, { task: mockTask });
		const runButton = screen.getByText('Run Task');
		
		expect(runButton).toBeInTheDocument();
		expect(runButton).not.toBeDisabled();

		// Mock event listener
		let eventFired = false;
		component.component.$on('runTask', () => {
			eventFired = true;
		});

		await fireEvent.click(runButton);
		expect(eventFired).toBe(true);
	});

	it('disables run button when runDisabled is true', () => {
		render(TaskHeader, { task: mockTask, runDisabled: true });
		
		const runButton = screen.getByText('Run Task');
		expect(runButton).toBeDisabled();
	});

	it('handles task without description', () => {
		const taskWithoutDescription: EnhancedTask = {
			...mockTask,
			description: undefined
		};

		render(TaskHeader, { task: taskWithoutDescription });

		expect(screen.getByText('Test Task')).toBeInTheDocument();
		expect(screen.queryByText('A test task for demonstration')).not.toBeInTheDocument();
	});

	it('handles task without last execution', () => {
		const taskWithoutLastExecution: EnhancedTask = {
			...mockTask,
			statistics: {
				totalExecutions: 0,
				successRate: 0
			}
		};

		render(TaskHeader, { task: taskWithoutLastExecution });

		expect(screen.getByText('Never executed')).toBeInTheDocument();
		expect(screen.getByText('0')).toBeInTheDocument();
		expect(screen.getByText('0%')).toBeInTheDocument();
	});

	it('displays loading state correctly', () => {
		render(TaskHeader, { task: mockTask, loading: true });

		// Should show skeleton loaders
		const skeletonElements = document.querySelectorAll('.animate-pulse');
		expect(skeletonElements.length).toBeGreaterThan(0);

		// Should not show actual content
		expect(screen.queryByText('Test Task')).not.toBeInTheDocument();
	});

	it('applies correct color coding for different success rates', () => {
		const testCases = [
			{ successRate: 95, expectedClass: 'text-green-600' },
			{ successRate: 80, expectedClass: 'text-yellow-600' },
			{ successRate: 50, expectedClass: 'text-red-600' }
		];

		testCases.forEach(({ successRate, expectedClass }) => {
			const task: EnhancedTask = {
				...mockTask,
				statistics: {
					...mockTask.statistics,
					successRate
				}
			};

			const { unmount } = render(TaskHeader, { task });
			const successRateElement = screen.getByText(`${Math.round(successRate)}%`);
			expect(successRateElement).toHaveClass(expectedClass);
			unmount();
		});
	});

	it('formats duration correctly for different time ranges', () => {
		const testCases = [
			{ duration: 30, expected: '30s' },
			{ duration: 90, expected: '1m 30s' },
			{ duration: 3600, expected: '1h 0m' },
			{ duration: 3720, expected: '1h 2m' }
		];

		testCases.forEach(({ duration, expected }) => {
			const task: EnhancedTask = {
				...mockTask,
				statistics: {
					...mockTask.statistics,
					averageDuration: duration
				}
			};

			const { unmount } = render(TaskHeader, { task });
			expect(screen.getByText(expected)).toBeInTheDocument();
			unmount();
		});
	});

	it('handles missing average duration gracefully', () => {
		const taskWithoutDuration: EnhancedTask = {
			...mockTask,
			statistics: {
				...mockTask.statistics,
				averageDuration: undefined
			}
		};

		render(TaskHeader, { task: taskWithoutDuration });
		expect(screen.getByText('N/A')).toBeInTheDocument();
	});

	it('displays correct status indicators', () => {
		const statusCases = [
			{ status: 'success', expectedText: 'success' },
			{ status: 'failed', expectedText: 'failed' },
			{ status: 'running', expectedText: 'running' },
			{ status: 'queued', expectedText: 'queued' }
		];

		statusCases.forEach(({ status, expectedText }) => {
			const task: EnhancedTask = {
				...mockTask,
				statistics: {
					...mockTask.statistics,
					lastExecution: {
						...mockTask.statistics.lastExecution!,
						status: status as any
					}
				}
			};

			const { unmount } = render(TaskHeader, { task });
			expect(screen.getByText(expectedText)).toBeInTheDocument();
			unmount();
		});
	});
});