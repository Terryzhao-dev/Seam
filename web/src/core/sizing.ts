// Size engine for tops. Compares garment measurements with the twin zone by zone, using
// the brand's own intended ease (from its body chart) as the target, shifted by fit style.
// Uncertainty is handled by Monte Carlo over correlated bodies drawn from the twin.

import { conditionOn, sample, toRecord, type BodyModel, type Gaussian } from "./bodymodel.ts";
import { randn, rng } from "./linalg.ts";

export type FitStyle = "slim" | "regular" | "relaxed";
export type HemChoice = "above_belt" | "at_belt" | "mid_fly" | "covering";
export interface Prefs { fit: FitStyle; hem: HemChoice }

export interface GarmentSize {
  size: string;
  length_back?: number;     // centre back of the neck to hem
  shoulder_width?: number;  // seam to seam
  chest_flat?: number;      // armpit to armpit, flat
  sleeve_cb?: number;       // centre back of the collar to sleeve edge
  body?: { chest?: number[]; waist?: number[] };
}

export interface Garment {
  id: string;
  brand: string;
  name: string;
  sleeve: "short" | "long";
  shoulder: "set-in" | "drop";
  fit: string;
  tolerance_cm: number;
  sizes: GarmentSize[];
  [key: string]: unknown;
}

// Starting values [est], to be calibrated (drape and sleeve on Terry, the rest from orders).
// calibration.json can override drapeK at runtime.
export const CONFIG = { drapeK: 5 }; // cm of back length lost over the upper back when worn
export const STYLE_SHIFT = {
  chest: { slim: -4, regular: 0, relaxed: 5 },
  shoulder: { slim: -1, regular: 0, relaxed: 1.5 },
  sleeve: { slim: -1, regular: 0, relaxed: 1 },
};
export const BANDS = { chest: 3, shoulder: 2, length: 2.5, sleeve: 2.5 };
// Wearable at all: at least this much chest ease (garment girth minus body girth) for a
// non-stretch knit [est]. Independent of the brand's intended look.
export const MIN_CHEST_EASE = 2;
// Note wording thresholds per zone, roughly a quarter and two-thirds of a size step [est].
const WORDING = { chest: [1.5, 4.5], shoulder: [0.8, 2], length: [2, 5], sleeve: [1.5, 3.5] };
export const HEM_LABELS: Record<HemChoice, string> = {
  above_belt: "Above the belt", at_belt: "At the belt", mid_fly: "Just below the belt", covering: "Covering the seat",
};

type Zone = "chest" | "shoulder" | "length" | "sleeve";
type Intent = Partial<Record<"chest" | "shoulder" | "sleeve", number>>;

// Chest and shoulders decide the size. Length and sleeves can tip a close call between
// neighbouring sizes but never override a chest or shoulder fit; a mismatch shows in the notes.
const CORE: Zone[] = ["chest", "shoulder"];
const SECONDARY: Zone[] = ["length", "sleeve"];

export interface ZoneResult { zone: Zone; meanD: number; sd: number; pOk: number; pTight: number; pLoose: number }
export interface SizeResult {
  size: string;
  pCore: number;       // chance chest and shoulders both fit
  pSecondary: number;  // chance length and sleeves are within twice their band
  score: number;
  wearable: boolean;
  zones: ZoneResult[];
  intent: Intent;
}
export interface Recommendation {
  size: string;
  between: string | null;
  confidence: "high" | "medium" | "low";
  notes: { zone: string; text: string }[];
  sizes: SizeResult[];
}

const mid = (r?: number[]) => (r && r.length === 2 ? (r[0] + r[1]) / 2 : null);

