// Walks the whole popup in headless Chrome (fake camera), screenshots every screen and
// fails on any console error. Needs the dev server: npm run dev (port 5173).
// Usage: node test/smoke.mjs [outDir]

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const URL_BASE = process.env.SEAM_URL || "http://127.0.0.1:5173/";
const OUT = process.argv[2] || "smoke-shots";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--enable-unsafe-swiftshader", "--no-first-run", "--lang=en-US"],
});
const errors = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on("pageerror", (e) => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`[${name}] console: ${m.text()}`); });
  let n = 0;
  const shot = async (label) => { await wait(450); await page.screenshot({ path: join(OUT, `${name}-${String(++n).padStart(2, "0")}-${label}.png`) }); };
  const click = async (text, sel = "button") => {
    const handle = await page.waitForFunction((sel, text) =>
      [...document.querySelectorAll(sel)].find((b) => b.textContent.trim().includes(text) && !b.disabled), { timeout: 15000 }, sel, text);
    await handle.asElement().click();
  };
  const type = async (sel, value) => { await page.waitForSelector(sel); await page.click(sel, { clickCount: 3 }); await page.type(sel, value); };

  await page.goto(URL_BASE, { waitUntil: "networkidle0" });
  await shot("product");
  await click("Find Your Size");
  await page.waitForSelector(".seam-card");
  await shot("intro");
  await click("Get started");
  await click("cm", ".seam-segment button");
  await type(".seam-number input", "178");
  await shot("height");
  await click("Continue");
  await click("kg", ".seam-segment button");
  await type(".seam-number input", "75");
  await shot("weight");
  await click("Continue");
  await shot("fit");
  await click("Regular", ".seam-row-option");
  await wait(400);
  await shot("length");
  await click("Just below", ".seam-option");
  await wait(400);
  await shot("camera");
  await click("Allow camera");
  await page.waitForSelector(".scan canvas", { timeout: 20000 });
  await wait(4000); // model loads, fake camera frames flow
  await shot("scan-front");
  await click("Skip the scan");
  await wait(250);
  await shot("processing");
  await page.waitForFunction(() => document.querySelector(".seam-title")?.textContent.includes("Which looks"), { timeout: 15000 });
  await shot("torso");
  await click("", ".seam-option");
  await page.waitForFunction(() => document.querySelector(".seam-title")?.textContent.includes("arms"), { timeout: 10000 });
  await shot("arms");
  const arms = await page.$$(".seam-option");
  await arms[1].click();
  await page.waitForSelector(".size", { timeout: 10000 });
  await shot("result");
  await click("See your measurements");
  await shot("measurements");
  await click("Done");
  await wait(400);
  await click("Save my size");
  await type("input[type=email]", "terry@example.com");
  await shot("save-email");
  await click("Send me a code");
  await type("input[inputmode=numeric]", "123456");
  await click("Verify");
  await shot("saved");
  await click("Back to shopping");
  await wait(500);
  const yourSize = await page.$eval("#yourSize", (el) => (el.hidden ? "" : el.textContent));
  await shot("product-after");
  const stored = await page.evaluate(() => ({ sessions: JSON.parse(localStorage.getItem("seam.sessions") || "[]").length, profile: !!localStorage.getItem("seam.profile") }));
  console.log(`[${name}] product page says: "${yourSize}"; sessions saved: ${stored.sessions}; profile: ${stored.profile}`);
  await page.close();
}

try {
  await run("desktop", { width: 1280, height: 860 });
  await run("phone", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
} finally {
  await browser.close();
}
if (errors.length) { console.log("ERRORS:\n  " + errors.join("\n  ")); process.exitCode = 1; }
else console.log(`OK: no errors. Screenshots in ${OUT}`);
