<script lang="ts">
	// Skeleton loading component for SystemStatusWidget
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="animate-pulse">
		<div class="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
	</div>

	<!-- Metrics Grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		<!-- Active Workers Card -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<div class="animate-pulse">
				<div class="flex items-center justify-between">
					<div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="mt-4 h-8 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
			</div>
		</div>

		<!-- Total Jobs Today Card -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<div class="animate-pulse">
				<div class="flex items-center justify-between">
					<div class="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="mt-4 h-8 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
			</div>
		</div>

		<!-- System Uptime Card -->
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<div class="animate-pulse">
				<div class="flex items-center justify-between">
					<div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="mt-4 h-8 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
			</div>
		</div>
	</div>

	<!-- System Alerts Section -->
	<div class="animate-pulse">
		<div class="h-5 w-28 rounded bg-gray-200 dark:bg-gray-700 mb-4"></div>
		<div class="space-y-3">
			<div class="h-16 w-full rounded-lg bg-gray-200 dark:bg-gray-700"></div>
			<div class="h-16 w-full rounded-lg bg-gray-200 dark:bg-gray-700"></div>
		</div>
	</div>
</div>