<script lang="ts">
	import { isLoading } from '$lib/stores';

	interface Props {
		show?: boolean;
		message?: string;
	}

	let { show = false, message = 'Loading...' }: Props = $props();
	
	let globalLoading = $state(false);

	$effect(() => {
		isLoading.subscribe(value => {
			globalLoading = value;
		});
	});

	let shouldShow = $derived(show || globalLoading);
</script>

{#if shouldShow}
	<div 
		class="fixed inset-0 bg-black/50 backdrop-blur-sm z-modal flex items-center justify-center"
		role="dialog"
		aria-modal="true"
		aria-label="Loading"
	>
		<div class="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-sm w-full mx-4">
			<div class="flex items-center space-x-4">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
				<div>
					<p class="text-gray-900 dark:text-gray-100 font-medium">
						{message}
					</p>
					<p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
						Please wait...
					</p>
				</div>
			</div>
		</div>
	</div>
{/if}