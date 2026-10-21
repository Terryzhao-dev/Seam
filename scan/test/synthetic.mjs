// A simple synthetic person (mask + landmarks) with known dimensions, for tests.

export function makeMask(width, height) {
  return { data: new Uint8Array(width * height), width, height };
}

export function fillRect(m, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.data[y * m.width + x] = 1;
}

export function fillEllipse(m, cx, cy, rx, ry) {
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) m.data[y * m.width + x] = 1;
}

// Thick line from a to b (capsule).
export function fillLimb(m, a, b, r) {
  const minX = Math.floor(Math.min(a.x, b.x) - r), maxX = Math.ceil(Math.max(a.x, b.x) + r);
  const minY = Math.floor(Math.min(a.y, b.y) - r), maxY = Math.ceil(Math.max(a.y, b.y) + r);
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      if (Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) <= r) m.data[y * m.width + x] = 1;
    }
}

const W = 400, H = 800;

// Front A-pose. Known: top row 55, bottom row 750, chest band 121 px wide (y 200 to 300),
// waist band 101 px (y 300 to 420), crotch at y 470, upper arm 130 px.
export function frontPerson() {
  const m = makeMask(W, H);
  fillEllipse(m, 200, 100, 35, 45);                 // head, top at 55
  fillRect(m, 186, 140, 214, 180);                  // neck, 29 px
  for (let y = 165; y < 200; y++) {                 // shoulder slope
    const half = 14 + ((y - 165) / 35) * (60 - 14);
    fillRect(m, Math.round(200 - half), y, Math.round(200 + half), y);
  }
  fillRect(m, 140, 200, 260, 300);                  // chest band, 121 px
  fillRect(m, 150, 301, 250, 420);                  // waist band, 101 px
  fillRect(m, 140, 421, 260, 470);                  // hips, 121 px
  fillRect(m, 150, 471, 195, 735);                  // left leg
  fillRect(m, 205, 471, 250, 735);                  // right leg (gap 196 to 204)
  fillRect(m, 145, 736, 198, 750);                  // feet, bottom at 750
  fillRect(m, 202, 736, 255, 750);

  const a = (35 * Math.PI) / 180;
  const sL = { x: 135, y: 212 }, sR = { x: 265, y: 212 };  // shoulder joints: ratio to torso ~0.56
  const eL = { x: sL.x - 130 * Math.sin(a), y: sL.y + 130 * Math.cos(a) };
  const eR = { x: sR.x + 130 * Math.sin(a), y: sR.y + 130 * Math.cos(a) };
  const wL = { x: eL.x - 120 * Math.sin(a), y: eL.y + 120 * Math.cos(a) };
  const wR = { x: eR.x + 120 * Math.sin(a), y: eR.y + 120 * Math.cos(a) };
  fillLimb(m, sL, eL, 15); fillLimb(m, eL, wL, 12);
  fillLimb(m, sR, eR, 15); fillLimb(m, eR, wR, 12);

  const pts = Array.from({ length: 33 }, () => ({ x: 200, y: 100 }));
  Object.assign(pts, {
    0: { x: 200, y: 105 }, 11: sL, 12: sR, 13: eL, 14: eR, 15: wL, 16: wR,
    23: { x: 175, y: 445 }, 24: { x: 225, y: 445 }, 25: { x: 172, y: 600 }, 26: { x: 228, y: 600 },
    27: { x: 172, y: 730 }, 28: { x: 228, y: 730 },
  });
  return { mask: m, lms: norm(pts) };
}

// Side pose. Known: same top and bottom; torso depth 60 px at chest height, 70 px at waist.
export function sidePerson() {
  const m = makeMask(W, H);
  fillEllipse(m, 200, 100, 30, 45);
  fillRect(m, 190, 140, 214, 199);
  fillRect(m, 170, 200, 229, 300);                  // chest depth 60 px
  fillRect(m, 165, 301, 234, 420);                  // waist depth 70 px
  fillRect(m, 165, 421, 240, 470);                  // hips/buttocks 76 px
  fillRect(m, 180, 471, 225, 750);                  // legs together
  const pts = Array.from({ length: 33 }, () => ({ x: 200, y: 100 }));
  Object.assign(pts, {
    11: { x: 200, y: 212 }, 12: { x: 202, y: 212 }, 13: { x: 200, y: 340 }, 14: { x: 202, y: 340 },
    15: { x: 200, y: 450 }, 16: { x: 202, y: 450 }, 23: { x: 200, y: 445 }, 24: { x: 202, y: 445 },
    25: { x: 200, y: 600 }, 26: { x: 202, y: 600 }, 27: { x: 200, y: 730 }, 28: { x: 202, y: 730 },
  });
  return { mask: m, lms: norm(pts) };
}

function norm(pts) {
  return pts.map((p) => ({ x: p.x / W, y: p.y / H, z: 0, visibility: 1 }));
}
