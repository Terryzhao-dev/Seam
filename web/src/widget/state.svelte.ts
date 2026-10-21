// All popup state in one place (Svelte 5 runes).

import * as B from "../core/bodymodel.ts";
import * as P from "../core/picks.ts";
import { CONFIG, recommend, type Garment, type Prefs, type Recommendation } from "../core/sizing.ts";
import { quality } from "../core/measure.js";
import { errorScale } from "../core/capture.ts";
import { Scanner, readingsFrom, type PoseCapture } from "./scanner.ts";
import { defaultUnits, type Units } from "./units.ts";

export type Step = "intro" | "height" | "weight" | "fit" | "length" | "camera" | "scanFront" | "scanSide" | "processing" | "torso" | "arms" | "result" | "save";
export const FLOW: Step[] = ["intro", "height", "weight", "fit", "length", "camera", "scanFront", "scanSide", "processing", "torso", "arms", "result", "save"];
const NO_RETURN: Step[] = ["processing", "scanFront", "scanSide"]; // back skips over these

export interface Calibration { camera?: Record<string, { offset: number; sd: number }>; drapeK?: number }

export class Finder {
  open = $state(false);
  step = $state<Step>("intro");
  dir = $state(1);
  units = $state<Units>(defaultUnits());
  heightCm = $state<number | null>(null);
  weightKg = $state<number | null>(null);
  prefs = $state<Prefs>({ fit: "regular", hem: "mid_fly" });
  garment = $state.raw<Garment | null>(null);
  scanSkipped = $state(false);
  front = $state.raw<PoseCapture | null>(null);
  side = $state.raw<PoseCapture | null>(null);
  readings = $state.raw<Record<string, number> | null>(null);
  readingScale = $state.raw<Record<string, number> | null>(null);
  scanQuality = $state.raw<ReturnType<typeof quality> | null>(null);
  priorTwin = $state.raw<B.Gaussian | null>(null);
  scanTwin = $state.raw<B.Gaussian | null>(null);
  twin = $state.raw<B.Gaussian | null>(null);
  torsoOptions = $state.raw<P.BodyOption[]>([]);
  armOptions = $state.raw<P.BodyOption[]>([]);
  torsoPick = $state<string | null>(null);
  armPick = $state<string | null>(null);
  rec = $state.raw<Recommendation | null>(null);
  savedEmail = $state<string | null>(null);
  error = $state<string | null>(null);
  debug = typeof location !== "undefined" && new URLSearchParams(location.search).has("debug");

  model: B.BodyModel | null = null;
  calibration: Calibration = {};
  scanner: Scanner | null = null;
  sessionId = crypto.randomUUID();
  onResult: ((size: string, rec: Recommendation) => void) | null = null;
  private history: Step[] = [];

  get progress() {
    const i = FLOW.indexOf(this.step);
    return Math.max(0, i) / (FLOW.length - 1);
  }

  go(step: Step) {
    this.error = null;
    this.dir = FLOW.indexOf(step) >= FLOW.indexOf(this.step) ? 1 : -1;
    this.history.push(this.step);
    this.step = step;
  }

  back() {
    this.error = null;
    let prev = this.history.pop();
    while (prev && NO_RETURN.includes(prev)) prev = this.history.pop();
    if (!prev) return;
    if (NO_RETURN.includes(this.step)) this.scanner?.stop();
    this.dir = -1;
    this.step = prev;
  }

  reset(garment: Garment) {
    this.garment = garment;
    this.step = "intro";
    this.history = [];
    this.scanSkipped = false;
    this.front = this.side = null;
    this.readings = null;
    this.readingScale = null;
    this.scanQuality = null;
    this.priorTwin = this.scanTwin = this.twin = null;
    this.torsoPick = this.armPick = null;
    this.rec = null;
    this.error = null;
    this.sessionId = crypto.randomUUID();
  }

  close() {
    this.scanner?.stop();
    this.open = false;
  }

  // Prior from height and weight, then the camera update if there was a scan.
  buildTwin() {
    if (!this.model || !this.heightCm || !this.weightKg) throw new Error("missing inputs");
    if (this.calibration.drapeK != null) CONFIG.drapeK = this.calibration.drapeK;
    const inputs = { height_cm: this.heightCm, weight_kg: this.weightKg };
    this.priorTwin = B.prior(this.model, inputs);
    let twin = this.priorTwin;
    if (this.front && this.side) {
      this.readings = readingsFrom(this.front, this.side);
      this.scanQuality = quality(this.front.summary, this.side.summary, this.front.heights, this.heightCm, this.model.proportions);
      // Checks that failed during capture widen the error on the readings they affect.
      this.readingScale = { ...errorScale("front", this.front.failures ?? {}), ...errorScale("side", this.side.failures ?? {}) };
      twin = B.condition(twin, B.cameraObservation(this.model, this.readings, this.scanQuality.q, this.calibration.camera, this.readingScale));
    }
    this.scanTwin = twin;
    this.twin = twin;
    this.torsoOptions = P.torsoOptions(this.model, twin);
  }

  pickTorso(id: string) {
    const opt = this.torsoOptions.find((o) => o.id === id)!;
    this.torsoPick = id;
    this.twin = P.applyTorsoPick(this.scanTwin!, opt);
    this.armOptions = P.armOptions(this.model!, this.twin);
  }

  pickArms(id: string) {
    const opt = this.armOptions.find((o) => o.id === id)!;
    this.armPick = id;
    const afterTorso = P.applyTorsoPick(this.scanTwin!, this.torsoOptions.find((o) => o.id === this.torsoPick)!);
    this.twin = P.applyArmPick(afterTorso, opt);
    this.rec = recommend(this.model!, this.twin, this.garment!, this.prefs);
  }

  recompute() {
    if (this.twin && this.garment) this.rec = recommend(this.model!, this.twin, this.garment, this.prefs);
  }
}

export const finder = new Finder();
