import { describe, it, expect } from 'vitest';
import {
	validationRules,
	validateField,
	validateForm,
	isFormValid,
	getFieldErrors,
	FormValidator
} from './validation';

describe('validationRules', () => {
	describe('required', () => {
		const rule = validationRules.required();

		it('validates non-empty strings', () => {
			expect(rule.validate('test')).toBe(true);
			expect(rule.validate('  test  ')).toBe(true);
		});

		it('rejects empty strings', () => {
			expect(rule.validate('')).toBe(false);
			expect(rule.validate('   ')).toBe(false);
		});

		it('rejects null and undefined', () => {
			expect(rule.validate(null)).toBe(false);
			expect(rule.validate(undefined)).toBe(false);
		});

		it('validates non-string values', () => {
			expect(rule.validate(0)).toBe(true);
			expect(rule.validate(false)).toBe(true);
			expect(rule.validate([])).toBe(true);
		});

		it('uses custom message', () => {
			const customRule = validationRules.required('Custom required message');
			expect(customRule.message).toBe('Custom required message');
		});
	});

	describe('minLength', () => {
		const rule = validationRules.minLength(5);

		it('validates strings meeting minimum length', () => {
			expect(rule.validate('12345')).toBe(true);
			expect(rule.validate('123456')).toBe(true);
		});

		it('rejects strings below minimum length', () => {
			expect(rule.validate('1234')).toBe(false);
		});

		it('allows empty strings (use required separately)', () => {
			expect(rule.validate('')).toBe(true);
		});
	});

	describe('maxLength', () => {
		const rule = validationRules.maxLength(5);

		it('validates strings within maximum length', () => {
			expect(rule.validate('12345')).toBe(true);
			expect(rule.validate('1234')).toBe(true);
		});

		it('rejects strings exceeding maximum length', () => {
			expect(rule.validate('123456')).toBe(false);
		});
	});

	describe('email', () => {
		const rule = validationRules.email();

		it('validates correct email formats', () => {
			expect(rule.validate('test@example.com')).toBe(true);
			expect(rule.validate('user.name@domain.co.uk')).toBe(true);
			expect(rule.validate('test+tag@example.org')).toBe(true);
		});

		it('rejects invalid email formats', () => {
			expect(rule.validate('invalid-email')).toBe(false);
			expect(rule.validate('test@')).toBe(false);
			expect(rule.validate('@example.com')).toBe(false);
			expect(rule.validate('test@.com')).toBe(false);
		});

		it('allows empty strings', () => {
			expect(rule.validate('')).toBe(true);
		});
	});

	describe('pattern', () => {
		const rule = validationRules.pattern(/^\d{3}-\d{3}-\d{4}$/, 'Invalid phone format');

		it('validates strings matching pattern', () => {
			expect(rule.validate('123-456-7890')).toBe(true);
		});

		it('rejects strings not matching pattern', () => {
			expect(rule.validate('1234567890')).toBe(false);
			expect(rule.validate('123-45-6789')).toBe(false);
		});

		it('allows empty strings', () => {
			expect(rule.validate('')).toBe(true);
		});
	});

	describe('min', () => {
		const rule = validationRules.min(18);

		it('validates numbers meeting minimum', () => {
			expect(rule.validate(18)).toBe(true);
			expect(rule.validate(25)).toBe(true);
		});

		it('rejects numbers below minimum', () => {
			expect(rule.validate(17)).toBe(false);
		});

		it('allows null and undefined', () => {
			expect(rule.validate(null)).toBe(true);
			expect(rule.validate(undefined)).toBe(true);
		});
	});

	describe('max', () => {
		const rule = validationRules.max(100);

		it('validates numbers within maximum', () => {
			expect(rule.validate(100)).toBe(true);
			expect(rule.validate(50)).toBe(true);
		});

		it('rejects numbers exceeding maximum', () => {
			expect(rule.validate(101)).toBe(false);
		});
	});

	describe('url', () => {
		const rule = validationRules.url();

		it('validates correct URL formats', () => {
			expect(rule.validate('https://example.com')).toBe(true);
			expect(rule.validate('http://test.org/path')).toBe(true);
			expect(rule.validate('ftp://files.example.com')).toBe(true);
		});

		it('rejects invalid URL formats', () => {
			expect(rule.validate('not-a-url')).toBe(false);
			expect(rule.validate('http://')).toBe(false);
		});

		it('allows empty strings', () => {
			expect(rule.validate('')).toBe(true);
		});
	});

	describe('phone', () => {
		const rule = validationRules.phone();

		it('validates phone number formats', () => {
			expect(rule.validate('1234567890')).toBe(true);
			expect(rule.validate('+1234567890')).toBe(true);
			expect(rule.validate('123-456-7890')).toBe(true);
			expect(rule.validate('(123) 456-7890')).toBe(true);
		});

		it('rejects invalid phone formats', () => {
			expect(rule.validate('abc')).toBe(false);
			expect(rule.validate('123')).toBe(false);
		});

		it('allows empty strings', () => {
			expect(rule.validate('')).toBe(true);
		});
	});

	describe('custom', () => {
		const rule = validationRules.custom(
			(value) => value === 'valid',
			'Value must be "valid"'
		);

		it('uses custom validator function', () => {
			expect(rule.validate('valid')).toBe(true);
			expect(rule.validate('invalid')).toBe(false);
		});

		it('uses custom message', () => {
			expect(rule.message).toBe('Value must be "valid"');
		});
	});
});

