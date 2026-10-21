// Turns MediaPipe output (33 landmarks + a person mask) into body measurements in cm.
// Pure functions, no DOM: runs in the browser and in Node tests.
//
// Scale comes from the typed height: cm per pixel = height / (mask top to mask bottom).
// MediaPipe's world landmarks are not used for size (not metric for an individual).

export const LM = {
  NOSE: 0, L_SHOULDER: 11, R_SHOULDER: 12, L_ELBOW: 13, R_ELBOW: 14, L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24, L_KNEE: 25, R_KNEE: 26, L_ANKLE: 27, R_ANKLE: 28,
};

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function median(xs) {
  const v = xs.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ---------- mask helpers ----------

export function binarise(probs, width, height, threshold = 0.5) {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < data.length; i++) data[i] = probs[i] >= threshold ? 1 : 0;
  return { data, width, height };
}

// Runs of mask pixels in one row as [start, end] (inclusive). Tiny gaps are merged and
// specks dropped so mask noise does not look like an arm gap.
export function rowRuns(mask, y, minLen = 3, maxGap = 2) {
  const { data, width } = mask;
  if (y < 0 || y >= mask.height) return [];
  const raw = [];
  const off = y * width;
  let start = -1;
  for (let x = 0; x < width; x++) {
    const on = data[off + x] === 1;
    if (on && start < 0) start = x;
    if (!on && start >= 0) { raw.push([start, x - 1]); start = -1; }
  }
  if (start >= 0) raw.push([start, width - 1]);
  const merged = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] - 1 <= maxGap) last[1] = r[1];
    else merged.push([...r]);
  }
  return merged.filter(([a, b]) => b - a + 1 >= minLen);
}

const runAt = (runs, x) => runs.find(([a, b]) => x >= a && x <= b) || null;
const runWidth = (r) => (r ? r[1] - r[0] + 1 : null);

// First and last rows that contain the person.
export function bodyExtent(mask, minPixels = 3) {
  const { data, width, height } = mask;
  let top = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    let n = 0;
    const off = y * width;
    for (let x = 0; x < width && n < minPixels; x++) n += data[off + x];
    if (n >= minPixels) { if (top < 0) top = y; bottom = y; }
  }
  return top < 0 ? null : { top, bottom };
}

export function toPx(lms, width, height) {
  return lms.map((l) => ({ x: l.x * width, y: l.y * height, v: l.visibility ?? 1 }));
}

// Torso centre line: from mid-shoulder to mid-hip, clamped beyond them.
function centreX(p, y) {
  const s = mid(p[LM.L_SHOULDER], p[LM.R_SHOULDER]);
  const h = mid(p[LM.L_HIP], p[LM.R_HIP]);
  if (Math.abs(h.y - s.y) < 1) return s.x;
  const t = clamp((y - s.y) / (h.y - s.y), 0, 1);
  return s.x + t * (h.x - s.x);
}

function torsoRun(mask, p, y) {
  const runs = rowRuns(mask, Math.round(y));
  return runAt(runs, Math.round(centreX(p, y)));
}

// ---------- landmark rows found from the mask ----------

// First row below the shoulders where both arms have separated from the torso.
export function findArmpitRow(mask, p, yFrom, yTo, need = 3) {
  let streak = 0;
  for (let y = Math.round(yFrom); y <= Math.round(yTo); y++) {
    const runs = rowRuns(mask, y);
    const r = runAt(runs, Math.round(centreX(p, y)));
    const separated = r && runs.some((q) => q[1] < r[0]) && runs.some((q) => q[0] > r[1]);
    streak = separated ? streak + 1 : 0;
    if (streak === need) return y - need + 1;
  }
  return null;
}

// First row below the hips where the gap between the legs starts.
export function findCrotchRow(mask, p, yFrom, yTo, need = 3) {
  const cx = Math.round(mid(p[LM.L_HIP], p[LM.R_HIP]).x);
  let streak = 0;
  for (let y = Math.round(yFrom); y <= Math.round(yTo); y++) {
    const off = y * mask.width;
    const gap = [-1, 0, 1].every((d) => mask.data[off + cx + d] === 0);
    streak = gap ? streak + 1 : 0;
    if (streak === need) return y - need + 1;
  }
  return null;
}

