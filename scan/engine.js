// Turns typed inputs + camera measurements into body estimates and a tee size.
// Pure functions, no DOM.
//
// 1. Prior: ANSUR II regressions from self-reported height, weight (+ age).
// 2. Camera: raw measurements, corrected by calibration when it exists; girths from width + depth.
// 3. Combine: precision-weighted average, so a noisy scan falls back to the prior.
// 4. Size: ease (garment minus body) vs fit-style target, using the error bands.

// Until tape data calibrates them, camera errors are guesses [est]. A scan quality q < 1
// widens them (sd / q).
export const UNCALIBRATED_SD = {
  outer_shoulder: 2.5, chest_width: 2.5, chest_depth: 2.5, waist_width: 2.5, waist_depth: 2.5,
  hip_width: 2.5, hip_depth: 2.5, upper_arm: 2.0, arm_length: 3.0, inseam: 3.0, torso_length: 3.0,
};

export const LABELS = {
  chest_girth: "Chest girth", waist_girth: "Waist girth", hip_girth: "Hip girth",
  outer_shoulder: "Outer shoulder width", bony_shoulder: "Bony shoulder width",
  chest_width: "Chest width", chest_depth: "Chest depth", waist_width: "Waist width", waist_depth: "Waist depth",
  hip_width: "Hip width", hip_depth: "Hip depth", upper_arm: "Upper arm (shoulder to elbow)",
  arm_length: "Arm length (shoulder to wrist)", inseam: "Inseam", torso_length: "Torso length (neck base to crotch)",
  joint_shoulder: "Shoulder joint distance", leg_length: "Hip joint to ankle",
};

