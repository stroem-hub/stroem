import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Label from './Label.svelte';

describe('Label Component', () => {
	it('renders with default props', () => {
		render(Label, {
			props: {
				children: () => 'Test label'
			}
		});

		const label = screen.getByText('Test label');
		expect(label).toBeInTheDocument();
		expect(label.tagName).toBe('LABEL');
	});

	it('shows required indicator when required is true', () => {
		render(Label, {
			props: {
				required: true,
				children: () => 'Required field'
			}
		});

		expect(screen.getByText('Required field')).toBeInTheDocument();
		expect(screen.getByText('*')).toBeInTheDocument();
		expect(screen.getByTitle('This field is required')).toBeInTheDocument();
	});

	it('does not show required indicator when required is false', () => {
		render(Label, {
			props: {
				required: false,
				children: () => 'Optional field'
			}
		});

		expect(screen.getByText('Optional field')).toBeInTheDocument();
		expect(screen.queryByText('*')).not.toBeInTheDocument();
	});

	it('applies custom class names', () => {
		render(Label, {
			props: {
				class: 'custom-label-class',
				children: () => 'Custom label'
			}
		});

		expect(screen.getByText('Custom label')).toHaveClass('custom-label-class');
	});

	it('passes through HTML attributes', () => {
		render(Label, {
			props: {
				for: 'test-input',
				id: 'test-label',
				children: () => 'Label with attributes'
			}
		});

		const label = screen.getByText('Label with attributes');
		expect(label).toHaveAttribute('for', 'test-input');
		expect(label).toHaveAttribute('id', 'test-label');
	});
});