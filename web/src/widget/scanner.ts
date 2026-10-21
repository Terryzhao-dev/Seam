// Camera + MediaPipe: live pose checks, auto-capture of the front and side poses.
// Ported from scan/app.js. Video never leaves the browser.

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import * as M from "../core/measure.js";
import { CHECK_POINTS, THRESHOLD, failureRates, readyToCapture } from "../core/capture.ts";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const modelUrl = (v: string) => `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${v}/float16/latest/pose_landmarker_${v}.task`;

const BUFFER = 16;              // most recent measured frames kept (about 0.6 s)
const MIN_FRAMES = 4;           // frames needed before a pose can finish
const SIDE_GRACE_MS = 1200;     // time to turn after the front pose
const STALL_MS = 3000;          // ready but no measurable frames: finish anyway
const STILL_FRAMES = 12;
const SMOOTH_FRAMES = 10;       // a check counts as passed if it held in most of the last 10 frames
const SMOOTH_PASS = 0.6;
const STILL_TOL = 0.02;         // max landmark drift, share of frame height
// Widest native view: full-sensor 4:3 at high resolution, no cropping or scaling by the browser.
const WIDE: MediaTrackConstraints = { width: { ideal: 1920 }, height: { ideal: 1440 }, aspectRatio: { ideal: 4 / 3 }, ...({ resizeMode: { ideal: "none" } } as object) };
const ULTRA_WIDE = /ultra ?wide|0[.,]5/i;

export type Pose = "front" | "side";
export interface Check { id: string; label: string; pass: boolean; hint: string }
export interface ScanUpdate { phase: "setup" | "capture"; status: string; checks: Check[]; progress: number; personInView: boolean; score: number; stillFor: number }
export interface PoseCapture {
  frames: any[];
  summary: Record<string, { median: number | null; iqr: number | null; n: number }>;
  heights: Record<string, number | null>;
  failures: Record<string, number>;   // share of captured frames where each check failed
  startedBy: "score" | "still";
  silhouette?: string;
  landmarks?: any[];
}

let landmarkerPromise: Promise<{ lm: PoseLandmarker; delegate: string }> | null = null;

// Starts downloading MediaPipe early (called when the popup opens).
export function preloadLandmarker(variant = "full") {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      const make = (delegate: "GPU" | "CPU") => PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: modelUrl(variant), delegate },
        runningMode: "VIDEO", numPoses: 1, outputSegmentationMasks: true,
      });
      try { return { lm: await make("GPU"), delegate: "GPU" }; }
      catch (e) { console.warn("GPU unavailable, using CPU", e); return { lm: await make("CPU"), delegate: "CPU" }; }
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

export class Scanner {
  video: HTMLVideoElement;
  stream: MediaStream | null = null;
  canvas: HTMLCanvasElement | null = null;
  delegate = "";
  private running = false;
  private lastTime = -1;
  private maskCanvas: HTMLCanvasElement | null = null;

  constructor() {
    this.video = document.createElement("video");
    this.video.playsInline = true;
    this.video.muted = true;
  }

  zoom: number | null = null;

  // Picks the widest view available: an ultra-wide (0.5x) camera if the browser exposes one,
  // the full uncropped sensor, and the minimum zoom the camera allows.
  async startCamera(deviceId?: string): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't use the camera on this page.");
    this.stream?.getTracks().forEach((t) => t.stop());
    const video = deviceId ? { deviceId: { exact: deviceId }, ...WIDE } : { facingMode: "user", ...WIDE };
    this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    if (!deviceId) {
      const ultra = (await this.cameras()).find((c) => ULTRA_WIDE.test(c.label));
      if (ultra && ultra.deviceId !== this.deviceId) return this.startCamera(ultra.deviceId);
    }
    await this.zoomOut();
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  async cameras() {
    return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
  }

  get deviceId() { return this.stream?.getVideoTracks()[0]?.getSettings().deviceId; }
  get cameraLabel() { return this.stream?.getVideoTracks()[0]?.label ?? ""; }

  async nextCamera() {
    const cams = await this.cameras();
    if (cams.length < 2) return this.cameraLabel;
    const i = cams.findIndex((c) => c.deviceId === this.deviceId);
    await this.startCamera(cams[(i + 1) % cams.length].deviceId);
    return this.cameraLabel;
  }

