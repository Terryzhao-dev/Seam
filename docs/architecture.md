# Architecture (version 2)

Status: design only, 19 October 2026. Replaces the version 1 design (iPhone app + cloud 3D body model); the reasons are in `decisions.md` section 3. Thresholds, weights and ease targets below are **starting values**, tuned on the validation testers. Licences in `../LICENCES.md`.

## 1. Overview

```
Shopper's browser (shop's own domain)                   Seam server                 Supabase
-------------------------------------                   -----------                 --------
theme app embed: "I don't know my size" button
inline popup
  height, weight, fit style, age range
  MediaPipe Pose Landmarker (Web Worker, from Seam CDN)
  pose checks -> auto-capture front + side
  outline + point measurements (cm)
  quality score
  body-type pick
                     -- numbers only -->         /recommend
                                                   prior (ANSUR II model)
                                                   camera estimate (calibrated)
                                                   combine by reliability
                                                   size engine vs garment data  <-- size_specs
                     <-- size + notes --                                         --> sessions
result: "M. Chest relaxed, length right"
optional save (email code)                                                       --> profiles
```

## 2. Embedding in Shopify

| Piece | Approach | Why |
|---|---|---|
| Button | Theme app embed (works on every theme) adds the button next to the size selector; optional app block lets the merchant place it | Shopify requires theme changes to go through theme app extensions |
| Popup | Rendered inline on the shop's own domain by a small loader script (< 10 KB) | Camera permission then belongs to the shop's domain; cross-origin iframes are unreliable for the camera on Safari |
| Heavy files | MediaPipe WASM (13.5 MB) + model (full 9.4 MB, lite 5.8 MB) + scan bundle from Seam's CDN | Exceed the 10 MB theme extension limit |
| Preload | Start downloading when the popup opens, while the shopper types height and weight | Hides most of the download time |
| Unsupported in v1 | Headless storefronts that send `Permissions-Policy: camera=()` (e.g. gymshark.com) | Camera blocked by the store itself |

## 3. Capture

### 3.1 Setup checks (before capture)

| Check | Rule |
|---|---|
| Whole body in frame | Head top (outline) and both heels visible, with ≥ 3% of body height margin top and bottom |
| Distance | Body fills 60 to 90% of frame height |
| One person | One pose detected |
| Light | Landmark visibility of key points ≥ 0.8 |

### 3.2 Pose checks (every frame)

| Pose | Check | Rule |
|---|---|---|
| Front | Facing camera | Shoulder width (points 11 to 12) ≥ 80% of its maximum seen in setup |
| Front | Arm angle | Angle between upper arm (11→13, 12→14) and torso line 30 to 45° on both sides |
| Front | Straight arms | Elbow angle (shoulder, elbow, wrist) ≥ 160° |
| Front | Feet | Ankle gap (27 to 28) about hip width (0.8 to 1.3 × hip gap 23 to 24) |
| Both | Upright | Line from mid-hip to mid-shoulder within 5° of vertical |
| Side | Turned 90° | Shoulder width ≤ 30% of front shoulder width |
| Side | Arms down | Wrists below hips and within the torso's front to back outline |
| Both | Still | Each measurement varies < 1% across 0.5 s |

When all checks pass, capture about 30 frames (3 s) per pose. Each measurement = median across frames. Voice prompts name the failing check ("arms a bit wider", "turn a little more").

### 3.3 Scale

Pixel height = top of the outline to the floor line (average of heel points 29 and 30, plus a small offset learned on testers). cm per pixel = typed height ÷ pixel height. The side pose gets its own scale the same way; front and side scales must agree within 2% or the quality score drops.

MediaPipe's "world landmarks" are **not** used for size: the model card says they are not metric for an individual.

## 4. Measurements

