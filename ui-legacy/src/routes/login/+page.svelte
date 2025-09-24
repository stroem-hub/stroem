<script lang="ts">
  import type { PageProps } from './$types';
  import { Button, Input, Alert } from '$lib/components';
  import { ExclamationCircleIcon } from '$lib/components/icons';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';
  import { accessToken, authUser } from '$lib/stores';



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
{#if showError}
  <Alert variant="error" class="mb-4 absolute w-full" onclose={() => showError = false} dismissible>
    {#snippet icon()}
      <ExclamationCircleIcon class="w-5 h-5" />
    {/snippet}
    {errorMessage}
  </Alert>
{/if}

<div class="flex items-center justify-center min-h-screen bg-gray-100">
  <div class="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
    <h1 class="mb-6 text-2xl font-bold text-center text-gray-800">Login to Strøm</h1>

    {#each providers as provider, i}
      {#if i === 0 || $showAll}
      <div class="space-y-4 m-6">
        <h3 class="mb-6 font-bold text-center text-gray-800">Login with {provider.name} authentication</h3>
    {#if provider.type === 'internal'}
      <Input
        fullWidth
        type="email"
        placeholder="E-mail"
        bind:value={email}
      />
      <Input
        fullWidth
        type="password"
        placeholder="Password"
        bind:value={password}
      />
      <Button
        variant="primary"
        class="w-full mb-4 transition-transform transform hover:scale-105"
        onclick={() => loginInternal(provider.id)}
      >
        Log in
      </Button>
    {:else}
      <Button
        variant="primary"
        class="w-full mb-4 transition-transform transform hover:scale-105"
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
        class="text-blue-500 underline text-sm mt-4"
        onclick={() => showAll.set(true)}
        disabled={$showAll}
      >
        Show another login options
      </Button>
    {/if}

  </div>
</div>

