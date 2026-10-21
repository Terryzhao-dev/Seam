// Seam Scan v0: camera or photos -> MediaPipe -> measurements -> estimates -> size, plus
// tape comparison and saved sessions (the data that later trains Seam's own model).

import { PoseLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/vision_bundle.mjs";
import * as M from "./measure.js";
import * as E from "./engine.js";

const APP_VERSION = "scan-v0.1";
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const modelUrl = (v) => `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${v}/float16/latest/pose_landmarker_${v}.task`;
const FRAMES = 40;        // frames measured per pose
const HOLD = 12;          // frames the pose must pass before capture starts
const STILL_FRAMES = 15;  // window for the "holding still" check
const STILL_TOL = 0.012;  // max landmark drift in that window, share of frame height

const ORDER = ["chest_girth", "waist_girth", "outer_shoulder", "torso_length", "upper_arm", "arm_length",
  "chest_width", "chest_depth", "waist_width", "waist_depth", "hip_girth", "hip_width", "hip_depth", "inseam"];
const TARGET = { chest_girth: 2.5, waist_girth: 3, outer_shoulder: 1.5, torso_length: 2, upper_arm: 2, arm_length: 2 };

const TAPE_FIELDS = [
  ["height_cm", "Height, barefoot", "Back and heels against a wall. Lay a hardback book flat on your head against the wall, mark under it, measure floor to mark."],
  ["weight_kg", "Weight (kg)", "Bathroom scale, light clothes."],
  ["chest_girth", "Chest girth", "Tape round the chest at armpit level, level all the way round (check in a mirror). Arms down, breathe out normally, snug not tight."],
  ["waist_girth", "Waist girth", "Tape round the waist at the navel, stomach relaxed, after breathing out."],
  ["hip_girth", "Hip girth", "Round the widest part of the buttocks, feet together."],
  ["outer_shoulder", "Outer shoulder width", "Back flat against a wall. Hold two hardback books flat against the wall, one touching the outside of each shoulder at its widest point. Step out, measure between the books."],
  ["torso_length", "Torso length (neck base to crotch)", "Mark two heights on the wall: where your neck meets the top of your shoulder (hold a ruler level from that point to the wall) and your crotch height (see inseam). Subtract."],
  ["upper_arm", "Upper arm (shoulder tip to elbow)", "Arm hanging straight: from the bony tip of the shoulder to the point of the elbow. Easier with a helper."],
  ["arm_length", "Arm length (shoulder tip to wrist)", "Arm straight down: bony tip of the shoulder to the wrist bone on the little-finger side."],
  ["inseam", "Inseam (crotch to floor)", "Barefoot, back to a wall. Push a hardback book up between your legs, spine up and level, as high as comfortable. Mark the top of the book, measure floor to mark."],
  ["chest_width", "Chest width (caliper, optional)", "Sliding caliper across the chest at armpit level, arms slightly out."],
  ["chest_depth", "Chest depth (caliper, optional)", "Caliper front to back at the same height, after breathing out."],
  ["waist_width", "Waist width (caliper, optional)", "Across the waist at the navel."],
  ["waist_depth", "Waist depth (caliper, optional)", "Front to back at the navel."],
];

const $ = (id) => document.getElementById(id);
const video = $("video"), canvas = $("canvas"), ctx = canvas.getContext("2d");
const S = {
  models: null, charts: [], calibration: {}, landmarker: null, variant: null, mode: null, delegate: null,
  stream: null, running: false, phase: "idle", hold: 0, recent: [], lastVideoTime: -1,
  frames: { front: [], side: [] }, snaps: {}, frontHeights: null, rows: null,
  inputs: null, session: null, lastSaid: "", lastSaidAt: 0, clearArmed: false,
};

// ---------- storage ----------

const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { console.warn("storage failed", e); return false; } },
};
const sessions = () => store.get("seam.sessions", []);
function saveSession(s) {
  const { silhouettes, ...light } = s; // silhouettes only go into exports, to keep storage small
  const all = sessions().filter((x) => x.id !== s.id);
  all.push(light);
  store.set("seam.sessions", all);
  renderSessions();
}

