<script>
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { accessToken, authUser, theme } from '$lib/stores';
	import { refreshAccessToken } from '$lib/auth';
	import { Sidebar } from '$lib/components';
	import ErrorBoundary from '$lib/components/organisms/ErrorBoundary.svelte';
	import ToastContainer from '$lib/components/organisms/ToastContainer.svelte';
	import LoadingOverlay from '$lib/components/organisms/LoadingOverlay.svelte';
	import '../app.css';

	let { children } = $props();
	let sidebarCollapsed = $state(false);

	// Initialize theme on mount
	onMount(async () => {
		// Initialize theme from localStorage or system preference
		const savedTheme = localStorage.getItem('theme');
		const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
		const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
		
		theme.set(initialTheme === 'dark' ? 'dark' : 'light');

		// Try to refresh token on mount if no access token
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

		// Load sidebar collapsed state from localStorage
		const savedCollapsed = localStorage.getItem('sidebar-collapsed');
		if (savedCollapsed !== null) {
			sidebarCollapsed = JSON.parse(savedCollapsed);
		}
	});

	function handleLogout() {
		accessToken.set(null);
		authUser.set(null);
		goto('/login');
	}

	function handleSidebarToggle(collapsed) {
		sidebarCollapsed = collapsed;
		localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed));
	}
</script>

<ErrorBoundary>
	{#if $authUser}
	<div class="h-screen bg-gray-50 dark:bg-gray-900">
		<Sidebar 
			user={$authUser} 
			onLogout={handleLogout}
			collapsed={sidebarCollapsed}
			onToggle={handleSidebarToggle}
		/>
		
		<main class="transition-all duration-300 ease-in-out overflow-y-auto h-screen
			{sidebarCollapsed ? 'ml-16' : 'ml-64'} md:ml-0">
			<div class="p-6 lg:p-8 pt-16 md:pt-6 
				{sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}">
				<ErrorBoundary>
					{@render children()}
				</ErrorBoundary>
			</div>
		</main>
	</div>
	{:else}
		<main class="min-h-screen bg-gray-50 dark:bg-gray-900">
			<ErrorBoundary>
				{@render children()}
			</ErrorBoundary>
		</main>
	{/if}

	<!-- Global UI Components -->
	<ToastContainer />
	<LoadingOverlay />
</ErrorBoundary>




