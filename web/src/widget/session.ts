// Saves each session (the data that later trains Seam's own model) and the shopper's
// profile. MVP: browser storage only; accounts are simulated.

import type { Finder } from "./state.svelte.ts";

const SESSIONS = "seam.sessions";
const PROFILE = "seam.profile";
export const APP_VERSION = "widget-0.1";

function read<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { console.warn("Seam: storage failed", e); }
}

const r1 = (v: number) => Math.round(v * 10) / 10;

export function marginals(f: Finder, which: "priorTwin" | "scanTwin" | "twin") {
  const g = f[which];
  if (!g || !f.model) return null;
  return Object.fromEntries(f.model.vars.map((k, i) => [k, { mean: r1(g.mean[i]), sd: r1(Math.sqrt(g.cov[i][i])) }]));
}

export function buildSession(f: Finder, extra: Record<string, unknown> = {}) {
  const profile = (cap: typeof f.front) => cap && {
    summary: cap.summary,
    heights: cap.heights,
    landmarks: cap.landmarks,
    profile: cap.frames[Math.floor(cap.frames.length / 2)]?.profile,
  };
  return {
    id: f.sessionId,
    created: new Date().toISOString(),
    app: APP_VERSION,
    garment: f.garment?.id,
    units: f.units,
    inputs: { height_cm: f.heightCm, weight_kg: f.weightKg },
    prefs: f.prefs,
    scan: f.scanSkipped ? null : {
      readings: f.readings, readingScale: f.readingScale, quality: f.scanQuality,
      front: profile(f.front), side: profile(f.side),
      failures: { front: f.front?.failures, side: f.side?.failures }, startedBy: { front: f.front?.startedBy, side: f.side?.startedBy },
      camera: { label: f.scanner?.cameraLabel, zoom: f.scanner?.zoom, delegate: f.scanner?.delegate, frame: f.scanner?.canvas ? [f.scanner.canvas.width, f.scanner.canvas.height] : null },
    },
    twin: { prior: marginals(f, "priorTwin"), afterScan: marginals(f, "scanTwin"), final: marginals(f, "twin") },
    picks: {
      torso: f.torsoPick, torsoOptions: f.torsoOptions.map((o) => ({ id: o.id, label: o.label, scores: o.scores })),
      arms: f.armPick, armOptions: f.armOptions.map((o) => ({ id: o.id, label: o.label, scores: o.scores })),
    },
    recommendation: f.rec && {
      size: f.rec.size, between: f.rec.between, confidence: f.rec.confidence, notes: f.rec.notes,
      sizes: f.rec.sizes.map((s) => ({ size: s.size, pCore: s.pCore, pSecondary: s.pSecondary, score: s.score, wearable: s.wearable })),
    },
    saved: f.savedEmail ? true : false,
    ...extra,
  };
}

export function saveSession(f: Finder, extra: Record<string, unknown> = {}) {
  const s = buildSession(f, extra);
  const all = read<any[]>(SESSIONS, []).filter((x) => x.id !== s.id);
  all.push(s);
  write(SESSIONS, all.slice(-50));
  return s;
}

export function saveProfile(f: Finder, email: string) {
  write(PROFILE, {
    email,
    created: new Date().toISOString(),
    inputs: { height_cm: f.heightCm, weight_kg: f.weightKg },
    prefs: f.prefs,
    units: f.units,
    twin: f.twin && { vars: f.model?.vars, mean: f.twin.mean, cov: f.twin.cov },
  });
}

export function loadProfile(): { email: string } | null {
  return read(PROFILE, null);
}