// ---------- setup ----------

async function init() {
  const [models, charts, calibration] = await Promise.all([
    fetch("models.json").then((r) => r.json()),
    fetch("charts.json").then((r) => r.json()),
    fetch("calibration.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  S.models = models;
  S.charts = charts;
  S.calibration = calibration;
  const custom = store.get("seam.customChart", null);
  if (custom) S.charts.push(custom);
  const last = store.get("seam.inputs", null);
  if (last) {
    $("height").value = last.height_cm ?? "";
    $("weight").value = last.weight_kg ?? "";
    $("age").value = last.age ?? "";
    $("style").value = last.fit_style ?? "regular";
  }
  renderChartSelect();
  renderTapeForm();
  renderSessions();
  $("start").onclick = () => startCamera().catch(fail);
  $("photos").onclick = () => measurePhotos().catch(fail);
  $("cancel").onclick = () => { stopCamera(); show("setup"); };
  $("again").onclick = () => { show("setup"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  $("chart").onchange = () => { if (S.session) { renderRecommendation(S.session); saveSession(S.session); } };
  $("saveChart").onclick = saveCustomChart;
  $("compare").onclick = compareTape;
  $("exportJson").onclick = exportJson;
  $("exportCsv").onclick = exportCsv;
  $("clear").onclick = clearSessions;
}

function readInputs() {
  const h = parseFloat($("height").value), w = parseFloat($("weight").value);
  const age = $("age").value ? parseInt($("age").value, 10) : null;
  if (!(h >= 140 && h <= 215)) return msg("Enter your barefoot height in cm (140 to 215)."), null;
  if (!(w >= 40 && w <= 200)) return msg("Enter your weight in kg (40 to 200)."), null;
  const inputs = { height_cm: h, weight_kg: w, age, fit_style: $("style").value };
  store.set("seam.inputs", inputs);
  msg("");
  return inputs;
}

function msg(text) { $("setupMsg").textContent = text; }
function fail(e) { console.error(e); stopCamera(); show("setup"); msg(`Something went wrong: ${e.message || e}`); }
function show(which) {
  $("setup").classList.toggle("hidden", which !== "setup");
  $("scan").classList.toggle("hidden", which !== "scan");
  $("results").classList.toggle("hidden", which !== "results");
  $("tape").classList.toggle("hidden", which !== "results");
}

async function getLandmarker(mode) {
  const variant = $("model").value;
  if (!S.landmarker || S.variant !== variant) {
    setStatus("Loading the pose model (about 25 MB the first time)");
    $("phase").textContent = "Loading";
    const fileset = await FilesetResolver.forVisionTasks(WASM);
    const make = (delegate) => PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: modelUrl(variant), delegate },
      runningMode: mode, numPoses: 1, outputSegmentationMasks: true,
    });
    try { S.landmarker = await make("GPU"); S.delegate = "GPU"; }
    catch (e) { console.warn("GPU unavailable, using CPU", e); S.landmarker = await make("CPU"); S.delegate = "CPU"; }
    S.variant = variant;
    S.mode = mode;
  } else if (S.mode !== mode) {
    await S.landmarker.setOptions({ runningMode: mode });
    S.mode = mode;
  }
  return S.landmarker;
}

function resetCapture() {
  S.frames = { front: [], side: [] };
  S.snaps = {};
  S.frontHeights = null;
  S.rows = null;
  S.hold = 0;
  S.recent = [];
  setProgress(0);
}

// ---------- camera scan ----------

async function startCamera() {
  const inputs = readInputs();
  if (!inputs) return;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("this browser cannot use the camera here (it needs localhost or https)");
  S.inputs = inputs;
  resetCapture();
  show("scan");
  canvas.classList.add("mirror");
  await getLandmarker("VIDEO");
  S.stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }, audio: false,
  });
  video.srcObject = S.stream;
  await video.play();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  S.phase = "front-setup";
  S.running = true;
  $("phase").textContent = "Pose 1 of 2: front";
  say("Step back until your whole body is in view. Arms straight, out to the sides. Feet hip-width apart.", true);
  requestAnimationFrame(loop);
}

