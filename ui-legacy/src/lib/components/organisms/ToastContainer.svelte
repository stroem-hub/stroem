<script lang="ts">
	import { toasts, type Toast } from '$lib/stores';
	import { fly } from 'svelte/transition';

	let toastList: Toast[] = $state([]);

	$effect(() => {
		toasts.subscribe(value => {
			toastList = value;
		});
	});

	function getToastIcon(type: Toast['type']) {
		switch (type) {
			case 'success':
				return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
				</svg>`;
			case 'error':
				return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>`;
			case 'warning':
				return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
				</svg>`;
			case 'info':
			default:
				return `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>`;
		}
	}

	function getToastClasses(type: Toast['type']) {
		const baseClasses = 'flex items-start p-4 rounded-lg shadow-lg border max-w-sm w-full';
		
		switch (type) {
			case 'success':
				return `${baseClasses} bg-success-50 dark:bg-success-900/20 border-success-200 dark:border-success-800 text-success-800 dark:text-success-200`;
			case 'error':
				return `${baseClasses} bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800 text-error-800 dark:text-error-200`;
			case 'warning':
				return `${baseClasses} bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800 text-warning-800 dark:text-warning-200`;
			case 'info':
			default:
				return `${baseClasses} bg-info-50 dark:bg-info-900/20 border-info-200 dark:border-info-800 text-info-800 dark:text-info-200`;
		}
	}
</script>

<div class="fixed top-4 right-4 z-toast space-y-2" role="region" aria-label="Notifications">
	{#each toastList as toast (toast.id)}
		<div
			class={getToastClasses(toast.type)}
			transition:fly={{ x: 300, duration: 300 }}
			role="alert"
			aria-live="polite"
		>
			<div class="flex-shrink-0 mr-3">
				{@html getToastIcon(toast.type)}
			</div>
			
			<div class="flex-1 min-w-0">
				<p class="font-medium text-sm">
					{toast.title}
				</p>
				{#if toast.message}
					<p class="text-sm opacity-90 mt-1">
						{toast.message}
					</p>
				{/if}
			</div>
			
			<button
				class="flex-shrink-0 ml-3 opacity-70 hover:opacity-100 transition-opacity"
				onclick={() => toasts.remove(toast.id)}
				aria-label="Close notification"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>
	{/each}
</div>