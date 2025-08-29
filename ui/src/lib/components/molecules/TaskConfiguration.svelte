<script lang="ts">
	import { ChevronDownIcon, ChevronRightIcon, InfoCircleIcon, ExclamationCircleIcon } from '$lib/components/icons';

	interface InputField {
		type: string;
		default?: string | number | boolean | null;
		required?: boolean;
		description?: string;
		order?: number;
		name?: string;
		id: string;
	}

	interface FlowStep {
		action: string;
		input?: Record<string, any>;
		depends_on?: string[];
		continue_on_fail?: boolean;
		on_error?: string;
	}

	interface Task {
		id: string;
		name?: string;
		description?: string;
		input?: Record<string, InputField>;
		flow: Record<string, FlowStep>;
	}

	interface TaskConfigurationProps {
		task: Task;
		loading?: boolean;
	}

	let { task, loading = false }: TaskConfigurationProps = $props();

	// State for expandable sections
	let expandedSections = $state<Record<string, boolean>>({
		parameters: true,
		flow: false
	});

	let expandedSteps = $state<Record<string, boolean>>({});

	function toggleSection(section: string) {
		expandedSections[section] = !expandedSections[section];
	}

	function toggleStep(stepId: string) {
		expandedSteps[stepId] = !expandedSteps[stepId];
	}

	// Helper function to get sorted inputs
	function getSortedInputs(input?: Record<string, InputField>): InputField[] {
		if (!input) return [];
		
		const entries = Object.entries(input).map(([id, field]) => ({
			...field,
			id
		}));
		
		entries.sort((a, b) => {
			const orderA = a.order ?? Infinity;
			const orderB = b.order ?? Infinity;
			return orderA - orderB;
		});
		
		return entries;
	}

	// Helper function to format default value
	function formatDefaultValue(value: any, type: string): string {
		if (value === null || value === undefined) return 'None';
		
		switch (type) {
			case 'string':
				return `"${value}"`;
			case 'boolean':
				return value ? 'true' : 'false';
			case 'number':
			case 'int':
			case 'uint':
				return value.toString();
			default:
				return JSON.stringify(value);
		}
	}

	// Helper function to get type badge color
	function getTypeBadgeColor(type: string): string {
		switch (type) {
			case 'string':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
			case 'number':
			case 'int':
			case 'uint':
				return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
			case 'boolean':
				return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
		}
	}

	let sortedInputs = $derived(getSortedInputs(task.input));
	let flowSteps = $derived(Object.entries(task.flow || {}));
</script>

