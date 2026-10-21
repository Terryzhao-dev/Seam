# Decisions

Every decision and the reason for it. Append new decisions at the end with a date. Never delete old rows: strike them through and point to the decision that replaces them.

## 1. Product and business (14 to 16 October 2026)

| # | Area | Decision | Why | Rejected |
|---|---|---|---|---|
| 1 | Ambition | Venture-scale startup | Terry's goal for the next 6 months | Portfolio project; "prove the CV first, decide later" |
| 2 | Who pays | Brands and retailers (B2B). Shoppers use it free | 53% of online apparel returns cite size or fit; brands already pay for fit tools (True Fit USD 1,000 / month on Shopify, 3DLOOK USD 499 / month) | Shoppers paying (B2C) |
| 3 | Team | Solo until the demo, then look for a cofounder, ideally US work-authorised | A working demo attracts better people; a US work-authorised cofounder can run pilots while Terry is on F-1 | Looking now; staying solo |
| 4 | v1 category | Men's T-shirts only | Few points of measure; lengths (shoulder, arm, torso) are accurate even through a tee (Terry's point); one simple garment shape | Jeans (rise and inseam hard to scan), tailoring, all categories for one brand |
| 5 | Final surface | ~~Shopify app: widget on brand product pages, QR handoff to the iPhone app to scan~~ **Replaced by #27** | Matches the B2B model; brands supply real garment data | Chrome extension (desktop only; ABODY.AI has 162 users), Safari extension, app only |
| 6 | December demo | ~~iPhone scan app + cloud measurement + size and fit notes for a scraped tee catalogue, inside the app~~ **Replaced by #40** | Only 40 to 80 hours available before mid-December | Full flow including Shopify by December; pushing the demo to January |
| 7 | Output | Size + fit notes per zone ("Buy M. Chest relaxed, sleeves 2 cm short") | Uses the garment measurements fully; tells shoppers where it is tight or loose | Size only; 3D try-on (cloth simulation for every garment, far bigger build) |
| 8 | Scan device | ~~Camera first (every iPhone), LiDAR as a bonus on Pro models~~ **Replaced by #32** | Reaches every iPhone; no strong evidence LiDAR beats photo + ML for girths; LiDAR is rear camera only | LiDAR only; camera only |
| 9 | Scan flow | ~~Phone propped against a wall, user turns slowly in a circle for about 10 seconds~~ **Replaced by #30** | Studies show rotation-video apps beat two-photo apps; works solo | Two photos; a friend holding the phone |
| 10 | Scan outfit | One inner layer (a T-shirt is fine, no hoodie or jacket), fitted preferred, pre-scan checklist, loose clothing gets a lower accuracy label | Comfortable for everyone; lengths are robust to a tee | Underwear only; whatever they wear with no checklist |
| 11 | Processing | ~~Cloud. Phone blurs the head before upload; server deletes images after measuring; only numbers kept~~ **Replaced by #35** | Bigger models and easier to improve; blur and deletion address face-geometry laws (BIPA, CUBI) | On-phone processing; keeping images |
| 12 | Fit taste | ~~Fit style pick (slim / regular / relaxed / oversized) + optional favourite-tee calibration~~ **Changed by #43** | Same body, different taste. A favourite tee lets Seam compare garment to garment, so scan error mostly cancels | Style only; favourite tee only |
| 13 | Garment data | Demo: scrape published garment measurements. Shopify: auto-import from the brand's product pages, tech pack upload optional | Tech packs are confidential until a brand trusts you; few shops publish garment measurements, so pick those for the demo | Waiting for brands; tech pack upload only |
| 14 | Validation | ~~Head-to-head on 20 to 30 men: tape measure vs scan vs height/weight guess, then try-ons of real tees~~ **Replaced by #39** | Incumbents effectively guess from height and weight; the scan must beat that to justify itself | Tape measure only; tracking real purchases |
| 15 | Pricing | 60-day free pilot, then flat monthly by store size (about USD 49 to 299 for small brands) **[est]** | Prove fewer returns first. Benchmarks: Kiwi Sizing USD 0 to 27, Easysize USD 35 to 250 + usage, True Fit USD 1,000 | Per recommendation; share of savings (hard to measure) |
| 16 | First brands | Premium men's basics on Shopify (USD 40 to 100 tees) | Fit-obsessed buyers, higher prices, more likely to publish garment measurements **[est]** | Streetwear drop brands; big retailers (slow sales cycles) |
| 17 | F-1 | Short section in the README: likely fine now vs sort before the first pilot | Brand pilots probably count as work; see Pear research | Full Pear-style analysis now; skipping it |
| 18 | Programmes | Product and brands first; Berkeley programmes (Free Ventures, SkyDeck, LAUNCH) and YC after the demo | Applications are stronger with a demo and pilot data | Applying now |
| 19 | Constraints | 5 to 10 hours / week, USD 500 to 2,000, demo by about 13 December 2026 | Terry's answers | |
| 20 | Name | Seam (folder `~/projects/Seam`) | Short, clothing-native | Fitted, Drape, Tailor |

