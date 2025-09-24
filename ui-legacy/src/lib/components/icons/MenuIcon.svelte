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
  <line x1="4" x2="20" y1="6" y2="6"/>
  <line x1="4" x2="20" y1="12" y2="12"/>
  <line x1="4" x2="20" y1="18" y2="18"/>
</svg>