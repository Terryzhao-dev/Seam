# Licences

Seam is a commercial product, so every model, library and dataset must allow commercial use. **Add a row before using anything new.** Status "to check" = re-read the licence (code **and** model files, which often differ) before first use.

## Used in version 2

| Component | Used for | Licence | Commercial OK? | Status | Source |
|---|---|---|---|---|---|
| MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) + Pose Landmarker models | Points + body outline in the browser | Apache 2.0 | Yes | To check: model card terms. Note: sends usage pings to Google every 60 s (disclose in privacy notice) | https://registry.npmjs.org/@mediapipe/tasks-vision |
| ANSUR II | Height/weight prior, body-type silhouettes, chest formula | "Cleared for unlimited public release"; no formal licence text | Probably **[unverified]** | To check before shipping | http://tools.openlab.psu.edu/publicData/ANSURII-MFR.pdf |
| scikit-learn, pandas | Model building | BSD | Yes | To check | |
| Shopify CLI app template | Merchant app | MIT **[unverified]** | Yes | To check | |
| Supabase, Fly.io / Render, Cloudflare R2 | Data, hosting, CDN | Commercial terms | Yes | n/a | |
| Svelte 5, Vite 8, Vitest | Popup UI, build, tests | MIT | Yes | To check | https://github.com/sveltejs/svelte |
| Figtree (`@fontsource-variable/figtree`) | Font (replaces Inter) | SIL Open Font Licence 1.1 | Yes | To check | https://github.com/erikdkennedy/figtree |
| Aritzia "Non-Seasonal Geo" | Not used: custom licensed typeface | Proprietary | No | Banned | |
| puppeteer-core | Smoke tests only (not shipped) | Apache 2.0 | Yes | To check | https://github.com/puppeteer/puppeteer |
| Uniqlo size charts | Demo garment data (published measurements) | Uniqlo website terms | Demo only; brands supply their own data in pilots | To check before any public use | https://www.uniqlo.com/us/en/products/E455365-000/00 |

## Maybe later

| Component | Licence | Rule |
|---|---|---|
| NHANES body measures | Public use, "statistical reporting and analysis only" | Confirm commercial model use is allowed before training on it |
| CAESAR | SAE, commercial use priced on request | Only if civilian shape data is needed and budget allows |
| SizeUSA | Price on request | Same |

## Benchmark only (never in shipped models)

| Component | Licence | Rule |
|---|---|---|
| Amazon BodyM | CC BY-NC | Evaluate against it; never train shipped models on it |

## Not used now (version 1 design, kept as an upgrade path)

| Component | Licence | Note |
|---|---|---|
| Meta MHR | Apache 2.0 (code) | Cloud 3D body model, only if two poses miss the target |
| SAM 3D Body | SAM Licence (commercial OK; bans military and ITAR uses) | Same |
| Naver Anny | Apache 2.0 code, CC0 assets; SMPL-X topology option non-commercial | Same |
| SAM 2.1, ViTPose, PyTorch3D, trimesh | Apache 2.0 / Apache 2.0 / BSD / MIT | Same |

## Banned

| Component | Licence | Why |
|---|---|---|
| SMPL, SMPL-X | Non-commercial (commercial licence via Max Planck Innovation) | Not licensed for Seam |
| SMPL-Anthropometry | Depends on SMPL | Read for ideas only |
| Sapiens | Non-commercial | |
| OpenPose | Non-commercial academic | Use MediaPipe instead |
| nvdiffrast | NVIDIA non-commercial source licence | |