// What body the brand designs each size for (body-chart midpoints + ANSUR for the rest),
// and therefore the ease it intends in each zone.
export function brandIntent(model: BodyModel, garment: Garment): Intent[] {
  const pop = { mean: model.population.mean, cov: model.population.cov };
  const raw = garment.sizes.map((s) => {
    const values: Record<string, number> = {};
    const c = mid(s.body?.chest), w = mid(s.body?.waist);
    if (c != null) values.chest_girth = c;
    if (w != null) values.waist_girth = w;
    if (!Object.keys(values).length) return null;
    const t = toRecord(model, conditionOn(model, pop, values).mean);
    const intent: Intent = {};
    if (s.chest_flat != null) intent.chest = 2 * s.chest_flat - t.chest_girth;
    if (s.shoulder_width != null) intent.shoulder = s.shoulder_width - t.bony_shoulder;
    if (s.sleeve_cb != null && garment.sleeve === "long") intent.sleeve = s.sleeve_cb - t.cb_wrist;
    return intent;
  });
  // sizes without a body chart borrow the nearest size's intent
  return raw.map((r, i) => {
    if (r) return r;
    for (let d = 1; d < raw.length; d++) {
      const near = raw[i - d] ?? raw[i + d];
      if (near) return near;
    }
    return {};
  });
}

export function hemHeight(b: Record<string, number>, hem: HemChoice): number {
  const belt = b.navel_height - 3;
  if (hem === "above_belt") return belt + 3;
  if (hem === "at_belt") return belt;
  if (hem === "mid_fly") return (belt + b.crotch_height) / 2;
  return b.crotch_height - 2;
}

// Difference from the shopper's target in each zone, for one body.
// Positive = more room / longer than wanted; negative = tighter / shorter.
function zoneDiffs(b: Record<string, number>, s: GarmentSize, intent: Intent, prefs: Prefs, garment: Garment, noise: () => number) {
  const tol = garment.tolerance_cm;
  const out: Partial<Record<Zone | "chestEase", number>> = {};
  if (s.chest_flat != null && intent.chest != null) {
    out.chestEase = 2 * (s.chest_flat + tol * noise()) - b.chest_girth;
    out.chest = out.chestEase - (intent.chest + STYLE_SHIFT.chest[prefs.fit]);
  }
  if (s.shoulder_width != null && intent.shoulder != null && garment.shoulder === "set-in")
    out.shoulder = s.shoulder_width + tol * noise() - b.bony_shoulder - (intent.shoulder + STYLE_SHIFT.shoulder[prefs.fit]);
  if (s.length_back != null) {
    const wornHem = b.neck_height - (s.length_back + tol * noise() - CONFIG.drapeK);
    out.length = hemHeight(b, prefs.hem) - wornHem; // positive: hem sits lower than wanted (longer)
  }
  if (garment.sleeve === "long" && s.sleeve_cb != null && intent.sleeve != null)
    out.sleeve = s.sleeve_cb + tol * noise() - b.cb_wrist - (intent.sleeve + STYLE_SHIFT.sleeve[prefs.fit]);
  return out;
}

export function recommend(model: BodyModel, twin: Gaussian, garment: Garment, prefs: Prefs, n = 4000): Recommendation {
  const bodies = sample(twin, n, 11).map((v) => toRecord(model, v));
  const intents = brandIntent(model, garment);
  const rand = rng(23);
  const noise = () => randn(rand);
  const sizes: SizeResult[] = garment.sizes.map((s, si) => {
    const diffs = bodies.map((b) => zoneDiffs(b, s, intents[si], prefs, garment, noise));
    const zones = (Object.keys(BANDS) as Zone[]).filter((z) => diffs[0][z] != null).map((z) => {
      const d = diffs.map((x) => x[z] as number);
      const meanD = d.reduce((a, v) => a + v, 0) / n;
      const sd = Math.sqrt(d.reduce((a, v) => a + (v - meanD) ** 2, 0) / n);
      const band = BANDS[z];
      return { zone: z, meanD, sd, pOk: d.filter((v) => Math.abs(v) <= band).length / n, pTight: d.filter((v) => v < -band).length / n, pLoose: d.filter((v) => v > band).length / n };
    });
    const has = (zz: Zone[]) => zz.filter((q) => zones.some((x) => x.zone === q));
    const core = has(CORE), secondary = has(SECONDARY);
    const pCore = diffs.filter((x) => core.every((q) => Math.abs(x[q] as number) <= BANDS[q])).length / n;
    const pSecondary = diffs.filter((x) => secondary.every((q) => Math.abs(x[q] as number) <= 2 * BANDS[q])).length / n;
    const ease = diffs.map((x) => x.chestEase).filter((v): v is number => v != null);
    const wearable = !ease.length || ease.filter((v) => v < MIN_CHEST_EASE).length / ease.length <= 0.25;
    return { size: s.size, pCore, pSecondary, score: pCore * (0.5 + 0.5 * pSecondary), wearable, zones, intent: intents[si] };
  });

  const pool = sizes.some((s) => s.wearable) ? sizes.filter((s) => s.wearable) : sizes;
  const logScore = (s: SizeResult) => s.zones.reduce((a, z) => a + Math.log(Math.max(z.pOk, 1e-4)), 0);
  const ranked = [...pool].sort((a, b) => b.score - a.score || logScore(b) - logScore(a));
  const best = ranked[0], second = ranked[1];
  const pos = (s: SizeResult) => garment.sizes.findIndex((g) => g.size === s.size);
  const between = second && best.score > 0 && second.score >= 0.85 * best.score && Math.abs(pos(second) - pos(best)) === 1 ? second.size : null;
  const confidence = best.pCore >= 0.5 ? "high" : best.pCore >= 0.25 ? "medium" : "low";
  const meanBody = toRecord(model, twin.mean);
  return { size: best.size, between, confidence, notes: fitNotes(best, garment.sizes[pos(best)], meanBody, prefs, garment), sizes };
}

