"""Build Seam's body model (digital twin v0) from ANSUR II men.

The model is a multivariate Gaussian over 23 body measurements:
  mean        linear in typed height, weight, BMI (+ age)
  covariance  residual covariance, so the model knows which measurements move together
Also exports the population Gaussian (no inputs), used to work out what body each brand
designs each size for, and a reference case so the JavaScript maths can be tested exactly.

Run: .venv/bin/python build_body_model.py
"""

import json
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "data" / "ansur" / "ANSUR_II_MALE_Public.csv"
OUT = ROOT / "web" / "public" / "body_model.json"
REF = ROOT / "web" / "src" / "core" / "reference.json"

# key: (ANSUR column, label). Lengths in cm.
VARS = {
    "chest_girth": ("chestcircumference", "Chest girth"),
    "waist_girth": ("waistcircumference", "Waist girth"),
    "hip_girth": ("buttockcircumference", "Hip girth"),
    "neck_girth": ("neckcircumferencebase", "Neck girth (base)"),
    "arm_girth": ("bicepscircumferenceflexed", "Upper-arm girth"),  # ANSUR measures it flexed
    "outer_shoulder": ("bideltoidbreadth", "Outer shoulder width"),
    "bony_shoulder": ("biacromialbreadth", "Shoulder width (bone to bone)"),
    "chest_width": ("chestbreadth", "Chest width"),
    "chest_depth": ("chestdepth", "Chest depth"),
    "waist_width": ("waistbreadth", "Waist width"),
    "waist_depth": ("waistdepth", "Waist depth"),
    "hip_width": ("hipbreadth", "Hip width"),
    "hip_depth": ("buttockdepth", "Hip depth"),
    "upper_arm": ("shoulderelbowlength", "Shoulder to elbow"),
    "arm_length": ("sleeveoutseam", "Shoulder to wrist"),
    "cb_wrist": ("sleevelengthspinewrist", "Centre back to wrist"),
    "stature": ("stature", "Height (true)"),
    "shoulder_height": ("acromialheight", "Shoulder height"),
    "neck_height": ("cervicaleheight", "Back of neck height"),
    "armpit_height": ("axillaheight", "Armpit height"),
    "chest_height": ("chestheight", "Chest height"),
    "navel_height": ("waistheightomphalion", "Navel height"),
    "crotch_height": ("crotchheight", "Crotch height"),
}
FEATURES = {"hw": ["h", "w", "bmi"], "hwa": ["h", "w", "bmi", "age"]}


def load():
    raw = pd.read_csv(CSV, encoding="latin-1")
    df = pd.DataFrame({k: raw[col] / 10 for k, (col, _) in VARS.items()})
    df["h"] = raw["Heightin"] * 2.54          # self-reported, as a shopper types it
    df["w"] = raw["Weightlbs"] * 0.45359237
    df["age"] = raw["Age"]
    df = df[(df.h > 140) & (df.h < 215) & (df.w > 40) & (df.w < 200)].copy()
    df["bmi"] = df.w / (df.h / 100) ** 2
    return df


def fit_conditional(df, feats):
    X = np.column_stack([np.ones(len(df))] + [df[f].to_numpy() for f in feats])
    Y = df[list(VARS)].to_numpy()
    B, *_ = np.linalg.lstsq(X, Y, rcond=None)      # (1 + p) x 23
    E = Y - X @ B
    cov = E.T @ E / (len(df) - X.shape[1])
    return B.T, cov                                  # 23 x (1 + p), 23 x 23


def kalman(mean, cov, H, y, R):
    """Same update as bodymodel.ts (Joseph form)."""
    S = H @ cov @ H.T + R
    K = cov @ H.T @ np.linalg.inv(S)
    mean2 = mean + K @ (y - H @ mean)
    A = np.eye(len(mean)) - K @ H
    cov2 = A @ cov @ A.T + K @ R @ K.T
    return mean2, (cov2 + cov2.T) / 2


