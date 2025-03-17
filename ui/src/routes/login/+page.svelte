<script>
  import { Button, Input, Label } from 'flowbite-svelte';
  import { goto } from '$app/navigation';
  import { writable } from 'svelte/store';

  // Mock authentication state (always logs in for now)
  let isAuthenticated = false;
  let showInternalLogin = writable(false);
  let username = '';
  let password = '';

  // Redirect to main app if "authenticated"
  function checkAuth() {
    if (isAuthenticated) {
      goto('/');
    }
  }

  // Mock Google login (always succeeds for now)
  async function loginWithGoogle() {
    isAuthenticated = true;
    checkAuth();
  }

  // Toggle internal login form
  function toggleInternalLogin() {
    $showInternalLogin = !$showInternalLogin;
  }

  // Mock internal login (always succeeds for now)
  async function loginInternal() {
    if (username && password) {
      isAuthenticated = true;
      checkAuth();
    }
  }

  // Check auth on mount (for now, always shows login)
  checkAuth();
</script>

<div class="flex items-center justify-center min-h-screen bg-gray-100">
  <div class="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
    <h1 class="mb-6 text-2xl font-bold text-center text-gray-800">Login to Stroem</h1>

    <!-- Login with Google -->
    <Button
      color="blue"
      class="w-full mb-4 transition-transform transform hover:scale-105"
      on:click={loginWithGoogle}
    >
      <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12.545,10.917v3.666h5.47c-.222,1.167-.834,2.167-1.834,2.917l2.917,2.25c1.667-1.5,2.667-3.667,2.667-6.167c0-.583-.083-1.167-.25-1.666h-8.97zm-1.666-2.5H7.212v8.334h3.667v-8.334zm-5-3.334H1.545v13.334h4.334V5.083zm6.666-1.666v1.666h3.334v1.666h-3.334v1.666h5v-5h-5z"/>
      </svg>
      Login with Google
    </Button>

    <!-- Login with Internal Authentication -->
    <Button
      color="gray"
      outline
      class="w-full mb-4 transition-transform transform hover:scale-105"
      on:click={toggleInternalLogin}
    >
      Login with Internal Authentication
    </Button>

    <!-- Internal Login Form -->
    {#if $showInternalLogin}
      <div class="space-y-4 animate-fade-in">
        <div>
          <Label for="username" class="block mb-2 text-sm font-medium text-gray-700">Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="Enter your username"
            bind:value={username}
            class="w-full"
          />
        </div>
        <div>
          <Label for="password" class="block mb-2 text-sm font-medium text-gray-700">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            bind:value={password}
            class="w-full"
          />
        </div>
        <Button
          color="blue"
          class="w-full transition-transform transform hover:scale-105"
          on:click={loginInternal}
        >
          Login
        </Button>
      </div>
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