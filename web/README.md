# Seam web: "Find Your Size" popup MVP

Men's tees and long sleeves. A demo product page with a **Find Your Size** link that opens a one-question-per-screen popup: height, weight, fit, tee length, front + side camera scan, torso pick, arms pick, size with fit notes, save (simulated account).

## Run it

```
cd ~/projects/Seam/web
npm run dev
```

Open **http://127.0.0.1:5173**. Add `?debug=1` to see the numbers, tape check and calibration panel.

**On your iPhone (real 0.5x lens):** run `npm run dev:phone` instead, then open the "Network" address it prints (e.g. `https://10.61.139.8:5173/?debug=1`) in Safari on the same Wi-Fi. The certificate is self-signed: tap Show Details, then visit this website. The scan picks the ultra-wide camera when Safari offers it; that is the back camera, so prop the phone screen-to-wall and follow the voice. The camera button switches back to the front camera.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run dev:phone` | Same over https on your Wi-Fi, so a phone can use its camera |
| `npm test` | 31 unit tests (body model vs numpy reference, picks, size engine, capture rule, outlines, measurements) |
| `npm run check` | Type check (Svelte + TypeScript) |
| `npm run smoke` | Headless Chrome walks every screen on desktop and phone sizes, screenshots each, fails on any console error (needs the dev server) |
| `node test/person.mjs video.mjpeg` | Scan test with a real figure: feeds an MJPEG video to Chrome as the camera and checks both poses finish on their own |
| `npm run build` | Production build into `dist/` |

## Test it on yourself

| Step | What to do |
|---|---|
| 1 | Measure with a tape (twice each): height, chest, waist, shoulder bone to bone, upper-arm girth relaxed, centre back to wrist (arm straight), floor to back of neck |
| 2 | Open `http://127.0.0.1:5173/?debug=1`, Find Your Size, use your **measured** height |
| 3 | Laptop upright at waist height, you 2 to 3 m away, one T-shirt, barefoot. Better: prop your iPhone and tap the camera button on the scan screen until it says 'iPhone Camera'. Turn off Center Stage in Control Center |
| 4 | In the debug panel, type your tape values: errors show in green (within 2.5 cm) or red |
| 5 | **Drape calibration (most important):** put on any tee whose back length you know (e.g. measure one flat), measure floor to hem at the back and floor to back of neck. The panel shows the implied drape allowance. The model currently guesses 5 cm; put your number in `public/calibration.json` (`drapeK`) |
| 6 | Click **Download session JSON** and save it to `~/projects/Seam/data/sessions/` |
| 7 | Run `cd ~/projects/Seam/model && .venv/bin/python calibrate.py`: it fits the camera offsets and drape allowance from your tape values and writes `web/public/calibration.json` (reload the page to use it). `--dry-run` shows the numbers without writing |

## How the size is worked out

| Stage | File | What happens |
|---|---|---|
| Prior | `src/core/bodymodel.ts` | 23 body measurements as a Gaussian from typed height and weight (ANSUR II, 4,077 men, `public/body_model.json`) |
| Scan | `src/core/measure.js`, `src/widget/scanner.ts`, `src/core/capture.ts` | MediaPipe in the browser; widest camera available; every frame measured in the background; checks scored out of 100 by importance; a pose finishes at 80 (or 5 s still with 60+); failed checks widen the error of the readings they affect |
| Camera update | `bodymodel.ts` | Kalman update: each reading = body variable + clothing offset + noise, shared scale error from typed height. Updates all 23 variables |
| Picks | `src/core/picks.ts` | 4 torso options along the twin's two main directions of uncertainty; 3 arm options; each pick is a weak extra reading |
| Size | `src/core/sizing.ts` | Brand-intent targets from the brand's body chart; Monte Carlo over 4,000 bodies; chest and shoulders decide, length and sleeves break ties; absolute wearability floor |
| Notes | `sizing.ts` | Plain-language fit per zone |
| Data | `src/widget/session.ts` | Every session saved in the browser (`seam.sessions`), profile on save (`seam.profile`) |

## Honest limits

| Limit | Status |
|---|---|
| Camera offsets and noise are guesses | Calibrate from your tape check, then from testers |
| Drape allowance (tee length) is 5 cm **[est]** | Calibrate first: the "longer than you like" notes depend on it |
| Arm options use illustrative thickness | Real 1.5 to 2 cm differences are invisible at this size |
| Torso options exaggerate differences 2.2× for display | The pick itself uses the true values |
| Not yet tested on a real body | Smoke test uses Chrome's fake camera; your scan is the first real test |
| Accounts simulated | Email + code screens only; saved in the browser |
| Phone camera needs https | Use the laptop for now |

## Data

`public/garments/*.json` come from `../model/fetch_garments.py` (Uniqlo US size-chart API). `public/body_model.json` and `src/core/reference.json` come from `../model/build_body_model.py`.