function stopCamera() {
  S.running = false;
  S.stream?.getTracks().forEach((t) => t.stop());
  S.stream = null;
  speechSynthesis?.cancel();
}

function loop() {
  if (!S.running) return;
  if (video.readyState >= 2 && video.currentTime !== S.lastVideoTime) {
    S.lastVideoTime = video.currentTime;
    let res = null;
    try { res = S.landmarker.detectForVideo(video, performance.now()); }
    catch (e) { console.error(e); }
    if (res) { onFrame(res, video); res.close?.(); }
  }
  requestAnimationFrame(loop);
}

function readResult(res) {
  const lms = res.landmarks?.[0] || null;
  const m = res.segmentationMasks?.[0];
  const mask = m ? M.binarise(m.getAsFloat32Array(), m.width, m.height) : null;
  return { lms, mask };
}

function isStill(recent, height) {
  for (let i = 0; i < recent[0].length; i++) {
    const vals = recent.map((r) => r[i]);
    if ((Math.max(...vals) - Math.min(...vals)) / height > STILL_TOL) return false;
  }
  return true;
}

function onFrame(res, source) {
  const { lms, mask } = readResult(res);
  const pose = S.phase.startsWith("front") ? "front" : "side";
  draw(source, mask, lms);
  if (!lms || !mask) {
    S.hold = 0;
    showChecks([]);
    setStatus("Step into view");
    return;
  }
  const ext = M.bodyExtent(mask);
  const chk = M.checkPose(pose, lms, mask.width, mask.height, ext);
  const p = M.toPx(lms, mask.width, mask.height);
  S.recent.push([p[11].x, p[11].y, p[12].x, p[12].y, p[23].x, p[23].y, p[24].x, p[24].y]);
  if (S.recent.length > STILL_FRAMES) S.recent.shift();
  const still = S.recent.length === STILL_FRAMES && isStill(S.recent, mask.height);
  chk.checks.push({ id: "still", label: "Holding still", pass: still, hint: "Hold still" });
  const failing = chk.checks.find((c) => !c.pass);
  showChecks(chk.checks);

  if (S.phase.endsWith("setup")) {
    S.hold = failing ? 0 : S.hold + 1;
    setStatus(failing ? failing.hint : "Hold it there");
    if (failing && failing.id !== "still") say(failing.hint);
    if (S.hold >= HOLD) { S.phase = `${pose}-capture`; S.hold = 0; say("Hold still", true); }
    return;
  }
  if (S.phase.endsWith("capture")) {
    if (!failing) {
      const r = pose === "front"
        ? M.measureFront(mask, lms, S.inputs.height_cm)
        : M.measureSide(mask, lms, S.inputs.height_cm, S.frontHeights);
      if (r.ok) {
        S.frames[pose].push(r);
        S.rows = { pose, ...(r.rows || {}) };
        if (S.frames[pose].length === FRAMES / 2) S.snaps[pose] = { silhouette: silhouette(mask), landmarks: bodyLandmarks(lms) };
        setStatus("Measuring, hold still");
      } else setStatus(r.reason);
    } else setStatus(failing.hint);
    setProgress(S.frames[pose].length / FRAMES);
    if (S.frames[pose].length >= FRAMES) poseDone(pose);
  }
}

function poseDone(pose) {
  if (pose === "front") {
    S.frontHeights = medianHeights(S.frames.front);
    S.phase = "side-setup";
    S.recent = [];
    S.rows = null;
    setProgress(0);
    $("phase").textContent = "Pose 2 of 2: side";
    say("Great. Now turn to your left so your side faces the camera. Arms straight down by your sides. Feet together.", true);
  } else {
    stopCamera();
    say("Done", true);
    finish("camera");
  }
}

