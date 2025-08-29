import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import TaskStatusBadge from './TaskStatusBadge.svelte';

describe('TaskStatusBadge', () => {
	it('renders success status correctly', () => {
		const { getByText } = render(TaskStatusBadge, {
			props: {
				status: 'success'
			}
		});

		expect(getByText('Success')).toBeTruthy();
	});

	it('renders failed status correctly', () => {
		const { getByText } = render(TaskStatusBadge, {
			props: {
				status: 'failed'
			}
		});

		expect(getByText('Failed')).toBeTruthy();
	});

	it('renders never executed status correctly', () => {
		const { getByText } = render(TaskStatusBadge, {
			props: {
				status: 'never_executed'
			}
		});

		expect(getByText('Never executed')).toBeTruthy();
	});
});