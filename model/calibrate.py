"""Calibrate the camera from sessions with tape measurements.

Input:  data/sessions/*.json, downloaded from the popup's debug panel (?debug=1) after
        entering tape values (and optionally the drape check with a tee you own).
Output: web/public/calibration.json, which the popup reads on load.

What it fits (honest about what one person can and can't tell us):
  - Scale first: camera numbers are scaled by the typed height, so they are rescaled by
    measured height / typed height before anything else.
  - Direct offsets where the tape measures the same thing as the camera: outer shoulder,
    shoulder joints vs bone-to-bone shoulder, back-of-neck height, crotch height.
  - Chest and waist: the tape measures girth, the camera measures width and depth. One shared
    extra offset per region is solved so that width and depth reproduce the tape girth
    (through the ANSUR girth-from-width-and-depth relation).
  - Drape allowance for tee length, from the "wear a known tee" check.
  Noise (sd) is left at its default until there are several different people: repeat scans
  of one person show repeatability, not how wrong the camera is across bodies.

Run: .venv/bin/python calibrate.py [--dry-run]
"""

import json
import math
import re
import sys
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SESSIONS = ROOT / "data" / "sessions"
OUT = ROOT / "web" / "public" / "calibration.json"
BODYMODEL_TS = ROOT / "web" / "src" / "core" / "bodymodel.ts"
ANSUR = ROOT / "data" / "ansur" / "ANSUR_II_MALE_Public.csv"

# camera reading -> tape field measuring the same thing
DIRECT = {"outer_shoulder": "outer_shoulder", "joint_shoulder": "bony_shoulder", "neck_height": "neck_height", "crotch_height": "crotch_height"}
REGIONS = {"chest": ("chest_width", "chest_depth", "chest_girth"), "waist": ("waist_width", "waist_depth", "waist_girth")}


def default_links():
    """Read CAMERA_LINKS from bodymodel.ts so defaults live in one place."""
    src = BODYMODEL_TS.read_text()
    links = {}
    for m in re.finditer(r'\{ camera: "(\w+)", body: "(\w+)", offset: (-?[\d.]+), sd: ([\d.]+) \}', src):
        links[m.group(1)] = {"body": m.group(2), "offset": float(m.group(3)), "sd": float(m.group(4))}
    if not links:
        raise SystemExit("could not read CAMERA_LINKS from bodymodel.ts")
    return links


def ellipse(w, d):
    a, b = w / 2, d / 2
    return math.pi * (3 * (a + b) - math.sqrt((3 * a + b) * (a + 3 * b)))


def girth_relations():
    """ANSUR: girth ≈ k × ellipse(width, depth) + c, per region (caliper data)."""
    raw = pd.read_csv(ANSUR, encoding="latin-1")
    out = {}
    for region, (wc, dc, gc) in {"chest": ("chestbreadth", "chestdepth", "chestcircumference"),
                                 "waist": ("waistbreadth", "waistdepth", "waistcircumference")}.items():
        e = np.array([ellipse(w / 10, d / 10) for w, d in zip(raw[wc], raw[dc])])
        g = raw[gc].to_numpy() / 10
        k, c = np.polyfit(e, g, 1)
        out[region] = (float(k), float(c))
    return out


def num(v):
    try:
        x = float(v)
        return x if math.isfinite(x) else None
    except (TypeError, ValueError):
        return None


def load_sessions():
    rows = []
    for path in sorted(SESSIONS.glob("*.json")):
        s = json.loads(path.read_text())
        readings = (s.get("scan") or {}).get("readings") or {}
        tape = {k: num(v) for k, v in (s.get("tape") or {}).items()}
        typed = num((s.get("inputs") or {}).get("height_cm"))
        if not readings or not typed:
            print(f"  skip {path.name}: no scan readings or typed height")
            continue
        scale = (tape.get("stature") or typed) / typed  # undo a wrong typed height
        cam = {k: v * scale for k, v in readings.items() if num(v) is not None}
        rows.append({"file": path.name, "cam": cam, "tape": tape, "scale": scale, "drape": num((s.get("wearCalibration") or {}).get("drapeK"))})
    return rows