// ---------- photo mode ----------

async function measurePhotos() {
  const inputs = readInputs();
  if (!inputs) return;
  const fFile = $("photoFront").files[0], sFile = $("photoSide").files[0];
  if (!fFile || !sFile) return msg("Choose both a front and a side photo.");
  S.inputs = inputs;
  resetCapture();
  show("scan");
  canvas.classList.remove("mirror");
  $("phase").textContent = "Measuring photos";
  const lm = await getLandmarker("IMAGE");
  for (const [pose, file] of [["front", fFile], ["side", sFile]]) {
    const img = await loadImage(file);
    canvas.width = img.width;
    canvas.height = img.height;
    const res = lm.detect(img);
    const { lms, mask } = readResult(res);
    res.close?.();
    if (!lms || !mask) throw new Error(`no person found in the ${pose} photo`);
    const chk = M.checkPose(pose, lms, mask.width, mask.height, M.bodyExtent(mask));
    showChecks(chk.checks);
    const r = pose === "front" ? M.measureFront(mask, lms, inputs.height_cm) : M.measureSide(mask, lms, inputs.height_cm, S.frontHeights);
    if (!r.ok) throw new Error(`${pose} photo: ${r.reason}${chk.hint ? ` (${chk.hint})` : ""}`);
    S.frames[pose] = [r];
    S.rows = { pose, ...(r.rows || {}) };
    S.snaps[pose] = { silhouette: silhouette(mask), landmarks: bodyLandmarks(lms), checksFailed: chk.checks.filter((c) => !c.pass).map((c) => c.id) };
    draw(img, mask, lms);
    if (pose === "front") S.frontHeights = medianHeights(S.frames.front);
  }
  finish("photos");
}

// Phone photos are large; scale to at most 1280 px on the long side.
async function loadImage(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

// ---------- results ----------

function medianHeights(frames) {
  const out = {};
  for (const key of Object.keys(frames[0]?.heights || {})) out[key] = M.median(frames.map((f) => f.heights[key]));
  return out;
}

function medianProfile(frames) {
  if (!frames.length) return [];
  return frames[0].profile.map(([f], i) => {
    const m = M.median(frames.map((fr) => fr.profile[i]?.[1]));
    return [f, m == null ? null : Math.round(m * 10) / 10];
  });
}

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const roundEst = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v, mean: round1(v.mean), sd: round1(v.sd), ...(v.cameraWeight != null ? { cameraWeight: Math.round(v.cameraWeight * 100) / 100 } : {}) }]));

function finish(source) {
  const fs = M.summarise(S.frames.front.map((f) => f.values));
  const ss = M.summarise(S.frames.side.map((f) => f.values));
  const raw = {};
  for (const [k, v] of Object.entries({ ...fs, ...ss })) raw[k] = round1(v.median);
  const q = M.quality(fs, ss, S.frontHeights, S.inputs.height_cm, S.models.proportions);
  const prior = E.priorEstimates(S.models, S.inputs);
  const camera = E.cameraEstimates(S.models, S.inputs, raw, q.q, S.calibration);
  const combined = E.combine(prior, camera);
  const s = {
    id: crypto.randomUUID(),
    created: new Date().toISOString(),
    app: APP_VERSION,
    source,
    model: { variant: S.variant, delegate: S.delegate, mediapipe: "1.1.1" },
    device: { userAgent: navigator.userAgent, frame: [canvas.width, canvas.height] },
    inputs: S.inputs,
    quality: q,
    raw,
    spread: Object.fromEntries(Object.entries({ ...fs, ...ss }).map(([k, v]) => [k, { iqr: round1(v.iqr), n: v.n }])),
    front: { heights: roundObj(S.frontHeights), profile: medianProfile(S.frames.front), landmarks: S.snaps.front?.landmarks, checksFailed: S.snaps.front?.checksFailed },
    side: { profile: medianProfile(S.frames.side), landmarks: S.snaps.side?.landmarks, checksFailed: S.snaps.side?.checksFailed },
    prior: roundEst(prior),
    camera: roundEst(camera),
    combined: roundEst(combined),
    tape: store.get("seam.tape", null),
    silhouettes: { front: S.snaps.front?.silhouette, side: S.snaps.side?.silhouette },
  };
  S.session = s;
  renderResults(s);
  saveSession(s);
  show("results");
  if (s.tape) compareTape();
  $("results").scrollIntoView({ behavior: "smooth" });
}

