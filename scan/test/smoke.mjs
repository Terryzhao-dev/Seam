// Headless smoke test in real Chrome with Chrome's fake camera (a test pattern, no person).
// Checks: page loads, MediaPipe loads, the camera starts, the frame loop runs without errors.
// Run: node test/smoke.mjs   (screenshot saved to the path given as the first argument)

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json" };
const shot = process.argv[2] || join(ROOT, "smoke.png");

const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^\/+/, "") || "index.html";
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--enable-unsafe-swiftshader", "--no-first-run"],
});
const errors = [];
const logs = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1400 });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { logs.push(`${m.type()}: ${m.text()}`); if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  page.on("requestfailed", (r) => { if (!r.url().endsWith("favicon.ico")) errors.push(`request failed: ${r.url()} ${r.failure()?.errorText}`); });

  await page.goto(url, { waitUntil: "networkidle0" });
  await page.type("#height", "178");
  await page.type("#weight", "75");
  await page.click("#start");

  // Wait for the model to load and frames to flow (status changes away from "Loading").
  await page.waitForFunction(() => {
    const s = document.getElementById("status").textContent;
    return s && !s.startsWith("Loading");
  }, { timeout: 90000 });
  await new Promise((r) => setTimeout(r, 4000));
  const state = await page.evaluate(() => ({
    phase: document.getElementById("phase").textContent,
    status: document.getElementById("status").textContent,
    canvas: [document.getElementById("canvas").width, document.getElementById("canvas").height],
    setupMsg: document.getElementById("setupMsg").textContent,
  }));
  await page.screenshot({ path: shot });
  console.log("state:", JSON.stringify(state));
  console.log("console:", logs.filter((l) => !l.startsWith("debug")).slice(0, 15).join("\n  "));
  if (errors.length) { console.log("ERRORS:\n  " + errors.join("\n  ")); process.exitCode = 1; }
  else console.log("OK: no page errors");
  console.log("screenshot:", shot);
} finally {
  await browser.close();
  server.close();
}
