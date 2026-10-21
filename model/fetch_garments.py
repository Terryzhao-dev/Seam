"""Fetch published garment + body size charts and write Seam garment files.

Source: the JSON API that Uniqlo US product pages call for their size charts.
Raw responses are cached in data/garments/raw/; output goes to web/public/garments/.
Run: .venv/bin/python fetch_garments.py
"""

import json
import ssl
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "garments" / "raw"
OUT = ROOT / "web" / "public" / "garments"
try:
    import certifi
    SSL = ssl.create_default_context(cafile=certifi.where())
except ImportError:  # python.org builds ship without root certificates
    SSL = ssl.create_default_context()

API = "https://www.uniqlo.com/us/api/commerce/v5/en/products/size-charts?productIdsWithColorCode={pid}-{colour}&includeBodyMeasurements=true"

PRODUCTS = [
    {
        "id": "uniqlo-supima-tee",
        "pid": "E455365-000", "colours": ["00", "09", "01"],
        "name": "SUPIMA Cotton T-Shirt",
        "url": "https://www.uniqlo.com/us/en/products/E455365-000/00",
        "fit": "regular", "fabric": "100% Supima cotton jersey, no stretch", "sleeve": "short", "shoulder": "set-in",
        "price": 19.90,
    },
    {
        "id": "uniqlo-soft-brushed-ls",
        "pid": "E450179-000", "colours": ["01", "00", "09"],
        "name": "Soft Brushed T-Shirt | Long Sleeve",
        "url": "https://www.uniqlo.com/us/en/products/E450179-000/00",
        "fit": "regular", "fabric": "100% cotton, brushed inside, ribbed cuffs, no stretch", "sleeve": "long", "shoulder": "set-in",
        "price": 24.90,
    },
]

# Uniqlo part codes -> Seam points of measure (cm).
POM = {"body-length-back": "length_back", "shoulder-width": "shoulder_width", "body-width": "chest_flat", "sleeve-length-cb": "sleeve_cb"}
BODY = {"nude-chest": "chest", "nude-waist": "waist"}


def fetch(product):
    RAW.mkdir(parents=True, exist_ok=True)
    cache = RAW / f"{product['pid']}.json"
    for colour in product["colours"]:
        url = API.format(pid=product["pid"], colour=colour)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30, context=SSL) as r:
                data = json.load(r)
            if data.get("status") == "ok" and data.get("result"):
                cache.write_text(json.dumps(data, indent=1))
                return data, url
        except Exception as e:  # network hiccups: try the next colour, then the cache
            print(f"  {product['pid']}-{colour}: {e}")
    if cache.exists():
        print(f"  using cached {cache.name}")
        return json.loads(cache.read_text()), "cache"
    raise SystemExit(f"could not fetch {product['pid']}")


def cm(part):
    return next(m["value"] for m in part["measurements"] if m["unit"] == "cm")


def convert(product, data, source):
    result = data["result"][0]
    body = {}
    for entry in result.get("bodyMeasurements", []):
        ranges = {}
        for part in entry["sizeParts"]:
            if part["code"] in BODY:
                lo, hi = (float(x) for x in cm(part).split("-"))
                ranges[BODY[part["code"]]] = [lo, hi]
        body[entry["name"]] = ranges
    sizes = []
    for entry in result["sizeChart"]:
        row = {"size": entry["name"]}
        for part in entry["sizeParts"]:
            if part["code"] in POM:
                row[POM[part["code"]]] = float(cm(part))
        row["body"] = body.get(entry["name"], {})
        sizes.append(row)
    return {
        "id": product["id"],
        "brand": "Uniqlo",
        "name": product["name"],
        "product_id": product["pid"],
        "url": product["url"],
        "source": "Uniqlo US size-chart API" if source != "cache" else "Uniqlo US size-chart API (cached)",
        "fetched": date.today().isoformat(),
        "price": product["price"],
        "fit": product["fit"],
        "fabric": product["fabric"],
        "sleeve": product["sleeve"],
        "shoulder": product["shoulder"],
        "measured": {
            "length_back": "centre back of the neck to the hem",
            "shoulder_width": "seam to seam",
            "chest_flat": "armpit to armpit, laid flat (x 2 = girth)",
            "sleeve_cb": "centre back of the collar to the sleeve edge",
        },
        "tolerance_cm": 1.0,
        "sizes": sizes,
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for product in PRODUCTS:
        data, source = fetch(product)
        garment = convert(product, data, source)
        (OUT / f"{product['id']}.json").write_text(json.dumps(garment, indent=1))
        sizes = ", ".join(f"{s['size']} {s.get('chest_flat')}" for s in garment["sizes"])
        print(f"{product['id']}: {len(garment['sizes'])} sizes (chest flat: {sizes})")


if __name__ == "__main__":
    main()
