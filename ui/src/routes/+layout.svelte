<script>
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { accessToken, authUser } from '$lib/stores';
	import { refreshAccessToken } from '$lib/auth';
	import { Sidebar } from '$lib/components';
	import { DashboardIcon, TasksIcon, ActionsIcon, TriggersIcon } from '$lib/components/icons';
	import '../app.css';

	let { children } = $props();

	// Sidebar collapse state
	let sidebarCollapsed = $state(false);

	// Navigation items for the sidebar
	const navigationItems = [
		{
			id: 'dashboard',
			label: 'Dashboard',
			href: '/',
			icon: DashboardIcon
		},
		{
			id: 'tasks',
			label: 'Tasks',
			href: '/tasks',
			icon: TasksIcon
		},
		{
			id: 'actions',
			label: 'Actions',
			href: '/actions',
			icon: ActionsIcon
		},
		{
			id: 'triggers',
			label: 'Triggers',
			href: '/triggers',
			icon: TriggersIcon
		}
	];

	// Convert authUser to Sidebar user format
	const sidebarUser = $derived(
		$authUser
			? {
					id: $authUser.user_id,
					name: $authUser.name || 'User',
					email: $authUser.email
				}
			: undefined
	);

	// Handle sidebar toggle
	function handleSidebarToggle(collapsed) {
		sidebarCollapsed = collapsed;
	}

	// Handle user logout
	function handleLogout() {
		accessToken.set(null);
		authUser.set(null);
		goto('/login');
	}

	// Try to refresh token on mount if no access token
	onMount(async () => {
		const currentToken = get(accessToken);
		const publicPaths = ['/login'];

		if (currentToken || publicPaths.includes(page.url.pathname)) {
			return;
		}

		const success = await refreshAccessToken();
		if (!success) {
			authUser.set(null);
			goto('/login');
		}
	});
</script>

{#if $authUser}
	<div class="h-screen">
		<Sidebar
			user={sidebarUser}
			items={navigationItems}
			collapsed={sidebarCollapsed}
			onToggle={handleSidebarToggle}
			onLogout={handleLogout}
		/>

		<!-- Main content with responsive margin to account for sidebar -->
		<main
			class="p-9 overflow-y-auto h-full ml-0 transition-all duration-300 {sidebarCollapsed
				? 'md:ml-16'
				: 'md:ml-64'}"
		>
			{@render children()}
		</main>
	</div>
{:else}
	<main>
		{@render children()}
	</main>
{/if}