## 2. Technical, version 1 (16 October 2026)

| # | Area | Decision | Why | Rejected |
|---|---|---|---|---|
| 21 | Body model | ~~Meta MHR (Apache 2.0), started per frame from SAM 3D Body. Fallback: Naver Anny~~ **Replaced by #33; kept as an upgrade path** | Commercially licensed; SAM 3D Body works without training | SMPL / SMPL-X (non-commercial without a Max Planck licence) |
| 22 | Scale | ~~Self-reported barefoot height, cross-checked against ARKit floor, LiDAR and Vision 3D height~~ **Replaced by #33** | A single camera cannot tell size from distance | No anchor |
| 23 | De-risking | ~~Offline Python on recorded videos first; no Swift until the go/no-go on 8 November~~ **Replaced by #42** | The measurement accuracy is the whole business; test it cheaply first | Building the iOS app first |
| 24 | Training data | ANSUR II (public release, 4,082 men) for the height/weight prior and body types. BodyM for benchmarking only | BodyM is CC BY-NC | Training shipped models on BodyM |
| 25 | Hosting | ~~Modal for GPU inference, Supabase for auth and data, no image storage~~ **Replaced by #41** | Cheap, per-second billing, plain Python; Supabase already available to Terry | RunPod (more ops work), Replicate (less flexible) |
| 26 | Fit notes | Fixed templates, no LLM | Predictable wording, testable | LLM-written notes |

## 3. Version 2: Shopify popup + browser scan (19 October 2026)

Terry's redesign: frictionless onboarding inside the store, MediaPipe in the browser, height and weight plus a body-type pick, accuracy over hype.

