<script lang="ts">
	// Skeleton loader for RecentActivityWidget
</script>

<div class="space-y-6 animate-pulse" role="status" aria-label="Loading recent activity">
	<!-- Header Skeleton -->
	<div>
		<div class="h-7 bg-gray-200 rounded dark:bg-gray-700 w-48 mb-2"></div>
		<div class="h-4 bg-gray-200 rounded dark:bg-gray-700 w-80"></div>
	</div>

	<!-- System Alerts Section Skeleton -->
	<div>
		<div class="flex items-center mb-4">
			<div class="h-6 bg-gray-200 rounded dark:bg-gray-700 w-32"></div>
			<div class="ml-2 h-5 w-8 bg-red-100 rounded-full dark:bg-red-900/20"></div>
		</div>
		<div class="space-y-3 mb-6">
			{#each Array(2) as _}
				<div class="rounded-lg border border-gray-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
					<div class="flex items-start space-x-3">
						<div class="flex-shrink-0">
							<div class="h-5 w-5 bg-red-200 rounded dark:bg-red-800"></div>
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center justify-between mb-2">
								<div class="h-4 bg-red-200 rounded dark:bg-red-800 w-64"></div>
								<div class="h-3 bg-red-200 rounded dark:bg-red-800 w-16"></div>
							</div>
							<div class="h-3 bg-red-200 rounded dark:bg-red-800 w-32"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Recent Jobs Section Skeleton -->
	<div>
		<div class="flex items-center mb-4">
			<div class="h-6 bg-gray-200 rounded dark:bg-gray-700 w-48"></div>
			<div class="ml-2 h-5 w-6 bg-blue-100 rounded-full dark:bg-blue-900/20"></div>
		</div>
		<div class="space-y-3 mb-6">
			{#each Array(5) as _}
				<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
					<div class="flex items-start justify-between">
						<div class="flex items-start space-x-3 flex-1 min-w-0">
							<div class="flex-shrink-0">
								<div class="h-8 w-8 bg-gray-200 rounded-md dark:bg-gray-700"></div>
							</div>
							<div class="flex-1 min-w-0">
								<div class="flex items-center space-x-2 mb-2">
									<div class="h-4 bg-gray-200 rounded dark:bg-gray-700 w-32"></div>
									<div class="h-5 w-16 bg-gray-200 rounded-full dark:bg-gray-700"></div>
								</div>
								<div class="flex items-center space-x-4">
									<div class="h-3 bg-gray-200 rounded dark:bg-gray-700 w-20"></div>
									<div class="h-3 bg-gray-200 rounded dark:bg-gray-700 w-24"></div>
									<div class="h-3 bg-gray-200 rounded dark:bg-gray-700 w-28"></div>
								</div>
							</div>
						</div>
						<div class="flex-shrink-0">
							<div class="h-3 bg-gray-200 rounded dark:bg-gray-700 w-16"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Upcoming Jobs Section Skeleton -->
	<div>
		<div class="flex items-center mb-4">
			<div class="h-6 bg-gray-200 rounded dark:bg-gray-700 w-52"></div>
			<div class="ml-2 h-5 w-6 bg-green-100 rounded-full dark:bg-green-900/20"></div>
		</div>
		<div class="space-y-3">
			{#each Array(3) as _}
				<div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
					<div class="flex items-start justify-between">
						<div class="flex items-start space-x-3 flex-1 min-w-0">
							<div class="flex-shrink-0">
								<div class="h-8 w-8 bg-green-100 rounded-md dark:bg-green-900/20"></div>
							</div>
							<div class="flex-1 min-w-0">
								<div class="h-4 bg-gray-200 rounded dark:bg-gray-700 w-36 mb-2"></div>
								<div class="flex items-center space-x-4">
									<div class="h-3 bg-gray-200 rounded dark:bg-gray-700 w-20"></div>
									<div class="h-3 bg-gray-200 rounded dark:bg-gray-700 w-28"></div>
								</div>
							</div>
						</div>
						<div class="flex-shrink-0">
							<div class="h-3 bg-green-200 rounded dark:bg-green-800 w-12"></div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<span class="sr-only">Loading recent activity...</span>
</div>