| Measurement | Pose | Source | Method | Used for |
|---|---|---|---|---|
| Outer shoulder width (bideltoid) | Front | Outline | Widest row of the torso region between shoulder point height and the armpit row | Tees (strong chest predictor, r = 0.89) |
| Chest width | Front | Outline | Torso width at the armpit row: first row below the shoulders where the outline splits into arm, torso, arm | Tees |
| Waist width | Front | Outline | Narrowest torso row between the chest row and hip point height | Tees (slim fit), trousers |
| Hip width | Front | Outline | Widest row near hip point height | Trousers |
| Neck base (HPS proxy) | Front | Outline | Row where outline width jumps from neck width to shoulder slope | Tee length |
| Crotch point | Front | Outline | Top of the gap between the legs | Torso length, inseam |
| Torso length | Front | Outline | Neck base row to crotch row | Tee length |
| Upper arm | Front | Points | Shoulder to elbow (11→13, 12→14), mean of both sides | Sleeve fit |
| Arm length | Front | Points | Shoulder to elbow to wrist | Long sleeves later |
| Leg length | Front | Points + outline | Hip point to ankle; crotch to floor (inseam) | Trousers |
| Chest depth | Side | Outline | Front to back width at the chest row's height (height carried over from the front pose in cm) | Tees |
| Waist depth | Side | Outline | Same, at the waist row's height | Tees, trousers |
| Hip depth | Side | Outline | Widest row near hip height | Trousers |

All captured on every scan (full body); v1 sizing uses the tee rows. Face points (0 to 10) are used only for pose checks and never leave the device.

### 4.1 Quality score q (0 to 1)

| Component | Signal |
|---|---|
| Framing | Margins above the head and below the feet |
| Tilt | Upper body to lower body length ratio vs the ANSUR expected ratio at that height; where the person sits vertically in the frame |
| Confidence | Mean landmark visibility |
| Steadiness | Spread of each measurement across the 30 frames |
| Agreement | Front vs side scale |

## 5. Estimation model

### 5.1 Prior (height, weight, age)

Linear regressions trained on ANSUR II men (n = 4,082) using **self-reported** height and weight, so the model learns the typical over-reporting. Targets: chest girth, waist girth, outer shoulder width, chest and waist width and depth, torso length, upper arm. Each gives a mean μp and an error σp (cross-validated). Expected chest σp ≈ 3.8 cm **[own calc]**.

### 5.2 Body-type pick

At the shopper's height and weight (ANSUR men within ±3 cm and ±4 kg), cluster the residual shape (chest, waist and shoulder measurements after removing what height and weight explain) into 4 groups. Draw each group's average front outline. The pick shifts μp by a fraction of that group's offset (start 0.25, tuned on testers). Low weight because only 63.5% of adults judge their own weight status correctly.

### 5.3 Camera estimate

- Chest girth: ellipse perimeter from chest width and depth (Ramanujan), then a linear correction: girth = a × ellipse + b × outer shoulder width + c × height + d. First fitted on ANSUR caliper data (chest error 2.1 cm with true width and depth), then re-fitted on testers' camera values against tape (tee on).
- Every other measurement: linear correction from camera value to tape value, fitted on testers.
- Camera error σc = σcal ÷ q, where σcal is the leave-one-out error on testers (capped so a poor scan contributes almost nothing).

### 5.4 Combining

For each measurement:

```
estimate = (μp / σp² + μc / σc²) / (1 / σp² + 1 / σc²)
error    = 1 / √(1 / σp² + 1 / σc²)
```

A low-quality scan has a large σc, so the estimate falls back to the prior. With no scan, the estimate is the prior.

The coefficients are small, so the model is exported from Python as JSON and evaluated in TypeScript on the server. Keeping it server-side protects the model and allows updates without touching the storefront code.

## 6. Size engine

### 6.1 Garment data

Per product and size: `chest_width` (flat), `body_length_hps`, `shoulder_width`, `sleeve_length_shoulder`, plus `tolerance_cm` (±1 cm default for knits). Demo: tees from brands that publish garment measurements (e.g. Uniqlo, Taylor Stitch) loaded into the development store. Later: auto-import from merchants' size charts, tech pack or CSV upload. Normalise inches to cm; convert centre-back sleeve to sleeve from shoulder seam (minus half the shoulder width).

### 6.2 Ease targets

Ease = garment minus body, in cm of circumference for girths (flat widths doubled).

| Zone | Body | Garment | Ease formula | Target slim / regular / relaxed | Band (±) | Weight |
|---|---|---|---|---|---|---|
| Chest | chest girth | chest width | 2W − B | 5 / 10 / 16 cm | 2 cm | 3 |
| Shoulders | outer shoulder width | shoulder width | G − B | −2 / 0 / +3 cm **[est]** | 1.5 cm | 2 |
| Length | torso length | body length from HPS | G − B | +2 / +3 / +4 cm | 1.5 cm | 1.5 |
| Sleeve | upper arm | sleeve from shoulder seam | (sleeve + (G_sh − B_sh) / 2) ÷ B | 0.40 / 0.50 / 0.55 | 0.08 | 1 |
| Waist | waist girth | mid-body width | 2W − B | 4 / 10 / 16 cm | 3 cm | 1 (slim only) |

