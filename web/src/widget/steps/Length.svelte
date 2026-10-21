<script lang="ts">
  import { finder } from "../state.svelte.ts";
  import type { HemChoice } from "../../core/sizing.ts";

  // y = where the hem sits on a 100-unit-tall figure (belt line at 56, crotch at 66).
  const OPTIONS: { id: HemChoice; label: string; y: number }[] = [
    { id: "above_belt", label: "Above the belt", y: 52 },
    { id: "at_belt", label: "At the belt", y: 56 },
    { id: "mid_fly", label: "Just below", y: 61 },
    { id: "covering", label: "Covering the seat", y: 67 },
  ];

  function choose(id: HemChoice) {
    finder.prefs.hem = id;
    setTimeout(() => finder.go("camera"), 260);
  }
</script>

<h2 class="seam-title">Where should a tee end?</h2>
<p class="seam-sub">Untucked, standing straight.</p>

<div class="seam-options four">
  {#each OPTIONS as o}
    {@const on = finder.prefs.hem === o.id}
    <button class="seam-option" class:on onclick={() => choose(o.id)}>
      <svg width="54" height="108" viewBox="0 0 50 100" aria-hidden="true">
        <!-- figure -->
        <circle cx="25" cy="9" r="6" fill="#ececea" />
        <path d="M18 18 h14 l3 38 h-20z M17 56 h16 l-1 40 h-5 l-2-30 l-2 30 h-5z" fill="#ececea" />
        <line x1="12" x2="38" y1="56" y2="56" stroke="#c9c9c5" stroke-width="0.8" stroke-dasharray="1.5 1.5" />
        <!-- tee -->
        <path d={`M17 17 L10 22 L13 31 L17 29 L17 ${o.y} L33 ${o.y} L33 29 L37 31 L40 22 L33 17 Q25 22 17 17Z`} fill={on ? "#0b0b0c" : "#bdbdb9"} />
      </svg>
      <span class="label small">{o.label}</span>
    </button>
  {/each}
</div>

<style>
  .small { font-size: 12px; line-height: 1.25; }
  .seam-option { padding: 12px 6px 10px; }
</style>
