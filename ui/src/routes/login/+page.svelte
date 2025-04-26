<script lang="ts">
  import type { PageProps } from './$types';
  import { Button, Input, Label, Alert } from 'flowbite-svelte';
  import { InfoCircleSolid } from 'flowbite-svelte-icons';
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

  let email = '';
  let password = '';
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
  <Alert color="red" class="mb-4 absolute w-full" on:close={() => showError = false} dismissable>
    <InfoCircleSolid slot="icon" class="w-5 h-5" />
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
        class="block w-full mt-2 p-2 border rounded-md"
        type="email"
        placeholder="E-mail"
        bind:value={email}
      />
      <Input
        class="block w-full mt-2 p-2 border rounded-md"
        type="password"
        placeholder="Password"
        bind:value={password}
      />
      <Button
        color="blue"
        class="w-full mb-4 transition-transform transform hover:scale-105"
        on:click={() => loginInternal(provider.id)}
      >
        Log in
      </Button>
    {:else}
      <Button
        color="blue"
        class="w-full mb-4 transition-transform transform hover:scale-105"
        on:click={() => loginOIDC(provider.id)}
      >
        Login with {provider.name}
      </Button>
    {/if}
        </div>
      {/if}
    {/each}
    {#if providers.length > 1 && !$showAll}
      <Button
        class="text-blue-500 underline text-sm mt-4"
        on:click={() => showAll.set(true)}
        disabled={$showAll}
      >
        Show another login options
      </Button>
    {/if}

  </div>
</div>

<style>
  .animate-fade-in {
    animation: fadeIn 0.3s ease-in;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>