// Going up from the shoulders: the row where the outline narrows from the shoulder slope
// into the neck. Proxy for the high point of the shoulder (HPS), which sets tee length.
export function findNeckRow(mask, p, yShoulder, yTop, ratio = 0.4) {
  const ref = runWidth(torsoRun(mask, p, yShoulder));
  if (!ref) return null;
  for (let y = Math.round(yShoulder); y >= Math.round(yTop); y--) {
    const w = runWidth(torsoRun(mask, p, y));
    if (w != null && w < ratio * ref) return y;
  }
  return null;
}

// Torso width every 1% of body height, for learning better row choices later.
function widthProfile(mask, p, ext, k, from = 0.4, to = 0.9) {
  const pxH = ext.bottom - ext.top + 1;
  const out = [];
  for (let f = from; f <= to + 1e-9; f += 0.01) {
    const y = Math.round(ext.bottom - f * pxH);
    const w = runWidth(torsoRun(mask, p, y));
    out.push([Math.round(f * 100) / 100, w == null ? null : Math.round(w * k * 10) / 10]);
  }
  return out;
}

// ---------- measurements ----------

// Front pose: A-pose, arms 30 to 45° out, feet hip-width apart.
export function measureFront(mask, lms, heightCm) {
  const ext = bodyExtent(mask);
  if (!ext) return { ok: false, reason: "no person in mask" };
  const p = toPx(lms, mask.width, mask.height);
  const pxH = ext.bottom - ext.top + 1;
  const k = heightCm / pxH;
  const ys = mid(p[LM.L_SHOULDER], p[LM.R_SHOULDER]).y;
  const yh = mid(p[LM.L_HIP], p[LM.R_HIP]).y;
  const L = yh - ys;
  if (L < 20) return { ok: false, reason: "body too small in frame" };

  // Lenient: if the arms are not clear of the body, widths are skipped but lengths and
  // heights are still measured (the twin simply gets fewer readings from this frame).
  const yA = findArmpitRow(mask, p, ys, yh);
  const tw = (y) => runWidth(torsoRun(mask, p, y));

  // Starting row choices, to be tuned against tape data (the profile is saved for that).
  const yShoulderRow = yA == null ? null : Math.round(ys + 0.3 * (yA - ys));
  const yC = yA == null ? null : Math.round(yA + 0.06 * L);
  let yW = null, wMin = Infinity;
  if (yC != null)
    for (let y = Math.round(yC + 0.35 * (yh - yC)); y <= Math.round(yh - 0.1 * (yh - yC)); y++) {
      const w = tw(y);
      if (w != null && w < wMin) { wMin = w; yW = y; }
    }
  const yCr = findCrotchRow(mask, p, yh, ext.bottom);
  let yHip = null, wHip = -Infinity;
  if (yA != null) {
    const hipEnd = yCr != null ? yCr - 2 : Math.round(yh + 0.12 * L);
    for (let y = Math.round(yh - 0.05 * L); y <= hipEnd; y++) {
      const w = tw(y);
      if (w != null && w > wHip) { wHip = w; yHip = y; }
    }
  }
  const yN = findNeckRow(mask, p, ys, ext.top);

  const upper = (dist(p[LM.L_SHOULDER], p[LM.L_ELBOW]) + dist(p[LM.R_SHOULDER], p[LM.R_ELBOW])) / 2;
  const fore = (dist(p[LM.L_ELBOW], p[LM.L_WRIST]) + dist(p[LM.R_ELBOW], p[LM.R_WRIST])) / 2;
  const leg = (dist(p[LM.L_HIP], p[LM.L_ANKLE]) + dist(p[LM.R_HIP], p[LM.R_ANKLE])) / 2;
  const cm = (v) => (v == null ? null : v * k);
  const above = (y) => (y == null ? null : (ext.bottom - y) * k);

  return {
    ok: true,
    k,
    extent: ext,
    armsClear: yA != null,
    rows: { yN, ys, yShoulderRow, yA, yC, yW, yh, yHip, yCr },
    heights: { neck: above(yN), shoulder: above(ys), armpit: above(yA), chest: above(yC), waist: above(yW), hip: above(yHip), crotch: above(yCr) },
    values: {
      outer_shoulder: yShoulderRow == null ? null : cm(tw(yShoulderRow)),
      chest_width: yC == null ? null : cm(tw(yC)),
      waist_width: yW == null ? null : cm(wMin),
      hip_width: yHip == null ? null : cm(wHip),
      joint_shoulder: cm(dist(p[LM.L_SHOULDER], p[LM.R_SHOULDER])),
      upper_arm: cm(upper),
      arm_length: cm(upper + fore),
      leg_length: cm(leg),
      inseam: yCr == null ? null : cm(ext.bottom - yCr),
      torso_length: yN != null && yCr != null ? cm(yCr - yN) : null,
    },
    profile: widthProfile(mask, p, ext, k),
  };
}

