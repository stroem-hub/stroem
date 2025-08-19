<script lang="ts">
  import type { PageProps } from './$types';
  import Button from '$lib/components/atoms/Button.svelte';
  import Input from '$lib/components/atoms/Input.svelte';
  import Card from '$lib/components/atoms/Card.svelte';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';
  import { accessToken, authUser } from '$lib/stores';

  interface Provider {
    id: string;
    type: string;
    primary?: boolean;
    name: string;
  }

  let { data }: PageProps = $props();
  const providers = data.providers;

  let email = $state('');
  let password = $state('');
  const showAll = writable(false);

  let errorMessage = $state('');
  let showError = $state(false);

  const login =  async (providerId: string, requestBody: string) => {
    try {
      const res = await fetch(`/api/auth/${providerId}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody
      });

      const body = await res.json();
      if (!body.success) {
        errorMessage = body.error || 'Login failed';
        showError = true;
        setTimeout(() => showError = false, 5000);
      } else {
        // OIDC redirect
        const redirectUrl = body.data?.redirect;
        if (redirectUrl) {
          window.location.replace(redirectUrl);
          return
        }

        // We have received access token
        accessToken.set(body.data?.access_token);
        authUser.set(body.data?.user);
        goto('/');
      }
    } catch (err) {
      console.error('Login failed:', err);
      errorMessage = 'Login error';
      showError = true;
      setTimeout(() => showError = false, 5000);
    }
  };

  const loginInternal = async (providerId: string) => {
    login(providerId, JSON.stringify({ email, password }));
  };

  const loginOIDC = async (providerId: string) => {
    login(providerId, "{}");
  };

</script>
<div class="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
  {#if showError}
    <div class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4">
      <div class="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-error-800 dark:text-error-200 px-4 py-3 rounded-lg shadow-lg flex items-center">
        <svg class="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span class="flex-1">{errorMessage}</span>
        <button 
          onclick={() => showError = false}
          class="ml-3 opacity-70 hover:opacity-100"
          aria-label="Close error message"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  {/if}

  <Card class="w-full max-w-md">
    <div class="p-6">
      <h1 class="mb-6 text-2xl font-bold text-center text-gray-900 dark:text-gray-100">Login to Strøm</h1>

      {#each providers as provider, i}
        {#if i === 0 || $showAll}
        <div class="space-y-4 mb-6">
          <h3 class="mb-4 font-semibold text-center text-gray-800 dark:text-gray-200">Login with {provider.name} authentication</h3>
          {#if provider.type === 'internal'}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              oninput={(e) => email = (e.target as HTMLInputElement).value}
              class="w-full"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              oninput={(e) => password = (e.target as HTMLInputElement).value}
              class="w-full"
            />
            <Button
              variant="primary"
              fullWidth
              onclick={() => loginInternal(provider.id)}
            >
              Log in
            </Button>
          {:else}
            <Button
              variant="primary"
              fullWidth
              onclick={() => loginOIDC(provider.id)}
            >
              Login with {provider.name}
            </Button>
          {/if}
        </div>
        {/if}
      {/each}
      
      {#if providers.length > 1 && !$showAll}
        <Button
          variant="ghost"
          onclick={() => showAll.set(true)}
          disabled={$showAll}
          class="w-full text-sm"
        >
          Show other login options
        </Button>
      {/if}
    </div>
  </Card>
</div>

