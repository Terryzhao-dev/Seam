<script lang="ts">
  import { finder } from "../state.svelte.ts";
  import * as B from "../../core/bodymodel.ts";
  import Figure from "../parts/Figure.svelte";
  import { saveSession } from "../session.ts";

  const base = finder.twin && finder.model ? B.toRecord(finder.model, finder.twin.mean) : null;
  let chosen = $state<string | null>(finder.armPick);
  const SCALE = [0.72, 1, 1.32]; // illustrative arm thickness for slimmer / average / more muscular
  const sleeve = finder.garment?.sleeve === "long" ? "long" : "short";

  function choose(id: string) {
    chosen = id;
    finder.pickArms(id);
    saveSession(finder);
    setTimeout(() => finder.go("result"), 320);
  }
</script>

<h2 class="seam-title">And your arms?</h2>
<p class="seam-sub">A T-shirt sleeve hides some of your upper arm, so this helps with sleeve fit.</p>

<div class="seam-options three">
  {#each finder.armOptions as o, i (o.id)}
    <button class="seam-option" class:on={chosen === o.id} onclick={() => choose(o.id)}>
      <Figure body={base ?? o.body} armScale={SCALE[i]} crop="upper" height={150} sleeve="short" selected={chosen === o.id} />
      <span class="label">{o.label.replace(" arms", "")}</span>
    </button>
  {/each}
</div>
