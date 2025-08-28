import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import FormField from './FormField.svelte';

describe('FormField', () => {
	it('renders with minimal props', () => {
		const { container } = render(FormField, {
			props: {}
		});

		const wrapper = container.querySelector('div');
		expect(wrapper).toBeInTheDocument();
		expect(wrapper).toHaveClass('space-y-1');
	});

	it('renders label correctly', () => {
		const labelText = 'Email Address';
		const { container } = render(FormField, {
			props: { label: labelText }
		});

		const label = container.querySelector('label');
		expect(label).toBeInTheDocument();
		expect(label).toHaveTextContent(labelText);
		expect(label).toHaveClass('block', 'text-sm', 'font-medium', 'text-gray-700', 'dark:text-gray-300');
	});

	it('renders required indicator when required', () => {
		const labelText = 'Email Address';
		const { container } = render(FormField, {
			props: { 
				label: labelText,
				required: true 
			}
		});

		const requiredIndicator = container.querySelector('span[aria-label="required"]');
		expect(requiredIndicator).toBeInTheDocument();
		expect(requiredIndicator).toHaveTextContent('*');
		expect(requiredIndicator).toHaveClass('text-error-500', 'ml-1');
	});

	it('does not render required indicator when not required', () => {
		const labelText = 'Email Address';
		const { container } = render(FormField, {
			props: { 
				label: labelText,
				required: false 
			}
		});

		const requiredIndicator = container.querySelector('span[aria-label="required"]');
		expect(requiredIndicator).not.toBeInTheDocument();
	});

	it('renders helper text correctly', () => {
		const helperText = 'Enter your email address';
		const { container } = render(FormField, {
			props: { helperText }
		});

		const helperElement = container.querySelector('p:not([role="alert"])');
		expect(helperElement).toBeInTheDocument();
		expect(helperElement).toHaveTextContent(helperText);
		expect(helperElement).toHaveClass('text-sm', 'text-gray-500', 'dark:text-gray-400');
	});

	it('renders error message correctly', () => {
		const errorMessage = 'This field is required';
		const { container } = render(FormField, {
			props: { error: errorMessage }
		});

		const errorElement = container.querySelector('p[role="alert"]');
		expect(errorElement).toBeInTheDocument();
		expect(errorElement).toHaveTextContent(errorMessage);
		expect(errorElement).toHaveClass('text-sm', 'text-error-600', 'dark:text-error-400');
	});

	it('prioritizes error over helper text', () => {
		const helperText = 'Enter your email address';
		const errorMessage = 'This field is required';
		const { container } = render(FormField, {
			props: { 
				helperText,
				error: errorMessage 
			}
		});

		const errorElement = container.querySelector('p[role="alert"]');
		const helperElement = container.querySelector('p:not([role="alert"])');
		
		expect(errorElement).toBeInTheDocument();
		expect(errorElement).toHaveTextContent(errorMessage);
		expect(helperElement).not.toBeInTheDocument();
	});

	it('handles disabled state correctly', () => {
		const { container } = render(FormField, {
			props: { 
				label: 'Test Field',
				disabled: true 
			}
		});

		const wrapper = container.querySelector('div');
		expect(wrapper).toHaveClass('opacity-50', 'pointer-events-none');
	});

	it('applies custom className correctly', () => {
		const { container } = render(FormField, {
			props: { class: 'custom-field-class' }
		});

		const wrapper = container.querySelector('div');
		expect(wrapper).toHaveClass('custom-field-class');
	});

	it('passes through additional HTML attributes', () => {
		const { container } = render(FormField, {
			props: {
				'data-testid': 'custom-field',
				'aria-describedby': 'field-description'
			}
		});

		const wrapper = container.querySelector('div');
		expect(wrapper).toHaveAttribute('data-testid', 'custom-field');
		expect(wrapper).toHaveAttribute('aria-describedby', 'field-description');
	});

	it('generates unique IDs for accessibility', () => {
		const { container: container1 } = render(FormField, {
			props: { 
				label: 'Field 1',
				helperText: 'Helper 1'
			}
		});

		const { container: container2 } = render(FormField, {
			props: { 
				label: 'Field 2',
				helperText: 'Helper 2'
			}
		});

		const label1 = container1.querySelector('label');
		const label2 = container2.querySelector('label');
		const helper1 = container1.querySelector('p:not([role="alert"])');
		const helper2 = container2.querySelector('p:not([role="alert"])');

		// Labels should have different 'for' attributes
		expect(label1?.getAttribute('for')).not.toBe(label2?.getAttribute('for'));
		
		// Helper texts should have different IDs
		expect(helper1?.getAttribute('id')).not.toBe(helper2?.getAttribute('id'));
	});

	it('associates label with form control via for attribute', () => {
		const { container } = render(FormField, {
			props: { label: 'Test Field' }
		});

		const label = container.querySelector('label');
		const forAttribute = label?.getAttribute('for');
		
		expect(forAttribute).toBeTruthy();
		expect(forAttribute).toMatch(/^field-/);
	});

	it('associates helper text with form control via ID', () => {
		const { container } = render(FormField, {
			props: { 
				label: 'Test Field',
				helperText: 'Helper text'
			}
		});

		const label = container.querySelector('label');
		const helper = container.querySelector('p:not([role="alert"])');
		const fieldId = label?.getAttribute('for');
		const helperId = helper?.getAttribute('id');
		
		expect(helperId).toBe(`${fieldId}-helper`);
	});

	it('associates error message with form control via ID', () => {
		const { container } = render(FormField, {
			props: { 
				label: 'Test Field',
				error: 'Error message'
			}
		});

		const label = container.querySelector('label');
		const error = container.querySelector('p[role="alert"]');
		const fieldId = label?.getAttribute('for');
		const errorId = error?.getAttribute('id');
		
		expect(errorId).toBe(`${fieldId}-error`);
	});

	it('renders without label', () => {
		const { container } = render(FormField, {
			props: { 
				helperText: 'Just helper text'
			}
		});

		const label = container.querySelector('label');
		const helper = container.querySelector('p:not([role="alert"])');
		
		expect(label).not.toBeInTheDocument();
		expect(helper).toBeInTheDocument();
	});

	it('has proper structure with all elements', () => {
		const { container } = render(FormField, {
			props: { 
				label: 'Test Field',
				helperText: 'Helper text',
				required: true
			}
		});

		// Check structure
		const wrapper = container.querySelector('div');
		const label = wrapper?.querySelector('label');
		const contentDiv = wrapper?.querySelector('div.relative');
		const helper = wrapper?.querySelector('p:not([role="alert"])');
		
		expect(wrapper).toHaveClass('space-y-1');
		expect(label).toBeInTheDocument();
		expect(contentDiv).toBeInTheDocument();
		expect(helper).toBeInTheDocument();
	});

	it('maintains proper spacing classes', () => {
		const { container } = render(FormField, {
			props: { 
				label: 'Test Field',
				helperText: 'Helper text'
			}
		});

		const wrapper = container.querySelector('div');
		expect(wrapper).toHaveClass('space-y-1');
	});
});