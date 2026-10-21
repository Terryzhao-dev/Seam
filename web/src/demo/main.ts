import "./demo.css";
import { createSizeFinder, type Garment } from "../widget/index.ts";

const $ = (id: string) => document.getElementById(id)!;
const load = (id: string): Promise<Garment> => fetch(`/garments/${id}.json`).then((r) => r.json());

const products = {
  tee: await load("uniqlo-supima-tee"),
  ls: await load("uniqlo-soft-brushed-ls"),
};
let current: keyof typeof products = "tee";
const recommended: Partial<Record<keyof typeof products, string>> = {};

const finder = await createSizeFinder({
  onResult(size) {
    recommended[current] = size;
    render();
  },
});

// Flat-lay illustration instead of product photos.
function photo(sleeve: "short" | "long") {
  const body = sleeve === "long"
    ? "M90,30 Q120,50 150,30 L188,44 L214,150 L190,158 L166,86 L166,252 L74,252 L74,86 L50,158 L26,150 L52,44 Z"
    : "M90,30 Q120,50 150,30 L188,44 L222,96 L190,112 L166,86 L166,252 L74,252 L74,86 L50,112 L18,96 L52,44 Z";
  return `<svg viewBox="0 0 240 280" aria-hidden="true"><path d="${body}" fill="#e3e3df" stroke="#d6d6d2" stroke-width="1.5" stroke-linejoin="round"/><path d="M90,30 Q120,50 150,30" fill="none" stroke="#cfcfcb" stroke-width="3"/></svg>`;
}

function render() {
  const g = products[current];
  $("tabs").innerHTML = (Object.keys(products) as (keyof typeof products)[])
    .map((k) => `<button data-k="${k}" class="${k === current ? "on" : ""}">${products[k].sleeve === "long" ? "Long sleeve" : "T-shirt"}</button>`).join("");
  $("tabs").querySelectorAll("button").forEach((b) => (b.onclick = () => { current = (b as HTMLElement).dataset.k as keyof typeof products; render(); }));
  $("photo").innerHTML = photo(g.sleeve);
  $("name").textContent = `${g.name} (demo)`;
  $("price").textContent = `$${(g.price as number).toFixed(2)}`;
  $("meta").textContent = `${g.fit[0].toUpperCase() + g.fit.slice(1)} fit · ${g.fabric}`;
  const rec = recommended[current];
  $("sizes").innerHTML = g.sizes.map((s) => `<button class="${s.size === rec ? "rec" : ""}">${s.size}</button>`).join("");
  const ys = $("yourSize");
  ys.hidden = !rec;
  if (rec) ys.innerHTML = `Seam recommends <b>${rec}</b> for you.`;
  $("chartTable").innerHTML = `<tr><th>Size</th><th>Length (back)</th><th>Shoulder</th><th>Chest (flat)</th><th>Sleeve (centre back)</th></tr>` +
    g.sizes.map((s) => `<tr><td>${s.size}</td><td>${s.length_back}</td><td>${s.shoulder_width}</td><td>${s.chest_flat}</td><td>${s.sleeve_cb}</td></tr>`).join("");
  $("source").textContent = `Source: ${g.source}, ${g.url}`;
}

$("find").onclick = () => finder.open(products[current]);
$("chartBtn").onclick = () => ($("chart") as HTMLDialogElement).showModal();
render();
