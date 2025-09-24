import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TaskConfiguration from './TaskConfiguration.svelte';

describe('TaskConfiguration', () => {
	const mockTask = {
		id: 'test-task',
		name: 'Test Task',
		description: 'A test task',
		input: {
			field1: {
				id: 'field1',
				name: 'Field 1',
				type: 'string',
				required: true,
				description: 'First field description',
				default: 'default value',
				order: 1
			},
			field2: {
				id: 'field2',
				name: 'Field 2',
				type: 'number',
				required: false,
				description: 'Second field description',
				default: 42,
				order: 2
			}
		},
		flow: {
			step1: {
				action: 'test.action1',
				input: {
					param1: 'value1'
				}
			},
			step2: {
				action: 'test.action2',
				depends_on: ['step1'],
				continue_on_fail: true,
				on_error: 'error_handler'
			}
		}
	};

	it('renders input parameters section', () => {
		render(TaskConfiguration, { task: mockTask });

		expect(screen.getByText('Input Parameters')).toBeInTheDocument();
		expect(screen.getByText('2 parameters defined')).toBeInTheDocument();
	});

	it('renders flow steps section', () => {
		render(TaskConfiguration, { task: mockTask });

		expect(screen.getByText('Flow Steps')).toBeInTheDocument();
		expect(screen.getByText('2 steps defined')).toBeInTheDocument();
	});

	it('expands and collapses sections', async () => {
		render(TaskConfiguration, { task: mockTask });

		// Parameters section should be expanded by default
		expect(screen.getByText('Field 1')).toBeInTheDocument();

		// Click to collapse parameters
		const parametersButton = screen.getByText('Input Parameters').closest('button');
		await fireEvent.click(parametersButton!);

		// Parameters should be collapsed (content not visible)
		expect(screen.queryByText('Field 1')).not.toBeInTheDocument();
	});

	it('displays parameter details correctly', () => {
		render(TaskConfiguration, { task: mockTask });

		// Check field 1 details
		expect(screen.getByText('Field 1')).toBeInTheDocument();
		expect(screen.getByText('string')).toBeInTheDocument();
		expect(screen.getByText('Required')).toBeInTheDocument();
		expect(screen.getByText('First field description')).toBeInTheDocument();
		expect(screen.getByText('"default value"')).toBeInTheDocument();

		// Check field 2 details
		expect(screen.getByText('Field 2')).toBeInTheDocument();
		expect(screen.getByText('number')).toBeInTheDocument();
		expect(screen.getByText('Second field description')).toBeInTheDocument();
		expect(screen.getByText('42')).toBeInTheDocument();
	});

	it('expands and shows flow step details', async () => {
		render(TaskConfiguration, { task: mockTask });

		// Expand flow section first
		const flowButton = screen.getByText('Flow Steps').closest('button');
		await fireEvent.click(flowButton!);

		// Should show step names
		expect(screen.getByText('step1')).toBeInTheDocument();
		expect(screen.getByText('step2')).toBeInTheDocument();

		// Expand step1
		const step1Button = screen.getByText('step1').closest('button');
		await fireEvent.click(step1Button!);

		// Should show step1 details
		expect(screen.getByText('test.action1')).toBeInTheDocument();
		expect(screen.getByText('Input')).toBeInTheDocument();
	});

	it('displays step dependencies correctly', async () => {
		render(TaskConfiguration, { task: mockTask });

		// Expand flow section
		const flowButton = screen.getByText('Flow Steps').closest('button');
		await fireEvent.click(flowButton!);

		// Should show dependency badge
		expect(screen.getByText('1 dep')).toBeInTheDocument();

		// Expand step2 to see dependencies
		const step2Button = screen.getByText('step2').closest('button');
		await fireEvent.click(step2Button!);

		expect(screen.getByText('Dependencies')).toBeInTheDocument();
		expect(screen.getByText('step1')).toBeInTheDocument();
	});

	it('displays error handling configuration', async () => {
		render(TaskConfiguration, { task: mockTask });

		// Expand flow section and step2
		const flowButton = screen.getByText('Flow Steps').closest('button');
		await fireEvent.click(flowButton!);

		const step2Button = screen.getByText('step2').closest('button');
		await fireEvent.click(step2Button!);

		expect(screen.getByText('Error Handling')).toBeInTheDocument();
		expect(screen.getByText('Continue on Fail')).toBeInTheDocument();
		expect(screen.getByText('error_handler')).toBeInTheDocument();
	});

	it('handles task with no parameters', () => {
		const taskWithoutParams = {
			...mockTask,
			input: {}
		};

		render(TaskConfiguration, { task: taskWithoutParams });

		expect(screen.getByText('0 parameters defined')).toBeInTheDocument();
		expect(screen.getByText('No Parameters')).toBeInTheDocument();
		expect(screen.getByText("This task doesn't require any input parameters.")).toBeInTheDocument();
	});

	it('handles task with no flow steps', () => {
		const taskWithoutFlow = {
			...mockTask,
			flow: {}
		};

		render(TaskConfiguration, { task: taskWithoutFlow });

		// Expand flow section
		const flowButton = screen.getByText('Flow Steps').closest('button');
		fireEvent.click(flowButton!);

		expect(screen.getByText('0 steps defined')).toBeInTheDocument();
		expect(screen.getByText('No Flow Steps')).toBeInTheDocument();
		expect(screen.getByText("This task doesn't have any flow steps defined.")).toBeInTheDocument();
	});

	it('displays loading state correctly', () => {
		render(TaskConfiguration, { task: mockTask, loading: true });

		// Should show skeleton loaders
		const skeletonElements = document.querySelectorAll('.animate-pulse');
		expect(skeletonElements.length).toBeGreaterThan(0);

		// Should not show actual content
		expect(screen.queryByText('Input Parameters')).not.toBeInTheDocument();
	});

	it('formats different parameter types correctly', () => {
		const taskWithDifferentTypes = {
			...mockTask,
			input: {
				stringField: {
					id: 'stringField',
					type: 'string',
					default: 'test'
				},
				numberField: {
					id: 'numberField',
					type: 'number',
					default: 123
				},
				booleanField: {
					id: 'booleanField',
					type: 'boolean',
					default: true
				},
				nullField: {
					id: 'nullField',
					type: 'string',
					default: null
				}
			}
		};

		render(TaskConfiguration, { task: taskWithDifferentTypes });

		expect(screen.getByText('"test"')).toBeInTheDocument();
		expect(screen.getByText('123')).toBeInTheDocument();
		expect(screen.getByText('true')).toBeInTheDocument();
		expect(screen.getByText('None')).toBeInTheDocument();
	});

	it('sorts parameters by order correctly', () => {
		const taskWithOrderedParams = {
			...mockTask,
			input: {
				third: {
					id: 'third',
					name: 'Third Field',
					type: 'string',
					order: 3
				},
				first: {
					id: 'first',
					name: 'First Field',
					type: 'string',
					order: 1
				},
				second: {
					id: 'second',
					name: 'Second Field',
					type: 'string',
					order: 2
				}
			}
		};

		render(TaskConfiguration, { task: taskWithOrderedParams });

		const parameterElements = screen.getAllByText(/Field$/);
		expect(parameterElements[0]).toHaveTextContent('First Field');
		expect(parameterElements[1]).toHaveTextContent('Second Field');
		expect(parameterElements[2]).toHaveTextContent('Third Field');
	});
});