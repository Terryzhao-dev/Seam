// Small dense linear algebra for the body model (matrices up to ~25 x 25).

export type Vec = number[];
export type Mat = number[][];

export const zeros = (r: number, c: number): Mat => Array.from({ length: r }, () => new Array(c).fill(0));
export const identity = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const transpose = (A: Mat): Mat => A[0].map((_, j) => A.map((row) => row[j]));

export function matMul(A: Mat, B: Mat): Mat {
  const n = A.length, m = B[0].length, k = B.length;
  const C = zeros(n, m);
  for (let i = 0; i < n; i++)
    for (let p = 0; p < k; p++) {
      const a = A[i][p];
      if (a === 0) continue;
      for (let j = 0; j < m; j++) C[i][j] += a * B[p][j];
    }
  return C;
}

export const matVec = (A: Mat, x: Vec): Vec => A.map((row) => row.reduce((s, a, j) => s + a * x[j], 0));
export const add = (A: Mat, B: Mat): Mat => A.map((row, i) => row.map((a, j) => a + B[i][j]));
export const sub = (A: Mat, B: Mat): Mat => A.map((row, i) => row.map((a, j) => a - B[i][j]));
export const symmetrise = (A: Mat): Mat => A.map((row, i) => row.map((a, j) => (a + A[j][i]) / 2));
export const outer = (a: Vec, b: Vec): Mat => a.map((x) => b.map((y) => x * y));

// Lower-triangular L with A = L Lᵀ. Adds a tiny jitter if A is barely positive definite.
export function cholesky(A: Mat): Mat {
  const n = A.length;
  for (let attempt = 0; attempt < 5; attempt++) {
    const jitter = attempt === 0 ? 0 : 1e-10 * 10 ** attempt;
    const L = zeros(n, n);
    let ok = true;
    for (let i = 0; i < n && ok; i++)
      for (let j = 0; j <= i; j++) {
        let s = A[i][j] + (i === j ? jitter : 0);
        for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
        if (i === j) {
          if (s <= 0) { ok = false; break; }
          L[i][i] = Math.sqrt(s);
        } else L[i][j] = s / L[j][j];
      }
    if (ok) return L;
  }
  throw new Error("matrix is not positive definite");
}

// Inverse of a symmetric positive definite matrix via Cholesky.
export function spdInverse(A: Mat): Mat {
  const L = cholesky(A);
  const n = A.length;
  const Linv = zeros(n, n);
  for (let i = 0; i < n; i++) {
    Linv[i][i] = 1 / L[i][i];
    for (let j = 0; j < i; j++) {
      let s = 0;
      for (let k = j; k < i; k++) s -= L[i][k] * Linv[k][j];
      Linv[i][j] = s / L[i][i];
    }
  }
  return matMul(transpose(Linv), Linv);
}

// Eigen-decomposition of a small symmetric matrix (Jacobi). Sorted by eigenvalue, largest first.
export function symEigen(A: Mat): { values: Vec; vectors: Mat } {
  const n = A.length;
  const a = A.map((r) => [...r]);
  const v = identity(n);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2;
    if (off < 1e-20) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p], akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k], aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k][p], vkq = v[k][q];
          v[k][p] = c * vkp - s * vkq;
          v[k][q] = s * vkp + c * vkq;
        }
      }
  }
  const order = a.map((_, i) => i).sort((i, j) => a[j][j] - a[i][i]);
  return { values: order.map((i) => a[i][i]), vectors: order.map((i) => v.map((row) => row[i])) };
}

// Seeded random numbers so recommendations are reproducible.
export function rng(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randn(rand: () => number): number {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
