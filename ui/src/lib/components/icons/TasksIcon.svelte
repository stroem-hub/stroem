<script lang="ts">
  interface Props {
    class?: string;
    size?: number;
  }

  let { class: className = '', size = 24 }: Props = $props();
</script>

<svg 
  class={className} 
  width={size} 
  height={size} 
  viewBox="0 0 24 24" 
  fill="none" 
  stroke="currentColor" 
  stroke-width="2" 
  stroke-linecap="round" 
  stroke-linejoin="round"
>
  <path d="M12 2v20"/>
  <path d="m15 5 3 3-3 3"/>
  <path d="m9 9 3 3-3 3"/>
  <path d="M5 3l3 3-3 3"/>
</svg>