<script lang="ts">
	import { Alert, Button } from '$lib/components';
	import { ExclamationTriangleIcon, ArrowPathIcon } from '$lib/components/icons';

	interface Props {
		error?: string | Error | null;
		title?: string;
		description?: string;
		showRetry?: boolean;
		onRetry?: () => void;
		variant?: 'error' | 'warning' | 'info';
		class?: string;
		children?: any;
	}

	let { 
		error = null,
		title = 'Something went wrong',
		description,
		showRetry = true,
		onRetry,
		variant = 'error',
		class: className = '',
		children
	}: Props = $props();

	// Extract error message from different error types
	function getErrorMessage(err: string | Error | null): string {
		if (!err) return 'An unknown error occurred';
		if (typeof err === 'string') return err;
		if (err instanceof Error) return err.message;
		return 'An unknown error occurred';
	}

	let errorMessage = $derived(getErrorMessage(error));
	let isRetrying = $state(false);

	async function handleRetry() {
		if (!onRetry) return;
		
		isRetrying = true;
		try {
			await onRetry();
		} catch (retryError) {
			console.error('Retry failed:', retryError);
		} finally {
			isRetrying = false;
		}
	}
</script>

{#if error}
	<Alert {variant} class={className}>
		{#snippet icon()}
			<ExclamationTriangleIcon class="w-5 h-5" />
		{/snippet}
		{#snippet children()}
			<div class="space-y-2">
				<div>
					<h3 class="font-medium">{title}</h3>
					<p class="text-sm mt-1">{errorMessage}</p>
					{#if description}
						<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
					{/if}
				</div>
				
				{#if showRetry && onRetry}
					<Button
						variant="outline"
						size="sm"
						onclick={handleRetry}
						disabled={isRetrying}
						class="mt-3"
					>
						{#snippet children()}
							{#if isRetrying}
								<ArrowPathIcon class="w-4 h-4 mr-2 animate-spin" />
								Retrying...
							{:else}
								<ArrowPathIcon class="w-4 h-4 mr-2" />
								Try Again
							{/if}
						{/snippet}
					</Button>
				{/if}
			</div>
		{/snippet}
	</Alert>
{:else if children}
	{@render children()}
{/if}