<script lang="ts">
  import { finder } from "../state.svelte.ts";
  import * as B from "../../core/bodymodel.ts";
  import Figure from "../parts/Figure.svelte";

  const base = finder.twin && finder.model ? B.toRecord(finder.model, finder.twin.mean) : null;
  let chosen = $state<string | null>(finder.torsoPick);
  const DESC: Record<string, string> = {
    "Leaner": "Slimmer chest and stomach",
    "Broader chest": "Chest wider than the waist",
    "Fuller middle": "More through the stomach",
    "Larger build": "Bigger chest and stomach",
  };
  const sleeve = finder.garment?.sleeve === "long" ? "long" : "short";

  function choose(id: string) {
    chosen = id;
    finder.pickTorso(id);
    setTimeout(() => finder.go("arms"), 320);
  }
</script>

<h2 class="seam-title">Which looks most like you?</h2>
<p class="seam-sub">
  {finder.scanSkipped ? "Shapes that fit your height and weight." : "All four match your scan. Pick the closest; differences are exaggerated so they're easy to see."}
</p>

<div class="seam-options two grid">
  {#each finder.torsoOptions as o (o.id)}
    <button class="seam-option" class:on={chosen === o.id} onclick={() => choose(o.id)}>
      <div class="pair">
        <Figure body={o.body} {base} k={2.4} crop="torso" height={176} {sleeve} selected={chosen === o.id} />
        <Figure body={o.body} {base} k={2.4} view="side" crop="torso" height={176} {sleeve} selected={chosen === o.id} />
      </div>
      <span class="label">{o.label}</span>
      <span class="desc">{DESC[o.label] ?? ""}</span>
    </button>
  {/each}
</div>

<style>
  .grid { margin-top: 20px; }
  .pair { display: flex; align-items: flex-end; justify-content: center; gap: 2px; width: 100%; min-width: 0; }
  .pair :global(svg) { flex: var(--fw) 1 0; } /* front and side share the width by their proportions */
  .seam-option { padding: 14px 8px 12px; gap: 6px; }
  .label { margin-top: 4px; }
</style>