export function ellipsePerimeter(width, depth) {
  const a = width / 2, b = depth / 2;
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

export function features(inputs, m = {}) {
  const h = inputs.height_cm, w = inputs.weight_kg;
  const f = { h, w, bmi: w / (h / 100) ** 2, age: inputs.age ?? null, ...m };
  if (m.chest_width != null && m.chest_depth != null) f.ellipse_chest = ellipsePerimeter(m.chest_width, m.chest_depth);
  if (m.waist_width != null && m.waist_depth != null) f.ellipse_waist = ellipsePerimeter(m.waist_width, m.waist_depth);
  if (m.hip_width != null && m.hip_depth != null) f.ellipse_hip = ellipsePerimeter(m.hip_width, m.hip_depth);
  return f;
}

export function predict(model, f) {
  let y = model.intercept;
  for (let i = 0; i < model.features.length; i++) {
    const v = f[model.features[i]];
    if (v == null || !Number.isFinite(v)) return null;
    y += model.coef[i] * v;
  }
  return y;
}

export function priorEstimates(models, inputs) {
  const set = inputs.age ? models.prior.hwa : models.prior.hw;
  const f = features(inputs);
  const out = {};
  for (const [t, m] of Object.entries(set)) out[t] = { mean: predict(m, f), sd: m.rmse };
  return out;
}

// calibration[t] = { a, b, sd }: tape ≈ a × camera + b, with leave-one-out error sd.
export function cameraEstimates(models, inputs, raw, q = 1, calibration = {}) {
  const qq = Math.max(q, 0.05);
  const out = {};
  for (const [t, sd0] of Object.entries(UNCALIBRATED_SD)) {
    if (raw[t] == null) continue;
    const c = calibration[t] || { a: 1, b: 0, sd: sd0 };
    out[t] = { mean: c.a * raw[t] + c.b, sd: c.sd / qq, calibrated: !!calibration[t] };
  }
  const girth = (target, modelName, inputsUsed) => {
    const model = models.camera[modelName];
    if (inputsUsed.some((k) => !out[k])) return false;
    const means = Object.fromEntries(inputsUsed.map((k) => [k, out[k].mean]));
    const g = (vals) => predict(model, features(inputs, vals));
    const mean = g(means);
    if (mean == null) return false;
    // Propagate each input's error through the formula (numerical derivative).
    let variance = model.rmse ** 2;
    for (const k of inputsUsed) {
      const d = 0.5;
      const slope = (g({ ...means, [k]: means[k] + d }) - g({ ...means, [k]: means[k] - d })) / (2 * d);
      variance += (slope * out[k].sd) ** 2;
    }
    out[target] = { mean, sd: Math.sqrt(variance), via: modelName };
    return true;
  };
  girth("chest_girth", "chest_girth_wd", ["chest_width", "chest_depth", "outer_shoulder"]) ||
    girth("chest_girth", "chest_girth_w", ["chest_width", "outer_shoulder"]);
  girth("waist_girth", "waist_girth_wd", ["waist_width", "waist_depth"]) ||
    girth("waist_girth", "waist_girth_w", ["waist_width"]);
  girth("hip_girth", "hip_girth_wd", ["hip_width", "hip_depth"]);
  return out;
}

// Known simplification: camera girth formulas also use height and weight, so prior and
// camera errors are partly correlated and the combined error is a little optimistic.
// Leave-one-out testing on real people is what keeps this honest.
export function combine(prior, camera) {
  const out = {};
  for (const t of new Set([...Object.keys(prior), ...Object.keys(camera)])) {
    const p = prior[t], c = camera[t];
    if (p && c && p.mean != null && c.mean != null) {
      const wp = 1 / p.sd ** 2, wc = 1 / c.sd ** 2;
      out[t] = { mean: (p.mean * wp + c.mean * wc) / (wp + wc), sd: 1 / Math.sqrt(wp + wc), cameraWeight: wc / (wp + wc) };
    } else if (p && p.mean != null) out[t] = { ...p, cameraWeight: 0 };
    else if (c && c.mean != null) out[t] = { ...c, cameraWeight: 1 };
  }
  return out;
}

// ---------- size engine ----------

// Target ease (garment minus body) per fit style; starting values, tuned on testers.
export const FIT = {
  chest: { body: "chest_girth", slim: 5, regular: 10, relaxed: 16, band: 2, weight: 3 },
  shoulder: { body: "outer_shoulder", slim: -2, regular: 0, relaxed: 3, band: 1.5, weight: 2 },
  length: { body: "torso_length", slim: 2, regular: 3, relaxed: 4, band: 1.5, weight: 1.5 },
};

const WORDS = {
  chest: ["tight", "slightly snug", "right", "slightly relaxed", "loose"],
  shoulder: ["narrow", "slightly narrow", "right", "slightly wide", "wide"],
  length: ["short", "slightly short", "right", "slightly long", "long"],
};

function erf(x) {
  // Abramowitz and Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
export const normCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

function garmentValue(zone, size) {
  if (zone === "chest") return size.chest_width_flat != null ? 2 * size.chest_width_flat : null;
  if (zone === "shoulder") return size.shoulder_width ?? null;
  if (zone === "length") return size.body_length ?? null;
  return null;
}

export function recommend(est, chart, style = "regular") {
  const tol = chart.tolerance_cm ?? 1;
  const rows = chart.sizes.map((size) => {
    const zones = [];
    for (const [zone, spec] of Object.entries(FIT)) {
      const g = garmentValue(zone, size), b = est[spec.body];
      if (g == null || !b) continue;
      const garmentTol = zone === "chest" ? 2 * tol : tol;
      const d = g - b.mean - spec[style];
      const s = Math.hypot(b.sd, garmentTol);
      const pFit = normCdf((spec.band - d) / s) - normCdf((-spec.band - d) / s);
      const pTooTight = normCdf((-2 * spec.band - d) / s);
      zones.push({ zone, ease: g - b.mean, target: spec[style], d, s, pFit, pTooTight, weight: spec.weight, band: spec.band });
    }
    const wSum = zones.reduce((a, z) => a + z.weight, 0) || 1;
    const score = Math.exp(zones.reduce((a, z) => a + z.weight * Math.log(Math.max(z.pFit, 1e-6)), 0) / wSum);
    const chest = zones.find((z) => z.zone === "chest");
    return { size: size.size, zones, score, wearable: !chest || chest.pTooTight <= 0.2 };
  });
  const pool = rows.some((r) => r.wearable) ? rows.filter((r) => r.wearable) : rows;
  const ranked = [...pool].sort((a, b) => b.score - a.score);
  const best = ranked[0], second = ranked[1];
  const idx = (r) => chart.sizes.findIndex((s) => s.size === r.size);
  const between = second && second.score >= 0.85 * best.score && Math.abs(idx(second) - idx(best)) === 1 ? second.size : null;
  const notes = best.zones
    .sort((a, b) => b.weight - a.weight)
    .map((z) => {
      const level = Math.abs(z.d) <= z.band ? 2 : Math.abs(z.d) <= 2 * z.band ? (z.d < 0 ? 1 : 3) : (z.d < 0 ? 0 : 4);
      const cm = Math.abs(z.d) > z.s ? ` (${Math.round(Math.abs(z.d))} cm ${z.d < 0 ? "under" : "over"} your target)` : "";
      return { zone: z.zone, text: `${z.zone[0].toUpperCase() + z.zone.slice(1)} ${WORDS[z.zone][level]}${cm}` };
    });
  return { size: best.size, between, notes, rows };
}

// ---------- tape comparison ----------

// camera = cameraEstimates() output, so girths are included.
export function compareToTape(tape, camera, prior, combined) {
  const rows = [];
  for (const [t, v] of Object.entries(tape)) {
    if (v == null || v === "" || !LABELS[t]) continue;
    const tapeV = Number(v);
    const r = { key: t, label: LABELS[t], tape: tapeV, camera: camera[t]?.mean ?? null, prior: prior[t]?.mean ?? null, combined: combined[t]?.mean ?? null };
    r.cameraErr = r.camera == null ? null : r.camera - tapeV;
    r.priorErr = r.prior == null ? null : r.prior - tapeV;
    r.combinedErr = r.combined == null ? null : r.combined - tapeV;
    rows.push(r);
  }
  return rows;
}
