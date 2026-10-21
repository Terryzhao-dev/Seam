<script lang="ts">
  import { finder } from "../state.svelte.ts";
  import { cmToFtIn, ftInToCm } from "../units.ts";
  import { focus } from "../parts/focus.ts";

  const start = finder.heightCm;
  let cm = $state(start ? String(Math.round(start)) : "");
  let ft = $state(start ? String(cmToFtIn(start).ft) : "");
  let inch = $state(start ? String(cmToFtIn(start).inch) : "");

  const value = $derived(finder.units === "metric" ? parseFloat(cm) : ft ? ftInToCm(parseFloat(ft), parseFloat(inch || "0")) : NaN);
  const valid = $derived(value >= 140 && value <= 215);
  const touched = $derived(finder.units === "metric" ? cm.length >= 3 : ft.length > 0 && inch.length > 0);

  function setUnits(u: "metric" | "imperial") {
    if (u === finder.units) return;
    if (Number.isFinite(value)) {
      if (u === "metric") cm = String(Math.round(value));
      else { const c = cmToFtIn(value); ft = String(c.ft); inch = String(c.inch); }
    }
    finder.units = u;
  }
  function next() {
    if (!valid) return;
    finder.heightCm = Math.round(value * 10) / 10;
    finder.go("weight");
  }
  const onkeydown = (e: KeyboardEvent) => e.key === "Enter" && next();
</script>

<h2 class="seam-title">How tall are you?</h2>
<p class="seam-sub">Without shoes. A measured height is best, because it sets the scale for the scan.</p>

{#if finder.units === "metric"}
  <div class="seam-number">
    <input type="text" autocomplete="off" inputmode="decimal" aria-label="Height in centimetres" placeholder="178" bind:value={cm} {onkeydown} use:focus />
    <span class="unit">cm</span>
  </div>
{:else}
  <div class="seam-number">
    <input type="text" autocomplete="off" inputmode="numeric" aria-label="Feet" placeholder="5" bind:value={ft} {onkeydown} use:focus style="width: 1.4ch" />
    <span class="unit">ft</span>
    <input type="text" autocomplete="off" inputmode="decimal" aria-label="Inches" placeholder="10" bind:value={inch} {onkeydown} style="width: 2.2ch" />
    <span class="unit">in</span>
  </div>
{/if}

<div class="center">
  <div class="seam-segment">
    <button class:on={finder.units === "imperial"} onclick={() => setUnits("imperial")}>ft / in</button>
    <button class:on={finder.units === "metric"} onclick={() => setUnits("metric")}>cm</button>
  </div>
</div>
<p class="seam-hint" class:err={touched && !valid}>{touched && !valid ? "Enter a height between 140 and 215 cm (4′7″ to 7′1″)" : ""}</p>

<div class="seam-spacer"></div>
<button class="seam-primary" disabled={!valid} onclick={next}>Continue</button>

<style>
  .center { display: flex; justify-content: center; margin-top: 8px; }
  .seam-hint { margin-top: 12px; }
</style>
