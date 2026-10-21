<script lang="ts">
  // MVP: accounts are simulated. Nothing is sent; the profile is kept in this browser.
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { finder } from "../state.svelte.ts";
  import { saveProfile, saveSession } from "../session.ts";
  import { focus } from "../parts/focus.ts";
  import Icon from "../parts/Icon.svelte";

  let stage = $state<"email" | "code" | "done">("email");
  let email = $state("");
  let code = $state("");
  const emailOk = $derived(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()));
  const codeOk = $derived(/^\d{6}$/.test(code));

  function sendCode() { if (emailOk) stage = "code"; }
  function verify() {
    if (!codeOk) return;
    finder.savedEmail = email.trim();
    saveProfile(finder, email.trim());
    saveSession(finder, { savedProfile: true });
    stage = "done";
  }
</script>

{#key stage}
  <div class="inner" in:fly={{ x: 24, duration: 280, easing: cubicOut }}>
    {#if stage === "email"}
      <h2 class="seam-title">Save your size</h2>
      <p class="seam-sub">Next time you see Find Your Size on any store using Seam, it will already know you. No scan needed.</p>
      <input class="field" type="email" placeholder="you@example.com" autocomplete="email" bind:value={email} use:focus onkeydown={(e) => e.key === "Enter" && sendCode()} />
      <div class="seam-spacer"></div>
      <button class="seam-primary" disabled={!emailOk} onclick={sendCode}>Send me a code</button>
      <button class="seam-link" onclick={() => finder.close()}>Not now</button>
    {:else if stage === "code"}
      <h2 class="seam-title">Check your email</h2>
      <p class="seam-sub">Enter the 6-digit code sent to {email}.</p>
      <input class="field code" inputmode="numeric" maxlength="6" placeholder="000000" bind:value={code} use:focus onkeydown={(e) => e.key === "Enter" && verify()} />
      <p class="demo">Demo: no email is sent yet. Any 6 digits work.</p>
      <div class="seam-spacer"></div>
      <button class="seam-primary" disabled={!codeOk} onclick={verify}>Verify</button>
      <button class="seam-link" onclick={() => (stage = "email")}>Use a different email</button>
    {:else}
      <div class="done">
        <div class="tick"><Icon name="check" size={30} /></div>
        <h2 class="seam-title">Size saved</h2>
        <p class="seam-sub">Your Seam profile is saved as {finder.savedEmail}. Your size here is <b>{finder.rec?.size}</b>.</p>
      </div>
      <div class="seam-spacer"></div>
      <button class="seam-primary" onclick={() => finder.close()}>Back to shopping</button>
    {/if}
  </div>
{/key}

<style>
  .inner { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 100%; }
  .field { margin-top: 28px; width: 100%; height: 56px; border: 1px solid var(--line); border-radius: 14px; padding: 0 16px; font-size: 17px; outline: 0; transition: border-color 0.2s; }
  .field:focus { border-color: var(--ink); }
  .code { letter-spacing: 0.5em; font-size: 26px; text-align: center; font-variant-numeric: tabular-nums; }
  .demo { font-size: 12px; color: var(--faint); margin: 10px 0 0; text-align: center; }
  .done { text-align: center; padding-top: 60px; }
  .tick { width: 64px; height: 64px; border-radius: 999px; background: var(--ink); color: #fff; display: grid; place-items: center; margin: 0 auto 22px; animation: pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.4); }
  @keyframes pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
