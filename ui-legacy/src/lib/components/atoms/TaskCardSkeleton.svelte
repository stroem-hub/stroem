<script lang="ts">
	import { Card } from '$lib/components';

	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<Card 
	variant="elevated" 
	padding="md"
	class="animate-pulse {className}"
>
	{#snippet children()}
		<div class="space-y-4">
			<!-- Header with title and status -->
			<div class="flex items-start justify-between gap-3">
				<div class="flex-1 min-w-0">
					<div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
					<div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
					<div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mt-1"></div>
				</div>
				<div class="flex-shrink-0">
					<div class="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
				</div>
			</div>

			<!-- Statistics row -->
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
				<!-- Total executions -->
				<div class="flex flex-col">
					<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-1"></div>
					<div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
				</div>

				<!-- Success rate -->
				<div class="flex flex-col">
					<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-1"></div>
					<div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
				</div>

				<!-- Average duration -->
				<div class="flex flex-col col-span-2 sm:col-span-1">
					<div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1"></div>
					<div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
				</div>
			</div>

			<!-- Last execution info -->
			<div class="pt-3 border-t border-gray-200 dark:border-gray-700">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<div class="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
						<div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
						<div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
					</div>
				</div>
			</div>
		</div>
	{/snippet}
</Card>