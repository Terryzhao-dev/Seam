// Clothed body figures (front and side) drawn from twin measurements, as layered SVG paths:
// skin, trousers, tee, shoes. Shapes follow the body's widths, depths and landmark heights;
// head, hands, knees and feet use fixed human proportions.

type P = [number, number]; // [x, height above floor] in cm

export type LayerKind = "skin" | "hair" | "tee" | "trousers" | "shoe";
export interface FigureLayers {
  viewBox: string;     // full figure
  crops: { torso: string; upper: string };
  layers: { d: string; kind: LayerKind }[]; // in paint order
}

export interface FigureOptions {
  sleeve?: "short" | "long";
  armAngle?: number;   // degrees out from the body (front view)
  armScale?: number;   // illustrative arm thickness
}

const f = (v: number) => (Math.round(v * 10) / 10).toString();

// Smooth closed curve (Catmull-Rom to Bézier) in SVG coordinates. Lower tension = tighter corners.
function smooth(pts: P[], S: number, tension = 0.5): string {
  const q = pts.map(([x, h]) => [x, S - h] as P);
  const n = q.length;
  let d = `M${f(q[0][0])},${f(q[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = q[(i - 1 + n) % n], p1 = q[i], p2 = q[(i + 1) % n], p3 = q[(i + 2) % n];
    const c1: P = [p1[0] + ((p2[0] - p0[0]) * tension) / 3, p1[1] + ((p2[1] - p0[1]) * tension) / 3];
    const c2: P = [p2[0] - ((p3[0] - p1[0]) * tension) / 3, p2[1] - ((p3[1] - p1[1]) * tension) / 3];
    d += ` C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + "Z";
}

const mirror = (pts: P[]): P[] => pts.map(([x, h]) => [-x, h] as P).reverse();
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Arm outline along its axis: list of [distance along arm, half-width].
function armShape(O: P, angleDeg: number, side: 1 | -1, profile: [number, number][]): P[] {
  const a = (angleDeg * Math.PI) / 180;
  const d: P = [side * Math.sin(a), -Math.cos(a)];      // down and out
  const nrm: P = [side * Math.cos(a), Math.sin(a)];     // outward normal
  const at = (t: number, w: number, s: number): P => [O[0] + d[0] * t + nrm[0] * w * s, O[1] + d[1] * t + nrm[1] * w * s];
  return [...profile.map(([t, w]) => at(t, w, 1)), ...profile.slice().reverse().map(([t, w]) => at(t, w, -1))];
}

function landmarks(b: Record<string, number>) {
  const S = b.stature;
  return {
    S,
    hps: b.neck_height - 1.5,                       // side of the neck, a little below C7
    chin: S - 23.5,
    knee: 0.285 * S,
    calf: 0.205 * S,
    hip: b.crotch_height + 8,
    belt: b.navel_height - 3,
    hem: b.crotch_height + 4,                          // tee ending near the bottom of the fly
    neckW: (b.neck_girth / (2 * Math.PI)) * 0.88,
  };
}