const roundObj = (o) => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, round1(v)]));
const fmt = (e) => (e && e.mean != null ? `${e.mean.toFixed(1)} <span class="small">± ${e.sd.toFixed(1)}</span>` : "-");

function renderResults(s) {
  S.session = s;
  renderRecommendation(s);
  const q = s.quality;
  $("quality").innerHTML = `Scan quality <b>${Math.round(q.q * 100)}%</b> (steadiness ${Math.round(q.steadiness * 100)}%, body proportions ${Math.round(q.proportion * 100)}%${q.proportionZ > 2 ? `: proportions look ${q.proportionZ} SD off, camera may be tilted` : ""}). Source: ${s.source}, ${s.model.variant} model.`;
  const rows = ORDER.filter((k) => s.prior[k] || s.camera[k]).map((k) => `<tr><td>${E.LABELS[k]}</td><td>${fmt(s.camera[k])}</td><td>${fmt(s.prior[k])}</td><td>${fmt(s.combined[k])}</td><td>${s.combined[k]?.cameraWeight != null ? Math.round(s.combined[k].cameraWeight * 100) + "%" : "-"}</td></tr>`);
  const extra = ["joint_shoulder", "leg_length"].filter((k) => s.raw[k] != null).map((k) => `<tr><td>${E.LABELS[k]} <span class="small">(raw)</span></td><td>${s.raw[k].toFixed(1)}</td><td>-</td><td>-</td><td>-</td></tr>`);
  $("estimates").innerHTML = `<tr><th>cm</th><th>Camera</th><th>Height/weight</th><th>Combined</th><th>Camera weight</th></tr>${rows.join("")}${extra.join("")}`;
  $("silhouettes").innerHTML = ["front", "side"].filter((p) => s.silhouettes?.[p]).map((p) => `<figure><img src="${s.silhouettes[p]}" alt="${p} outline"><figcaption>${p}</figcaption></figure>`).join("");
}

function renderRecommendation(s) {
  const chart = S.charts.find((c) => c.id === $("chart").value) || S.charts[0];
  const rec = E.recommend(s.combined, chart, s.inputs.fit_style);
  s.recommendation = { chart: chart.id, size: rec.size, between: rec.between, notes: rec.notes.map((n) => n.text) };
  $("size").textContent = rec.size;
  $("between").textContent = rec.between ? `Between ${rec.size} and ${rec.between}` : `${chart.name}, ${s.inputs.fit_style} fit`;
  $("notes").innerHTML = rec.notes.map((n) => `<li>${n.text}</li>`).join("");
  const zones = Object.keys(E.FIT);
  $("sizeTable").innerHTML = `<tr><th>Size</th>${zones.map((z) => `<th>${z} ease vs target</th>`).join("")}<th>Fit score</th></tr>` +
    rec.rows.map((r) => `<tr class="${r.size === rec.size ? "best" : ""}"><td>${r.size}${r.wearable ? "" : " (too tight)"}</td>${zones.map((z) => {
      const zz = r.zones.find((x) => x.zone === z);
      return `<td>${zz ? `${zz.ease.toFixed(1)} / ${zz.target}` : "-"}</td>`;
    }).join("")}<td>${Math.round(r.score * 100)}</td></tr>`).join("");
}

function renderChartSelect() {
  $("chart").innerHTML = S.charts.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
}