// ---------- plain-language notes ----------

function fitNotes(best: SizeResult, s: GarmentSize, b: Record<string, number>, prefs: Prefs, garment: Garment) {
  const notes: { zone: string; text: string }[] = [];
  const z = (name: Zone) => best.zones.find((x) => x.zone === name);
  const cm = (v: number) => `${Math.max(1, Math.round(Math.abs(v)))} cm`;
  const chest = z("chest");
  if (chest) {
    const d = chest.meanD, [a, b2] = WORDING.chest;
    const text = d < -b2 ? "snug" : d < -a ? "a little snug" : d <= a ? `just right for a ${prefs.fit} fit` : d <= b2 ? "a little roomy" : "roomy";
    notes.push({ zone: "Chest", text });
  }
  const sh = z("shoulder");
  if (sh) {
    const d = sh.meanD, [a, b2] = WORDING.shoulder;
    const text = d < -b2 ? "narrow, seams sit inside your shoulders" : d < -a ? "slightly narrow" : d <= a ? "seams sit on your shoulders" : d <= b2 ? "seams sit just past your shoulders" : "wide, seams drop down your arms";
    notes.push({ zone: "Shoulders", text });
  }
  const len = z("length");
  if (len && s.length_back != null) {
    const wornHem = b.neck_height - (s.length_back - CONFIG.drapeK);
    const marks: [string, number][] = [
      ["above your belt", hemHeight(b, "above_belt")],
      ["at your belt", hemHeight(b, "at_belt")],
      ["just below your belt", hemHeight(b, "mid_fly")],
      ["over your seat", hemHeight(b, "covering")],
      ["well below your seat", b.crotch_height - 10],
    ];
    const where = marks.reduce((a, m) => (Math.abs(m[1] - wornHem) < Math.abs(a[1] - wornHem) ? m : a))[0];
    const off = Math.abs(len.meanD) > WORDING.length[0] ? ` (about ${cm(len.meanD)} ${len.meanD > 0 ? "longer" : "shorter"} than you like)` : "";
    notes.push({ zone: "Length", text: `ends ${where}${off}` });
  }
  const sl = z("sleeve");
  if (sl) {
    const d = sl.meanD;
    const text = Math.abs(d) <= WORDING.sleeve[0] ? "end at your wrist" : d < 0 ? `about ${cm(d)} short of your wrist` : `about ${cm(d)} past your wrist`;
    notes.push({ zone: "Sleeves", text });
  } else if (garment.sleeve === "short" && s.sleeve_cb != null && s.shoulder_width != null) {
    const reach = (s.sleeve_cb - b.bony_shoulder / 2) / b.upper_arm;
    const text = reach < 0.35 ? "end high on your upper arm" : reach < 0.65 ? "end mid upper arm" : "end just above your elbow";
    notes.push({ zone: "Sleeves", text });
  }
  return notes;
}
