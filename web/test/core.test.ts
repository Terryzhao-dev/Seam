import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as B from "../src/core/bodymodel.ts";
import * as P from "../src/core/picks.ts";
import * as Z from "../src/core/sizing.ts";
import { symEigen } from "../src/core/linalg.ts";

const load = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const model: B.BodyModel = load("../public/body_model.json");
const ref = load("../src/core/reference.json");
const tee: Z.Garment = load("../public/garments/uniqlo-supima-tee.json");
const ls: Z.Garment = load("../public/garments/uniqlo-soft-brushed-ls.json");
const close = (a: number[], b: number[], tol: number, what: string) =>
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= tol, `${what}[${model.vars[i] ?? i}]: ${v} vs ${b[i]}`));

test("prior matches the numpy reference", () => {
  const g = B.prior(model, ref.inputs);
  close(g.mean, ref.prior_mean, 1e-6, "prior mean");
});

test("camera update matches the numpy reference", () => {
  const g = B.prior(model, ref.inputs);
  const keys = Object.keys(ref.observations);
  const obs = { H: keys.map((k) => B.unitRow(model, k)), y: keys.map((k) => ref.observations[k]), R: ref.R };
  const post = B.condition(g, obs);
  close(post.mean, ref.posterior_mean, 1e-6, "posterior mean");
  close(post.cov.map((r, i) => Math.sqrt(r[i])), ref.posterior_sd, 1e-6, "posterior sd");
});

test("typical wearer from population matches the numpy reference", () => {
  const pop = { mean: model.population.mean, cov: model.population.cov };
  const t = B.conditionOn(model, pop, { chest_girth: 100, waist_girth: 80 });
  close(t.mean, ref.typical_given_chest100_waist80, 1e-4, "typical");
});

test("camera observation applies offsets, quality and the shared scale term", () => {
  const obs = B.cameraObservation(model, { chest_width: 31, joint_shoulder: 36, nothing: 5 }, 0.5);
  assert.deepEqual(obs.labels, ["chest_width", "joint_shoulder"]);
  assert.deepEqual(obs.y, [30, 41]);
  assert.ok(Math.abs(obs.R[0][0] - ((2.0 / 0.5) ** 2 + 30 * 30 * B.SCALE_SD ** 2)) < 1e-9);
  assert.ok(obs.R[0][1] > 0, "scale error is shared between readings");
});

test("eigen-decomposition recovers a known matrix", () => {
  const { values, vectors } = symEigen([[4, 1], [1, 3]]);
  assert.ok(Math.abs(values[0] - (3.5 + Math.sqrt(1.25))) < 1e-9);
  const v = vectors[0];
  assert.ok(Math.abs(4 * v[0] + 1 * v[1] - values[0] * v[0]) < 1e-9);
});

test("torso options differ visibly and stay plausible", () => {
  const g = B.prior(model, { height_cm: 178, weight_kg: 75 });
  const opts = P.torsoOptions(model, g);
  assert.equal(opts.length, 4);
  const chests = opts.map((o) => o.body.chest_girth);
  assert.ok(Math.max(...chests) - Math.min(...chests) >= 3.9, `chest spread ${chests}`);
  assert.equal(new Set(opts.map((o) => o.label)).size, 4, opts.map((o) => o.label).join(", "));
  for (const o of opts) assert.ok(o.body.chest_girth > 85 && o.body.chest_girth < 112);
});

test("a torso pick moves the twin towards the option, but only part of the way", () => {
  const g = B.prior(model, { height_cm: 178, weight_kg: 75 });
  const opt = P.torsoOptions(model, g).find((o) => o.label === "Larger build")!;
  const after = P.applyTorsoPick(g, opt);
  const before = B.marginal(model, g, "chest_girth").mean;
  const now = B.marginal(model, after, "chest_girth").mean;
  assert.ok(now > before && now < opt.body.chest_girth, `${before} -> ${now} (option ${opt.body.chest_girth})`);
  assert.ok(B.marginal(model, after, "chest_girth").sd < B.marginal(model, g, "chest_girth").sd);
});

test("arm options are spaced at least 1.5 cm and a pick updates arm girth", () => {
  const g = B.prior(model, { height_cm: 178, weight_kg: 75 });
  const opts = P.armOptions(model, g);
  assert.ok(opts[2].body.arm_girth - opts[1].body.arm_girth >= 1.5);
  const after = P.applyArmPick(g, opts[2]);
  assert.ok(B.marginal(model, after, "arm_girth").mean > B.marginal(model, g, "arm_girth").mean);
});

