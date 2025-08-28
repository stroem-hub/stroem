<script lang="ts">
	interface Props {
		variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'primary';
		size?: 'sm' | 'md' | 'lg';
		class?: string;
		children: import('svelte').Snippet;
	}

	let { variant = 'default', size = 'md', class: className = '', children }: Props = $props();

	const variantClasses = {
		default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
		primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/20 dark:text-primary-300',
		success: 'bg-success-100 text-success-800 dark:bg-success-900/20 dark:text-success-300',
		error: 'bg-error-100 text-error-800 dark:bg-error-900/20 dark:text-error-300',
		warning: 'bg-warning-100 text-warning-800 dark:bg-warning-900/20 dark:text-warning-300',
		info: 'bg-info-100 text-info-800 dark:bg-info-900/20 dark:text-info-300'
	};

	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-sm',
		lg: 'px-3 py-1.5 text-base'
	};
</script>

<span class="inline-flex items-center font-medium rounded-full {variantClasses[variant]} {sizeClasses[size]} {className}">
	{@render children()}
</span>