  private async zoomOut() {
    const track = this.stream?.getVideoTracks()[0];
    const caps = (track?.getCapabilities?.() ?? {}) as { zoom?: { min: number } };
    this.zoom = null;
    if (track && caps.zoom && typeof caps.zoom.min === "number") {
      try {
        await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min } as MediaTrackConstraintSet] });
        this.zoom = caps.zoom.min;
      } catch { /* zoom not adjustable on this camera */ }
    }
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }

  // Measures every frame in the background; the moment the pose is "ready" (5 checks, or
  // 5 s still) it finishes with the frames already measured. Never waits for a second phase.
  async capture(pose: Pose, heightCm: number, frontHeights: Record<string, number | null> | null, canvas: HTMLCanvasElement, onUpdate: (u: ScanUpdate) => void): Promise<PoseCapture> {
    const { lm, delegate } = await preloadLandmarker();
    this.delegate = delegate;
    this.canvas = canvas;
    canvas.width = this.video.videoWidth || 1280;
    canvas.height = this.video.videoHeight || 720;
    const ctx = canvas.getContext("2d")!;
    const buffer: { r: any; failed: string[] }[] = [];
    const startedAt = performance.now();
    let readySince: number | null = null;
    let stillSince: number | null = null;
    let snap: { silhouette?: string; landmarks?: any[] } = {};
    const recent: number[][] = [];
    const history: Record<string, boolean[]> = {};
    this.running = true;

    this.ring.reset();
    const finish = (why: "score" | "still"): PoseCapture => {
      this.running = false;
      const frames = buffer.map((b) => b.r);
      const summary = M.summarise(frames.map((f) => f.values)) as PoseCapture["summary"];
      const heights: Record<string, number | null> = {};
      for (const k of Object.keys(frames[0]?.heights || {})) heights[k] = M.median(frames.map((f) => f.heights[k]));
      return { frames, summary, heights, failures: failureRates(buffer.map((b) => b.failed)), startedBy: why, ...snap };
    };

    return new Promise((resolve) => {
      const tick = () => {
        if (!this.running) return;
        const v = this.video;
        if (v.readyState >= 2 && v.currentTime !== this.lastTime) {
          this.lastTime = v.currentTime;
          if (v.videoWidth && (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight)) {
            canvas.width = v.videoWidth; // camera switched
            canvas.height = v.videoHeight;
          }
          let res: any = null;
          try { res = lm.detectForVideo(v, performance.now()); } catch (e) { console.error(e); }
          if (res) {
            const lms = res.landmarks?.[0] || null;
            const m = res.segmentationMasks?.[0];
            const mask = m ? M.binarise(m.getAsFloat32Array(), m.width, m.height) : null;
            res.close?.();
            const now = performance.now();
            if (!lms || !mask) {
              stillSince = null;
              readySince = null;
              recent.length = 0;
              for (const k of Object.keys(history)) delete history[k];
              this.draw(ctx, v, null, null, pose, [], false);
              onUpdate({ phase: "setup", status: "Step into view", checks: [], progress: 0, personInView: false, score: 0, stillFor: 0 });
            } else {
              const ext = M.bodyExtent(mask);
              const chk = M.checkPose(pose, lms, mask.width, mask.height, ext);
              const p = M.toPx(lms, mask.width, mask.height);
              recent.push([p[11].x, p[11].y, p[12].x, p[12].y, p[23].x, p[23].y, p[24].x, p[24].y]);
              if (recent.length > STILL_FRAMES) recent.shift();
              const still = recent.length === STILL_FRAMES && isStill(recent, mask.height);
              stillSince = still ? stillSince ?? now : null;
              const stillFor = stillSince == null ? 0 : now - stillSince;
              const raw: Check[] = [...chk.checks, { id: "still", label: "Holding still", pass: still, hint: "Hold still" }];
              // Steady verdicts: a check passes if it held in most recent frames (MediaPipe
              // flickers on borderline poses, which would reset the score and the timer).
              const checks: Check[] = raw.map((c) => {
                const h = (history[c.id] ??= []);
                h.push(c.pass);
                if (h.length > SMOOTH_FRAMES) h.shift();
                return { ...c, pass: h.filter(Boolean).length / h.length >= SMOOTH_PASS };
              });

              // measure this frame in the background (raw verdicts decide how much it counts)
              const r = pose === "front" ? M.measureFront(mask, lms, heightCm) : M.measureSide(mask, lms, heightCm, frontHeights);
              if (r.ok) {
                buffer.push({ r, failed: raw.filter((c) => !c.pass).map((c) => c.id) });
                if (buffer.length > BUFFER) buffer.shift();
              }

              const grace = pose === "side" && now - startedAt < SIDE_GRACE_MS;
              const scored = readyToCapture(pose, checks, stillFor);
              const go = grace ? { ...scored, ready: false, why: null } : scored;
              readySince = go.ready ? readySince ?? now : null;
              this.draw(ctx, v, mask, lms, pose, checks, go.ready);
              // Hint for the most valuable check still missing.
              const missing = checks.filter((c) => !c.pass).sort((a, b) => (CHECK_POINTS[pose][b.id] ?? 0) - (CHECK_POINTS[pose][a.id] ?? 0))[0];
              const status = go.ready ? "Got it" : grace ? "Turn to your side" : missing ? missing.hint : "Hold it there";
              onUpdate({ phase: go.ready ? "capture" : "setup", status, checks, progress: Math.min(1, go.score / THRESHOLD), personInView: true, score: go.score, stillFor });

              const enough = buffer.length >= MIN_FRAMES;
              const stalled = readySince != null && now - readySince > STALL_MS;
              if (go.ready && (enough || stalled)) {
                snap = { silhouette: silhouetteImage(mask), landmarks: bodyLandmarks(lms) };
                resolve(finish(go.why ?? "score"));
                return;
              }
            }
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // Face ID-style view: dark background, the person cut out from the camera image, and a
  // ring of ticks around them. Each check owns an arc sized by its points; it fills green
  // when the check passes. The whole ring turns green when the pose is captured.
  ring = new Ring();
  private personCanvas: HTMLCanvasElement | null = null;

  private draw(ctx: CanvasRenderingContext2D, source: HTMLVideoElement, mask: any, lms: any[] | null, pose: Pose, checks: Check[], done: boolean) {
    const c = ctx.canvas;
    ctx.fillStyle = "#0b0b0c";
    ctx.fillRect(0, 0, c.width, c.height);
    let box: { cx: number; cy: number; h: number } | null = null;
    if (mask) {
      if (!this.maskCanvas || this.maskCanvas.width !== mask.width || this.maskCanvas.height !== mask.height) {
        this.maskCanvas = document.createElement("canvas");
        this.maskCanvas.width = mask.width;
        this.maskCanvas.height = mask.height;
      }
      const mctx = this.maskCanvas.getContext("2d")!;
      const img = mctx.createImageData(mask.width, mask.height);
      const px = new Uint32Array(img.data.buffer);
      for (let i = 0; i < mask.data.length; i++) px[i] = mask.data[i] ? 0xff000000 : 0;
      mctx.putImageData(img, 0, 0);

      if (!this.personCanvas || this.personCanvas.width !== c.width || this.personCanvas.height !== c.height) {
        this.personCanvas = document.createElement("canvas");
        this.personCanvas.width = c.width;
        this.personCanvas.height = c.height;
      }
      const pctx = this.personCanvas.getContext("2d")!;
      pctx.globalCompositeOperation = "source-over";
      pctx.clearRect(0, 0, c.width, c.height);
      pctx.drawImage(source, 0, 0, c.width, c.height);
      pctx.globalCompositeOperation = "destination-in";
      pctx.filter = "blur(1.5px)"; // soft cutout edge
      pctx.drawImage(this.maskCanvas, 0, 0, c.width, c.height);
      pctx.filter = "none";
      pctx.globalCompositeOperation = "source-over";
      ctx.save();
      if (done) { ctx.shadowColor = "rgba(48, 209, 88, 0.85)"; ctx.shadowBlur = c.height / 30; }
      ctx.drawImage(this.personCanvas, 0, 0);
      ctx.restore();

      const ext = M.bodyExtent(mask);
      if (ext && lms) {
        const sy = c.height / mask.height;
        const cx = ((lms[11].x + lms[12].x + lms[23].x + lms[24].x) / 4) * c.width;
        box = { cx, cy: ((ext.top + ext.bottom) / 2) * sy, h: (ext.bottom - ext.top) * sy };
      }
    }
    this.ring.draw(ctx, box, CHECK_POINTS[pose], checks, done);
  }
}

class Ring {
  private cx = 0; private cy = 0; private r = 0;
  private fill: Record<string, number> = {};
  private glow = 0;

  reset() { this.fill = {}; this.glow = 0; this.r = 0; }

  draw(ctx: CanvasRenderingContext2D, box: { cx: number; cy: number; h: number } | null, points: Record<string, number>, checks: Check[], done: boolean) {
    const c = ctx.canvas;
    const target = box
      ? { cx: box.cx, cy: box.cy, r: Math.min(box.h * 0.56, c.height * 0.48) }
      : { cx: c.width / 2, cy: c.height / 2, r: c.height * 0.42 };
    const k = this.r ? 0.25 : 1; // smooth movement, jump on first frame
    this.cx += (target.cx - this.cx) * k;
    this.cy += (target.cy - this.cy) * k;
    this.r += (target.r - this.r) * k;
    this.glow += ((done ? 1 : 0) - this.glow) * 0.2;

    // segments clockwise from the top, most important first
    const order = Object.entries(points).sort((a, b) => b[1] - a[1]);
    const passed = new Set(checks.filter((x) => x.pass).map((x) => x.id));
    const TICKS = 120;
    const len = this.r * 0.075, width = Math.max(2, this.r / 90);
    let start = 0;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = width;
    for (const [id, pts] of order) {
      const n = Math.max(1, Math.round((pts / 100) * TICKS));
      const want = done || passed.has(id) ? 1 : 0;
      this.fill[id] = (this.fill[id] ?? 0) + (want - (this.fill[id] ?? 0)) * 0.22;
      const lit = Math.round(this.fill[id] * n);
      for (let i = 0; i < n; i++) {
        const t = ((start + i) / TICKS) * 2 * Math.PI - Math.PI / 2;
        const on = i < lit;
        ctx.strokeStyle = on ? "#30d158" : "rgba(255, 255, 255, 0.22)";
        const r0 = this.r + (on ? len * 0.15 * this.glow : 0);
        ctx.beginPath();
        ctx.moveTo(this.cx + Math.cos(t) * r0, this.cy + Math.sin(t) * r0);
        ctx.lineTo(this.cx + Math.cos(t) * (r0 + len), this.cy + Math.sin(t) * (r0 + len));
        ctx.stroke();
      }
      start += n;
    }
    ctx.restore();
  }
}

function isStill(recent: number[][], height: number) {
  for (let i = 0; i < recent[0].length; i++) {
    const vals = recent.map((r) => r[i]);
    if ((Math.max(...vals) - Math.min(...vals)) / height > STILL_TOL) return false;
  }
  return true;
}

// Small outline image (no face detail) for later offline tuning.
function silhouetteImage(mask: any): string {
  const c = document.createElement("canvas");
  c.width = mask.width; c.height = mask.height;
  const g = c.getContext("2d")!;
  const img = g.createImageData(mask.width, mask.height);
  const px = new Uint32Array(img.data.buffer);
  for (let i = 0; i < mask.data.length; i++) px[i] = mask.data[i] ? 0xffffffff : 0xff000000;
  g.putImageData(img, 0, 0);
  const h = 320, w = Math.round((mask.width / mask.height) * h);
  const small = document.createElement("canvas");
  small.width = w; small.height = h;
  small.getContext("2d")!.drawImage(c, 0, 0, w, h);
  return small.toDataURL("image/png");
}

// Body landmarks only (11 to 32): face points are dropped here.
function bodyLandmarks(lms: any[]) {
  const r = (v: number) => Math.round(v * 10000) / 10000;
  return lms.slice(11).map((l, i) => ({ i: i + 11, x: r(l.x), y: r(l.y), z: r(l.z), v: r(l.visibility ?? 0) }));
}

// Camera readings for the twin, from the two captured poses.
export function readingsFrom(front: PoseCapture | null, side: PoseCapture | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const cap of [front, side]) {
    if (!cap) continue;
    for (const [k, v] of Object.entries(cap.summary)) if (v.median != null) out[k] = v.median;
  }
  if (front?.heights) {
    if (front.heights.neck != null) out.neck_height = front.heights.neck;
    if (front.heights.armpit != null) out.armpit_height = front.heights.armpit;
    if (front.heights.crotch != null) out.crotch_height = front.heights.crotch;
  }
  return out;
}
