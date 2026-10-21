<script lang="ts">
  import { finder } from "../state.svelte.ts";
  import type { FitStyle } from "../../core/sizing.ts";

  const OPTIONS: { id: FitStyle; label: string; desc: string; w: number }[] = [
    { id: "slim", label: "Slim", desc: "Close to the body, not tight", w: 0.78 },
    { id: "regular", label: "Regular", desc: "Easy through the chest and waist", w: 0.9 },
    { id: "relaxed", label: "Relaxed", desc: "Roomy, a little boxy", w: 1.05 },
  ];

  function choose(id: FitStyle) {
    finder.prefs.fit = id;
    setTimeout(() => finder.go("length"), 260);
  }

  // Tee outline whose body width scales with w.
  const tee = (w: number) => {
    const b = 13 * w, s = 7;
    return `M${30 - b},14 L${30 - b - s},18 L${30 - b - s - 7},30 L${30 - b - 2},33 L${30 - b},29 L${30 - b},58 L${30 + b},58 L${30 + b},29 L${30 + b + 2},33 L${30 + b + s + 7},30 L${30 + b + s},18 L${30 + b},14 Q30,21 ${30 - b},14Z`;
  };
</script>

<h2 class="seam-title">How do you like tops to fit?</h2>
<p class="seam-sub">Seam picks the size that gives you this fit in this item.</p>

<div class="seam-options">
  {#each OPTIONS as o}
    <button class="seam-row-option" class:on={finder.prefs.fit === o.id} onclick={() => choose(o.id)}>
      <svg width="54" height="54" viewBox="0 0 60 64" aria-hidden="true"><path d={tee(o.w)} fill={finder.prefs.fit === o.id ? "#0b0b0c" : "#dcdcd9"} /></svg>
      <span><span class="label">{o.label}</span><br /><span class="desc">{o.desc}</span></span>
    </button>
  {/each}
</div>
