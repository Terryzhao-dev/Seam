<script lang="ts">
  import { onMount } from "svelte";
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { finder } from "../state.svelte.ts";
  import * as B from "../../core/bodymodel.ts";
  import { HEM_LABELS, type FitStyle } from "../../core/sizing.ts";
  import { formatHeight, formatLength } from "../units.ts";
  import { saveSession } from "../session.ts";

  let drawer = $state(false);
  const rec = $derived(finder.rec);
  const CONF = { high: "High confidence", medium: "Moderate confidence", low: "Rough estimate" };
  const SHOWN = ["chest_girth", "waist_girth", "bony_shoulder", "arm_girth", "cb_wrist", "neck_height"];

  onMount(() => {
    if (rec) finder.onResult?.(rec.size, rec);
    saveSession(finder);
  });

  function setFit(fit: FitStyle) {
    finder.prefs.fit = fit;
    finder.recompute();
    if (finder.rec) finder.onResult?.(finder.rec.size, finder.rec);
  }

  function m(key: string) {
    const v = B.marginal(finder.model!, finder.twin!, key);
    const relaxed = key === "arm_girth" ? 2 : 0; // ANSUR measures it flexed [est]
    return { mean: v.mean - relaxed, sd: v.sd };
  }
</script>

{#if rec}
  <div class="top">
    <p class="seam-eyebrow">Your size</p>
    <div class="size" in:fly={{ y: 12, duration: 420, easing: cubicOut }}>{rec.size}</div>
    {#if rec.between}
      {@const order = finder.garment!.sizes.map((s) => s.size)}
      {@const pair = [rec.size, rec.between].sort((a, b) => order.indexOf(a) - order.indexOf(b))}
      <p class="between">Between {pair[0]} and {pair[1]}. {rec.size} gives you the fit you chose.</p>
    {/if}
    <span class="seam-chip {rec.confidence}">{CONF[rec.confidence]}{finder.scanSkipped ? ", no scan" : ""}</span>
  </div>

  <ul class="seam-list notes">
    {#each rec.notes as n}<li><span class="k">{n.zone}</span><span>{n.text[0].toUpperCase() + n.text.slice(1)}</span></li>{/each}
  </ul>

  <div class="fitrow">
    <span>Fit</span>
    <div class="seam-segment">
      {#each ["slim", "regular", "relaxed"] as f}
        <button class:on={finder.prefs.fit === f} onclick={() => setFit(f as FitStyle)}>{f[0].toUpperCase() + f.slice(1)}</button>
      {/each}
    </div>
  </div>

  <button class="seam-link left" onclick={() => (drawer = true)}>See your measurements</button>
  <div class="seam-spacer"></div>
  <button class="seam-primary" onclick={() => finder.go("save")}>Save my size</button>
  <button class="seam-link" onclick={() => finder.close()}>Not now</button>

  {#if drawer}
    <div class="scrim" transition:fade={{ duration: 160 }} onclick={() => (drawer = false)} role="presentation"></div>
    <div class="drawer" transition:fly={{ y: 300, duration: 320, easing: cubicOut }}>
      <div class="grab"></div>
      <h3>Your measurements</h3>
      <p class="seam-sub small">Estimated from your {finder.scanSkipped ? "height and weight" : "scan, height and weight"}. ± is the likely error.</p>
      <ul class="seam-list">
        {#each SHOWN as key}
          {@const v = m(key)}
          <li><span class="k wide">{finder.model!.labels[key]}</span><span class="num">{key.endsWith("height") ? formatHeight(v.mean, finder.units) : formatLength(v.mean, finder.units)} <span class="pm">± {formatLength(v.sd, finder.units)}</span></span></li>
        {/each}
      </ul>
      <p class="seam-sub small">Preference: {finder.prefs.fit} fit, ends {HEM_LABELS[finder.prefs.hem].toLowerCase()}.</p>
      <button class="seam-primary" onclick={() => (drawer = false)}>Done</button>
    </div>
  {/if}
{/if}

<style>
  .top { text-align: center; padding-top: 8px; }
  .size { font-size: 104px; line-height: 1; font-weight: 650; letter-spacing: -0.05em; margin: 2px 0 12px; }
  .between { font-size: 14px; color: var(--muted); margin: 0 0 12px; }
  .notes { margin-top: 22px; }
  .fitrow { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 14px; border-top: 1px solid var(--line); font-size: 14px; color: var(--muted); }
  .left { margin: 16px 0 0; text-align: left; }
  .scrim { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.18); }
  .drawer { position: absolute; left: 0; right: 0; bottom: 0; background: #fff; border-radius: 22px 22px 0 0; padding: 12px 26px 24px; box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.12); max-height: 88%; overflow-y: auto; }
  .grab { width: 38px; height: 4px; border-radius: 4px; background: var(--line); margin: 0 auto 14px; }
  h3 { margin: 0 0 4px; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
  .small { font-size: 13px; margin: 0 0 6px; }
  .wide { width: auto; flex: 1 1 auto; }
  .num { font-variant-numeric: tabular-nums; font-weight: 600; }
  .pm { font-weight: 400; color: var(--faint); }
  .drawer .seam-primary { margin-top: 16px; }
</style>