function saveCustomChart() {
  const sizes = $("customChart").value.split("\n").map((l) => l.split(",").map((x) => x.trim())).filter((p) => p.length >= 3 && p[0])
    .map(([size, chest, length, shoulder]) => ({ size, chest_width_flat: parseFloat(chest), body_length: parseFloat(length), ...(shoulder ? { shoulder_width: parseFloat(shoulder) } : {}) }));
  if (!sizes.length || sizes.some((s) => !Number.isFinite(s.chest_width_flat) || !Number.isFinite(s.body_length))) {
    $("customChart").setCustomValidity("Use: size, chest width flat, body length");
    $("customChart").reportValidity();
    return;
  }
  $("customChart").setCustomValidity("");
  const chart = { id: "custom", name: "My tee", source: "entered by hand", tolerance_cm: 1, sizes };
  S.charts = S.charts.filter((c) => c.id !== "custom").concat(chart);
  store.set("seam.customChart", chart);
  renderChartSelect();
  $("chart").value = "custom";
  if (S.session) renderRecommendation(S.session);
}

// ---------- tape comparison ----------

function renderTapeForm() {
  const tape = store.get("seam.tape", {}) || {};
  $("tapeForm").innerHTML = TAPE_FIELDS.map(([id, label, how]) => `<label>${label}<input id="tape_${id}" type="number" step="0.1" inputmode="decimal" value="${tape[id] ?? ""}"><span class="how">${how}</span></label>`).join("");
}

function compareTape() {
  if (!S.session) return;
  const tape = {};
  for (const [id] of TAPE_FIELDS) { const v = $(`tape_${id}`).value; if (v !== "") tape[id] = parseFloat(v); }
  store.set("seam.tape", tape);
  const s = S.session;
  s.tape = tape;
  const rows = E.compareToTape(tape, s.camera, s.prior, s.combined);
  const cls = (err, key) => (err == null ? "" : Math.abs(err) <= (TARGET[key] ?? 2) ? "good" : "bad");
  const cell = (v, err, key) => (v == null ? "<td>-</td>" : `<td>${v.toFixed(1)} <span class="${cls(err, key)}">(${err > 0 ? "+" : ""}${err.toFixed(1)})</span></td>`);
  $("comparison").innerHTML = rows.length
    ? `<tr><th>cm (error vs tape)</th><th>Tape</th><th>Camera</th><th>Height/weight</th><th>Combined</th><th>Target</th></tr>` +
      rows.map((r) => `<tr><td>${r.label}</td><td>${r.tape.toFixed(1)}</td>${cell(r.camera, r.cameraErr, r.key)}${cell(r.prior, r.priorErr, r.key)}${cell(r.combined, r.combinedErr, r.key)}<td>± ${TARGET[r.key] ?? 2}</td></tr>`).join("")
    : "";
  if (tape.height_cm) {
    const d = s.inputs.height_cm - tape.height_cm;
    $("heightNote").textContent = Math.abs(d) >= 0.5
      ? `You typed ${s.inputs.height_cm} cm but measured ${tape.height_cm} cm. Typed height sets the scale, so every camera length is ${Math.abs((d / tape.height_cm) * 100).toFixed(1)}% too ${d > 0 ? "big" : "small"}.`
      : "";
  }
  s.comparison = rows.map((r) => ({ key: r.key, tape: r.tape, cameraErr: round1(r.cameraErr), priorErr: round1(r.priorErr), combinedErr: round1(r.combinedErr) }));
  saveSession(s);
}

// ---------- sessions ----------

