<script lang="ts">
  import { finder } from "../state.svelte.ts";
  import { preloadLandmarker } from "../scanner.ts";

  preloadLandmarker().catch(() => {}); // start downloading the pose model while they answer questions
</script>

<p class="seam-eyebrow">{finder.garment?.name ?? "Find your size"}</p>
<h2 class="seam-title">Find your exact size</h2>
<p class="seam-sub">A few quick questions and a short scan. Seam builds a measured profile of you, then checks it against this item's real garment measurements.</p>

<ul class="seam-list intro">
  <li><span class="k">About 1 min</span><span>Height, weight, how you like tops to fit, then two poses in front of your camera.</span></li>
  <li><span class="k">Private</span><span>The video never leaves your device. Only measurements are kept.</span></li>
  <li><span class="k">Zone by zone</span><span>Chest, shoulders, length and sleeves, not just a letter.</span></li>
</ul>

<div class="seam-spacer"></div>
<button class="seam-primary" onclick={() => finder.go("height")}>Get started</button>

<style>
  .intro { margin-top: 28px; }
</style>
