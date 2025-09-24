<script lang="ts">
	interface AccordionItem {
		id: string;
		header: import('svelte').Snippet;
		content: import('svelte').Snippet;
		open?: boolean;
		disabled?: boolean;
	}

	interface Props {
		items: AccordionItem[];
		allowMultiple?: boolean;
		class?: string;
		onToggle?: (id: string, isOpen: boolean) => void;
	}

	let { items, allowMultiple = false, class: className = '', onToggle }: Props = $props();
	
	let openItems = $state<Set<string>>(new Set(items.filter(item => item.open).map(item => item.id)));

	function toggleItem(id: string) {
		const item = items.find(i => i.id === id);
		if (item?.disabled) return;

		const wasOpen = openItems.has(id);
		
		if (wasOpen) {
			openItems.delete(id);
		} else {
			if (!allowMultiple) {
				openItems.clear();
			}
			openItems.add(id);
		}
		openItems = new Set(openItems); // Trigger reactivity
		
		onToggle?.(id, !wasOpen);
	}

	function handleKeyDown(event: KeyboardEvent, id: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleItem(id);
		}
	}
</script>

<div class="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg {className}">
	{#each items as item, index}
		<div class="accordion-item">
			<h3>
				<button
					class="w-full px-4 py-3 text-left flex items-center justify-between transition-colors duration-200
						{item.disabled 
							? 'opacity-50 cursor-not-allowed' 
							: 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset'}"
					onclick={() => toggleItem(item.id)}
					onkeydown={(e) => handleKeyDown(e, item.id)}
					aria-expanded={openItems.has(item.id)}
					aria-controls="accordion-content-{item.id}"
					id="accordion-header-{item.id}"
					disabled={item.disabled}
				>
					<div class="flex-1">
						{@render item.header()}
					</div>
					<svg 
						class="w-5 h-5 text-gray-500 transition-transform duration-200 {openItems.has(item.id) ? 'rotate-180' : ''}"
						fill="none" 
						stroke="currentColor" 
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
					</svg>
				</button>
			</h3>
			
			{#if openItems.has(item.id)}
				<div 
					class="px-4 pb-4 border-t border-gray-200 dark:border-gray-700"
					id="accordion-content-{item.id}"
					aria-labelledby="accordion-header-{item.id}"
					role="region"
				>
					<div class="pt-4">
						{@render item.content()}
					</div>
				</div>
			{/if}
		</div>
	{/each}
</div>