// Face ID-style capture scored out of 100. Every check is worth points by how much the
// measurements depend on it; the pose finishes the moment the score reaches the threshold,
// using frames already measured in the background. Failed checks never block on their own;
// they widen the error on the readings they affect (errorScale below).

// Points per check (sum 100). Front: the scale ruler (head and feet) and arms clear of the
// body (chest and waist widths) matter most. Side: actually turned, then the ruler.
// With the threshold at 80, the front can't finish without head+feet and arms out, and the
// side can't finish without turning and head+feet: the measurement-critical checks.
export const CHECK_POINTS: Record<"front" | "side", Record<string, number>> = {
  front: { frame: 30, arms: 25, facing: 15, upright: 10, straight: 5, feet: 5, visible: 5, distance: 3, still: 2 },
  side: { turned: 35, frame: 25, armsdown: 15, upright: 10, visible: 5, distance: 5, still: 5 },
};
export const THRESHOLD = 80;       // score that finishes the pose
export const STILL_MS = 5000;      // fallback: held still this long...
export const STILL_THRESHOLD = 60; // ...and at least this score...
// ...and the pose's defining check passes (never finish a "side" pose facing front).
export const DEFINING: Record<"front" | "side", string> = { front: "frame", side: "turned" };

export interface CheckResult { id: string; pass: boolean }

export function poseScore(pose: "front" | "side", checks: CheckResult[]): number {
  return checks.reduce((sum, c) => sum + (c.pass ? CHECK_POINTS[pose][c.id] ?? 0 : 0), 0);
}

export function readyToCapture(pose: "front" | "side", checks: CheckResult[], stillForMs: number): { ready: boolean; why: "score" | "still" | null; score: number } {
  const score = poseScore(pose, checks);
  if (score >= THRESHOLD) return { ready: true, why: "score", score };
  const defining = checks.find((c) => c.id === DEFINING[pose])?.pass;
  if (defining && score >= STILL_THRESHOLD && stillForMs >= STILL_MS) return { ready: true, why: "still", score };
  return { ready: false, why: null, score };
}

type Effect = { readings: string[] | "*"; penalty: number; dropAbove?: number };

// rate = share of captured frames where the check failed. Error multiplier per reading is
// the product of (1 + penalty x rate); dropAbove = ignore the reading if the check failed in
// more than that share of frames. Values are starting guesses [est], tuned on testers.
const WIDTHS = ["chest_width", "waist_width", "hip_width", "outer_shoulder"];
const DEPTHS = ["chest_depth", "waist_depth", "hip_depth"];
export const CHECK_EFFECTS: Record<"front" | "side", Record<string, Effect>> = {
  front: {
    // Head or feet cut off: the scale (typed height / pixel height) is wrong for everything.
    frame: { readings: "*", penalty: 2.0, dropAbove: 0.5 },
    visible: { readings: "*", penalty: 1.0 },
    distance: { readings: "*", penalty: 0.5 },
    still: { readings: "*", penalty: 0.3 },
    upright: { readings: ["neck_height", "armpit_height", "crotch_height", "chest_width", "waist_width"], penalty: 1.0 },
    facing: { readings: [...WIDTHS, "joint_shoulder"], penalty: 2.0, dropAbove: 0.8 },
    arms: { readings: [...WIDTHS, "upper_arm", "arm_length"], penalty: 1.0 },
    straight: { readings: ["upper_arm", "arm_length"], penalty: 2.0, dropAbove: 0.8 },
    feet: { readings: ["crotch_height", "hip_width"], penalty: 1.0 },
  },
  side: {
    frame: { readings: "*", penalty: 2.0, dropAbove: 0.5 },
    visible: { readings: "*", penalty: 1.0 },
    distance: { readings: "*", penalty: 0.5 },
    still: { readings: "*", penalty: 0.3 },
    upright: { readings: DEPTHS, penalty: 1.0 },
    turned: { readings: DEPTHS, penalty: 3.0, dropAbove: 0.5 },
    armsdown: { readings: DEPTHS, penalty: 1.0 },
  },
};

export const POSE_READINGS = {
  front: ["chest_width", "waist_width", "hip_width", "outer_shoulder", "joint_shoulder", "upper_arm", "arm_length", "neck_height", "armpit_height", "crotch_height"],
  side: DEPTHS,
};

export function failureRates(failedPerFrame: string[][]): Record<string, number> {
  const n = failedPerFrame.length || 1;
  const counts: Record<string, number> = {};
  for (const ids of failedPerFrame) for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).map(([id, c]) => [id, c / n]));
}

// Reading -> error multiplier (Infinity means: don't use this reading).
export function errorScale(pose: "front" | "side", rates: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = Object.fromEntries(POSE_READINGS[pose].map((r) => [r, 1]));
  for (const [check, rate] of Object.entries(rates)) {
    const effect = CHECK_EFFECTS[pose][check];
    if (!effect || rate <= 0) continue;
    const targets = effect.readings === "*" ? POSE_READINGS[pose] : effect.readings;
    for (const r of targets) {
      if (effect.dropAbove != null && rate > effect.dropAbove) out[r] = Infinity;
      else out[r] *= 1 + effect.penalty * rate;
    }
  }
  return out;
}
