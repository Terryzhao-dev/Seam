// Digital twin v0: a Gaussian over 23 body measurements (ANSUR II men).
//
// prior(height, weight, age)  ->  N(mean, cov)
// camera readings, body picks ->  Gaussian conditioning (Kalman update), which also updates
//                                 measurements the camera cannot see through their correlations.

import { add, cholesky, matMul, matVec, outer, randn, rng, spdInverse, sub, symmetrise, transpose, identity, type Mat, type Vec } from "./linalg.ts";

export interface BodyModel {
  vars: string[];
  labels: Record<string, string>;
  prior: Record<"hw" | "hwa", { features: string[]; coef: number[][]; cov: Mat }>;
  population: { mean: Vec; cov: Mat };
  proportions: Record<string, { mean: number; sd: number }>;
}

export interface Inputs {
  height_cm: number;
  weight_kg: number;
  age?: number | null;
}

export interface Gaussian {
  mean: Vec;
  cov: Mat;
}

export interface Observation {
  H: Mat;   // rows: linear combinations of body variables
  y: Vec;   // observed values
  R: Mat;   // observation noise covariance
  labels?: string[];
}

export function prior(model: BodyModel, inputs: Inputs): Gaussian {
  const set = inputs.age ? model.prior.hwa : model.prior.hw;
  const h = inputs.height_cm, w = inputs.weight_kg;
  const f: Record<string, number> = { h, w, bmi: w / (h / 100) ** 2, age: inputs.age ?? 0 };
  const x = [1, ...set.features.map((k) => f[k])];
  return { mean: set.coef.map((row) => row.reduce((s, c, j) => s + c * x[j], 0)), cov: set.cov.map((r) => [...r]) };
}

// Kalman update in Joseph form (numerically stable, keeps the covariance symmetric).
export function condition(g: Gaussian, obs: Observation): Gaussian {
  if (!obs.y.length) return g;
  const { H, y, R } = obs;
  const PHt = matMul(g.cov, transpose(H));
  const S = add(matMul(H, PHt), R);
  const K = matMul(PHt, spdInverse(S));
  const innovation = y.map((v, i) => v - H[i].reduce((s, h, j) => s + h * g.mean[j], 0));
  const mean = g.mean.map((m, i) => m + K[i].reduce((s, k, j) => s + k * innovation[j], 0));
  const A = sub(identity(g.mean.length), matMul(K, H));
  const cov = add(matMul(matMul(A, g.cov), transpose(A)), matMul(matMul(K, R), transpose(K)));
  return { mean, cov: symmetrise(cov) };
}

// Exact values for some variables (used for "typical wearer of size M").
export function conditionOn(model: BodyModel, g: Gaussian, values: Record<string, number>): Gaussian {
  const keys = Object.keys(values);
  const H = keys.map((k) => unitRow(model, k));
  const R = keys.map((_, i) => keys.map((__, j) => (i === j ? 1e-6 : 0)));
  return condition(g, { H, y: keys.map((k) => values[k]), R });
}

export function unitRow(model: BodyModel, key: string): Vec {
  const i = model.vars.indexOf(key);
  if (i < 0) throw new Error(`unknown body variable ${key}`);
  return model.vars.map((_, j) => (j === i ? 1 : 0));
}

export function marginal(model: BodyModel, g: Gaussian, key: string): { mean: number; sd: number } {
  const i = model.vars.indexOf(key);
  return { mean: g.mean[i], sd: Math.sqrt(Math.max(g.cov[i][i], 0)) };
}

export function toRecord(model: BodyModel, values: Vec): Record<string, number> {
  return Object.fromEntries(model.vars.map((k, i) => [k, values[i]]));
}

export function sample(g: Gaussian, n: number, seed = 7): Vec[] {
  const L = cholesky(g.cov);
  const rand = rng(seed);
  const d = g.mean.length;
  const out: Vec[] = [];
  for (let s = 0; s < n; s++) {
    const z = Array.from({ length: d }, () => randn(rand));
    const x = matVec(L, z);
    out.push(x.map((v, i) => v + g.mean[i]));
  }
  return out;
}

// ---------- camera -> body variables ----------

// camera reading ≈ body variable + offset, with noise sd (cm). Offsets and noise are starting
// guesses [est] until tape data calibrates them (calibration.json overrides).
export interface CameraLink { camera: string; body: string; offset: number; sd: number }

export const CAMERA_LINKS: CameraLink[] = [
  { camera: "chest_width", body: "chest_width", offset: 1.0, sd: 2.0 },
  { camera: "chest_depth", body: "chest_depth", offset: 1.0, sd: 2.0 },
  { camera: "waist_width", body: "waist_width", offset: 2.0, sd: 2.5 },
  { camera: "waist_depth", body: "waist_depth", offset: 1.5, sd: 2.5 },
  { camera: "hip_width", body: "hip_width", offset: 0.5, sd: 2.0 },
  { camera: "hip_depth", body: "hip_depth", offset: 0.5, sd: 2.5 },
  { camera: "outer_shoulder", body: "outer_shoulder", offset: 0, sd: 2.5 },
  { camera: "joint_shoulder", body: "bony_shoulder", offset: -5, sd: 2.5 },
  { camera: "upper_arm", body: "upper_arm", offset: -1, sd: 2.0 },
  { camera: "arm_length", body: "arm_length", offset: -2, sd: 2.5 },
  { camera: "neck_height", body: "neck_height", offset: 0, sd: 2.5 },
  { camera: "armpit_height", body: "armpit_height", offset: 0, sd: 2.5 },
  { camera: "crotch_height", body: "crotch_height", offset: 0, sd: 2.5 },
];

// Typed height sets the camera's scale, so a wrong height moves every camera number by the
// same percentage. ANSUR: typed minus true height has SD ~2.6 cm (~1.5%).
export const SCALE_SD = 0.015;

export function cameraObservation(
  model: BodyModel,
  readings: Record<string, number | null | undefined>,
  quality: number,
  calibration: Partial<Record<string, { offset: number; sd: number }>> = {},
  errorScale: Record<string, number> = {}, // from failed pose checks (capture.ts); Infinity = skip
): Observation {
  const q = Math.max(quality, 0.05);
  const rows: Vec[] = [], y: number[] = [], sds: number[] = [], labels: string[] = [];
  for (const link of CAMERA_LINKS) {
    const v = readings[link.camera];
    const scale = errorScale[link.camera] ?? 1;
    if (v == null || !Number.isFinite(v) || !Number.isFinite(scale)) continue;
    const cal = calibration[link.camera];
    rows.push(unitRow(model, link.body));
    y.push(v - (cal?.offset ?? link.offset));
    sds.push(((cal?.sd ?? link.sd) * scale) / q);
    labels.push(link.camera);
  }
  const R = add(sds.map((s, i) => sds.map((_, j) => (i === j ? s * s : 0))), outer(y, y).map((r) => r.map((v) => v * SCALE_SD ** 2)));
  return { H: rows, y, R, labels };
}
