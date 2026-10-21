import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as E from "../engine.js";

const models = JSON.parse(readFileSync(new URL("../models.json", import.meta.url)));
const charts = JSON.parse(readFileSync(new URL("../charts.json", import.meta.url)));
const inputs = { height_cm: 178, weight_kg: 75, age: 20 };

test("prior gives plausible measurements for 178 cm, 75 kg", () => {
  const p = E.priorEstimates(models, inputs);
  assert.ok(p.chest_girth.mean > 88 && p.chest_girth.mean < 102, `chest ${p.chest_girth.mean}`);
  assert.ok(p.outer_shoulder.mean > 44 && p.outer_shoulder.mean < 52, `shoulder ${p.outer_shoulder.mean}`);
  assert.ok(Math.abs(p.chest_girth.sd - 3.67) < 0.01);
});

test("camera chest girth comes from width + depth and carries their error", () => {
  const raw = { chest_width: 32, chest_depth: 23, outer_shoulder: 48 };
  const c = E.cameraEstimates(models, inputs, raw, 1);
  assert.equal(c.chest_girth.via, "chest_girth_wd");
  assert.ok(c.chest_girth.mean > 85 && c.chest_girth.mean < 105, `chest ${c.chest_girth.mean}`);
  assert.ok(c.chest_girth.sd > models.camera.chest_girth_wd.rmse);
  const front = E.cameraEstimates(models, inputs, { chest_width: 32, outer_shoulder: 48 }, 1);
  assert.equal(front.chest_girth.via, "chest_girth_w");
});

test("low scan quality widens camera error, so the prior dominates", () => {
  const raw = { chest_width: 32, chest_depth: 23, outer_shoulder: 48 };
  const prior = E.priorEstimates(models, inputs);
  const good = E.combine(prior, E.cameraEstimates(models, inputs, raw, 1));
  const bad = E.combine(prior, E.cameraEstimates(models, inputs, raw, 0.1));
  assert.ok(good.chest_girth.cameraWeight > bad.chest_girth.cameraWeight);
  assert.ok(bad.chest_girth.cameraWeight < 0.15, `bad weight ${bad.chest_girth.cameraWeight}`);
});

test("combining equal errors averages the two", () => {
  const out = E.combine({ x: { mean: 10, sd: 2 } }, { x: { mean: 14, sd: 2 } });
  assert.equal(out.x.mean, 12);
  assert.ok(Math.abs(out.x.sd - Math.SQRT2) < 1e-9);
});

test("size engine picks sensible Gildan sizes", () => {
  const chart = charts[0];
  const est = (chest) => ({ chest_girth: { mean: chest, sd: 2 }, torso_length: { mean: 70, sd: 2 } });
  assert.ok(["M", "L"].includes(E.recommend(est(96), chart, "regular").size));
  assert.equal(E.recommend(est(122), chart, "regular").size, "2XL");
  const slim = E.recommend(est(96), chart, "slim").size;
  const relaxed = E.recommend(est(96), chart, "relaxed").size;
  const order = chart.sizes.map((s) => s.size);
  assert.ok(order.indexOf(slim) <= order.indexOf(relaxed), `slim ${slim} relaxed ${relaxed}`);
  const notes = E.recommend(est(96), chart, "regular").notes;
  assert.equal(notes[0].zone, "chest");
});

test("tape comparison reports errors", () => {
  const rows = E.compareToTape({ chest_girth: "97", waist_girth: "" }, { chest_girth: { mean: 99 } }, { chest_girth: { mean: 95 } }, { chest_girth: { mean: 98 } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cameraErr, 2);
  assert.equal(rows[0].priorErr, -2);
});
