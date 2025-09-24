<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<div class="space-y-6 animate-pulse {className}">
	<!-- Input Parameters Section -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="h-6 w-40 rounded bg-gray-200 dark:bg-gray-700 mb-4"></div>
		<div class="space-y-4">
			{#each Array(3) as _}
				<div class="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
					<div class="flex items-start justify-between mb-2">
						<div class="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
						<div class="h-4 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
					</div>
					<div class="h-4 w-full rounded bg-gray-200 dark:bg-gray-700 mb-2"></div>
					<div class="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
			{/each}
		</div>
	</div>

	<!-- Flow Steps Section -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 mb-4"></div>
		<div class="space-y-4">
			{#each Array(2) as _}
				<div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
					<div class="flex items-center justify-between mb-3">
						<div class="h-5 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
						<div class="h-4 w-4 rounded bg-gray-200 dark:bg-gray-700"></div>
					</div>
					<div class="space-y-2">
						<div class="h-4 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
						<div class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700"></div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>