function renderSessions() {
  const all = sessions();
  $("sessionTable").innerHTML = all.length
    ? `<tr><th>When</th><th>Source</th><th>Quality</th><th>Chest girth</th><th>Size</th><th>Chest error vs tape</th><th></th></tr>` +
      all.slice().reverse().map((s) => {
        const ce = s.comparison?.find((c) => c.key === "chest_girth")?.combinedErr;
        return `<tr><td>${new Date(s.created).toLocaleString()}</td><td>${s.source}</td><td>${Math.round(s.quality.q * 100)}%</td><td>${s.combined.chest_girth?.mean ?? "-"}</td><td>${s.recommendation?.size ?? "-"}</td><td>${ce == null ? "-" : (ce > 0 ? "+" : "") + ce}</td><td><button data-view="${s.id}">View</button></td></tr>`;
      }).join("")
    : `<tr><td>No sessions yet.</td></tr>`;
  $("sessionTable").querySelectorAll("[data-view]").forEach((b) => {
    b.onclick = () => {
      const s = sessions().find((x) => x.id === b.dataset.view);
      if (!s) return;
      S.session = s;
      renderResults(s);
      show("results");
      if (s.tape) { renderTapeFormFrom(s.tape); compareTape(); }
      $("results").scrollIntoView({ behavior: "smooth" });
    };
  });
  renderRepeatability(all.filter((s) => s.source === "camera"));
}

function renderTapeFormFrom(tape) {
  for (const [id] of TAPE_FIELDS) $(`tape_${id}`).value = tape[id] ?? "";
}

function renderRepeatability(list) {
  if (list.length < 2) { $("repeat").innerHTML = `<tr><td>Needs at least 2 camera sessions.</td></tr>`; return; }
  const keys = ["chest_width", "chest_depth", "waist_width", "waist_depth", "outer_shoulder", "torso_length", "upper_arm", "arm_length", "inseam"];
  const rows = keys.map((k) => {
    const v = list.map((s) => s.raw[k]).filter((x) => x != null);
    if (v.length < 2) return "";
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / (v.length - 1));
    return `<tr><td>${E.LABELS[k]}</td><td>${v.length}</td><td>${mean.toFixed(1)}</td><td class="${sd <= 1 ? "good" : "bad"}">${sd.toFixed(2)}</td><td>${(Math.max(...v) - Math.min(...v)).toFixed(1)}</td></tr>`;
  });
  $("repeat").innerHTML = `<tr><th>cm</th><th>Sessions</th><th>Mean</th><th>SD (target ≤ 1.0)</th><th>Range</th></tr>${rows.join("")}`;
}

function download(name, text, type) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

function exportJson() {
  const all = sessions().map((s) => (S.session && s.id === S.session.id ? { ...s, silhouettes: S.session.silhouettes } : s));
  download(`seam-sessions-${stamp()}.json`, JSON.stringify({ exported: new Date().toISOString(), app: APP_VERSION, sessions: all }, null, 1), "application/json");
}

