<script lang="ts">
  import { fade, fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { finder } from "./state.svelte.ts";
  import Icon from "./parts/Icon.svelte";
  import Intro from "./steps/Intro.svelte";
  import Height from "./steps/Height.svelte";
  import Weight from "./steps/Weight.svelte";
  import Fit from "./steps/Fit.svelte";
  import Length from "./steps/Length.svelte";
  import Camera from "./steps/Camera.svelte";
  import Scan from "./steps/Scan.svelte";
  import Processing from "./steps/Processing.svelte";
  import Torso from "./steps/Torso.svelte";
  import Arms from "./steps/Arms.svelte";
  import Result from "./steps/Result.svelte";
  import Save from "./steps/Save.svelte";
  import DebugPanel from "./DebugPanel.svelte";

  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ms = (n: number) => (reduce ? 0 : n);

  const full = $derived(finder.step === "scanFront" || finder.step === "scanSide");
  const flush = $derived(full || finder.step === "processing");
  const canGoBack = $derived(!["intro", "processing", "scanFront", "scanSide"].includes(finder.step));

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && finder.open) finder.close();
  }
</script>

<svelte:window {onkeydown} />

{#if finder.open}
  <div class="seam seam-overlay" transition:fade={{ duration: ms(200) }} onclick={(e) => e.target === e.currentTarget && finder.close()} role="presentation">
    <div class="seam-card" class:full role="dialog" aria-modal="true" aria-label="Find your size" in:scale={{ start: 0.97, duration: ms(280), easing: cubicOut }}>
      {#if !full}
        <div class="seam-head">
          {#if canGoBack}
            <button class="seam-icon-btn" aria-label="Back" onclick={() => finder.back()}><Icon name="back" /></button>
          {:else}<span></span>{/if}
          <div class="seam-brand"><Icon name="mark" size={18} /> Seam</div>
          <button class="seam-icon-btn" aria-label="Close" onclick={() => finder.close()}><Icon name="close" /></button>
        </div>
        <div class="seam-progress"><div style:width="{finder.progress * 100}%"></div></div>
      {/if}

      <div class="seam-stage">
        {#key finder.step}
          <div class="seam-screen" class:flush
            in:fly={{ x: 40 * finder.dir, duration: ms(340), easing: cubicOut, opacity: 0 }}
            out:fly={{ x: -40 * finder.dir, duration: ms(220), easing: cubicOut, opacity: 0 }}>
            {#if finder.step === "intro"}<Intro />
            {:else if finder.step === "height"}<Height />
            {:else if finder.step === "weight"}<Weight />
            {:else if finder.step === "fit"}<Fit />
            {:else if finder.step === "length"}<Length />
            {:else if finder.step === "camera"}<Camera />
            {:else if finder.step === "scanFront"}<Scan pose="front" />
            {:else if finder.step === "scanSide"}<Scan pose="side" />
            {:else if finder.step === "processing"}<Processing />
            {:else if finder.step === "torso"}<Torso />
            {:else if finder.step === "arms"}<Arms />
            {:else if finder.step === "result"}<Result />
            {:else if finder.step === "save"}<Save />
            {/if}
          </div>
        {/key}
      </div>
    </div>
    {#if finder.debug}<DebugPanel />{/if}
  </div>
{/if}
