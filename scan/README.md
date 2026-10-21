# Seam Scan v0

A local web page that scans you with the laptop camera (or two phone photos), measures your body, recommends a tee size and compares everything with your tape measurements. Every session is saved so it can train Seam's own model later.

Nothing is uploaded. Sessions live in this browser's storage until you export them.

## Run it

```
cd ~/projects/Seam/scan
python3 -m http.server 8000
```

Open **http://localhost:8000** in Chrome. The camera only works on `localhost` or `https`, not by double-clicking `index.html`.

## Test it on yourself (first round)

| Step | What to do |
|---|---|
| 1 | **Measure yourself first**, each value twice, and use the average: barefoot height, weight, chest, waist, hips, outer shoulder width, torso length, upper arm, arm length, inseam. The how-to for each is on the page (section 4) |
| 2 | Type your **measured** barefoot height, not the one you usually say. Height sets the scale for every camera number |
| 3 | Laptop on a shelf or table at about waist height, screen upright, you 2 to 3 m away, plain wall behind, good light. One T-shirt, barefoot |
| 4 | Do **3 camera scans**, stepping out of view between them. The page compares each with your tape numbers automatically |
| 5 | Optional: have someone take a front and a side photo with your phone in the same poses, AirDrop them over, use "Or measure two photos instead" |
| 6 | Click **Export JSON** and **Export CSV** and save them to `~/projects/Seam/data/sessions/` |

## What to look at

| Where | What it tells you |
|---|---|
| Result, size + notes | The tee size for the chosen chart and fit style |
| Body estimates | Camera alone vs height/weight alone vs combined, with ± errors and how much the camera counted |
| Scan quality | Low steadiness = you moved; low proportions = camera probably tilted |
| Compare (section 4) | Error of each estimate vs your tape. Green = inside the target (chest ± 2.5 cm, waist ± 3, outer shoulder ± 1.5, lengths ± 2) |
| Repeatability | Same body scanned several times should vary ≤ 1.0 cm |
| Coloured lines while capturing | Where the scan thinks your neck base, armpit, chest, waist, hips and crotch are. If a line is clearly wrong, that measurement will be too |

## Honest limits of v0

| Limit | Why it matters |
|---|---|
| Camera numbers are **uncalibrated** | The rows used for chest, waist and shoulders are first guesses. Your tape data shows the bias, and the saved width profiles let us pick better rows |
| One person can only fix offsets | Your sessions can correct a constant bias. Correcting how errors scale with body size needs about 10 different people |
| Not yet tested on a real body | Unit tests use a synthetic silhouette, and the browser smoke test uses Chrome's fake camera. Your first scan is the first real test |
| Laptop camera tilt | If the proportions score is low, raise or level the laptop |
| Phone camera in the browser needs https | For now use photos from the phone. Live phone scanning comes with hosting |

## Files

| File | What it is |
|---|---|
| `index.html`, `style.css`, `app.js` | The page: camera, pose checks, capture, results, tape comparison, sessions, export |
| `measure.js` | Mask and landmark maths: armpit, chest, waist, hip, neck and crotch rows; widths, depths, lengths; pose checks; quality |
| `engine.js` | Height/weight prior, camera girths from width + depth, combining by reliability, size engine, fit notes |
| `models.json` | Built by `../model/build_prior.py` from ANSUR II (4,077 men) |
| `charts.json` | Tee size charts (garment measurements). Add your own on the page |
| `calibration.json` | Empty until there is tape data to fit corrections |
| `test/` | Unit tests (`npm test`) and a headless Chrome smoke test (`node test/smoke.mjs`) |

Node lives in `~/.local/node/bin` (already on the PATH in your terminal through `.zshrc`).