export function frontFigure(b: Record<string, number>, opts: FigureOptions = {}): FigureLayers {
  const L = landmarks(b);
  const { S } = L;
  const angle = opts.armAngle ?? 9;
  const ra = ((b.arm_girth - 2) / (2 * Math.PI)) * (opts.armScale ?? 1); // relaxed arm ≈ flexed − 2 cm [est]
  const U = b.upper_arm, F = Math.max(b.arm_length - b.upper_arm, 20);

  const head: P[] = [[0, S], [5.6, S - 3.4], [7.6, S - 10], [7.2, S - 15.6], [5.4, S - 20.6], [3.0, S - 23.1], [0, S - 23.8]];
  const headPath = smooth([...head, ...mirror(head).slice(1, -1)], S, 0.55);
  const hairR: P[] = [[0, S + 0.6], [5.9, S - 2.6], [7.9, S - 8.6], [7.0, S - 9.4], [5.2, S - 5.2], [0, S - 4.2]];
  const hair = smooth([...hairR, ...mirror(hairR).slice(1, -1)], S, 0.5);

  const right: P[] = [
    [L.neckW, L.chin + 2],
    [L.neckW + 0.6, L.hps],
    [b.bony_shoulder / 2 - 4, b.shoulder_height + 2.2],
    [b.bony_shoulder / 2, b.shoulder_height + 0.4],
    [b.outer_shoulder / 2, b.shoulder_height - 6],
    [b.chest_width / 2 + 0.8, b.armpit_height],
    [b.chest_width / 2 + 0.3, b.chest_height],
    [lerp(b.chest_width, b.waist_width, 0.55) / 2 + 0.2, (b.chest_height + b.navel_height) / 2],
    [b.waist_width / 2, b.navel_height],
    [lerp(b.waist_width, b.hip_width, 0.6) / 2, b.navel_height - 7],
    [b.hip_width / 2, L.hip],
    [b.hip_width / 2 - 1.5, b.crotch_height - 6],
    [5.3, L.knee],
    [5.6, L.calf],
    [3.3, 7],
    [4.4, 1.6],
    [3.6, 0],
    [0.9, 0],
    [1.3, 6.5],
    [2.6, L.calf],
    [1.8, L.knee],
    [1.4, b.crotch_height - 14],
    [0.4, b.crotch_height - 1],
  ];
  const body = smooth([...right, ...mirror(right)], S, 0.5);

  const arms = ([1, -1] as const).map((side) => {
    const O: P = [side * (b.bony_shoulder / 2 - 2.2), b.shoulder_height - 2.5];
    return smooth(armShape(O, angle, side, [
      [-2.5, ra * 0.85], [4, ra * 1.12], [U * 0.55, ra], [U, ra * 0.72], [U + F * 0.25, ra * 0.84],
      [U + F, 2.6], [U + F + 2, 2.9], [U + F + 11, 2.4], [U + F + 17, 1.0],
    ]), S, 0.5);
  });

  // Tee: crew neck, sleeves along the arms, side seams hang a little off the body.
  const teeSides = ([1, -1] as const).map((side) => {
    const O: P = [side * (b.bony_shoulder / 2 - 2.2), b.shoulder_height - 2.5];
    const long = opts.sleeve === "long";
    const Ls = long ? U + F - 1 : U * 0.5;
    return armShape(O, angle, side, long
      ? [[-2.2, ra * 1.12 + 1.4], [U, ra * 0.72 + 1.6], [Ls, 3.4]]
      : [[-2.2, ra * 1.12 + 1.4], [Ls, ra + 1.7]]);
  });
  const sideX = (w: number) => w / 2 + 2.2;
  const teeRight: P[] = [
    [L.neckW + 1.4, L.hps + 0.4],
    [b.bony_shoulder / 2 + 1.5, b.shoulder_height - 0.2],
    teeSides[0][0], teeSides[0][Math.floor(teeSides[0].length / 2) - 1], teeSides[0][Math.floor(teeSides[0].length / 2)],
    [sideX(b.chest_width), b.armpit_height - 1.5],
    [Math.max(sideX(b.waist_width), sideX(b.chest_width) - 0.8), b.navel_height],
    [Math.max(b.hip_width, b.waist_width) / 2 + 1.8, L.hem],
  ];
  const neckDip: P = [0, L.hps - 4.6];
  const teeFront = smooth([...teeRight, ...mirror(teeRight), [-(L.neckW + 1.4) * 0.5, L.hps - 3.4], neckDip, [(L.neckW + 1.4) * 0.5, L.hps - 3.4]], S, 0.32);

  const trRight: P[] = [
    [lerp(b.waist_width, b.hip_width, 0.35) / 2 + 0.8, L.belt],
    [b.hip_width / 2 + 0.8, L.hip],
    [b.hip_width / 2 - 0.6, b.crotch_height - 6],
    [6.0, L.knee],
    [4.9, 3],
    [0.7, 3],
    [1.4, L.knee],
    [0.5, b.crotch_height - 2],
  ];
  const trousers = smooth([...trRight, [0, b.crotch_height - 0.8], ...mirror(trRight)], S, 0.35);
  const shoes = ([1, -1] as const).map((side) => smooth([[side * 0.5, 0], [side * 5.4, 0], [side * 5.4, 2.4], [side * 3.4, 3.6], [side * 0.6, 3.4]], S, 0.4));

  const half = Math.max(b.outer_shoulder / 2 + 2, b.hip_width / 2) + Math.sin((angle * Math.PI) / 180) * (U + F + 17) + ra;
  const w = Math.ceil(half + 2);
  return {
    viewBox: `${-w} -2 ${2 * w} ${f(S + 4)}`,
    crops: { torso: `${-w} -2 ${2 * w} ${f(S - L.knee + 8)}`, upper: `${-w + 4} -2 ${2 * w - 8} ${f(S - b.crotch_height + 8)}` },
    layers: [
      ...arms.map((d) => ({ d, kind: "skin" as const })),
      { d: body, kind: "skin" },
      { d: headPath, kind: "skin" },
      { d: hair, kind: "hair" },
      { d: trousers, kind: "trousers" },
      ...shoes.map((d) => ({ d, kind: "shoe" as const })),
      { d: teeFront, kind: "tee" },
    ],
  };
}