// Fallback heights as a share of stature (ANSUR II men: chest 0.735, navel 0.601, crotch 0.482)
// when the front pose could not place the chest, waist or hip rows.
const FALLBACK_HEIGHT = { chest: 0.735, waist: 0.601, hip: 0.54 };

// Side pose: turned 90°, arms straight down. Depths are read at the heights (cm above the
// floor) found in the front pose, converted with this pose's own scale.
export function measureSide(mask, lms, heightCm, frontHeights) {
  const ext = bodyExtent(mask);
  if (!ext) return { ok: false, reason: "no person in mask" };
  const fh = frontHeights || {};
  const at = (key) => fh[key] ?? FALLBACK_HEIGHT[key] * heightCm;
  const p = toPx(lms, mask.width, mask.height);
  const k = heightCm / (ext.bottom - ext.top + 1);
  const rowFor = (hCm) => Math.round(ext.bottom - hCm / k);
  const depth = (y) => runWidth(torsoRun(mask, p, y));
  const window = (hCm, halfCm, pick) => {
    if (hCm == null) return null;
    const y0 = rowFor(hCm + halfCm), y1 = rowFor(hCm - halfCm);
    const ws = [];
    for (let y = y0; y <= y1; y++) { const w = depth(y); if (w != null) ws.push(w); }
    if (!ws.length) return null;
    return (pick === "max" ? Math.max(...ws) : median(ws)) * k;
  };
  return {
    ok: true,
    k,
    extent: ext,
    values: {
      chest_depth: window(at("chest"), 1, "median"),
      waist_depth: window(at("waist"), 1, "median"),
      hip_depth: window(at("hip"), 4, "max"),
    },
    profile: widthProfile(mask, p, ext, k),
  };
}

// ---------- pose checks ----------

// Angle of the vector a->b away from straight down, in degrees.
function fromVertical(a, b) {
  return Math.abs(Math.atan2(b.x - a.x, b.y - a.y)) * 180 / Math.PI;
}

// Angle at b between b->a and b->c, in degrees.
function jointAngle(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y }, v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) || 1);
  return Math.acos(clamp(cos, -1, 1)) * 180 / Math.PI;
}

// Lenient limits: a failed check no longer blocks capture; it only widens the error on the
// readings it affects (see leniency.ts). Only "head and feet in frame" is required.
export const CHECK_LIMITS = {
  minVisibility: 0.35,
  frameMargin: 0.005,         // head and feet inside the frame
  bodyFraction: [0.4, 0.98],  // person height as a share of frame height
  facingRatio: 0.4,           // shoulder distance / torso length, front
  sideRatio: 0.4,             // same, side
  armAngle: [15, 60],         // upper arm from vertical, front
  armsDown: 30,               // upper arm from vertical, side
  elbowMin: 140,
  feetRatio: [0.6, 2.8],      // ankle gap / hip gap, front
  uprightMax: 12,
};

