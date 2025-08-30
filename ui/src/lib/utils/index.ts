// Utility functions

/**
 * Debounce function to limit the rate at which a function can fire
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns A debounced version of the function
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout>;
	
	return function executedFunction(...args: Parameters<T>) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

/**
 * Throttle function to limit the rate at which a function can fire
 * @param func The function to throttle
 * @param limit The number of milliseconds to limit
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	
	return function executedFunction(...args: Parameters<T>) {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => inThrottle = false, limit);
		}
	};
}

/**
 * Format a timestamp to a human-readable relative time
 * @param timestamp ISO timestamp string
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp: string): string {
	const date = new Date(timestamp);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);
	
	if (diffSeconds < 60) {
		return 'just now';
	} else if (diffMinutes < 60) {
		return `${diffMinutes}m ago`;
	} else if (diffHours < 24) {
		return `${diffHours}h ago`;
	} else if (diffDays < 7) {
		return `${diffDays}d ago`;
	} else {
		return date.toLocaleDateString();
	}
}

/**
 * Format duration in seconds to human-readable string
 * @param seconds Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
	if (seconds < 60) {
		return `${Math.round(seconds)}s`;
	} else if (seconds < 3600) {
		return `${Math.round(seconds / 60)}m`;
	} else {
		return `${Math.round(seconds / 3600)}h`;
	}
}

/**
 * Clamp a number between min and max values
 * @param value The value to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped value
 */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Generate a random ID string
 * @param length Length of the ID (default: 8)
 * @returns Random ID string
 */
export function generateId(length: number = 8): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

/**
 * Build a clean URL with only non-default parameters
 * @param baseUrl Base URL path
 * @param params Parameters to include
 * @param defaults Default parameter values
 * @returns Clean URL string
 */
export function buildCleanUrl(
	baseUrl: string,
	params: Record<string, any>,
	defaults: Record<string, any>
): string {
	const url = new URL(baseUrl, window.location.origin);
	
	Object.entries(params).forEach(([key, value]) => {
		const defaultValue = defaults[key];
		
		// Only add parameter if it's different from default and not empty
		if (value !== defaultValue && value !== '' && value !== null && value !== undefined) {
			url.searchParams.set(key, value.toString());
		}
	});
	
	return url.pathname + url.search;
}

/**
 * Parse and validate URL search parameters
 * @param searchParams URLSearchParams object
 * @param schema Validation schema with defaults and valid values
 * @returns Validated parameters object
 */
export function parseUrlParams<T extends Record<string, any>>(
	searchParams: URLSearchParams,
	schema: {
		[K in keyof T]: {
			default: T[K];
			parse?: (value: string) => T[K];
			validate?: (value: T[K]) => boolean;
		};
	}
): T {
	const result = {} as T;
	
	Object.entries(schema).forEach(([key, config]) => {
		const rawValue = searchParams.get(key);
		let parsedValue = config.default;
		
		if (rawValue !== null) {
			try {
				parsedValue = config.parse ? config.parse(rawValue) : rawValue as T[keyof T];
				
				// Validate the parsed value
				if (config.validate && !config.validate(parsedValue)) {
					parsedValue = config.default;
				}
			} catch {
				parsedValue = config.default;
			}
		}
		
		result[key as keyof T] = parsedValue;
	});
	
	return result;
}

/**
 * Create a shareable URL for the current page state
 * @param baseUrl Base URL path
 * @param params Current parameters
 * @param defaults Default parameter values
 * @returns Shareable URL string
 */
export function createShareableUrl(
	baseUrl: string,
	params: Record<string, any>,
	defaults: Record<string, any>
): string {
	return buildCleanUrl(baseUrl, params, defaults);
}