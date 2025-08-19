// Form validation utilities

export interface ValidationRule {
	validate: (value: any) => boolean;
	message: string;
}

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

// Common validation rules
export const validationRules = {
	required: (message = 'This field is required'): ValidationRule => ({
		validate: (value: any) => {
			if (typeof value === 'string') {
				return value.trim().length > 0;
			}
			return value !== null && value !== undefined && value !== '';
		},
		message
	}),

	minLength: (min: number, message?: string): ValidationRule => ({
		validate: (value: string) => {
			if (!value || value.trim() === '') return true; // Allow empty values (use required rule separately)
			return value.length >= min;
		},
		message: message || `Must be at least ${min} characters`
	}),

	maxLength: (max: number, message?: string): ValidationRule => ({
		validate: (value: string) => !value || value.length <= max,
		message: message || `Must be no more than ${max} characters`
	}),

	email: (message = 'Please enter a valid email address'): ValidationRule => ({
		validate: (value: string) => {
			if (!value) return true; // Allow empty values (use required rule separately)
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			return emailRegex.test(value);
		},
		message
	}),

	pattern: (regex: RegExp, message: string): ValidationRule => ({
		validate: (value: string) => !value || regex.test(value),
		message
	}),

	min: (min: number, message?: string): ValidationRule => ({
		validate: (value: number) => value === null || value === undefined || value >= min,
		message: message || `Must be at least ${min}`
	}),

	max: (max: number, message?: string): ValidationRule => ({
		validate: (value: number) => value === null || value === undefined || value <= max,
		message: message || `Must be no more than ${max}`
	}),

	url: (message = 'Please enter a valid URL'): ValidationRule => ({
		validate: (value: string) => {
			if (!value) return true;
			try {
				new URL(value);
				return true;
			} catch {
				return false;
			}
		},
		message
	}),

	phone: (message = 'Please enter a valid phone number'): ValidationRule => ({
		validate: (value: string) => {
			if (!value) return true;
			const phoneRegex = /^[\+]?[1-9][\d]{3,15}$/;
			return phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''));
		},
		message
	}),

	custom: (validator: (value: any) => boolean, message: string): ValidationRule => ({
		validate: validator,
		message
	})
};

// Validate a single field against multiple rules
export function validateField(value: any, rules: ValidationRule[]): ValidationResult {
	const errors: string[] = [];

	for (const rule of rules) {
		if (!rule.validate(value)) {
			errors.push(rule.message);
		}
	}

	return {
		isValid: errors.length === 0,
		errors
	};
}

// Validate multiple fields
export function validateForm(
	values: Record<string, any>,
	rules: Record<string, ValidationRule[]>
): Record<string, ValidationResult> {
	const results: Record<string, ValidationResult> = {};

	for (const [fieldName, fieldRules] of Object.entries(rules)) {
		const fieldValue = values[fieldName];
		results[fieldName] = validateField(fieldValue, fieldRules);
	}

	return results;
}

// Check if entire form is valid
export function isFormValid(validationResults: Record<string, ValidationResult>): boolean {
	return Object.values(validationResults).every(result => result.isValid);
}

// Get first error for each field
export function getFieldErrors(validationResults: Record<string, ValidationResult>): Record<string, string | undefined> {
	const errors: Record<string, string | undefined> = {};

	for (const [fieldName, result] of Object.entries(validationResults)) {
		errors[fieldName] = result.errors[0];
	}

	return errors;
}

// Form state management helper
export class FormValidator {
	private rules: Record<string, ValidationRule[]> = {};
	private values: Record<string, any> = {};
	private touched: Record<string, boolean> = {};

	constructor(initialValues: Record<string, any> = {}) {
		this.values = { ...initialValues };
	}

	// Set validation rules for a field
	setRules(fieldName: string, rules: ValidationRule[]): void {
		this.rules[fieldName] = rules;
	}

	// Update field value
	setValue(fieldName: string, value: any): void {
		this.values[fieldName] = value;
		this.touched[fieldName] = true;
	}

	// Get field value
	getValue(fieldName: string): any {
		return this.values[fieldName];
	}

	// Mark field as touched
	setTouched(fieldName: string, touched = true): void {
		this.touched[fieldName] = touched;
	}

	// Check if field is touched
	isTouched(fieldName: string): boolean {
		return this.touched[fieldName] || false;
	}

	// Validate a specific field
	validateField(fieldName: string): ValidationResult {
		const fieldRules = this.rules[fieldName] || [];
		const fieldValue = this.values[fieldName];
		return validateField(fieldValue, fieldRules);
	}

	// Validate all fields
	validateAll(): Record<string, ValidationResult> {
		return validateForm(this.values, this.rules);
	}

	// Get validation errors for touched fields only
	getTouchedErrors(): Record<string, string | undefined> {
		const errors: Record<string, string | undefined> = {};

		for (const fieldName of Object.keys(this.rules)) {
			if (this.touched[fieldName]) {
				const result = this.validateField(fieldName);
				errors[fieldName] = result.errors[0];
			}
		}

		return errors;
	}

	// Check if form is valid
	isValid(): boolean {
		const results = this.validateAll();
		return isFormValid(results);
	}

	// Reset form
	reset(newValues: Record<string, any> = {}): void {
		this.values = { ...newValues };
		this.touched = {};
	}

	// Get all values
	getValues(): Record<string, any> {
		return { ...this.values };
	}
}