<script lang="ts">
  import { onMount } from "svelte";
  import { finder } from "../state.svelte.ts";
  import * as B from "../../core/bodymodel.ts";
  import { frontFigure } from "../../core/figure.ts";

  const lines = finder.scanSkipped
    ? ["Starting from your height and weight", "Comparing with 4,077 measured bodies", "Preparing body shapes for you"]
    : ["Reading your measurements", "Comparing with 4,077 measured bodies", "Preparing body shapes for you"];
  let shown = $state(0);

  const body = finder.model && finder.heightCm && finder.weightKg
    ? B.toRecord(finder.model, B.prior(finder.model, { height_cm: finder.heightCm, weight_kg: finder.weightKg }).mean)
    : null;
  const fig = body ? frontFigure(body, { sleeve: finder.garment?.sleeve === "long" ? "long" : "short" }) : null;

  onMount(() => {
    const ticks = [350, 750].map((ms, i) => setTimeout(() => (shown = i + 1), ms));
    const done = setTimeout(() => {
      try {
        finder.buildTwin();
        finder.go("torso");
      } catch (e: any) {
        finder.error = `Something went wrong: ${e?.message || e}`;
      }
    }, 1200);
    return () => { ticks.forEach(clearTimeout); clearTimeout(done); };
  });
</script>

<div class="wrap">
  {#if fig}
    <svg viewBox={fig.viewBox} height="260" aria-hidden="true">
      {#each fig.layers as l, i}<path d={l.d} class={l.kind} pathLength="1" style:animation-delay="{i * 60}ms" />{/each}
    </svg>
  {/if}
  <h2 class="seam-title">Building your body profile</h2>
  <ul>
    {#each lines as line, i}<li class:on={i <= shown}>{line}</li>{/each}
  </ul>
  {#if finder.error}<p class="seam-hint err">{finder.error}</p>{/if}
</div>

<style>
  .wrap { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px; text-align: center; }
  svg { margin-bottom: 26px; stroke: #0b0b0c; stroke-width: 0.45; stroke-linejoin: round; }
  /* outline draws itself, then the clothes fade in */
  path { fill: transparent; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 0.9s cubic-bezier(0.4, 0, 0.2, 1) forwards, fill 0.5s 0.8s forwards; }
  path.skin { --to: #e6ded6; } path.hair { --to: #6d655e; } path.tee { --to: #cfcfcb; } path.trousers { --to: #9a9a96; } path.shoe { --to: #4a4a4c; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  @keyframes fill { to { fill: var(--to); stroke: transparent; } }
  ul { list-style: none; padding: 0; margin: 6px 0 0; }
  li { font-size: 14px; color: var(--faint); padding: 3px 0; transition: color 0.3s; }
  li.on { color: var(--ink); }
  @media (prefers-reduced-motion: reduce) { path { animation: none; stroke-dashoffset: 0; fill: var(--to); } }
</style>
