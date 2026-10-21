# Research

Desk research, 14 to 19 October 2026. **[unverified]** = not confirmed against a primary or reputable source. **[own calc]** = 10-fold cross-validated linear regression on the public [ANSUR II male CSV](https://tools.openlab.psu.edu/publicData/ANSUR_II_MALE_Public.csv) (n = 4,082), run during research, not peer reviewed. "My assessment" lines are interpretation, not fact.

Sections 1 to 6 date from the version 1 plan (iPhone app + cloud 3D model) and still hold for competitors, economics and regulation. Sections 7 to 13 cover the version 2 design (Shopify popup + MediaPipe in the browser).

## 1. Competitors

| Player | Status 2025 to 2026 | How it measures | Who pays / pricing | Source |
|---|---|---|---|---|
| 3DLOOK (YourFit, Mobile Tailor, FitXpress) | Operating; also sells into health and fitness | Two phone photos, 80+ measurements | B2B. Mobile Tailor USD 499 / month for 100 scans, USD 999 for 500. FitXpress USD 1,000 to 1,500 / month | https://3dlook.ai/pricing/ |
| True Fit | Operating. AI shopping agent launched Feb 2026; fit data offered over MCP | Shopper profile + purchase and return history across retailers. No scans | Retailer. Shopify "Standard" USD 1,000 / month up to 150k orders a year | https://apps.shopify.com/truefit, https://www.truefit.com/fit-intelligence-spec |
| Bold Metrics | Operating. Agentic Sizing Protocol with Gap, Mar 2026 | 4 to 6 survey questions predict 50+ body measurements, matched to brand tech packs | Retailer. Price not public. 2024 ARR USD 3.2m **[unverified]** | https://boldmetrics.com/solutions/virtual-sizer, https://wwd.com/business-news/technology/gap-bold-metrics-ai-sizing-agentic-commerce-1238687164/ |
| Fit Analytics | Bought by Snap 2021; management buyback effective Jan 2024; independent, AI assistant Jun 2026 | Questionnaire (height, weight, age, body shape) + crowd purchase and return data | Retailer. Price not public | https://www.businesswire.com/news/home/20260602315868/en/How-Fit-Analytics-Innovation-Reclaimed-its-Independence-to-Build-the-Future-of-AI-Commerce |
| MySize (MySizeID, Naiz Fit) | Listed; about USD 10m revenue 2025, mostly non-sizing units | Phone-based measurement app | Brands (SaaS). Price not public | https://www.sec.gov/Archives/edgar/data/1211805/000149315226008720/ex99-1.htm |
| ZOZOFIT | Repositioned as US fitness tracking. ZOZOMAT status **[unverified]** | Dotted suit + rear camera or app-only front-camera scan | Consumer. Suit USD 99.99; app USD 4.99 / month | https://zozofit.com/blogs/news/zozofit-announces-its-new-subscription-based-service-re-shaping-the-future-of-personalized-fitness |
| Presize | Acquired by Meta Apr 2022; no standalone product since **[unverified]** | Phone video scan | n/a | https://fashionunited.com/news/fashion/meta-acquires-presize-betting-on-virtual-sizing-technology/2022042647258 |
| Amazon | Made for You status **[unverified]**. Fit Insights (LLM analysis of reviews and returns for brands). BIPA class action over virtual try-on certified, affirmed Dec 2025 | Photos, purchase and review data | Internal | https://techcrunch.com/2024/01/08/amazon-turns-to-ai-to-help-customers-find-clothes-that-fit-when-shopping-online/ |
| Google | "Try it on" from a user photo in Search (US Jul 2025; shoes, Australia, Canada, Japan Oct 2025). Doppl app closed 30 Apr 2026 **[unverified]** | Generative image only, no sizing | Free | https://techcrunch.com/2025/10/08/googles-virtual-try-on-shopping-tool-expands-to-more-countries-now-lets-you-try-on-shoes/ |
| Zalando | In-house (bought Fision 2020). Two-photo scan processed on the phone; about 1m customers scanned; size-related returns down more than 8% (company claim) | Photos | Own platform | https://corporate.zalando.com/en/technology/zalando-launches-size-recommendations-based-customers-own-body-measurements |
| Fit:match | Operating; "Reflect" in-store turntable scanner | LiDAR scan matched to the nearest body in its database | Not public | https://athletechnews.com/fitmatch-intel-unveil-new-3d-body-scanning-technology/ |
| Perfitly | No press since 2023; status **[unverified]** | Questionnaire or two photos, avatar | Not public | https://www.perfitly.com/press |
| Sizebay | Free Shopify app launched Jun 2026 | Height, weight, age | Plans from BRL 70 / year **[unverified]** | https://apps.shopify.com/sizebay-fit-finder |
| Kiwi Sizing | Operating; 4.7 stars from 1,237 reviews | Size chart builder + recommender | USD 0 / 7.99 / 14.99 / 26.99 per month + usage | https://apps.shopify.com/kiwi-sizing |
| Easysize | Operating | Fit quiz + return data | USD 35 to 250 / month + USD 0.15 per add-to-cart | https://www.easysize.me/pricing |
| AIUTA | Live on ASOS iOS (US, UK) since Feb 2026 | Generative try-on | Not public | https://www.theinterline.com/2026/02/17/asos-launches-inclusive-new-way-to-shop-with-aiutas-virtual-try-on-technology/ |
| Veesual | USD 7.5m seed Apr 2024; Eileen Fisher, Adore Me | Generative try-on | Not public | https://www.prnewswire.com/news-releases/ai-powered-virtual-try-on-technology-platform-for-the-fashion-industry-veesual-raises-7-5-million-announces-us-expansion-with-new-eileen-fisher-partnership-302119247.html |

**Others to watch**

| Player | Why it matters | Source |
|---|---|---|
| Measmerize | Closest to Seam's matching layer: questionnaire + brand tech packs | https://www.measmerize.com/ |
| ABODY.AI | Chrome extension reading store size charts; 162 users (Sep 2026) | https://chromewebstore.google.com/detail/abodyai-true-fit-size-for/cobfpgeggnjajehgdpnmfiikpadmeijh |
| Bodygram | "Selfie" sizing, Mar 2025 **[unverified]** | |

**My assessment:** no player at scale combines a phone scan with per-garment tech pack matching. Incumbents use questionnaires plus purchase and return data. The 2026 trend is sizing APIs that AI shopping agents can call, which suits Seam's `/recommend` endpoint later.

## 2. Accuracy

| Study | Method | Result | Source |
|---|---|---|---|
| BMnet on Amazon BodyM | Front + side silhouettes + height + weight | Mean absolute error: chest 23 mm, waist 21, hip 18, leg length 15, shoulder breadth 8 | https://ar5iv.labs.arxiv.org/html/2210.05667 |
| Amazon MeasureNet | Phone photos | Waist-to-hip ratio error 1.4% vs 2.8% when people measured themselves | https://www.nature.com/articles/s41746-023-00909-5 |
| Smith 2022, n = 59 | MeThreeSixty app, phone rotation scan | R² 0.72 to 0.93 vs tape; precision close to a 20-camera scanner | https://onlinelibrary.wiley.com/doi/10.1002/oby.23434 |
| EJCN 2024 | Mobile Fit and Prism apps | Circumference technical error 0.9 cm (1.5%) for the rotation app; two-photo app had larger errors | https://pubmed.ncbi.nlm.nih.gov/38454153/ |
| Polycam vs Fit3D, n = 141 | Phone photogrammetry | Mean absolute error: waist 10 mm, hip 14 mm | https://arxiv.org/html/2608.12827 |
| iPad Pro LiDAR | LiDAR with Polycam | Only half the lower-limb scans usable | https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11054930/ |
| 3DLOOK | Vendor claim | "96 to 97%" accuracy; repeat scans under 1 cm apart. Not peer reviewed | https://3dlook.ai/content-hub/accuracy-drives-roi-digital-health/ |

| Point | Detail | Source |
|---|---|---|
| Benchmark | ISO 20685 allowable errors are 3 to 22 mm | https://www.tandfonline.com/doi/full/10.1080/00140139.2021.1931473 |
| Realistic error (my synthesis) | 1 to 2.5 cm on chest, waist, hip; about 1.5 cm inseam; under 1 cm shoulder | Studies above |
| Size step | Chest typically grades about 4 cm per size, so 2 cm error is half a size | https://techpacker.com/blog/design/what-is-a-tech-pack/ |
| LiDAR vs photos | No strong evidence LiDAR beats photo + ML for whole-body girths | Studies above |
| LiDAR iPhones | 12 Pro to 17 Pro and Pro Max only; rear camera only | https://support.apple.com/en-kg/guide/iphone/aside/iphc07537a89/26/ios/27 |
| Pro share of US sales | 38% (Q1 2025), 52% (Dec 2025 quarter). Installed base share not published; rough estimate 35 to 45% of US iPhone users **[unverified]** | https://9to5mac.com/2025/04/23/iphone-16-pro-is-the-surprise-loser-in-apples-recent-sales/, https://www.cnbc.com/2026/01/31/analysts-apples-staggering-iphone-sales-are-from-pent-up-demand.html |

**Apple frameworks**

| Framework | What it gives | Source |
|---|---|---|
| ARKit body tracking | 3D skeleton with a scale estimate, no body surface; A12 chip or later | https://developer.apple.com/videos/play/wwdc2019/607/ |
| Vision `VNDetectHumanBodyPose3DRequest` (iOS 17) | 17 joints in metres; uses depth when available, does not need LiDAR | https://developer.apple.com/documentation/vision/vndetecthumanbodypose3drequest |
| Object Capture | Needs LiDAR and A14; built for static objects, likely unsuitable for people | https://developer.apple.com/forums/tags/wwdc2023-10191 |

**Body models and data:** see `../LICENCES.md` for licences. SMPL-Anthropometry extracts girths from SMPL meshes (reference only, SMPL is non-commercial): https://github.com/DavidBoja/SMPL-Anthropometry. BodyM has 2,505 people with 14 measurements each: https://registry.opendata.aws/bodym/. ANSUR II: https://www.openlab.psu.edu/datasets/ansur2/.

## 3. Tech packs

| Point | Detail | Source |
|---|---|---|
| Contents | Points of measure, base size specs, grade rules, tolerances, materials, construction. Typical tolerances ±0.5 cm woven, ±1 cm knit | https://techpacker.com/blog/design/what-is-a-tech-pack/ |
| Sharing | Confidential between brand and factory. Fit vendors get them under B2B contracts; no public release practice found | https://boldmetrics.com/solutions/virtual-sizer, https://www.measmerize.com/how-it-works |
| Published garment measurements | Uniqlo (finished garment, measured flat, per product); Taylor Stitch ("garment specifications" link) | https://faq-sg.uniqlo.com/articles/en_US/Knowledge/Product-Measurement-Guidelines-SG, https://www.drip.com/blog/e-commerce-size-guide-examples |
| Most retailers | Publish body size charts, not garment measurements **[unverified generalisation]** | |
| Other signals | Shopper's own garment measured flat; review-derived fit signals (Amazon Fit Insights) | |

## 4. Market economics

| Fact | Source |
|---|---|
| US 2025: 15.8% of retail sales returned (USD 849.9bn). Online 19.3%, up from 17.6% in 2024 | https://nrf.com/media-center/press-releases/consumers-expected-to-return-nearly-850-billion-in-merchandise-in-2025 |
| Online apparel return rate 24.4%; 53% cite size or fit; USD 25.1bn processing cost (2023) | https://coresight.com/research/the-true-cost-of-apparel-returns-alarming-return-rates-require-loss-minimization-solutions/ |
| Average return costs about 27% of purchase price (Optoro, cited second-hand) **[unverified]** | https://www.icsc.com/news-and-views/icsc-exchange/solving-the-returns-problem-liquidonates-game-changing-approach-for-retailers |
| Vendor-claimed return cuts: Zalando > 8% (size-related), Fit Analytics 3%, Bold Metrics 32%, 3DLOOK 30% | Vendor sources in section 1 |

## 5. Distribution

| Channel | Facts | Source |
|---|---|---|
| Chrome extension | Precedent exists but adoption is tiny (ABODY.AI 162 users). Chrome Web Store restricts affiliate monetisation since 10 Jun 2025. Desktop only **[unverified]** | https://9to5google.com/2025/03/11/google-chrome-affiliate-extension-policy-honey/ |
| iOS Safari Web Extension | iOS 15+; content scripts can read and change pages; users opt in site by site; ships inside an App Store app | https://developer.apple.com/videos/play/wwdc2021/10104/ |
| Shopify app | Price benchmarks: Kiwi USD 0 to 27, Easysize USD 35 to 250 + usage, True Fit USD 1,000, Sizebay free. Merchants supply garment data | Section 1 |

## 6. Regulation

| Law | What it covers | Relevance to Seam | Source |
|---|---|---|---|
| Illinois BIPA | "Scan of hand or face geometry". Photos and height/weight excluded. USD 1,000 per violation, USD 5,000 if reckless; 2024 amendment counts one violation per person | Body measurements alone probably outside it; any face processing is a lawsuit risk | https://www.ilga.gov/documents/legislation/ilcs/documents/074000140k10.htm, https://blogs.duanemorris.com/classactiondefense/2025/12/30/seventh-circuit-affirms-certification-of-bipa-class-comprised-of-customers-who-used-amazons-virtual-try-on-tool/ |
| Texas CUBI | "Hand or face geometry". Consent required; Attorney General fines up to USD 25,000 per violation; Meta settled for USD 1.4bn in 2024 | Same face risk | https://www.texasattorneygeneral.gov/consumer-protection/file-consumer-complaint/consumer-privacy-rights/biometric-identifier-act |
| CCPA / CPRA | Biometric information includes face and body imagery from which an identifier can be extracted; sensitive when used to identify | Disclosure and a right to limit use | https://www.consumerprivacyact.com/section-1798-140-definitions/ |
| Washington MHMDA | "Consumer health data" includes bodily "measurements"; private right to sue | Risky if Seam outputs BMI or body fat (my interpretation) | https://app.leg.wa.gov/RCW/default.aspx?cite=19.373.010 |
| EU GDPR | Photos are biometric only when processed to uniquely identify someone | Body data is personal data; health-type outputs could become special-category (my interpretation) | https://gdpr-info.eu/recitals/no-51/ |

**Precedent:** Zalando processes photos on the phone and deletes them; Fit:match captures no photos.

## 7. MediaPipe Pose Landmarker

| Item | Fact | Source |
|---|---|---|
| Version | `@mediapipe/tasks-vision` 1.1.1 (14 Oct 2026); Apache 2.0 | https://registry.npmjs.org/@mediapipe/tasks-vision |
| Models | Lite, full, heavy. `.task` files 5.8, 9.4 and 30.7 MB; WASM 13.5 MB (header check during research) | https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf |
| 33 landmarks | 0 nose; 1 to 6 eyes; 7 to 8 ears; 9 to 10 mouth; 11/12 shoulders; 13/14 elbows; 15/16 wrists; 17 to 22 hands; 23/24 hips; 25/26 knees; 27/28 ankles; 29/30 heels; 31/32 foot index | https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker |
| What the points are | Model card says only "approximate location of body parts". In similar models, hips sit 29 to 53 mm off the true hip joint centre and shoulders 24 to 34 mm off | https://pmc.ncbi.nlm.nih.gov/articles/PMC8526586/ |
| Missing points | No head top, neck, crotch or waist | Model card |
| Segmentation mask | Optional output (`outputSegmentationMasks`, off by default) | Pose Landmarker guide |
| World landmarks | Metres from mid-hip, from fitting a body model; "metric accurate depth" is out of scope; widths are biased without subject size. **Not metric for an individual** | Model card; https://github.com/google-ai-edge/mediapipe/issues/4917; https://smart-medication.eu/dokumente/beitraege/bmt-2023-poster-mediapipe-pose.pdf |
| Telemetry | Version 1.x posts usage metrics to Google every 60 s, no opt-out; Google says no input data is sent | https://github.com/google-ai-edge/mediapipe/issues/6291 |
| Speed | 2021, web: iPhone 11 34 / 30 FPS (lite / full); heavy did not run on phones. Current iPhone Safari figures **[unverified]** | https://blog.tensorflow.org/2021/05/high-fidelity-pose-tracking-with-mediapipe-blazepose-and-tfjs.html |
| Legacy | Legacy solutions unsupported since 1 Mar 2023; use the Tasks API | https://developers.google.com/edge/mediapipe/solutions/guide |

## 8. Accuracy of pose-based measurement

| Study | Setup | Result | Source |
|---|---|---|---|
| arXiv 2601.01639 | MediaPipe vs tape, n = 4 | Shoulder 0 to 1.3 cm; torso 2.6 to 7.3 cm; leg 2 to 26 cm; waist up to 24.8 cm (20.5 cm in loose clothing) | https://arxiv.org/html/2601.01639v1 |
| Zong 2023 (Cornell) | Front + side photos scaled by height vs 3D scan, pilot | Widths underestimated more than depths; no numbers | https://proc.3dbody.tech/abstracts/2023/2333zong.html |
| Height study, n = 166 | MediaPipe + YOLOv8 + reference object | Height error 1.54 ± 0.64% | https://journal.yrpipku.com/index.php/jaets/article/view/8798 |

No published figure found for MediaPipe shoulder width vs bony shoulder width **[unverified]**. ANSUR II men: bony shoulder width (biacromial) 41.6 ± 1.9 cm, outer shoulder width (bideltoid) 51.0 ± 3.3 cm **[own calc]**.

## 9. What height and weight can predict

| Inputs (ANSUR II men) | Chest error (RMSE) | Waist error | Source |
|---|---|---|---|
| Height + weight | 3.2 cm (MAE 2.6, 90th percentile 5.3) | 4.4 cm | **[own calc]** |
| + age + BMI | 3.1 cm | 4.1 cm | **[own calc]** |
| + self-reported instead of measured height and weight | 3.8 cm | 5.0 cm | **[own calc]** |
| + bony shoulder width | 3.0 cm | 3.9 cm | **[own calc]** |
| + chest width only | 2.8 cm | | **[own calc]** |
| + chest width and depth | **2.1 cm** | | **[own calc]** |
| + waist width only / width and depth | | 2.4 / **1.5 cm** | **[own calc]** |

| Other evidence | Result | Source |
|---|---|---|
| Outer vs bony shoulder width as chest predictor | r = 0.89 vs 0.52 | **[own calc]** |
| NHANES + hospital cohort, n = 60,740 | Waist RMSE 4.7 cm from height, weight, BMI, age, sex, race | https://pmc.ncbi.nlm.nih.gov/articles/PMC7944598/ |
| BMnet (Amazon BodyM) | Front + side silhouettes + height + weight: chest MAE 1.6, waist 1.5 cm | https://arxiv.org/pdf/2210.05667 |
| Phone apps vs tape, n = 115 | Waist RMSE 4.7 to 6.5 cm | https://www.cambridge.org/core/journals/british-journal-of-nutrition/article/evaluation-of-automated-anthropometrics-produced-by-smartphonebased-machine-learning-a-comparison-with-traditional-anthropometric-assessments/49AFA085C23914A64D2B89CBBD8C8BD8 |
| Size from height + weight only | 51.7% correct vs 89.7% using bust, waist and hip | https://pmc.ncbi.nlm.nih.gov/articles/PMC12630603/ |
| Tee chest bins (10.16 cm) | Height, weight, age model lands in the true chest bin 76%; true width + depth 84% (illustrative) | **[own calc]** |

**Caveats:** ANSUR breadths and depths are caliper values; camera widths through a T-shirt will do worse. ANSUR is a fit military sample, so civilian errors will be higher.

**Picking your own body shape:** in 520 men the silhouette picked correlated with BMI at r = 0.76 ([Karger 2021](https://karger.com/ofa/article/14/4/397/820323/Development-of-a-BMI-Assigned-Stunkard-Scale-for)). Only 63.5% of adults judged their own weight status correctly; 30.8% of overweight people rated themselves normal ([Sci Rep 2021](https://www.nature.com/articles/s41598-021-04706-6)).

## 10. Self-reported height and weight (men)

| Source | Height | Weight |
|---|---|---|
| [NHANES 2001 to 2006, 8,208 men](https://www.cdc.gov/pcd/issues/2009/oct/08_0229.htm) | +1.22 cm overall; +0.75 to +0.97 cm at 16 to 49; +1.94 to +3.88 cm at 60+ | +0.30 kg overall; obese men −1.32 kg |
| [NHANES 1999 to 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC7289317/) | +1.36 cm | −0.08 kg |
| [Connor Gorber 2007 review](https://onlinelibrary.wiley.com/doi/10.1111/j.1467-789X.2007.00347.x) | Overestimated by 0.5 to 2.3 cm in 11 of 12 male studies | Under-reporting trend |
| ANSUR II men **[own calc]** | +2.27 cm (SD 2.63) | −0.25 kg (SD 3.47) |

## 11. Datasets

| Dataset | Contents | Licence / cost | Source |
|---|---|---|---|
| ANSUR II | 4,082 men, 1,986 women; 93 measurements incl. chest girth, chest and waist width and depth, bony and outer shoulder width, plus self-reported height and weight. Ages 17 to 58, mean BMI 27.7; "not an approximation of the US civilian population" | "Cleared for unlimited public release"; no formal licence text, commercial terms **[unverified]** | http://tools.openlab.psu.edu/publicData/ANSURII-MFR.pdf, https://www.openlab.psu.edu/ansur2/ |
| NHANES body measures (2021 to 2023) | Height, weight, upper leg and upper arm length, arm circumference, waist; hip from 2017 to 2018. **No chest girth** | Public use, "statistical reporting and analysis only"; commercial model use **[unverified]** | https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2021/DataFiles/BMX_L.htm, https://cdc.gov/nchs/policy/data-user-agreement.html |
| CAESAR | ~2,400 North American + 2,050 European subjects | Owned by SAE; commercial use priced on request | https://www.caesar-database.com/ |
| SizeUSA | 10,000+ subjects, 200+ measurements | Price on request | https://www.tc2.com/size-usa.html |
| BodyM | 2,505 subjects with silhouettes | CC BY-NC 4.0, not commercial | https://registry.opendata.aws/bodym/ |

## 12. Shopify and the browser camera

| Topic | Fact | Source |
|---|---|---|
| App blocks vs app embeds | App blocks need Online Store 2.0 themes; app embeds inject before `</head>` or `</body>` and work on vintage themes. Limits: 10 MB total, 100 KB Liquid, 10 KB JS suggested | https://shopify.dev/docs/apps/build/online-store/theme-app-extensions/configuration |
| Theme changes rule | Apps that change themes must use theme app extensions (requirement 5.1.1) | https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements |
| Camera in cross-origin iframes | Chrome needs `allow="camera"`; Safari has partial Feature Policy support and no Permissions-Policy header support; repeat prompts reported on iOS. Exact iOS behaviour **[unverified]** | https://www.chromium.org/Home/chromium-security/deprecating-permissions-in-cross-origin-iframes/, https://caniuse.com/permissions-policy, https://developer.apple.com/forums/thread/788518 |
| In-app browsers | Camera in WKWebView (Instagram etc.) works since iOS 14.3 | https://www.zappar.com/blog/zappar-webar-now-supported-social-media-apps-and-third-party-browsers-with-ios-14-3/ |
| Store headers | allbirds.com, kith.com, taylorstitch.com send no Permissions-Policy (camera allowed on own origin); headless gymshark.com sends `camera=()` (blocked). Header check during research | |
| App proxy | Serves the app at `shop/apps/…` on the shop's origin; cookies stripped | https://shopify.dev/docs/apps/build/online-store/app-proxies |
| Best pattern | 1. Inline popup from a theme app extension; 2. app proxy page; 3. new tab on own domain; 4. cross-origin iframe (least robust) | My assessment from the above |
| App Store rules | No camera or biometric rule found **[unverified]**; privacy webhooks and data protection rules apply | https://www.shopify.com/partners/blog/data-protection |

## 13. Tee grading and browser-camera competitors

**Gildan 5000, measured flat (S, M, L, XL, 2XL)** ([source](https://dtfdatabase.com/blog/gildan-5000-g500-heavy-cotton-style-guide/))

| Measurement | S to 2XL | Grade per size |
|---|---|---|
| Body width | 18, 20, 22, 24, 26 in | 2 in flat = about **10.2 cm of chest girth** |
| Body length | 28 to 32 in | 1 in (2.5 cm) |
| Sleeve (centre back) | 15⅝ to 21½ in | ~1.5 in (3.8 cm), includes shoulder |

Typical industry grades: chest +1.5 to 2 in, length +1 in, sleeve +0.75 in ([source](https://www.adstronaut.net/blog/how-to-grade-sizes-clothing)). Shoulder grade **[unverified]**.

**Competitors doing camera sizing in a browser or on Shopify**

| Vendor | Method | Claim | Source |
|---|---|---|---|
| UniMeasureAI | Browser camera, Shopify app (launched 27 Jul 2026, USD 49 to 995 / month, 0 reviews) | None | https://apps.shopify.com/unimeasure |
| Shaku | Two photos + height, Shopify app (one 1-star review) | None | https://apps.shopify.com/shaku-widget |
| Esenca | Two photos in the browser | 97% fit success via returns at one client | https://esencasizing.com/body-measuring/ |
| Sizer | Web scan | "97% measurement accuracy" | https://sizer.me/body-measurement-solution/ |
| 3DLOOK | Two photos | 96 to 97%, 1.5 to 2.0 cm (internal) | https://3dlook.ai/content-hub/3dlook-turns-two-photos-structured-body-data/ |
| Bodygram | Two photos + age, height, weight | "99 percent", under 1 inch (2018) | https://techcrunch.com/2018/07/02/original-stitchs-new-bodygram-will-measure-your-body/ |
| Bold Metrics | 4 to 6 questions | Within ±1% of a master tailor | https://blog.boldmetrics.com/how-ai-can-power-accurate-apparel-fit-and-sizing-with-a-foundation-of-body-data |

**My assessment:** none of these publishes per-measurement errors against tape on an independent sample. Bold Metrics' ±1% (about 1 cm chest) is tighter than the US Army's allowable error for trained measurers (15 mm chest, per the [Body Talk patent](https://patents.google.com/patent/US20210134042A1/en)) and well below what height and weight can achieve, so treat it as unaudited marketing. Publishing Seam's leave-one-out validation is a real differentiator.

## 14. Gaps (not yet researched)

| Gap | Why it matters |
|---|---|
| ANSUR II and NHANES terms for commercial models | The prior and body types depend on ANSUR |
| MediaPipe shoulder and hip points vs anatomical landmarks (numbers) | Sets how much calibration has to correct |
| Current MediaPipe speed in iPhone Safari | Scan time on phones |
| Legal risk of scraping retailer pages | Demo catalogue depends on it |
| Berkeley programme and YC deadlines for 2027 | Spring timeline |
| F-1 rules on unpaid pilots, App Store listings and founding a company | Gate before the first pilot |
