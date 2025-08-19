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
    d="m9 18 6-6-6-6"
  />
</svg>