function exportCsv() {
  const flat = sessions().map((s) => {
    const row = { id: s.id, created: s.created, source: s.source, model: s.model.variant, height_typed: s.inputs.height_cm, weight_typed: s.inputs.weight_kg, age: s.inputs.age, fit_style: s.inputs.fit_style, quality: s.quality.q, size: s.recommendation?.size ?? "" };
    for (const [k, v] of Object.entries(s.raw)) row[`raw_${k}`] = v;
    for (const [k, v] of Object.entries(s.prior)) row[`prior_${k}`] = v.mean;
    for (const [k, v] of Object.entries(s.combined)) row[`combined_${k}`] = v.mean;
    for (const [k, v] of Object.entries(s.tape || {})) row[`tape_${k}`] = v;
    return row;
  });
  const cols = [...new Set(flat.flatMap((r) => Object.keys(r)))];
  const esc = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  download(`seam-sessions-${stamp()}.csv`, [cols.join(","), ...flat.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n"), "text/csv");
}

function clearSessions() {
  if (!S.clearArmed) {
    S.clearArmed = true;
    $("clear").textContent = "Click again to delete all sessions";
    setTimeout(() => { S.clearArmed = false; $("clear").textContent = "Clear all"; }, 4000);
    return;
  }
  store.set("seam.sessions", []);
  S.clearArmed = false;
  $("clear").textContent = "Clear all";
  renderSessions();
}

// ---------- drawing and feedback ----------

let maskCanvas = null;
function draw(source, mask, lms) {
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (mask) {
    if (!maskCanvas || maskCanvas.width !== mask.width || maskCanvas.height !== mask.height) {
      maskCanvas = document.createElement("canvas");
      maskCanvas.width = mask.width;
      maskCanvas.height = mask.height;
    }
    const mctx = maskCanvas.getContext("2d");
    const img = mctx.createImageData(mask.width, mask.height);
    const px = new Uint32Array(img.data.buffer);
    const tint = 0x66ffb400; // ABGR: semi-transparent blue
    for (let i = 0; i < mask.data.length; i++) px[i] = mask.data[i] ? tint : 0;
    mctx.putImageData(img, 0, 0);
    ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
  }
  if (lms) {
    const sx = canvas.width, sy = canvas.height;
    ctx.lineWidth = Math.max(2, sx / 400);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
      if (start < 11 || end < 11) continue; // no face points
      ctx.beginPath();
      ctx.moveTo(lms[start].x * sx, lms[start].y * sy);
      ctx.lineTo(lms[end].x * sx, lms[end].y * sy);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    for (let i = 11; i < lms.length; i++) {
      ctx.beginPath();
      ctx.arc(lms[i].x * sx, lms[i].y * sy, Math.max(3, sx / 250), 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  if (S.rows && S.rows.pose === "front" && mask) {
    const k = canvas.height / mask.height;
    const lines = [["yN", "#c58cff"], ["yA", "#ffd166"], ["yC", "#ef476f"], ["yW", "#06d6a0"], ["yHip", "#118ab2"], ["yCr", "#ff9f1c"]];
    ctx.lineWidth = Math.max(2, canvas.width / 500);
    for (const [key, colour] of lines) {
      if (S.rows[key] == null) continue;
      ctx.strokeStyle = colour;
      ctx.beginPath();
      ctx.moveTo(0, S.rows[key] * k);
      ctx.lineTo(canvas.width, S.rows[key] * k);
      ctx.stroke();
    }
  }
}

// Small white-on-black outline (no face detail) kept for later offline tuning.
function silhouette(mask) {
  const c = document.createElement("canvas");
  c.width = mask.width;
  c.height = mask.height;
  const g = c.getContext("2d");
  const img = g.createImageData(mask.width, mask.height);
  const px = new Uint32Array(img.data.buffer);
  for (let i = 0; i < mask.data.length; i++) px[i] = mask.data[i] ? 0xffffffff : 0xff000000;
  g.putImageData(img, 0, 0);
  const h = 320, w = Math.round((mask.width / mask.height) * h);
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  small.getContext("2d").drawImage(c, 0, 0, w, h);
  return small.toDataURL("image/png");
}

// Body landmarks only (11 to 32): face points never leave this function.
function bodyLandmarks(lms) {
  return lms.slice(11).map((l, i) => ({ i: i + 11, x: round4(l.x), y: round4(l.y), z: round4(l.z), v: round4(l.visibility ?? 0) }));
}
const round4 = (v) => Math.round(v * 10000) / 10000;

function setStatus(text) { $("status").textContent = text || ""; }
function setProgress(f) { $("bar").style.width = `${Math.round(Math.min(1, f) * 100)}%`; }
function showChecks(checks) {
  $("checks").innerHTML = checks.map((c) => `<li class="${c.pass ? "pass" : "fail"}">${c.pass ? "✓" : "✗"} ${c.label}</li>`).join("");
}

function say(text, force = false) {
  if (!$("voice").checked || !text || !window.speechSynthesis) return;
  const now = performance.now();
  if (!force && (now - S.lastSaidAt < 2500 || (text === S.lastSaid && now - S.lastSaidAt < 5000))) return;
  S.lastSaid = text;
  S.lastSaidAt = now;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

init().catch((e) => { console.error(e); msg(`Could not start: ${e.message}. Run it from a local server (see README).`); });
