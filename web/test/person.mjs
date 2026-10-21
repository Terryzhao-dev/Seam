// End-to-end scan test with a real human figure: feeds an MJPEG video (e.g. a photo of a
// standing person, repeated) to Chrome as the camera, and checks the front pose finishes on
// its own and moves to the side pose. Needs the dev server (npm run dev).
// Usage: node test/person.mjs path/to/person.mjpeg [screenshotDir]

import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import puppeteer from "puppeteer-core";

const video = resolve(process.argv[2] || "");
const OUT = process.argv[3] || "person-shots";
mkdirSync(OUT, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${video}`, "--enable-unsafe-swiftshader", "--lang=en-US"],
});
const errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 860 });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  const click = async (text, sel = "button") => {
    const h = await page.waitForFunction((sel, text) => [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().includes(text) && !b.disabled), { timeout: 15000 }, sel, text);
    await h.asElement().click();
  };
  const type = async (sel, v) => { await page.waitForSelector(sel); await page.click(sel, { clickCount: 3 }); await page.type(sel, v); };

  await page.goto("http://127.0.0.1:5173/?debug=1", { waitUntil: "networkidle0" });
  await click("Find Your Size");
  await click("Get started");
  await click("cm", ".seam-segment button");
  await type(".seam-number input", "175");
  await click("Continue");
  await click("kg", ".seam-segment button");
  await type(".seam-number input", "75");
  await click("Continue");
  await click("Regular", ".seam-row-option");
  await wait(400);
  await click("Just below", ".seam-option");
  await wait(400);
  await click("Allow camera");
  await page.waitForSelector(".scan canvas", { timeout: 20000 });

  // Sample what the scan screen says while the front pose runs.
  const t0 = Date.now();
  const log = [];
  let movedOn = false;
  while (Date.now() - t0 < 40000) {
    const s = await page.evaluate(() => ({
      pose: document.querySelector(".scan .eyebrow")?.textContent,
      status: document.querySelector(".scan .status")?.textContent,
      sub: document.querySelector(".scan .sub")?.textContent ?? "",
      checks: [...document.querySelectorAll(".scan .checks li")].map((li) => (li.classList.contains("pass") ? "✓" : "✗") + li.textContent).join(" "),
    }));
    log.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${s.pose} | ${s.status} | ${s.sub} | ${s.checks}`);
    if (log.length === 6) await page.screenshot({ path: join(OUT, "front-live.png") });
    if (s.pose?.includes("2 of 2")) { movedOn = true; break; }
    await wait(500);
  }
  console.log(log.filter((_, i) => i % 2 === 0 || i === log.length - 1).join("\n"));
  await wait(1500);
  await page.screenshot({ path: join(OUT, "side.png") });
  // If the video also shows a side view, the side pose should finish by itself too.
  let sideDone = false;
  const t1 = Date.now();
  while (movedOn && Date.now() - t1 < 25000) {
    const title = await page.evaluate(() => document.querySelector(".seam-title")?.textContent ?? "");
    const st = await page.evaluate(() => document.querySelector(".scan .status")?.textContent ?? "");
    if (title.includes("Which looks")) { sideDone = true; break; }
    if ((Date.now() - t1) % 3000 < 600) console.log(`  side ${((Date.now() - t1) / 1000).toFixed(1)}s: ${st}`);
    await wait(500);
  }
  console.log(sideDone ? `PASS: side pose finished by itself after ${((Date.now() - t1) / 1000).toFixed(1)} s` : "side pose did not finish (expected if the video has no side view)");
  if (sideDone) {
    await wait(800);
    await page.screenshot({ path: join(OUT, "after-scan-torso.png") });
    const dbg = await page.evaluate(() => document.querySelector(".dbg")?.innerText ?? "");
    console.log(dbg.split("\n").filter((l) => /^(Scan quality|chest_|waist_|outer_|joint_|upper_arm|arm_length|neck_height|crotch)/.test(l)).slice(0, 16).join("\n"));
  }
  const front = await page.evaluate(() => document.querySelector(".dbg")?.textContent?.includes("Step scanSide"));
  console.log(movedOn ? `PASS: front pose finished by itself after ${((Date.now() - t0) / 1000).toFixed(1)} s and moved to the side pose (debug step check: ${front})` : "FAIL: front pose did not finish within 30 s");
  if (!movedOn) process.exitCode = 1;
} finally {
  await browser.close();
}
if (errors.length) { console.log("ERRORS:\n  " + errors.join("\n  ")); process.exitCode = 1; }
