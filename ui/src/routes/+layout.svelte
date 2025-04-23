<script>
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { accessToken, authUser } from '$lib/stores';
	import { refreshAccessToken } from '$lib/auth';
	import { browser } from '$app/environment'; // Check if running in browser
	import { Sidebar, SidebarWrapper, SidebarBrand, SidebarItem, SidebarGroup } from 'flowbite-svelte';
	import { ChartPieSolid, GridSolid, MailBoxSolid, UserSolid, ArrowRightToBracketOutline, EditOutline, ArrowsRepeatOutline, HammerOutline, FlagSolid } from 'flowbite-svelte-icons';

	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger, Avatar, Dropdown, DropdownItem, DropdownHeader, DropdownDivider } from 'flowbite-svelte';
	import '../app.css';

	let { children } = $props();

	let site = {
		name: 'Strøm',
		href: '/',
		img: 'https://cdn-icons-png.freepik.com/128/12707/12707916.png'
	};

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
<div class="h-screen flex">
<Sidebar class="sticky top-16 w-60 overflow-y-auto bg-gray-50">
	<SidebarWrapper>
		<SidebarGroup>
			<SidebarBrand {site} />
			<SidebarItem label="Dashboard" href="/">
				<svelte:fragment slot="icon">
					<GridSolid class="w-6 h-6 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
				</svelte:fragment>
			</SidebarItem>
			<SidebarItem label="Tasks" href="/tasks">
				<svelte:fragment slot="icon">
					<ArrowsRepeatOutline class="w-6 h-6 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
				</svelte:fragment>
			</SidebarItem>
			<SidebarItem label="Actions" href="/actions">
				<svelte:fragment slot="icon">
					<HammerOutline class="w-6 h-6 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
				</svelte:fragment>
			</SidebarItem>
			<SidebarItem label="Triggers" href="/triggers">
				<svelte:fragment slot="icon">
					<FlagSolid class="w-6 h-6 text-gray-500 transition duration-75 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white" />
				</svelte:fragment>
			</SidebarItem>
		</SidebarGroup>
	</SidebarWrapper>
</Sidebar>

	<main class="p-9 flex-1 overflow-y-auto">
		{@render children()}
	</main>

</div>
{:else}
	<main>
		{@render children()}
	</main>
{/if}




<!-- div class="max-h-screen overflow-auto relative w-full h-screen">
	<header class="sticky top-0 z-40 flex-none w-full mx-auto bg-white border-b border-gray-200 dark:border-gray-600 dark:bg-gray-800">
		<Navbar>
			<NavBrand href="/">
				<img src="https://static.vecteezy.com/system/resources/thumbnails/002/002/403/small/man-with-beard-avatar-character-isolated-icon-free-vector.jpg" class="me-3 h-6 sm:h-9" alt="Flowbite Logo" />
				<span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white">Flowbite</span>
			</NavBrand>
			<div class="flex items-center md:order-2">
				<Avatar id="avatar-menu" src="https://img.freepik.com/free-vector/businessman-character-avatar-isolated_24877-60111.jpg?semt=ais_hybrid" />
				<NavHamburger class="w-full md:flex md:w-auto md:order-1" />
			</div>
			<Dropdown placement="bottom" triggeredBy="#avatar-menu">
				<DropdownHeader>
					<span class="block text-sm">Bonnie Green</span>
					<span class="block truncate text-sm font-medium">name@flowbite.com</span>
				</DropdownHeader>
				<DropdownItem>Dashboard</DropdownItem>
				<DropdownItem>Settings</DropdownItem>
				<DropdownItem>Earnings</DropdownItem>
				<DropdownDivider />
				<DropdownItem>Sign out</DropdownItem>
			</Dropdown>
			<NavUl>
				<NavLi href="/" active={true}>Home</NavLi>
				<NavLi href="/about">About</NavLi>
				<NavLi href="/docs/components/navbar">Navbar</NavLi>
				<NavLi href="/pricing">Pricing</NavLi>
				<NavLi href="/contact">Contact</NavLi>
			</NavUl>
		</Navbar>
	</header>
	<div class="lg:flex w-full">
		<main class="flex-auto w-full min-w-0 lg:static lg:max-h-full lg:overflow-visible">
			<div class="flex w-full">
				{@render children()}
			</div>
		</main>
	</div>


</div -->

