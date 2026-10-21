<script lang="ts">
  // ?debug=1 only. Shows the numbers behind the popup, compares the twin with tape
  // measurements and works out the drape allowance from a tee you are wearing.
  import { finder } from "./state.svelte.ts";
  import { buildSession, marginals } from "./session.ts";

  const TAPE: [string, string][] = [
    ["stature", "Height, measured (cm)"],
    ["chest_girth", "Chest girth"],
    ["waist_girth", "Waist girth"],
    ["bony_shoulder", "Shoulder, bone to bone"],
    ["outer_shoulder", "Outer shoulder width"],
    ["arm_girth", "Upper-arm girth, relaxed"],
    ["cb_wrist", "Centre back to wrist"],
    ["neck_height", "Back of neck height"],
    ["crotch_height", "Crotch height"],
  ];
  const load = () => { try { return JSON.parse(localStorage.getItem("seam.tape") || "{}"); } catch { return {}; } };
  let tape = $state<Record<string, string>>(load());
  let wear = $state({ length_back: "", hem_height: "", neck_height: "" });
  let open = $state(true);

  $effect(() => { try { localStorage.setItem("seam.tape", JSON.stringify(tape)); } catch {} });

  const prior = $derived(finder.priorTwin && marginals(finder, "priorTwin"));
  const scan = $derived(finder.scanTwin && marginals(finder, "scanTwin"));
  const final = $derived(finder.twin && marginals(finder, "twin"));
  const drape = $derived.by(() => {
    const L = parseFloat(wear.length_back), hem = parseFloat(wear.hem_height), c7 = parseFloat(wear.neck_height);
    return [L, hem, c7].every(Number.isFinite) ? L - (c7 - hem) : null;
  });

  function err(key: string) {
    const t = parseFloat(tape[key]);
    const f = final?.[key];
    if (!Number.isFinite(t) || !f) return null;
    return f.mean - (key === "arm_girth" ? 2 : 0) - t; // twin arm girth is flexed [est]
  }

  function download() {
    const s = buildSession(finder, { tape, wearCalibration: { ...wear, drapeK: drape } });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(s, null, 1)], { type: "application/json" }));
    a.download = `seam-session-${s.id.slice(0, 8)}.json`;
    a.click();
  }
  const fmt = (v?: { mean: number; sd: number } | null) => (v ? `${v.mean.toFixed(1)} ±${v.sd.toFixed(1)}` : "-");
</script>

<aside class="dbg" class:closed={!open}>
  <button class="toggle" onclick={() => (open = !open)}>{open ? "Hide debug" : "Debug"}</button>
  {#if open}
    <p><b>Step</b> {finder.step} · units {finder.units} · {finder.scanner?.delegate || "no camera"}</p>
    {#if finder.scanQuality}<p><b>Scan quality</b> {finder.scanQuality.q} (steady {finder.scanQuality.steadiness}, proportions {finder.scanQuality.proportion}, z {finder.scanQuality.proportionZ})</p>{/if}

    {#if finder.readings}
      <h4>Camera readings (cm, raw)</h4>
      <table><tbody>{#each Object.entries(finder.readings) as [k, v]}<tr><td>{k}</td><td>{v.toFixed(1)}</td></tr>{/each}</tbody></table>
    {/if}

    {#if final}
      <h4>Twin: prior → after scan → final</h4>
      <table><tbody>
        {#each finder.model?.vars ?? [] as k}
          <tr><td>{k}</td><td>{fmt(prior?.[k])}</td><td>{fmt(scan?.[k])}</td><td><b>{fmt(final[k])}</b></td></tr>
        {/each}
      </tbody></table>
    {/if}

    {#if finder.rec}
      <h4>Sizes ({finder.rec.confidence})</h4>
      <table><tbody>
        <tr><th>size</th><th>core</th><th>length/sleeve</th><th>score</th></tr>
        {#each finder.rec.sizes as s}<tr class:best={s.size === finder.rec.size}><td>{s.size}{s.wearable ? "" : " ✗"}</td><td>{s.pCore.toFixed(2)}</td><td>{s.pSecondary.toFixed(2)}</td><td>{s.score.toFixed(2)}</td></tr>{/each}
      </tbody></table>
    {/if}

    <h4>Tape check (cm)</h4>
    <table><tbody>
      {#each TAPE as [k, label]}
        {@const e = err(k)}
        <tr><td>{label}</td><td><input bind:value={tape[k]} inputmode="decimal" /></td><td class:bad={e != null && Math.abs(e) > 2.5} class:good={e != null && Math.abs(e) <= 2.5}>{e == null ? "" : (e > 0 ? "+" : "") + e.toFixed(1)}</td></tr>
      {/each}
    </tbody></table>

    <h4>Drape calibration (wear a known tee)</h4>
    <table><tbody>
      <tr><td>Tee back length (chart)</td><td><input bind:value={wear.length_back} inputmode="decimal" /></td></tr>
      <tr><td>Floor to hem, at the back</td><td><input bind:value={wear.hem_height} inputmode="decimal" /></td></tr>
      <tr><td>Floor to back of neck</td><td><input bind:value={wear.neck_height} inputmode="decimal" /></td></tr>
      <tr><td>Implied drape allowance</td><td colspan="2"><b>{drape == null ? "-" : drape.toFixed(1) + " cm"}</b> (model uses 5)</td></tr>
    </tbody></table>

    <button class="dl" onclick={download}>Download session JSON</button>
  {/if}
</aside>

<style>
  .dbg { position: fixed; top: 12px; right: 12px; width: 380px; max-height: calc(100vh - 24px); overflow: auto; background: #fff; border: 1px solid #e7e7e4; border-radius: 12px; padding: 12px 14px; font: 11.5px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; color: #0b0b0c; z-index: 2147483600; box-shadow: 0 10px 40px rgba(0,0,0,0.12); }
  .dbg.closed { width: auto; }
  .toggle { float: right; border: 1px solid #e7e7e4; background: #f5f5f3; border-radius: 6px; font-size: 11px; padding: 2px 8px; }
  h4 { margin: 12px 0 4px; font-size: 11.5px; }
  p { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 1px 4px; text-align: right; white-space: nowrap; }
  td:first-child, th:first-child { text-align: left; }
  tr.best td { font-weight: 700; }
  input { width: 64px; font: inherit; border: 1px solid #e7e7e4; border-radius: 4px; padding: 1px 4px; }
  .good { color: #1e7b4c; } .bad { color: #b3261e; }
  .dl { margin-top: 12px; width: 100%; border: 0; background: #0b0b0c; color: #fff; border-radius: 8px; padding: 8px; font: inherit; }
</style>