// A twin pinned near the brand's typical wearer for a size should get that size.
function typicalTwin(chest: number, waist: number): B.Gaussian {
  const pop = { mean: model.population.mean, cov: model.population.cov };
  const t = B.conditionOn(model, pop, { chest_girth: chest, waist_girth: waist });
  return { mean: t.mean, cov: t.mean.map((_, i) => t.mean.map((__, j) => (i === j ? 0.5 : 0))) };
}

for (const garment of [tee, ls]) {
  test(`typical wearer of each size gets that size: ${garment.name}`, () => {
    for (const s of garment.sizes.filter((x) => ["S", "M", "L", "XL"].includes(x.size))) {
      const c = (s.body!.chest![0] + s.body!.chest![1]) / 2, w = (s.body!.waist![0] + s.body!.waist![1]) / 2;
      for (const hem of ["at_belt", "covering"] as Z.HemChoice[]) {
        const rec = Z.recommend(model, typicalTwin(c, w), garment, { fit: "regular", hem }, 1500);
        assert.equal(rec.size, s.size, `chest ${c}, hem ${hem}: got ${rec.size}`);
      }
    }
  });
}

test("fit style moves the size in the right direction", () => {
  const twin = typicalTwin(103, 83); // near the M/L boundary
  const order = tee.sizes.map((s) => s.size);
  const slim = Z.recommend(model, twin, tee, { fit: "slim", hem: "covering" }, 1500).size;
  const relaxed = Z.recommend(model, twin, tee, { fit: "relaxed", hem: "covering" }, 1500).size;
  assert.ok(order.indexOf(slim) < order.indexOf(relaxed), `slim ${slim}, relaxed ${relaxed}`);
});

test("an uncertain twin still gets a size, with lower confidence", () => {
  const g = B.prior(model, { height_cm: 178, weight_kg: 75 });
  const rec = Z.recommend(model, g, tee, { fit: "regular", hem: "covering" }, 1500);
  assert.ok(["S", "M", "L"].includes(rec.size), rec.size);
  assert.notEqual(rec.confidence, "high");
  assert.ok(rec.notes.some((n) => n.zone === "Chest"));
});

test("long sleeve notes talk about the wrist", () => {
  const rec = Z.recommend(model, typicalTwin(100, 80), ls, { fit: "regular", hem: "covering" }, 1500);
  assert.match(rec.notes.find((n) => n.zone === "Sleeves")!.text, /wrist/);
});

test("a slimmer-fitting size stays wearable: chest on the S/M boundary is 'between S and M'", () => {
  const g0 = B.prior(model, { height_cm: 178, weight_kg: 75 });
  const opts = P.torsoOptions(model, g0);
  const g1 = P.applyTorsoPick(g0, opts.find((o) => o.label === "Leaner")!);
  const g2 = P.applyArmPick(g1, P.armOptions(model, g1)[1]);
  const rec = Z.recommend(model, g2, tee, { fit: "regular", hem: "mid_fly" }, 2000);
  assert.deepEqual([rec.size, rec.between].sort(), ["M", "S"]);
  assert.ok(rec.sizes.find((s) => s.size === "S")!.wearable, "S gives ~6 cm of chest ease, so it is wearable");
  assert.ok(!rec.sizes.find((s) => s.size === "XS")!.wearable, "XS is smaller than the body");
});

test("clothed figures produce valid layered paths for small and large bodies", async () => {
  const { frontFigure, sideFigure } = await import("../src/core/figure.ts");
  for (const [h, w] of [[160, 52], [178, 75], [195, 120]]) {
    const body = B.toRecord(model, B.prior(model, { height_cm: h, weight_kg: w }).mean);
    for (const fig of [frontFigure(body), sideFigure(body), frontFigure(body, { sleeve: "long", armScale: 1.3 })]) {
      assert.ok(fig.layers.length >= 6);
      for (const l of fig.layers) {
        assert.match(l.d, /^M[-\d.]+,[-\d.]+/);
        assert.ok(!l.d.includes("NaN"), `${h}/${w} ${l.kind}`);
      }
      assert.ok(["skin", "tee", "trousers", "shoe"].every((k) => fig.layers.some((l) => l.kind === k)));
    }
  }
});
