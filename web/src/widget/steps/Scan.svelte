<script lang="ts">
  import { onMount } from "svelte";
  import { finder } from "../state.svelte.ts";
  import { Scanner, type Check, type ScanUpdate } from "../scanner.ts";
  import { CHECK_POINTS, THRESHOLD, STILL_MS, STILL_THRESHOLD } from "../../core/capture.ts";
  import Icon from "../parts/Icon.svelte";

  let { pose }: { pose: "front" | "side" } = $props();

  let canvas: HTMLCanvasElement;
  let status = $state("Starting");
  let checks = $state<Check[]>([]);
  let phase = $state<"setup" | "capture">("setup");
  let score = $state(0);
  let stillFor = $state(0);
  let camLabel = $state("");
  let camCount = $state(1);
  let voice = $state(true);
  let lastSaid = "", lastAt = 0;

  const INTRO = {
    front: "Step back until your whole body is in view. Arms straight, out to the sides. Feet hip-width apart.",
    side: "Great. Now turn to your left so your side faces the camera. Arms straight down by your sides.",
  };

  // Checks listed most important first, with their points.
  const points = $derived(CHECK_POINTS[pose]);
  const ordered = $derived([...checks].sort((a, b) => (points[b.id] ?? 0) - (points[a.id] ?? 0)));

  function say(text: string, force = false) {
    if (!voice || !text || typeof speechSynthesis === "undefined") return;
    const now = performance.now();
    if (!force && (now - lastAt < 2600 || (text === lastSaid && now - lastAt < 6000))) return;
    lastSaid = text; lastAt = now;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  function update(u: ScanUpdate) {
    status = u.status;
    checks = u.checks;
    score = u.score;
    stillFor = u.stillFor;
    if (u.phase !== phase) { phase = u.phase; if (phase === "capture") say("Got it", true); }
    if (phase === "setup" && u.status && u.status !== "Hold it there" && u.status !== "Hold still") say(u.status);
  }

  onMount(() => {
    let alive = true;
    say(INTRO[pose], true);
    (async () => {
      try {
        finder.scanner ??= new Scanner();
        if (!finder.scanner.stream) await finder.scanner.startCamera();
        camLabel = finder.scanner.cameraLabel;
        camCount = (await finder.scanner.cameras()).length;
        const cap = await finder.scanner.capture(pose, finder.heightCm!, pose === "side" ? finder.front?.heights ?? null : null, canvas, update);
        if (!alive) return;
        await new Promise((r) => setTimeout(r, 350)); // let the "Got it" register
        if (!alive) return;
        if (pose === "front") { finder.front = cap; finder.go("scanSide"); }
        else { finder.side = cap; finder.scanner.stop(); finder.go("processing"); }
      } catch (e: any) {
        if (alive) { status = `Camera problem: ${e?.message || e}`; }
      }
    })();
    return () => { alive = false; if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); };
  });

  async function switchCamera() {
    if (!finder.scanner) return;
    camLabel = "Switching…";
    try { camLabel = await finder.scanner.nextCamera(); } catch (e: any) { camLabel = `Couldn't switch (${e?.message || e})`; }
  }

  // Short camera name: "MacBook Pro Camera", "iPhone Camera", "Back Ultra Wide Camera".
  const shortLabel = (l: string) => l.replace(/\s*\([^)]*\)/g, "").trim() || "Camera";

  function skip() {
    finder.scanner?.stop();
    finder.scanSkipped = true;
    finder.front = finder.side = null;
    finder.go("processing");
  }
</script>

<div class="scan">
  <canvas bind:this={canvas}></canvas>

  <div class="top">
    <div>
      <p class="eyebrow">Pose {pose === "front" ? "1" : "2"} of 2</p>
      <h2>{pose === "front" ? "Face the camera, arms out" : "Turn to your side, arms down"}</h2>
    </div>
    <div class="actions">
      {#if camCount > 1}
        <button class="cam" onclick={switchCamera} aria-label="Switch camera">{shortLabel(camLabel)} · switch</button>
      {/if}
      <button class="round" aria-label={voice ? "Mute voice" : "Turn on voice"} onclick={() => (voice = !voice)}><Icon name={voice ? "sound" : "mute"} /></button>
      <button class="round" aria-label="Back" onclick={() => finder.back()}><Icon name="close" /></button>
    </div>
  </div>

  <div class="bottom">
    <div class="status-row">
      <div class="score" class:done={phase === "capture"}><b>{score}</b><span>/100</span></div>
      <div>
        <p class="status">{status}</p>
        {#if phase === "setup" && checks.length}
          {#if pose === "side" && checks.some((c) => c.id === "turned" && !c.pass)}
            <p class="sub">Turn so your side faces the camera to continue</p>
          {:else}
            <p class="sub">Moves on at {THRESHOLD}{score >= STILL_THRESHOLD && stillFor > 1000 ? `, or in ${Math.max(0, Math.ceil((STILL_MS - stillFor) / 1000))} s if you hold still` : ""}</p>
          {/if}
        {/if}
      </div>
    </div>
    <ul class="checks">
      {#each ordered as c (c.id)}<li class:pass={c.pass}>{c.label}<span class="pts">{points[c.id] ?? 0}</span></li>{/each}
    </ul>
    <button class="skip" onclick={skip}>Having trouble? Skip the scan</button>
  </div>
</div>

<style>
  .scan { position: absolute; inset: 0; background: #0b0b0c; color: #fff; overflow: hidden; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
  .top { position: absolute; top: 0; left: 0; right: 0; padding: 22px 24px 40px; display: flex; justify-content: space-between; align-items: flex-start; background: linear-gradient(rgba(0,0,0,0.55), transparent); }
  .eyebrow { margin: 0 0 6px; font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.75; }
  h2 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }
  .actions { display: flex; gap: 8px; }
  .round { width: 42px; height: 42px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.16); color: #fff !important; display: grid; place-items: center; backdrop-filter: blur(8px); }
  .bottom { position: absolute; left: 0; right: 0; bottom: 0; padding: 48px 24px 22px; background: linear-gradient(transparent, rgba(0,0,0,0.7)); }
  .status-row { display: flex; align-items: center; gap: 14px; }
  .status { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
  .sub { margin: 4px 0 0; font-size: 13px; opacity: 0.75; }
  .cam { height: 42px; border-radius: 999px; border: 0; background: rgba(255,255,255,0.16); color: #fff !important; padding: 0 14px; font-size: 13px; backdrop-filter: blur(8px); max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .checks { list-style: none; padding: 0; margin: 14px 0 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .checks li { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 6px 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.7); transition: background 0.25s, color 0.25s; }
  .checks li.pass { background: #30d158; color: #06240f; }
  .pts { font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 999px; background: rgba(0,0,0,0.25); }
  .score { display: flex; align-items: baseline; gap: 2px; min-width: 82px; }
  .score b { font-size: 40px; font-weight: 650; letter-spacing: -0.03em; transition: color 0.25s; }
  .score span { font-size: 14px; opacity: 0.6; }
  .score.done b { color: #30d158; }
  .skip { margin-top: 14px; border: 0; background: none; color: rgba(255,255,255,0.7) !important; font-size: 13px; text-decoration: underline; text-underline-offset: 3px; padding: 0; }
</style>