| # | Area | Decision | Why | Rejected |
|---|---|---|---|---|
| 27 | Surface | Shopify app. "I don't know my size" opens an inline popup on the product page. No app download | Every download step loses shoppers; brands install once | iPhone app with QR handoff (#5) |
| 28 | Category | The scan captures the full body every time; v1 only recommends men's tees | Trousers can follow without rescanning anyone | Tees + trousers now (double the testing) |
| 29 | Inputs | Height, weight, fit style (slim / regular / relaxed), optional age range, scan, body-type pick | Height + weight already predict chest to ~3.1 cm; age improves waist from 4.4 to 4.1 cm **[own calc]** | Scan only |
| 30 | Scan poses | Front A-pose + side, 3 s each, auto-captured when pose checks pass | Width + depth cut chest error to 2.1 cm vs 2.8 cm for width alone (calipers, **[own calc]**). A slow turn needs a cloud 3D model to combine frames, and MediaPipe mixes up left and right when facing away | Slow turn (#9); front only; front, side + back |
| 31 | Arm position | Front: arms straight, 30 to 45° from the body, feet hip-width. Side: arms straight down, hands by the thighs, feet together | Arms down hide chest width; hands on the waist hide the waist and lift the shoulders; a T-pose lifts the shoulders and the tee. A-pose is the standard for body scanners | Hands on waist; arms down; T-pose |
| 32 | Device | Any device (laptop webcam or phone), no QR code. Each scan gets a quality score and counts less when poor | Frictionless (Terry's priority). Resolution is not the issue; laptop camera tilt is, and the quality weighting stops a bad scan making the answer worse | Phone with QR from laptop; phone only (#8) |
| 33 | Measurement | MediaPipe Pose Landmarker in the browser with the segmentation mask on. Scale from the typed height. Widths, neck base and crotch from the outline; arm lengths from the points | Runs on the device, free, Apache 2.0. Its 3D coordinates are not metric for an individual and it has no head-top, neck, crotch or waist points. Outer shoulder width (outline) predicts chest far better than bony shoulder width (r = 0.89 vs 0.52) | Cloud 3D body model (#21); MediaPipe world landmarks for size |
| 34 | Body types | 4 silhouettes generated at the shopper's own height and weight from ANSUR II clusters, differing in where weight sits. Small weight in the model | Every option is realistic for that person. People misjudge their own shape (63.5% judge weight status correctly), so the scan overrides it | 3 generic drawings; no picker |
| 35 | Processing | In the browser; only numbers go to the server; face points never leave the device | Removes most privacy risk and all GPU cost | Cloud with face blur (#11); uploading video |
| 36 | Estimation | ANSUR II prior (trained on self-reported height and weight) + calibrated camera estimate, combined by reliability; runs server-side | A bad scan falls back to the prior automatically; the model stays private and can be updated | Camera numbers used raw |
| 37 | Saving | Optional "Save my size for other stores" with an email code, after results | Browsers wall off each store's storage, so carrying a scan across stores needs an account; asking after results keeps the start frictionless | Account before scanning; this store only |
| 38 | Accuracy bar | ≥ 85% size hits (tester's preferred size; "between M and L" counts if he picks either), nobody off by 2 sizes, ≥ 15 points above height/weight alone | Terry's choice. Note: even perfect chest width + depth gives the right chest size ~84% of the time **[own calc, illustrative]**, so the between-sizes rule and fit style matter | 95%; "just beat height/weight" |
| 39 | Validation | 30 men across builds; tape + caliper; scans on laptop and phone; same tee from 3 brands in S to XL; leave-one-out scoring | Tests the claim honestly; shows whether laptops are good enough | 20 to 30 men, phone only (#14) |
| 40 | Demo | By 13 December: full popup on a free Shopify development store with 10 to 20 real tees, plus validation results | A web popup is lighter to build than the iPhone app + cloud setup | Standalone web page; pushing to January (#6) |
| 41 | Embedding and hosting | Theme app embed + inline popup on the shop's domain; MediaPipe files on Seam's CDN; app on Fly.io or Render; Supabase for numbers. Headless storefronts unsupported in v1 | Camera permission belongs to the shop's domain; MediaPipe files exceed the 10 MB extension limit; no GPU needed | Cross-origin iframe; Modal GPU (#25) |
| 42 | Gate | Sun 8 Nov, ≥ 10 testers, leave-one-out: chest ≤ 2.5 cm and ≥ 25% below height/weight alone; outer shoulder ≤ 1.5 cm; torso and arm ≤ 2.0 cm; repeat scans ≤ 1.0 cm apart | Accuracy is the business; check before building the Shopify side | Building the Shopify app first (#23) |
| 43 | Fit taste | Fit style pick in the popup. Favourite-tee matching moved to after the demo **[Claude's default, Terry to confirm]** | Keeps the popup under a minute | Favourite tee in v1 (#12) |

## 4. Build approach (19 October 2026)

| # | Area | Decision | Why | Rejected |
|---|---|---|---|---|
| 44 | First build | Seam Scan v0: a local web page (camera or two photos), tested on Terry first against his own tape measurements, before any Shopify work | Prove something real works on one body before building distribution | Starting with the Shopify app |
| 45 | Tools | MediaPipe is the starting tool, not a commitment. Other models or Seam's own can replace any step | Terry: "we don't NEED to use MediaPipe" | Locking in one vendor |
| 46 | Data loop | Every session saves inputs, camera measurements, width profiles, body landmarks (no face), small outline images, estimates and tape values. Later, shoppers' chosen sizes and returns on small Shopify stores join this data to train Seam's own model | The data is the long-term moat; the starting models only bootstrap it | Collecting nothing until launch |
| 47 | Stack for v0 | Plain HTML + JavaScript (no build step), Python only to build models from ANSUR II, Node for tests | Simple to run and change | React / bundler for v0 |

## 5. Find Your Size popup MVP (19 October 2026)

| # | Area | Decision | Why | Rejected |
|---|---|---|---|---|
| 48 | Scope | Men's tees + long-sleeve tees | Most of Terry's measurement list without collars | Shirts (collar and woven fabric) |
| 49 | Flow | 13 screens, one question each: intro, height, weight, fit, length, camera, front scan, side scan, processing, torso, arms, result, save | Terry: "one page at a time, and clean" | One long form |
| 50 | Look | White, one sans font (Inter), black text, rounded controls, 340 ms slide transitions, reduced-motion respected | Premium and quiet | Editorial serif; mono |
| 51 | Digital twin v0 | 23-variable Gaussian from ANSUR II; camera readings and picks are Kalman updates; shared scale error from typed height | Updates measurements the camera can't see; no double counting | Separate regressions per measurement (#36 approach) |
| 52 | Body options | After the scan, from the twin: 4 torso options (±1 SD along its two main directions, at least 4 cm chest spread, shown 2.2× exaggerated), then 3 arm options (illustrative thickness) | Every option is plausible for that shopper; the pick only nudges | Generic body types before the scan |
| 53 | Targets | From the brand's own body chart: typical wearer per size (ANSUR fills the rest), garment minus that body = intended ease; fit style shifts it | A fixed sleeve target was 3 cm off for Uniqlo; brand intent is data, not a guess | Fixed ease targets |
| 54 | Zone priority | Chest and shoulders decide; length and sleeves break ties; wearable = at least 2 cm chest ease **[est]** | Length preference must not push someone into a too-tight size | All zones equal |
| 55 | Garments | Uniqlo SUPIMA Cotton T-Shirt and Soft Brushed Long Sleeve, fetched from Uniqlo's size-chart API (garment + body chart) | Published, like-for-like measuring points with ANSUR (back neck, centre back sleeve) | Gildan secondary source |
| 56 | Accounts and host | Simulated accounts (browser only); own demo product page; widget is a drop-in `createSizeFinder()` | Prove sizing before backend and Shopify | Supabase now; Shopify dev store now |
| 57 | Stack | Vite 8 + Svelte 5 + TypeScript 6 (svelte-check does not support TypeScript 7 yet), Vitest, puppeteer-core smoke test with screenshots | Small bundle, built-in transitions, easy to embed | React; vanilla |

## 6. Faster, lenient scan (19 October 2026)

| # | Area | Decision | Why | Rejected |
|---|---|---|---|---|
| 58 | Capture rule | ~~Capture starts at 5 checks with head and feet required, then 24 more frames~~ **Revised same day:** every frame is measured in the background; the moment 5 checks pass (or 5 s still) the pose finishes with the frames already measured. Only the side pose requires "turned". Cut-off head or feet no longer blocks; it drops the camera numbers instead | Terry: reaching 5 must move on immediately | Requiring every check; a second capture phase |
| 59 | Leniency without slop | Failed checks no longer block; each widens the error of the readings it affects (e.g. bent elbows double arm-length error; a side pose not turned in over half the frames drops the depth readings). Partial frames still give lengths and heights | Faster, and the twin still knows which numbers to trust | Accepting bad frames at full weight |
| 60 | Speed | 24 frames per pose (was 40), 6-frame hold (was 12), looser angle limits | About 1 s of capture per pose | |
| 61 | Camera | Widest view: ultra-wide (0.5x) camera when the browser exposes one, full uncropped 4:3 sensor, minimum zoom; switch button cycles cameras (e.g. "iPhone Camera" via Continuity Camera on a Mac); tip to turn off Center Stage | MacBooks have no 0.5x lens; the iPhone's rear camera is better and can be placed anywhere | Fixed default webcam |

## 7. Scored scan, Face ID look, clearer figures (19 October 2026)

| # | Area | Decision | Why | Rejected |
|---|---|---|---|---|
| 62 | Capture score | Checks weighted out of 100 by how much the measurements depend on them. Front: head and feet 30, arms out 25, facing 15, upright 10, arms straight 5, feet 5, visible 5, distance 3, still 2. Side: turned 35, head and feet 25, arms down 15, upright 10, visible 5, distance 5, still 5. Pose finishes at 80; fallback: 5 s still with 60+ and the defining check (front: head and feet; side: turned). Verdicts smoothed over 10 frames | Terry: important checks worth 30 to 40 points, move on at a threshold. At 80 the front needs head+feet and arms out (chest and waist widths), the side needs turning and head+feet | Count of any 5 checks (captured fronts with no chest width) |
| 63 | Scan look | Dark background, the person cut out from the camera image, a ring of ticks around them; each check owns an arc sized by its points and fills green when passed; whole ring and a green glow when captured | Terry's Face ID-style request | Raw camera view with overlays |
| 64 | Body figures | Clothed figures (fitted tee, trousers, shoes, hair) from twin measurements, front + side, cropped head to knees; short descriptions under each label; arms options show the upper body | More precise, legible and relatable than grey silhouettes | Grey outlines |
| 65 | Font | Figtree (SIL OFL), the closest free match to Aritzia's "Non-Seasonal Geo" (a custom licensed typeface, not reusable) | Same geometric, round feel without licence risk | Copying Aritzia's font file |

## 8. Testing on a phone and calibrating (20 October 2026)

| # | Area | Decision | Why | Rejected |
|---|---|---|---|---|
| 66 | Phone testing | `npm run dev:phone`: https dev server on the Wi-Fi (self-signed certificate) | Phones only allow the camera on https; the iPhone has the real 0.5x ultra-wide lens | Testing on the laptop only |
| 67 | Calibration | `model/calibrate.py`: rescales camera numbers by measured/typed height, fits direct offsets (outer shoulder, shoulder joints, neck and crotch heights), one shared width/depth offset per region from tape girth (ANSUR girth relation), drape allowance from the tee check; noise left at defaults until several people | One person can show offsets, not error across bodies. Verified on synthetic sessions with planted errors (all recovered within 0.1 to 0.2 cm) | Hand-tuning numbers |

## 9. Changes log

| Date | Change |
|---|---|
| 19 Oct 2026 | Version 2 redesign (section 3) |
| 19 Oct 2026 | Seam Scan v0 built (section 4); ANSUR baseline reproduced (chest 3.81 cm self-reported, 3.06 cm measured) |
| 19 Oct 2026 | Find Your Size popup MVP built in `web/` (section 5): 23 tests, full walkthrough smoke test on desktop and phone sizes |
| 19 Oct 2026 | Faster, lenient scan (section 6): 29 tests |
| 19 Oct 2026 | Scored scan, Face ID look, clothed figures, Figtree (section 7): 32 tests, real-figure scan test passes |
| 20 Oct 2026 | Phone https mode, calibration script, processing screen uses the clothed figure; old outline module removed (section 8): 31 tests |
