<script lang="ts">
	import { onMount } from 'svelte';
	import { errors } from '$lib/stores';
	import Button from '$lib/components/atoms/Button.svelte';
	import Card from '$lib/components/atoms/Card.svelte';

	interface Props {
		fallback?: import('svelte').Snippet;
		onError?: (error: Error) => void;
		children: import('svelte').Snippet;
	}

	let { fallback, onError, children }: Props = $props();
	let hasError = $state(false);
	let errorMessage = $state('');
	let errorDetails = $state('');

	function handleError(error: Error) {
		hasError = true;
		errorMessage = error.message || 'An unexpected error occurred';
		errorDetails = error.stack || '';
		
		// Add to global error store
		errors.add({
			message: errorMessage,
			details: errorDetails,
			recoverable: true
		});

		// Call custom error handler if provided
		onError?.(error);
		
		console.error('ErrorBoundary caught error:', error);
	}

	function retry() {
		hasError = false;
		errorMessage = '';
		errorDetails = '';
	}

	// Set up global error handler
	onMount(() => {
		const handleUnhandledError = (event: ErrorEvent) => {
			handleError(new Error(event.message));
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			handleError(new Error(event.reason?.message || 'Unhandled promise rejection'));
		};

		window.addEventListener('error', handleUnhandledError);
		window.addEventListener('unhandledrejection', handleUnhandledRejection);

		return () => {
			window.removeEventListener('error', handleUnhandledError);
			window.removeEventListener('unhandledrejection', handleUnhandledRejection);
		};
	});
</script>

{#if hasError}
	{#if fallback}
		{@render fallback()}
	{:else}
		<div class="min-h-screen flex items-center justify-center p-4">
			<Card class="max-w-md w-full">
				<div class="text-center space-y-4">
					<div class="w-16 h-16 mx-auto bg-error-100 dark:bg-error-900/20 rounded-full flex items-center justify-center">
						<svg class="w-8 h-8 text-error-600 dark:text-error-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
						</svg>
					</div>
					
					<div>
						<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
							Something went wrong
						</h2>
						<p class="text-gray-600 dark:text-gray-400 text-sm">
							{errorMessage}
						</p>
					</div>

					{#if errorDetails}
						<details class="text-left">
							<summary class="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
								Show error details
							</summary>
							<pre class="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-auto max-h-32 text-gray-800 dark:text-gray-200">{errorDetails}</pre>
						</details>
					{/if}

					<div class="flex gap-3 justify-center">
						<Button variant="outline" onclick={retry}>
							Try Again
						</Button>
						<Button variant="primary" onclick={() => window.location.reload()}>
							Reload Page
						</Button>
					</div>
				</div>
			</Card>
		</div>
	{/if}
{:else}
	{@render children()}
{/if}