def solve_shared_offset(w, d, target, k, c):
    """Extra offset x (cm) so that k·ellipse(w − x, d − x) + c = target (bisection)."""
    f = lambda x: k * ellipse(max(w - x, 1), max(d - x, 1)) + c - target
    lo, hi = -15.0, 15.0
    if f(lo) * f(hi) > 0:
        return None
    for _ in range(60):
        mid = (lo + hi) / 2
        if f(lo) * f(mid) <= 0:
            hi = mid
        else:
            lo = mid
    return (lo + hi) / 2


def main():
    global SESSIONS, OUT
    dry = "--dry-run" in sys.argv
    if "--sessions" in sys.argv:
        SESSIONS = Path(sys.argv[sys.argv.index("--sessions") + 1])
    if "--out" in sys.argv:
        OUT = Path(sys.argv[sys.argv.index("--out") + 1])
    links = default_links()
    rows = load_sessions()
    if not rows:
        raise SystemExit(f"no usable sessions in {SESSIONS} (download them from ?debug=1 after entering tape values)")
    print(f"sessions: {len(rows)}")
    camera = {}
    report = []

    for cam_key, tape_key in DIRECT.items():
        diffs = [r["cam"][cam_key] - r["tape"][tape_key] for r in rows if cam_key in r["cam"] and r["tape"].get(tape_key) is not None]
        if not diffs:
            continue
        offset = float(np.mean(diffs))
        camera[cam_key] = {"offset": round(offset, 2), "sd": links[cam_key]["sd"]}
        report.append((cam_key, links[cam_key]["offset"], offset, len(diffs), float(np.std(diffs)) if len(diffs) > 1 else None))

    rel = girth_relations()
    for region, (wk, dk, gk) in REGIONS.items():
        k, c = rel[region]
        extras = []
        for r in rows:
            w, d, g = r["cam"].get(wk), r["cam"].get(dk), r["tape"].get(gk)
            if None in (w, d, g):
                continue
            x = solve_shared_offset(w - links[wk]["offset"], d - links[dk]["offset"], g, k, c)
            if x is not None:
                extras.append(x)
        if extras:
            x = float(np.mean(extras))
            for key in (wk, dk):
                camera[key] = {"offset": round(links[key]["offset"] + x, 2), "sd": links[key]["sd"]}
                report.append((key, links[key]["offset"], links[key]["offset"] + x, len(extras), float(np.std(extras)) if len(extras) > 1 else None))

    drapes = [r["drape"] for r in rows if r["drape"] is not None]
    current = json.loads(OUT.read_text()) if OUT.exists() else {}
    drape_k = round(float(np.mean(drapes)), 1) if drapes else current.get("drapeK", 5)

    print(f"\n{'reading':16} {'default':>8} {'calibrated':>11} {'n':>3} {'spread':>7}")
    for key, old, new, n, sd in report:
        print(f"{key:16} {old:8.2f} {new:11.2f} {n:3d} {('%.2f' % sd) if sd is not None else '-':>7}")
    print(f"drape allowance: {drape_k} cm ({len(drapes)} measurement(s); default 5)")
    print(f"typed-height scale corrections: {[round(r['scale'], 4) for r in rows]}")

    result = {
        "built": date.today().isoformat(),
        "sessions": len(rows),
        "note": "Offsets from tape measurements (one person: offsets only, noise left at defaults). Rebuild with model/calibrate.py.",
        "camera": camera,
        "drapeK": drape_k,
    }
    if dry:
        print("\n(dry run, nothing written)")
    else:
        OUT.write_text(json.dumps(result, indent=1))
        print(f"\nwrote {OUT}")


if __name__ == "__main__":
    main()