describe('validateField', () => {
	it('validates field with single rule', () => {
		const rules = [validationRules.required()];
		const result = validateField('test', rules);

		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('validates field with multiple rules', () => {
		const rules = [
			validationRules.required(),
			validationRules.minLength(3),
			validationRules.maxLength(10)
		];
		const result = validateField('test', rules);

		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('returns errors for invalid field', () => {
		const rules = [
			validationRules.required(),
			validationRules.minLength(5)
		];
		const result = validateField('abc', rules); // Short string that fails minLength

		expect(result.isValid).toBe(false);
		expect(result.errors).toHaveLength(1);
		expect(result.errors).toContain('Must be at least 5 characters');
	});
});

describe('validateForm', () => {
	const formRules = {
		email: [validationRules.required(), validationRules.email()],
		password: [validationRules.required(), validationRules.minLength(8)]
	};

	it('validates valid form', () => {
		const values = {
			email: 'test@example.com',
			password: 'password123'
		};
		const results = validateForm(values, formRules);

		expect(results.email.isValid).toBe(true);
		expect(results.password.isValid).toBe(true);
	});

	it('validates invalid form', () => {
		const values = {
			email: 'invalid-email',
			password: '123'
		};
		const results = validateForm(values, formRules);

		expect(results.email.isValid).toBe(false);
		expect(results.password.isValid).toBe(false);
		expect(results.email.errors).toContain('Please enter a valid email address');
		expect(results.password.errors).toContain('Must be at least 8 characters');
	});
});

describe('isFormValid', () => {
	it('returns true for valid form results', () => {
		const results = {
			field1: { isValid: true, errors: [] },
			field2: { isValid: true, errors: [] }
		};
		expect(isFormValid(results)).toBe(true);
	});

	it('returns false for invalid form results', () => {
		const results = {
			field1: { isValid: true, errors: [] },
			field2: { isValid: false, errors: ['Error'] }
		};
		expect(isFormValid(results)).toBe(false);
	});
});

describe('getFieldErrors', () => {
	it('extracts first error from each field', () => {
		const results = {
			field1: { isValid: true, errors: [] },
			field2: { isValid: false, errors: ['First error', 'Second error'] },
			field3: { isValid: false, errors: ['Another error'] }
		};
		const errors = getFieldErrors(results);

		expect(errors.field1).toBeUndefined();
		expect(errors.field2).toBe('First error');
		expect(errors.field3).toBe('Another error');
	});
});

describe('FormValidator', () => {
	let validator: FormValidator;

	beforeEach(() => {
		validator = new FormValidator({ email: '', password: '' });
	});

	it('initializes with values', () => {
		expect(validator.getValue('email')).toBe('');
		expect(validator.getValue('password')).toBe('');
	});

	it('sets and gets values', () => {
		validator.setValue('email', 'test@example.com');
		expect(validator.getValue('email')).toBe('test@example.com');
	});

	it('tracks touched state', () => {
		expect(validator.isTouched('email')).toBe(false);
		validator.setTouched('email');
		expect(validator.isTouched('email')).toBe(true);
	});

	it('sets touched when setting value', () => {
		validator.setValue('email', 'test@example.com');
		expect(validator.isTouched('email')).toBe(true);
	});

	it('sets and validates rules', () => {
		validator.setRules('email', [validationRules.required(), validationRules.email()]);
		validator.setValue('email', 'invalid-email');

		const result = validator.validateField('email');
		expect(result.isValid).toBe(false);
		expect(result.errors).toContain('Please enter a valid email address');
	});

	it('validates all fields', () => {
		validator.setRules('email', [validationRules.required(), validationRules.email()]);
		validator.setRules('password', [validationRules.required(), validationRules.minLength(8)]);
		validator.setValue('email', 'test@example.com');
		validator.setValue('password', 'password123');

		const results = validator.validateAll();
		expect(results.email.isValid).toBe(true);
		expect(results.password.isValid).toBe(true);
	});

	it('returns errors for touched fields only', () => {
		validator.setRules('email', [validationRules.required()]);
		validator.setRules('password', [validationRules.required()]);
		validator.setValue('email', ''); // This marks email as touched
		// password is not touched

		const errors = validator.getTouchedErrors();
		expect(errors.email).toBe('This field is required');
		expect(errors.password).toBeUndefined();
	});

	it('checks if form is valid', () => {
		validator.setRules('email', [validationRules.required(), validationRules.email()]);
		validator.setValue('email', 'test@example.com');

		expect(validator.isValid()).toBe(true);

		validator.setValue('email', 'invalid-email');
		expect(validator.isValid()).toBe(false);
	});

	it('resets form', () => {
		validator.setValue('email', 'test@example.com');
		validator.setTouched('email');

		validator.reset({ email: 'new@example.com', password: 'newpass' });

		expect(validator.getValue('email')).toBe('new@example.com');
		expect(validator.getValue('password')).toBe('newpass');
		expect(validator.isTouched('email')).toBe(false);
	});

	it('gets all values', () => {
		validator.setValue('email', 'test@example.com');
		validator.setValue('password', 'password123');

		const values = validator.getValues();
		expect(values).toEqual({
			email: 'test@example.com',
			password: 'password123'
		});
	});
});