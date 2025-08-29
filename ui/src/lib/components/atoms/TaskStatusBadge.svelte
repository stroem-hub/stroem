<script lang="ts">
	import { Badge } from '$lib/components';
	import { 
		CheckCircleIcon, 
		ExclamationCircleIcon, 
		ClockIcon, 
		QuestionCircleIcon 
	} from '$lib/components/icons';

	interface Props {
		status: 'success' | 'failed' | 'running' | 'queued' | 'never_executed';
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	}

	let { status, size = 'md', class: className = '' }: Props = $props();

	const statusConfig = {
		success: {
			variant: 'success' as const,
			icon: CheckCircleIcon,
			label: 'Success',
			ariaLabel: 'Task execution successful'
		},
		failed: {
			variant: 'error' as const,
			icon: ExclamationCircleIcon,
			label: 'Failed',
			ariaLabel: 'Task execution failed'
		},
		running: {
			variant: 'info' as const,
			icon: ClockIcon,
			label: 'Running',
			ariaLabel: 'Task currently running'
		},
		queued: {
			variant: 'warning' as const,
			icon: ClockIcon,
			label: 'Queued',
			ariaLabel: 'Task queued for execution'
		},
		never_executed: {
			variant: 'default' as const,
			icon: QuestionCircleIcon,
			label: 'Never executed',
			ariaLabel: 'Task has never been executed'
		}
	};

	const config = statusConfig[status];
	const IconComponent = config.icon;

	const iconSizeClasses = {
		sm: 'w-3 h-3',
		md: 'w-4 h-4',
		lg: 'w-5 h-5'
	};
</script>

<div aria-label={config.ariaLabel}>
	<Badge 
		variant={config.variant} 
		{size} 
		class={className}
	>
	{#snippet children()}
		<div class="flex items-center gap-1">
			<IconComponent class={iconSizeClasses[size]} />
			<span>{config.label}</span>
		</div>
	{/snippet}
	</Badge>
</div>