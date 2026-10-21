<script lang="ts">
  import { finder } from "../state.svelte.ts";
  import { Scanner } from "../scanner.ts";

  let starting = $state(false);

  async function allow() {
    starting = true;
    finder.error = null;
    try {
      finder.scanner ??= new Scanner();
      await finder.scanner.startCamera();
      finder.scanSkipped = false;
      finder.go("scanFront");
    } catch (e: any) {
      finder.error = e?.name === "NotAllowedError"
        ? "Camera access was blocked. Allow it in your browser's address bar, or skip the scan."
        : `The camera didn't start (${e?.message || e}). You can skip the scan instead.`;
    } finally {
      starting = false;
    }
  }

  function skip() {
    finder.scanner?.stop();
    finder.scanSkipped = true;
    finder.front = null;
    finder.side = null;
    finder.go("processing");
  }
</script>

<h2 class="seam-title">Now a quick scan</h2>
<p class="seam-sub">Two poses, a few seconds each. It captures by itself when you're in position.</p>

<div class="setup">
  <svg viewBox="0 0 300 120" width="100%" aria-hidden="true">
    <line x1="10" y1="108" x2="290" y2="108" stroke="#e7e7e4" stroke-width="2" />
    <!-- shelf + device -->
    <rect x="22" y="64" width="44" height="4" rx="2" fill="#d6d6d2" />
    <rect x="38" y="44" width="13" height="20" rx="2.5" fill="#0b0b0c" />
    <line x1="44" y1="68" x2="44" y2="108" stroke="#d6d6d2" stroke-width="3" />
    <!-- distance -->
    <line x1="64" y1="92" x2="212" y2="92" stroke="#a1a1a6" stroke-width="1" stroke-dasharray="3 3" />
    <text x="138" y="86" text-anchor="middle" font-size="11" fill="#6b6b70">2 to 3 m</text>
    <!-- person in A-pose -->
    <circle cx="240" cy="22" r="8" fill="#cfcfcb" />
    <path d="M232 33 h16 l2 34 h-20z" fill="#cfcfcb" />
    <path d="M232 35 l-12 26 M248 35 l12 26" stroke="#cfcfcb" stroke-width="5" stroke-linecap="round" />
    <path d="M233 66 l-4 41 M247 66 l4 41" stroke="#cfcfcb" stroke-width="6" stroke-linecap="round" />
  </svg>
</div>

<ul class="seam-list">
  <li><span class="k">Device</span><span>Upright at about waist height, screen not tilted back. Step back 2 to 3 m.</span></li>
  <li><span class="k">You</span><span>One T-shirt, no hoodie or jacket. Barefoot, hair off your shoulders.</span></li>
  <li><span class="k">Room</span><span>Good light, plain background, nobody else in view.</span></li>
  <li><span class="k">Tip</span><span>Prop your phone instead for a wider view: on a Mac, pick "iPhone Camera" on the next screen. If your Mac has Center Stage, turn it off in Control Center so it doesn't zoom in.</span></li>
</ul>

{#if finder.error}<p class="seam-hint err msg">{finder.error}</p>{/if}

<div class="seam-spacer"></div>
<button class="seam-primary" onclick={allow} disabled={starting}>{starting ? "Starting camera…" : "Allow camera"}</button>
<button class="seam-link" onclick={skip}>Skip the scan (less accurate)</button>

<style>
  .setup { margin: 22px 0 4px; padding: 16px; background: var(--soft); border-radius: var(--radius); }
  .msg { text-align: left; margin-top: 14px; }
</style>
