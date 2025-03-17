<script>
	import { goto } from '$app/navigation';
	import { Sidebar, SidebarGroup, SidebarItem, SidebarWrapper } from 'flowbite-svelte';
	import '../app.css';
	// import { prerendered } from '$service-worker';

	let { children } = $props();

	// Mock authentication state (always false initially for demo)
	let isAuthenticated = false;

	// Redirect to login if not authenticated
	if (!isAuthenticated) {
		goto('/login');
	}
</script>

{#if isAuthenticated}
	<Sidebar>
		<SidebarWrapper>
			<SidebarGroup>
				<SidebarItem href="/actions">Actions</SidebarItem>
				<SidebarItem href="/flows">Flows</SidebarItem>
				<SidebarItem href="/history">History</SidebarItem>
				<SidebarItem href="/logs">Logs</SidebarItem>
			</SidebarGroup>
		</SidebarWrapper>
	</Sidebar>
	<div class="p-4">
		{@render children()}
	</div>
{/if}