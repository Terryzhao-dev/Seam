<script lang="ts">
  // Clothed body figure (fitted tee + trousers) from twin measurements. `base` + `k` exaggerate
  // differences from a base body for display only, so options a few cm apart are easy to tell
  // apart; `armScale` is an illustrative arm thickness.
  import { frontFigure, sideFigure } from "../../core/figure.ts";

  const SHAPE_KEYS = ["chest_girth", "waist_girth", "hip_girth", "chest_width", "chest_depth", "waist_width", "waist_depth", "hip_width", "hip_depth", "arm_girth", "outer_shoulder"];

  let {
    body,
    base = null,
    k = 1,
    view = "front",
    crop = "full",
    height = 150,
    selected = false,
    armScale = 1,
    sleeve = "short",
  }: {
    body: Record<string, number>;
    base?: Record<string, number> | null;
    k?: number;
    view?: "front" | "side";
    crop?: "full" | "torso" | "upper";
    height?: number;
    selected?: boolean;
    armScale?: number;
    sleeve?: "short" | "long";
  } = $props();

  const shown = $derived.by(() => {
    const o = { ...body };
    if (base && k !== 1) for (const key of SHAPE_KEYS) if (key in body && key in base) o[key] = base[key] + k * (body[key] - base[key]);
    return o;
  });
  const fig = $derived(view === "side" ? sideFigure(shown, { armScale, sleeve }) : frontFigure(shown, { armScale, sleeve }));
  const viewBox = $derived(crop === "full" ? fig.viewBox : fig.crops[crop]);
  const width = $derived.by(() => {
    const [, , w, h] = viewBox.split(" ").map(Number);
    return (height * w) / h;
  });
</script>

<svg {viewBox} {width} {height} aria-hidden="true" class:selected style:--fw={width} style:max-height="{height}px">
  {#each fig.layers as l}<path d={l.d} class={l.kind} />{/each}
</svg>

<style>
  /* Scales down with its card (keeps proportions), never wider than the space it has. */
  svg { overflow: hidden; display: block; min-width: 0; max-width: 100%; height: auto; }
  path { transition: fill 0.25s; stroke: #fff; stroke-width: 0.35; stroke-linejoin: round; }
  .skin { fill: #e6ded6; }
  .hair { fill: #6d655e; }
  .tee { fill: #cfcfcb; }
  .trousers { fill: #9a9a96; }
  .shoe { fill: #4a4a4c; }
  svg.selected .skin { fill: #dccfc3; }
  svg.selected .hair { fill: #3e3833; }
  svg.selected .tee { fill: #1f1f21; }
  svg.selected .trousers { fill: #55555a; }
  svg.selected .shoe { fill: #1f1f21; }
</style>
