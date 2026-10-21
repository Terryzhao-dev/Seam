<script lang="ts">
  import { finder } from "../state.svelte.ts";
  import { kgToLb, lbToKg } from "../units.ts";
  import { focus } from "../parts/focus.ts";

  const start = finder.weightKg;
  let kg = $state(start ? String(Math.round(start)) : "");
  let lb = $state(start ? String(Math.round(kgToLb(start))) : "");

  const value = $derived(finder.units === "metric" ? parseFloat(kg) : lbToKg(parseFloat(lb)));
  const valid = $derived(value >= 40 && value <= 200);
  const touched = $derived((finder.units === "metric" ? kg : lb).length >= 2);

  function setUnits(u: "metric" | "imperial") {
    if (u === finder.units) return;
    if (Number.isFinite(value)) {
      if (u === "metric") kg = String(Math.round(value));
      else lb = String(Math.round(kgToLb(value)));
    }
    finder.units = u;
  }
  function next() {
    if (!valid) return;
    finder.weightKg = Math.round(value * 10) / 10;
    finder.go("fit");
  }
  const onkeydown = (e: KeyboardEvent) => e.key === "Enter" && next();
</script>

<h2 class="seam-title">What do you weigh?</h2>
<p class="seam-sub">An estimate is fine. It helps Seam predict the parts of your body the camera can't see.</p>

<div class="seam-number">
  {#if finder.units === "metric"}
    <input type="text" autocomplete="off" inputmode="decimal" aria-label="Weight in kilograms" placeholder="75" bind:value={kg} {onkeydown} use:focus />
    <span class="unit">kg</span>
  {:else}
    <input type="text" autocomplete="off" inputmode="decimal" aria-label="Weight in pounds" placeholder="165" bind:value={lb} {onkeydown} use:focus />
    <span class="unit">lb</span>
  {/if}
</div>

<div class="center">
  <div class="seam-segment">
    <button class:on={finder.units === "imperial"} onclick={() => setUnits("imperial")}>lb</button>
    <button class:on={finder.units === "metric"} onclick={() => setUnits("metric")}>kg</button>
  </div>
</div>
<p class="seam-hint" class:err={touched && !valid}>{touched && !valid ? "Enter a weight between 40 and 200 kg (88 to 440 lb)" : ""}</p>

<div class="seam-spacer"></div>
<button class="seam-primary" disabled={!valid} onclick={next}>Continue</button>

<style>
  .center { display: flex; justify-content: center; margin-top: 8px; }
  .seam-hint { margin-top: 12px; }
</style>