export function checkPose(pose, lms, width, height, ext) {
  const C = CHECK_LIMITS;
  const p = toPx(lms, width, height);
  const checks = [];
  const add = (id, label, pass, hint) => checks.push({ id, label, pass, hint });
  const S = mid(p[LM.L_SHOULDER], p[LM.R_SHOULDER]), H = mid(p[LM.L_HIP], p[LM.R_HIP]);
  const torso = dist(S, H) || 1;
  const shoulderRatio = dist(p[LM.L_SHOULDER], p[LM.R_SHOULDER]) / torso;

  if (pose === "front") {
    const key = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    add("visible", "Whole body visible", key.every((i) => p[i].v >= C.minVisibility), "Make sure your whole body is in view");
  } else {
    const left = [11, 13, 15, 23, 25, 27], right = [12, 14, 16, 24, 26, 28];
    const sum = (ix) => ix.reduce((s, i) => s + p[i].v, 0);
    const side = sum(left) >= sum(right) ? left : right;
    add("visible", "Body visible", side.every((i) => p[i].v >= C.minVisibility), "Make sure your whole body is in view");
  }

  const inFrame = !!ext && ext.top > C.frameMargin * height && ext.bottom < (1 - C.frameMargin) * height;
  add("frame", "Head and feet in frame", inFrame, "Step back so your head and feet are in view");
  const frac = ext ? (ext.bottom - ext.top) / height : 0;
  add("distance", "Good distance", frac >= C.bodyFraction[0] && frac <= C.bodyFraction[1],
    frac < C.bodyFraction[0] ? "Step a little closer" : "Step back a little");

  const tilt = fromVertical(S, H); // hip should be straight below the shoulders
  add("upright", "Standing straight", tilt <= C.uprightMax, "Stand up straight");

  if (pose === "front") {
    add("facing", "Facing the camera", shoulderRatio >= C.facingRatio, "Face the camera");
    const aL = fromVertical(p[LM.L_SHOULDER], p[LM.L_ELBOW]), aR = fromVertical(p[LM.R_SHOULDER], p[LM.R_ELBOW]);
    const lo = Math.min(aL, aR), hi = Math.max(aL, aR);
    add("arms", "Arms 30 to 45° out", lo >= C.armAngle[0] && hi <= C.armAngle[1],
      lo < C.armAngle[0] ? "Move your arms a bit further out" : "Lower your arms a little");
    const eL = jointAngle(p[LM.L_SHOULDER], p[LM.L_ELBOW], p[LM.L_WRIST]);
    const eR = jointAngle(p[LM.R_SHOULDER], p[LM.R_ELBOW], p[LM.R_WRIST]);
    add("straight", "Arms straight", Math.min(eL, eR) >= C.elbowMin, "Keep your arms straight");
    const feet = dist(p[LM.L_ANKLE], p[LM.R_ANKLE]) / (dist(p[LM.L_HIP], p[LM.R_HIP]) || 1);
    add("feet", "Feet hip-width apart", feet >= C.feetRatio[0] && feet <= C.feetRatio[1],
      feet < C.feetRatio[0] ? "Feet a bit wider apart, about hip-width" : "Feet a bit closer together");
  } else {
    add("turned", "Side facing the camera", shoulderRatio <= C.sideRatio, "Turn so your side faces the camera");
    const aL = fromVertical(p[LM.L_SHOULDER], p[LM.L_ELBOW]), aR = fromVertical(p[LM.R_SHOULDER], p[LM.R_ELBOW]);
    const vis = p[LM.L_ELBOW].v >= p[LM.R_ELBOW].v ? aL : aR;
    add("armsdown", "Arms straight down", vis <= C.armsDown, "Let your arms hang straight down");
  }
  const failing = checks.find((c) => !c.pass);
  return { pass: !failing, checks, hint: failing ? failing.hint : null };
}

// ---------- combining frames ----------

// Median and spread of every measurement across the captured frames.
export function summarise(frames) {
  const keys = new Set(frames.flatMap((f) => Object.keys(f)));
  const out = {};
  for (const key of keys) {
    const v = frames.map((f) => f[key]).filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) { out[key] = { median: null, iqr: null, n: 0 }; continue; }
    out[key] = { median: quantile(v, 0.5), iqr: quantile(v, 0.75) - quantile(v, 0.25), n: v.length };
  }
  return out;
}

// 0 to 1. Low when measurements jump between frames or body proportions look distorted
// (a camera tilted up or down stretches the legs or the torso).
export function quality(frontSummary, sideSummary, frontHeights, heightCm, proportions) {
  const steadyKeys = [["front", "outer_shoulder"], ["front", "chest_width"], ["front", "waist_width"], ["side", "chest_depth"], ["side", "waist_depth"]];
  const rel = [];
  for (const [pose, key] of steadyKeys) {
    const s = (pose === "front" ? frontSummary : sideSummary)?.[key];
    if (s && s.median) rel.push(s.iqr / s.median);
  }
  const meanRel = rel.length ? rel.reduce((a, b) => a + b, 0) / rel.length : 1;
  const steadiness = clamp(1 - meanRel / 0.06, 0.1, 1);

  const z = [];
  for (const key of ["crotch", "neck"]) {
    const h = frontHeights?.[key];
    const ref = proportions?.[key];
    if (h != null && ref) z.push(Math.abs(h / heightCm - ref.mean) / ref.sd);
  }
  const worst = z.length ? Math.max(...z) : 0;
  const proportion = clamp(1 - (worst - 2) / 3, 0.1, 1);
  return { q: Math.round(steadiness * proportion * 100) / 100, steadiness: Math.round(steadiness * 100) / 100, proportion: Math.round(proportion * 100) / 100, proportionZ: Math.round(worst * 10) / 10 };
}