Shoulder targets changed from version 1 because the body measure is now outer (bideltoid) shoulder width, which is wider than the bony shoulder width.

### 6.3 Choosing the size

1. For each size and zone, d = ease − target, with error s = √(body error² + garment tolerance²).
2. P(zone fits) = probability that |d| ≤ band, given s.
3. Drop sizes where P(chest too tight beyond 2 × band) > 20%.
4. Size score = weighted geometric mean of P(zone fits). Highest wins.
5. If the runner-up scores within 15%: "Between M and L: M for a slimmer fit, L for a looser fit."
6. Confidence shown as high / medium / low from the winner's score and the scan quality.

### 6.4 Fit notes

| Size of d (either direction) | Wording |
|---|---|
| ≤ band | "right" |
| ≤ 2 × band | "slightly snug" / "slightly relaxed" |
| > 2 × band | "tight" / "loose" ("short" / "long" for length and sleeves) |

cm shown only when |d| is larger than its error, rounded to whole cm. Zones ordered by weight. Fixed templates, no LLM.

## 7. Stack

| Layer | Choice |
|---|---|
| Shopify app | Shopify CLI app template (React + Node) for the merchant admin and `/recommend` |
| Storefront | Theme app embed + optional app block; loader script; popup UI in plain TypeScript |
| Scan | `@mediapipe/tasks-vision` Pose Landmarker (full; lite on slow devices) in a Web Worker, segmentation masks on |
| Model building | Python (uv): pandas, scikit-learn, ANSUR II CSVs; exports JSON coefficients |
| Data | Supabase (Postgres, numbers only; email-code login for saved profiles) |
| Hosting | App on Fly.io or Render; scan files on a CDN (Cloudflare R2). Choose at build |

## 8. Data model (Supabase)

| Table | Key columns |
|---|---|
| `shops` | shop_domain, installed_at, plan |
| `products` | shop_domain, product_id, title, fit_label, fabric |
| `size_specs` | product_id, size, pom, value_cm, method (flat / circumference / centre-back), source (scrape / tech pack / CSV / hand), tolerance_cm |
| `sessions` | id, shop_domain, created_at, device (laptop / phone), inputs (height, weight, age range, fit style, body type), camera measurements, quality, estimates (value + error), recommended size, between_sizes |
| `profiles` | email, estimates, updated_at (only if the shopper chooses to save) |
| `events` | session_id, type (popup opened, scan done, size shown, add to cart, order, return), created_at |

## 9. Privacy rules

1. Video never leaves the device. Frames are processed in the Web Worker's memory and dropped.
2. Face points (0 to 10) are used for pose checks only and never sent.
3. The server stores numbers only.
4. MediaPipe sends usage pings to Google every 60 s (no images, no opt-out): disclose in the privacy notice.
5. Validation testers' recordings are kept only with signed consent, locally, gitignored.
6. No health outputs (BMI, body fat), which could fall under Washington's My Health My Data Act.
7. Shopify's required privacy webhooks (customer data request, customer redact, shop redact).
8. Privacy policy live before any merchant installs the app.

## 10. Planned code layout

Created when the build starts, not before.

```
~/projects/Seam/
  README.md  LICENCES.md  docs/
  model/          Python (uv): ansur/ (download, prior), silhouettes/, calibrate/, export/ (JSON), eval/ (leave-one-out, hit rate)
  scan/           TypeScript: worker (MediaPipe), checks, measure (outline + points), quality, capture UI
  shopify-app/    Shopify CLI app: admin, /recommend, extensions/theme-embed (loader + popup)
  validation/     protocol.md, consent.md, results/
  data/           gitignored: ANSUR CSVs, consented recordings, tape.csv
```

## 11. Upgrade paths (only if the 8 November gate fails or after the demo)

| Upgrade | When |
|---|---|
| Third pose at 45° | Chest or waist misses the gate |
| MediaPipe heavy model on laptops | Laptop outlines too rough |
| Cloud 3D body model (version 1 design: SAM 3D Body + MHR) | Two poses can't reach the target |
| Favourite-tee matching | After the demo, as an optional step for regular customers |
