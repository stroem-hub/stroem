<script lang="ts">
	interface Props {
		class?: string;
	}

	let { class: className = '' }: Props = $props();
</script>

<div class="space-y-4 animate-pulse {className}">
	<!-- Statistics cards grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each Array(3) as _}
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="flex items-center justify-between">
					<div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				<div class="mt-4">
					<div class="h-8 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
					<div class="mt-2 h-3 w-40 rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
			</div>
		{/each}
	</div>

	<!-- Last execution skeleton -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700 mb-4"></div>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each Array(4) as _}
				<div class="flex items-center space-x-3">
					<div class="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
					<div class="flex-1">
						<div class="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 mb-1"></div>
						<div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>