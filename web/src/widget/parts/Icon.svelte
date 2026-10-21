<script lang="ts">
  let { name, size = 20 }: { name: "back" | "close" | "check" | "sound" | "mute" | "mark"; size?: number } = $props();
</script>

{#if name === "mark"}
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="10" cy="10" r="10" fill="currentColor" />
    <path d="M5.5 13.5 C8 11.5 12 8.5 14.5 6.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="2 2.2" fill="none" />
  </svg>
{:else}
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if name === "back"}<path d="M15 5l-7 7 7 7" />
    {:else if name === "close"}<path d="M6 6l12 12M18 6L6 18" />
    {:else if name === "check"}<path d="M5 12.5l4.5 4.5L19 7.5" />
    {:else if name === "sound"}<path d="M4 10v4h4l5 4V6L8 10H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    {:else if name === "mute"}<path d="M4 10v4h4l5 4V6L8 10H4z" /><path d="M17 9l5 6M22 9l-5 6" />
    {/if}
  </svg>
{/if}
