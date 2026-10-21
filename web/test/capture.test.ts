import { test } from "vitest";
import assert from "node:assert/strict";
import { readyToCapture, errorScale, failureRates, CHECK_POINTS } from "../src/core/capture.ts";
import * as B from "../src/core/bodymodel.ts";
import { readFileSync } from "node:fs";

const FRONT = ["visible", "frame", "distance", "upright", "facing", "arms", "straight", "feet", "still"];
const SIDE = ["visible", "frame", "distance", "upright", "turned", "armsdown", "still"];
const checks = (pass: string[], all = FRONT) => all.map((id) => ({ id, pass: pass.includes(id) }));

test("points add up to 100 per pose", () => {
  for (const pose of ["front", "side"] as const) assert.equal(Object.values(CHECK_POINTS[pose]).reduce((a, b) => a + b, 0), 100);
});

test("front pose finishes the moment the weighted score reaches 80", () => {
  // head+feet 30, arms 25, facing 15, upright 10 = 80
  const r = readyToCapture("front", checks(["frame", "arms", "facing", "upright"]), 0);
  assert.equal(r.score, 80);
  assert.equal(r.ready, true);
});

test("front can't finish on points without head+feet or without arms out", () => {
  const noArms = checks(FRONT.filter((id) => id !== "arms"));
  assert.equal(readyToCapture("front", noArms, 0).score, 75);
  assert.equal(readyToCapture("front", noArms, 0).ready, false);
  const noFrame = checks(FRONT.filter((id) => id !== "frame"));
  assert.equal(readyToCapture("front", noFrame, 0).ready, false);
});

test("holding still 5 s finishes a nearly-there pose (score 60+, head+feet in view), but not a poor one", () => {
  const noArms = checks(FRONT.filter((id) => id !== "arms")); // 75: someone who can't raise their arms
  assert.equal(readyToCapture("front", noArms, 4900).ready, false);
  assert.equal(readyToCapture("front", noArms, 5000).why, "still");
  assert.equal(readyToCapture("front", checks(["frame", "upright", "visible"]), 9000).ready, false); // 45
  assert.equal(readyToCapture("front", checks(FRONT.filter((id) => id !== "frame")), 9000).ready, false); // no ruler
});

test("side pose can't finish without turning: everything else is 65 points", () => {
  const notTurned = checks(["visible", "frame", "distance", "upright", "armsdown", "still"], SIDE);
  const r = readyToCapture("side", notTurned, 9000);
  assert.equal(r.score, 65);
  assert.equal(r.ready, false);
  assert.equal(readyToCapture("side", checks(["turned", "frame", "upright", "visible", "distance"], SIDE), 0).ready, true); // 80
});

test("failed checks widen the right readings; cut-off feet or an unturned side drop readings", () => {
  const rates = failureRates([["straight"], ["straight"], [], []]); // elbows bent half the time
  assert.equal(rates.straight, 0.5);
  const front = errorScale("front", rates);
  assert.equal(front.arm_length, 2);       // 1 + 2.0 x 0.5
  assert.equal(front.chest_width, 1);      // unaffected
  assert.equal(errorScale("side", { turned: 0.9 }).chest_depth, Infinity);
  const cut = errorScale("front", { frame: 0.75 });
  assert.ok(Object.values(cut).every((v) => v === Infinity), "scale unknown: ignore camera numbers");
});

test("dropped readings are skipped by the camera update; widened ones count less", () => {
  const model = JSON.parse(readFileSync(new URL("../public/body_model.json", import.meta.url), "utf8"));
  const readings = { chest_width: 31, chest_depth: 24, arm_length: 58 };
  const obs = B.cameraObservation(model, readings, 1, {}, { chest_depth: Infinity, arm_length: 2 });
  assert.deepEqual(obs.labels, ["chest_width", "arm_length"]);
  const plain = B.cameraObservation(model, readings, 1);
  const iArm = plain.labels!.indexOf("arm_length");
  assert.ok(obs.R[1][1] > plain.R[iArm][iArm] * 3.5, "arm length error doubled (variance x4)");
});