def main():
    df = load()
    keys = list(VARS)
    prior = {}
    for name, feats in FEATURES.items():
        coef, cov = fit_conditional(df, feats)
        prior[name] = {"features": feats, "coef": np.round(coef, 6).tolist(), "cov": np.round(cov, 5).tolist()}
    pop_mean = df[keys].mean().to_numpy()
    pop_cov = np.cov(df[keys].to_numpy().T)

    # Landmark heights as a share of true stature, for the camera tilt check.
    proportions = {}
    for name, key in {"crotch": "crotch_height", "neck": "neck_height", "armpit": "armpit_height", "shoulder": "shoulder_height"}.items():
        frac = df[key] / df["stature"]
        proportions[name] = {"mean": round(float(frac.mean()), 4), "sd": round(float(frac.std()), 4)}

    model = {
        "built": date.today().isoformat(),
        "source": f"ANSUR II male public data, n = {len(df)}; typed (self-reported) height and weight",
        "units": "cm, kg, years",
        "vars": keys,
        "labels": {k: lab for k, (_, lab) in VARS.items()},
        "prior": prior,
        "population": {"mean": np.round(pop_mean, 4).tolist(), "cov": np.round(pop_cov, 5).tolist()},
        "proportions": proportions,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(model))

    # Reference case for the JavaScript tests (uses the rounded numbers, as JS will).
    coef = np.array(prior["hwa"]["coef"])
    cov = np.array(prior["hwa"]["cov"])
    h, w, age = 178.0, 75.0, 20.0
    x = np.array([1, h, w, w / (h / 100) ** 2, age])
    mean = coef @ x
    obs = {"chest_width": 33.0, "chest_depth": 24.5, "bony_shoulder": 40.0, "neck_height": 152.0}
    idx = [keys.index(k) for k in obs]
    H = np.zeros((len(obs), len(keys)))
    H[np.arange(len(obs)), idx] = 1
    y = np.array(list(obs.values()))
    R = np.diag([1.5 ** 2, 1.5 ** 2, 2.0 ** 2, 2.0 ** 2]) + 0.015 ** 2 * np.outer(y, y)
    post_mean, post_cov = kalman(mean, cov, H, y, R)
    pm = np.array(model["population"]["mean"])
    pc = np.array(model["population"]["cov"])
    ci = [keys.index("chest_girth"), keys.index("waist_girth")]
    Hc = np.zeros((2, len(keys)))
    Hc[[0, 1], ci] = 1
    typical, _ = kalman(pm, pc, Hc, np.array([100.0, 80.0]), np.eye(2) * 1e-6)
    REF.parent.mkdir(parents=True, exist_ok=True)
    REF.write_text(json.dumps({
        "inputs": {"height_cm": h, "weight_kg": w, "age": age},
        "prior_mean": mean.tolist(),
        "observations": obs,
        "R": R.tolist(),
        "posterior_mean": post_mean.tolist(),
        "posterior_sd": np.sqrt(np.diag(post_cov)).tolist(),
        "typical_given_chest100_waist80": typical.tolist(),
    }, indent=1))

    sd_prior = np.sqrt(np.diag(cov))
    sd_post = np.sqrt(np.diag(post_cov))
    print(f"ANSUR II men used: {len(df)}; wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)\n")
    print(f"{'variable':16} {'prior (178/75/20)':>18} {'after example scan':>20}")
    for i, k in enumerate(keys):
        print(f"{k:16} {mean[i]:8.1f} ± {sd_prior[i]:4.2f}   {post_mean[i]:8.1f} ± {sd_post[i]:4.2f}")
    print("\ntypical M wearer (chest 100, waist 80):",
          {k: round(typical[keys.index(k)], 1) for k in ["bony_shoulder", "cb_wrist", "neck_height", "stature"]})


if __name__ == "__main__":
    main()
