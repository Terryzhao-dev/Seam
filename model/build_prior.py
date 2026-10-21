"""Build Seam's starting models from ANSUR II (men) and export them for the scan page.

Two kinds of model, all plain linear regressions so they can run in the browser:
  prior   height + weight (+ age), as people would type them  ->  every body measurement
  camera  body widths and depths (calipers in ANSUR)          ->  girths

Errors are 10-fold cross-validated, so they are honest estimates for new people.
Run: .venv/bin/python build_prior.py
"""

import json
import math
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import KFold, cross_val_predict

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "data" / "ansur" / "ANSUR_II_MALE_Public.csv"
OUT = ROOT / "scan" / "models.json"

# Body measurements in cm (ANSUR stores lengths in mm).
TARGETS = {
    "chest_girth": "chestcircumference",
    "waist_girth": "waistcircumference",
    "hip_girth": "buttockcircumference",
    "outer_shoulder": "bideltoidbreadth",   # widest across the deltoids
    "bony_shoulder": "biacromialbreadth",   # acromion to acromion
    "chest_width": "chestbreadth",
    "chest_depth": "chestdepth",
    "waist_width": "waistbreadth",
    "waist_depth": "waistdepth",
    "hip_width": "hipbreadth",
    "hip_depth": "buttockdepth",
    "upper_arm": "shoulderelbowlength",     # acromion to elbow
    "arm_length": "sleeveoutseam",          # acromion to wrist
    "inseam": "crotchheight",
}


def ellipse_perimeter(width, depth):
    """Ramanujan's approximation; width and depth are full axes."""
    a, b = width / 2, depth / 2
    return math.pi * (3 * (a + b) - np.sqrt((3 * a + b) * (a + 3 * b)))


def load():
    raw = pd.read_csv(CSV, encoding="latin-1")
    df = pd.DataFrame({name: raw[col] / 10 for name, col in TARGETS.items()})
    # Neck base (C7) to crotch: proxy for HPS to crotch, which sets tee length.
    df["torso_length"] = (raw["cervicaleheight"] - raw["crotchheight"]) / 10
    df["h_measured"] = raw["stature"] / 10
    df["w_measured"] = raw["weightkg"] / 10
    df["h"] = raw["Heightin"] * 2.54          # self-reported, as a shopper types it
    df["w"] = raw["Weightlbs"] * 0.45359237
    df["age"] = raw["Age"]
    df = df[(df["h"] > 140) & (df["h"] < 215) & (df["w"] > 40) & (df["w"] < 200)].copy()
    for prefix in ("", "_measured"):
        h, w = df[f"h{prefix}"], df[f"w{prefix}"]
        df[f"bmi{prefix}"] = w / (h / 100) ** 2
    df["ellipse_chest"] = ellipse_perimeter(df["chest_width"], df["chest_depth"])
    df["ellipse_waist"] = ellipse_perimeter(df["waist_width"], df["waist_depth"])
    df["ellipse_hip"] = ellipse_perimeter(df["hip_width"], df["hip_depth"])
    return df


def fit(df, features, target):
    X, y = df[features].to_numpy(), df[target].to_numpy()
    cv = KFold(n_splits=10, shuffle=True, random_state=0)
    pred = cross_val_predict(LinearRegression(), X, y, cv=cv)
    err = pred - y
    model = LinearRegression().fit(X, y)
    return {
        "features": features,
        "intercept": round(float(model.intercept_), 5),
        "coef": [round(float(c), 6) for c in model.coef_],
        "rmse": round(float(np.sqrt(np.mean(err ** 2))), 2),
        "mae": round(float(np.mean(np.abs(err))), 2),
    }


def main():
    df = load()
    body = list(TARGETS) + ["torso_length"]

    prior = {
        "hw": {t: fit(df, ["h", "w", "bmi"], t) for t in body},
        "hwa": {t: fit(df, ["h", "w", "bmi", "age"], t) for t in body},
    }
    camera = {
        "chest_girth_wd": fit(df, ["ellipse_chest", "outer_shoulder", "h", "w"], "chest_girth"),
        "chest_girth_w": fit(df, ["chest_width", "outer_shoulder", "h", "w"], "chest_girth"),
        "waist_girth_wd": fit(df, ["ellipse_waist", "h", "w"], "waist_girth"),
        "waist_girth_w": fit(df, ["waist_width", "h", "w"], "waist_girth"),
        "hip_girth_wd": fit(df, ["ellipse_hip", "h", "w"], "hip_girth"),
    }
    # Landmark heights as a fraction of stature: a tilted camera distorts these.
    raw = pd.read_csv(CSV, encoding="latin-1")
    proportions = {}
    for name, col in {"crotch": "crotchheight", "neck": "cervicaleheight", "shoulder": "acromialheight",
                      "armpit": "axillaheight", "waist": "waistheightomphalion", "chest": "chestheight"}.items():
        frac = raw[col] / raw["stature"]
        proportions[name] = {"mean": round(float(frac.mean()), 4), "sd": round(float(frac.std()), 4)}
    # For comparison only: what perfectly measured height and weight would give.
    measured = {t: fit(df, ["h_measured", "w_measured", "bmi_measured", "age"], t) for t in ("chest_girth", "waist_girth")}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "built": date.today().isoformat(),
        "source": "ANSUR II male public data, n = %d; self-reported height and weight; 10-fold CV errors" % len(df),
        "units": "cm, kg, years",
        "prior": prior,
        "camera": camera,
        "proportions": proportions,
    }, indent=1))

    print(f"ANSUR II men used: {len(df)}\n")
    print(f"{'measurement':16} {'h+w':>7} {'h+w+age':>8}   (RMSE cm, self-reported inputs)")
    for t in body:
        print(f"{t:16} {prior['hw'][t]['rmse']:7.2f} {prior['hwa'][t]['rmse']:8.2f}")
    print("\nmeasured height/weight + age:", {t: m["rmse"] for t, m in measured.items()})
    print("\ncamera formulas (caliper inputs):")
    for name, m in camera.items():
        print(f"  {name:16} RMSE {m['rmse']:.2f}  MAE {m['mae']:.2f}")
    print("\nproportions of stature:", {k: v["mean"] for k, v in proportions.items()})
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
