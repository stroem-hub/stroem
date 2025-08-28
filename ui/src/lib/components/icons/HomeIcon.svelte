<script lang="ts">
  interface Props {
    class?: string;
    size?: number;
  }

  let { class: className = 'w-5 h-5', size }: Props = $props();
  
  const sizeClass = size ? `w-${size} h-${size}` : className;
</script>

<svg 
  class={sizeClass}
  fill="none" 
  stroke="currentColor" 
  viewBox="0 0 24 24" 
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <path 
    stroke-linecap="round" 
    stroke-linejoin="round" 
    stroke-width="2" 
    d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 0 0 1 1h3m10-11 2 2m-2-2v10a1 1 0 0 1-1 1h-3m-6 0a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1m-6 0h6"
  />
</svg>