export function sideFigure(b: Record<string, number>, opts: FigureOptions = {}): FigureLayers {
  const L = landmarks(b);
  const { S } = L;
  const cd = b.chest_depth, wd = b.waist_depth, hd = b.hip_depth;
  const ra = ((b.arm_girth - 2) / (2 * Math.PI)) * (opts.armScale ?? 1);
  const U = b.upper_arm, F = Math.max(b.arm_length - b.upper_arm, 20);
  const front = (x: number) => x;

  const head: P[] = [[-1, S], [-6.6, S - 3.4], [-8.6, S - 9], [-8.2, S - 14], [-4.6, S - 20.6], [-4.2, S - 22.4],
    [5.4, S - 22.8], [8.0, S - 19.6], [8.6, S - 17.4], [10.2, S - 13.6], [8.8, S - 9.6], [7.2, S - 4.4], [3.4, S - 0.6]];
  const headPath = smooth(head, S, 0.5);
  const hair = smooth([[-1.2, S + 0.6], [-7.2, S - 3.2], [-9.0, S - 9.6], [-8.4, S - 14.2], [-6.6, S - 12.4], [-4.4, S - 8.2], [0.6, S - 5.4], [5.6, S - 4.0], [7.4, S - 4.8], [6.6, S - 1.4], [3.0, S + 0.4]], S, 0.5);

  const body: P[] = [
    // front, top to bottom
    [4.4, L.chin + 0.8],
    [5.0, L.hps - 2],
    [front(0.52 * cd), b.armpit_height + 2],
    [front(0.58 * cd), b.chest_height],
    [front(lerp(0.56 * cd, 0.6 * wd, 0.5)), (b.chest_height + b.navel_height) / 2],
    [front(0.62 * wd), b.navel_height],
    [front(0.5 * hd), L.hip + 4],
    [front(0.36 * hd), b.crotch_height + 2],
    [front(0.36 * hd) + 0.8, b.crotch_height - 8],
    [4.8, L.knee],
    [4.0, L.calf],
    [3.4, 6],
    [16.4, 1.0],
    [16.0, 0],
    // back, bottom to top
    [-4.0, 0],
    [-3.6, 6],
    [-6.2, L.calf + 3],
    [-4.6, L.knee],
    [-6.4, b.crotch_height - 10],
    [-0.5 * hd, b.crotch_height - 2],
    [-0.6 * hd, L.hip - 1],
    [-0.36 * wd, b.navel_height + 2],
    [-0.4 * cd, b.chest_height - 6],
    [-0.46 * cd, b.armpit_height + 4],
    [-4.6, b.neck_height + 1],
    [-4.0, L.chin + 1.5],
  ];
  const bodyPath = smooth(body, S, 0.5);

  // Arm hangs at the side, slightly in front of the torso centre.
  const O: P = [-0.04 * cd, b.shoulder_height - 1.5];
  const arm = smooth(armShape(O, -4, 1, [
    [-2.5, ra * 0.95], [4, ra * 1.1], [U * 0.55, ra], [U, ra * 0.75], [U + F * 0.25, ra * 0.8], [U + F, 2.4], [U + F + 9, 2.6], [U + F + 16, 1.0],
  ]), S, 0.5);

  const teeBody: P[] = [
    [5.8, L.hps + 0.6],
    [front(0.52 * cd) + 1.6, b.armpit_height + 2],
    [front(0.58 * cd) + 1.6, b.chest_height],
    [Math.max(front(0.62 * wd), front(0.58 * cd) - 1) + 2, b.navel_height],
    [Math.max(front(0.62 * wd), 0.5 * hd) + 2, L.hem],
    [-(0.55 * hd) - 1.6, L.hem],
    [-(0.36 * wd) - 2.6, b.navel_height + 2],
    [-(0.4 * cd) - 1.8, b.chest_height - 6],
    [-(0.46 * cd) - 1.6, b.armpit_height + 4],
    [-4.8, b.neck_height + 0.6],
  ];
  const long = opts.sleeve === "long";
  const sleeve = smooth(armShape(O, -4, 1, long
    ? [[-3, ra * 1.1 + 1.4], [U, ra * 0.75 + 1.5], [U + F - 1, 3.2]]
    : [[-3, ra * 1.1 + 1.4], [U * 0.5, ra + 1.6]]), S, 0.35);

  const trousers: P[] = [
    [0.55 * wd + 0.8, L.belt],
    [0.5 * hd + 0.8, L.hip + 3],
    [0.36 * hd + 1.6, b.crotch_height - 8],
    [5.6, L.knee],
    [4.6, 3],
    [-4.6, 3],
    [-5.4, L.knee],
    [-7.2, b.crotch_height - 10],
    [-0.6 * hd - 0.8, L.hip - 1],
    [-0.38 * wd - 0.8, L.belt],
  ];
  const shoe = smooth([[-4.6, 0], [16.8, 0], [16.4, 1.6], [9, 3.4], [3.6, 4.6], [-4.4, 4.2]], S, 0.4);
  return {
    viewBox: `-24 -2 48 ${f(S + 4)}`,
    crops: { torso: `-22 -2 44 ${f(S - L.knee + 8)}`, upper: `-20 -2 40 ${f(S - b.crotch_height + 8)}` },
    layers: [
      { d: bodyPath, kind: "skin" },
      { d: headPath, kind: "skin" },
      { d: hair, kind: "hair" },
      { d: smooth(trousers, S, 0.35), kind: "trousers" },
      { d: shoe, kind: "shoe" },
      { d: smooth(teeBody, S, 0.35), kind: "tee" },
      { d: arm, kind: "skin" },
      { d: sleeve, kind: "tee" },
    ],
  };
}
