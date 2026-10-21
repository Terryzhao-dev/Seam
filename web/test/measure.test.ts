// @ts-nocheck  (ported verbatim from scan/test/measure.test.mjs)
import { test } from "vitest";
import assert from "node:assert/strict";
import * as M from "../src/core/measure.js";
import { frontPerson, sidePerson } from "./synthetic.mjs";

const HEIGHT = 175;
// cm per pixel from the mask's own extent (the 1-pixel tip of the head is below the noise threshold).
const kOf = (mask) => { const e = M.bodyExtent(mask); return HEIGHT / (e.bottom - e.top + 1); };
const K = kOf(frontPerson().mask);
const near = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: got ${actual?.toFixed?.(2)}, expected ${expected.toFixed(2)} ± ${tol}`);

test("row runs merge tiny gaps and drop specks", () => {
  const m = { data: new Uint8Array(20), width: 20, height: 1 };
  [2, 3, 4, 6, 7, 8, 15].forEach((x) => (m.data[x] = 1));
  assert.deepEqual(M.rowRuns(m, 0), [[2, 8]]);
});

test("body extent finds head top and feet", () => {
  const { mask } = frontPerson();
  const e = M.bodyExtent(mask);
  assert.ok(e.top >= 55 && e.top <= 58, `top ${e.top}`);
  assert.equal(e.bottom, 750);
});

test("front pose passes the pose checks", () => {
  const { mask, lms } = frontPerson();
  const r = M.checkPose("front", lms, mask.width, mask.height, M.bodyExtent(mask));
  assert.equal(r.pass, true, JSON.stringify(r.checks.filter((c) => !c.pass)));
});

test("front measurements match the drawn body", () => {
  const { mask, lms } = frontPerson();
  const r = M.measureFront(mask, lms, HEIGHT);
  assert.equal(r.ok, true, r.reason);
  near(r.k, K, 1e-9, "cm per px");
  assert.ok(r.rows.yA > 212 && r.rows.yA < 300, `armpit row ${r.rows.yA}`);
  near(r.values.chest_width, 121 * K, 0.01, "chest width");
  near(r.values.waist_width, 101 * K, 0.01, "waist width");
  near(r.values.hip_width, 121 * K, 0.01, "hip width");
  assert.equal(r.rows.yCr, 471); // hips drawn through row 470
  near(r.values.inseam, (750 - 471) * K, 0.01, "inseam");
  near(r.values.upper_arm, 130 * K, 0.5, "upper arm");
  assert.ok(r.rows.yN >= 165 && r.rows.yN <= 200, `neck row ${r.rows.yN}`);
  assert.equal(r.profile.length, 51);
});

test("arms touching the body: widths skipped, lengths still measured", () => {
  const { mask, lms } = frontPerson();
  for (let y = 200; y < 470; y++) for (let x = 0; x < mask.width; x++) mask.data[y * mask.width + x] = 1;
  const r = M.measureFront(mask, lms, HEIGHT);
  assert.equal(r.ok, true);
  assert.equal(r.armsClear, false);
  assert.equal(r.values.chest_width, null);
  assert.equal(r.values.waist_width, null);
  near(r.values.upper_arm, 130 * K, 0.5, "upper arm");
  assert.ok(r.values.joint_shoulder > 0);
});

test("side pose falls back to standard heights when the front pose had no widths", () => {
  const { mask, lms } = sidePerson();
  const r = M.measureSide(mask, lms, HEIGHT, { chest: null, waist: null, hip: null });
  assert.equal(r.ok, true);
  assert.ok(r.values.chest_depth > 10 && r.values.waist_depth > 10, JSON.stringify(r.values));
});

test("side measurements read depth at the front pose's heights", () => {
  const front = M.measureFront(frontPerson().mask, frontPerson().lms, HEIGHT);
  const { mask, lms } = sidePerson();
  const chk = M.checkPose("side", lms, mask.width, mask.height, M.bodyExtent(mask));
  assert.equal(chk.pass, true, JSON.stringify(chk.checks.filter((c) => !c.pass)));
  const r = M.measureSide(mask, lms, HEIGHT, front.heights);
  assert.equal(r.ok, true, r.reason);
  const ks = kOf(mask);
  near(r.values.chest_depth, 60 * ks, 0.01, "chest depth");
  near(r.values.waist_depth, 70 * ks, 0.01, "waist depth");
  near(r.values.hip_depth, 76 * ks, 0.01, "hip depth");
});

test("summary takes the median and spread across frames", () => {
  const s = M.summarise([{ a: 10 }, { a: 12 }, { a: 11 }, { a: null }]);
  assert.equal(s.a.median, 11);
  assert.equal(s.a.n, 3);
});

test("quality drops when proportions look distorted", () => {
  const props = { crotch: { mean: 0.48, sd: 0.015 }, neck: { mean: 0.86, sd: 0.01 } };
  const steady = { outer_shoulder: { median: 48, iqr: 0.3 }, chest_width: { median: 32, iqr: 0.3 } };
  const good = M.quality(steady, {}, { crotch: 84, neck: 150.5 }, 175, props);
  const tilted = M.quality(steady, {}, { crotch: 95, neck: 150.5 }, 175, props);
  assert.ok(good.q > 0.8, `good q ${good.q}`);
  assert.ok(tilted.q < good.q / 2, `tilted q ${tilted.q}`);
});
