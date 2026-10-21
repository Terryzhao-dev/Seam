// Body options shown after the scan. They are drawn from the shopper's own twin, so every
// option is plausible; the pick is a weak extra reading that nudges the twin.

import { condition, conditionOn, toRecord, type BodyModel, type Gaussian } from "./bodymodel.ts";
import { symEigen, type Vec } from "./linalg.ts";

export const TORSO_VARS = ["chest_girth", "waist_girth", "hip_girth", "chest_width", "chest_depth", "waist_width", "waist_depth", "hip_depth"];

export interface BodyOption {
  id: string;
  label: string;
  body: Record<string, number>;    // full twin mean for this option
  scores: number[];                // position along the twin's main directions
  directions: Vec[];               // full-length direction vectors (over all variables)
  spacing: number[];               // option spacing per direction, used as pick noise
}

const MIN_CHEST_SPREAD = 4; // cm between the extreme options, so they look different

// 4 torso options: ±1 SD along the two main directions of the twin's torso uncertainty.
export function torsoOptions(model: BodyModel, g: Gaussian): BodyOption[] {
  const idx = TORSO_VARS.map((k) => model.vars.indexOf(k));
  const sub = idx.map((i) => idx.map((j) => g.cov[i][j]));
  const { values, vectors } = symEigen(sub);
  const sds = values.slice(0, 2).map((v) => Math.sqrt(Math.max(v, 1e-9)));
  const dirs = vectors.slice(0, 2).map((e) => {
    const full = new Array(model.vars.length).fill(0);
    idx.forEach((i, k) => (full[i] = e[k]));
    // orient so positive means "more chest"
    const chestLoading = full[model.vars.indexOf("chest_girth")];
    return chestLoading < 0 ? full.map((v) => -v) : full;
  });
  const chestIdx = model.vars.indexOf("chest_girth");
  const chestSpread = 2 * Math.abs(dirs[0][chestIdx] * sds[0]) + 2 * Math.abs(dirs[1][chestIdx] * sds[1]);
  const stretch = Math.max(1, MIN_CHEST_SPREAD / Math.max(chestSpread, 1e-6));
  const spacing = sds.map((s) => s * stretch);
  const corners: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const centre = TORSO_VARS.map((k) => g.mean[model.vars.indexOf(k)]);
  const options = corners.map(([a, b], n) => {
    const torso: Record<string, number> = {};
    TORSO_VARS.forEach((k, t) => {
      const i = model.vars.indexOf(k);
      torso[k] = centre[t] + a * spacing[0] * dirs[0][i] + b * spacing[1] * dirs[1][i];
    });
    const body = toRecord(model, conditionOn(model, g, torso).mean);
    return { id: `torso-${n}`, label: "", body, scores: [a * spacing[0], b * spacing[1]], directions: dirs, spacing };
  });
  labelTorso(options, model, g);
  return options;
}

function labelTorso(options: BodyOption[], model: BodyModel, g: Gaussian) {
  const c0 = g.mean[model.vars.indexOf("chest_girth")], w0 = g.mean[model.vars.indexOf("waist_girth")];
  for (const o of options) {
    const dc = o.body.chest_girth - c0, dw = o.body.waist_girth - w0;
    o.label = dc <= 0 && dw <= 0 ? "Leaner" : dc > 0 && dw > 0 ? "Larger build" : dc > dw ? "Broader chest" : "Fuller middle";
  }
  // keep labels unique when two corners land on the same description
  const seen = new Set<string>();
  for (const o of options) {
    if (seen.has(o.label)) o.label = o.body.chest_girth > c0 ? "Broader chest" : "Fuller middle";
    seen.add(o.label);
  }
}

// A torso pick = noisy reading of the twin's position along the two directions.
export function applyTorsoPick(g: Gaussian, option: BodyOption): Gaussian {
  const H = option.directions;
  const y = H.map((d, k) => d.reduce((s, v, i) => s + v * g.mean[i], 0) + option.scores[k]);
  const R = option.spacing.map((s, i) => option.spacing.map((_, j) => (i === j ? s * s : 0)));
  return condition(g, { H, y, R, labels: ["torso_pick_1", "torso_pick_2"] });
}

export const ARM_LABELS = ["Slimmer arms", "Average arms", "More muscular arms"];

export function armOptions(model: BodyModel, g: Gaussian): BodyOption[] {
  const i = model.vars.indexOf("arm_girth");
  const sd = Math.sqrt(g.cov[i][i]);
  const step = Math.max(sd, 1.5);
  const dir = model.vars.map((_, j) => (j === i ? 1 : 0));
  return [-1, 0, 1].map((k, n) => ({
    id: `arms-${n}`,
    label: ARM_LABELS[n],
    body: toRecord(model, conditionOn(model, g, { arm_girth: g.mean[i] + k * step }).mean),
    scores: [k * step],
    directions: [dir],
    spacing: [step],
  }));
}

export function applyArmPick(g: Gaussian, option: BodyOption): Gaussian {
  const i = option.directions[0].indexOf(1);
  return condition(g, { H: option.directions, y: [g.mean[i] + option.scores[0]], R: [[option.spacing[0] ** 2]], labels: ["arm_pick"] });
}