<div class="space-y-6">
	{#if loading}
		<!-- Loading skeleton -->
		<div class="animate-pulse space-y-6">
			{#each Array(2) as _}
				<div class="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
					<div class="mb-4 flex items-center space-x-2">
						<div class="h-5 w-5 rounded bg-gray-200 dark:bg-gray-700"></div>
						<div class="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
					</div>
					<div class="space-y-3">
						{#each Array(3) as _}
							<div class="h-16 rounded bg-gray-100 dark:bg-gray-900"></div>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<!-- Input Parameters Section -->
		<div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<button
				class="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
				onclick={() => toggleSection('parameters')}
			>
				<div class="flex items-center space-x-3">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/20">
						<InfoCircleIcon class="h-4 w-4 text-blue-600 dark:text-blue-400" />
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
							Input Parameters
						</h3>
						<p class="text-sm text-gray-600 dark:text-gray-400">
							{sortedInputs.length} parameter{sortedInputs.length !== 1 ? 's' : ''} defined
						</p>
					</div>
				</div>
				<div class="flex items-center space-x-2">
					{#if expandedSections.parameters}
						<ChevronDownIcon class="h-5 w-5 text-gray-400" />
					{:else}
						<ChevronRightIcon class="h-5 w-5 text-gray-400" />
					{/if}
				</div>
			</button>

			{#if expandedSections.parameters}
				<div class="border-t border-gray-200 p-6 dark:border-gray-700">
					{#if sortedInputs.length === 0}
						<div class="text-center py-8">
							<InfoCircleIcon class="mx-auto h-12 w-12 text-gray-400" />
							<h4 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No Parameters</h4>
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
								This task doesn't require any input parameters.
							</p>
						</div>
					{:else}
						<div class="space-y-4">
							{#each sortedInputs as field}
								<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
									<div class="flex items-start justify-between">
										<div class="flex-1">
											<div class="flex items-center space-x-3">
												<h4 class="font-medium text-gray-900 dark:text-white">
													{field.name || field.id}
												</h4>
												<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {getTypeBadgeColor(field.type)}">
													{field.type}
												</span>
												{#if field.required}
													<span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/20 dark:text-red-400">
														Required
													</span>
												{/if}
											</div>
											
											{#if field.description}
												<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
													{field.description}
												</p>
											{/if}

											<div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
												<div>
													<span class="text-xs font-medium text-gray-500 dark:text-gray-400">Default Value:</span>
													<code class="ml-2 rounded bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200">
														{formatDefaultValue(field.default, field.type)}
													</code>
												</div>
												{#if field.order !== undefined}
													<div>
														<span class="text-xs font-medium text-gray-500 dark:text-gray-400">Order:</span>
														<span class="ml-2 text-xs text-gray-700 dark:text-gray-300">
															{field.order}
														</span>
													</div>
												{/if}
											</div>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Flow Steps Section -->
		<div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<button
				class="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
				onclick={() => toggleSection('flow')}
			>
				<div class="flex items-center space-x-3">
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-green-50 dark:bg-green-900/20">
						<svg class="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
							Flow Steps
						</h3>
						<p class="text-sm text-gray-600 dark:text-gray-400">
							{flowSteps.length} step{flowSteps.length !== 1 ? 's' : ''} defined
						</p>
					</div>
				</div>
				<div class="flex items-center space-x-2">
					{#if expandedSections.flow}
						<ChevronDownIcon class="h-5 w-5 text-gray-400" />
					{:else}
						<ChevronRightIcon class="h-5 w-5 text-gray-400" />
					{/if}
				</div>
			</button>

			{#if expandedSections.flow}
				<div class="border-t border-gray-200 p-6 dark:border-gray-700">
					{#if flowSteps.length === 0}
						<div class="text-center py-8">
							<ExclamationCircleIcon class="mx-auto h-12 w-12 text-gray-400" />
							<h4 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">No Flow Steps</h4>
							<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
								This task doesn't have any flow steps defined.
							</p>
						</div>
					{:else}
						<div class="space-y-4">
							{#each flowSteps as [stepId, step], index}
								<div class="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
									<button
										class="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
										onclick={() => toggleStep(stepId)}
									>
										<div class="flex items-center space-x-3">
											<div class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
												{index + 1}
											</div>
											<div>
												<h4 class="font-medium text-gray-900 dark:text-white">
													{stepId}
												</h4>
												<p class="text-sm text-gray-600 dark:text-gray-400">
													Action: {step.action}
												</p>
											</div>
										</div>
										<div class="flex items-center space-x-2">
											{#if step.depends_on && step.depends_on.length > 0}
												<span class="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
													{step.depends_on.length} dep{step.depends_on.length !== 1 ? 's' : ''}
												</span>
											{/if}
											{#if expandedSteps[stepId]}
												<ChevronDownIcon class="h-4 w-4 text-gray-400" />
											{:else}
												<ChevronRightIcon class="h-4 w-4 text-gray-400" />
											{/if}
										</div>
									</button>

									{#if expandedSteps[stepId]}
										<div class="border-t border-gray-200 p-4 dark:border-gray-700">
											<div class="space-y-4">
												<!-- Action -->
												<div>
													<h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">Action</h5>
													<code class="mt-1 block rounded bg-gray-200 px-3 py-2 text-sm text-gray-800 dark:bg-gray-700 dark:text-gray-200">
														{step.action}
													</code>
												</div>

												<!-- Dependencies -->
												{#if step.depends_on && step.depends_on.length > 0}
													<div>
														<h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">Dependencies</h5>
														<div class="mt-1 flex flex-wrap gap-2">
															{#each step.depends_on as dep}
																<span class="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
																	{dep}
																</span>
															{/each}
														</div>
													</div>
												{/if}

												<!-- Input -->
												{#if step.input && Object.keys(step.input).length > 0}
													<div>
														<h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">Input</h5>
														<pre class="mt-1 overflow-x-auto rounded bg-gray-200 p-3 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200">{JSON.stringify(step.input, null, 2)}</pre>
													</div>
												{/if}

												<!-- Error Handling -->
												{#if step.continue_on_fail || step.on_error}
													<div>
														<h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">Error Handling</h5>
														<div class="mt-1 space-y-1">
															{#if step.continue_on_fail}
																<div class="flex items-center space-x-2">
																	<span class="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
																		Continue on Fail
																	</span>
																</div>
															{/if}
															{#if step.on_error}
																<div class="flex items-center space-x-2">
																	<span class="text-xs text-gray-600 dark:text-gray-400">On Error:</span>
																	<code class="rounded bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-700 dark:text-gray-200">
																		{step.on_error}
																	</code>
																</div>
															{/if}
														</div>
													</div>
												{/if}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>