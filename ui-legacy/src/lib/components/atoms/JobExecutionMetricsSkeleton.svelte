<!-- JobExecutionMetrics Widget Skeleton Loading State -->
<div class="space-y-6" role="region" aria-label="Loading job execution metrics">
	<!-- Header Skeleton -->
	<div>
		<div class="h-7 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
		<div class="mt-1 h-4 w-80 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
	</div>

	<!-- Today's Statistics Grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each Array(4) as _, i}
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="flex items-center justify-between">
					<div class="h-4 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-8 w-8 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="mt-4">
					<div class="h-8 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="mt-1 h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Status Distribution Section -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="h-5 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700 mb-4"></div>
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{#each Array(4) as _, i}
				<div class="text-center">
					<div class="h-4 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700 mx-auto"></div>
					<div class="mt-2 h-6 w-8 animate-pulse rounded bg-gray-200 dark:bg-gray-700 mx-auto"></div>
					<div class="mt-1 h-3 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-700 mx-auto"></div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Top Failing Workflows Section -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="h-5 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-700 mb-4"></div>
		<div class="space-y-3">
			{#each Array(3) as _, i}
				<div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
					<div class="flex-1">
						<div class="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
						<div class="mt-1 h-3 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
					</div>
					<div class="h-4 w-12 animate-pulse rounded bg-gray-200 dark:bg-gray-600"></div>
				</div>
			{/each}
		</div>
	</div>
</div>