# Seam

Size recommendations for online clothing stores. If a shopper doesn't know their size, they enter their height and weight, do a quick camera scan in the browser and get a size, plus a note on how it'll fit at the chest, shoulders, length and sleeves.

<p align="center">
  <img src="docs/images/body-type.png" width="30%" alt="Body-type pick drawn at the shopper's height and weight">
  <img src="docs/images/result.png" width="30%" alt="Recommended size with fit notes">
  <img src="docs/images/measurements.png" width="30%" alt="Estimated body measurements with error bands">
</p>

Most size finders only ask for height and weight. I wanted to see how much a phone or laptop camera could add on top of that, without the video ever leaving the device.

**Status:** working MVP for men's tees and long sleeves. It hasn't been tested on real people yet: the camera offsets and the drape allowance are placeholders until I calibrate them against tape measurements.

## How it works

1. **Height and weight** give a starting estimate for 23 body measurements. It's a multivariate Gaussian fitted on ANSUR II (4,000+ US Army men), so every measurement comes with an uncertainty.
2. **Front and side scan.** MediaPipe Pose and its segmentation mask run in the browser and measure widths and depths, scaled by the typed height. Each reading goes through a Kalman update, so one measurement tightens all 23 variables, not just the one it measured.
3. **Body-type pick.** The shopper chooses which of four shapes, drawn at their own height and weight, looks most like them. That counts as a weak extra measurement.
4. **Size engine.** Compares the body against the brand's own size chart using Monte Carlo over sampled bodies. Chest and shoulders decide the size; length and sleeves break ties.

If the scan is poor, it falls back to the height-and-weight answer, so a bad scan can't make the result worse.

## Numbers that shaped the design

Before writing the scan I ran regressions on ANSUR II (`model/build_prior.py`):

- Height and weight alone predict chest girth to about 3.1 cm, or 3.8 cm when people type their own slightly wrong numbers. One tee size is about 10 cm of chest, so the camera has to clearly beat that to be worth it.
- Chest width plus depth gets to 2.1 cm, against 2.8 cm for width alone. That's why there's a side pose.
- Lengths are easy (upper arm 1.1 cm), girths are hard (waist 5.1 cm).

The bar before launch: at least 85% of people get their preferred size, nobody is off by two sizes, tested leave-one-out on 30 men.

## Running it

```sh
cd web
npm install
npm run dev      # http://127.0.0.1:5173, add ?debug=1 to see the numbers
npm test         # 31 unit tests, including the body model against a NumPy reference
npm run smoke    # headless walkthrough with a fake camera (needs the dev server)
```

Stack: Svelte 5, TypeScript, Vite and MediaPipe Tasks Vision in the browser; Python, NumPy, pandas and scikit-learn for the model.

## What's where

- `web/`: the Find Your Size popup on a demo product page
- `scan/`: an earlier lab page for checking scans against a tape measure
- `model/`: body model, size chart fetcher and the calibration script
- `docs/`: architecture notes, a decision log and research notes with sources
- `LICENCES.md`: licence for every model, library and dataset used

## Next

- Calibrate on real testers, then the 30-person validation study
- Shopify app so it runs on real product pages
- Trousers (the scan already captures legs), then women's tops

The demo garment data comes from Uniqlo's public size charts. Seam isn't affiliated with Uniqlo.
