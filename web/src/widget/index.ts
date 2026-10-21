// Drop-in entry point: createSizeFinder() mounts the popup once; open(garment) shows it.
import "@fontsource-variable/figtree";
import "./widget.css";
import { mount } from "svelte";
import SizeFinder from "./SizeFinder.svelte";
import { finder } from "./state.svelte.ts";
import type { Garment, Recommendation } from "../core/sizing.ts";

export interface SizeFinderOptions {
  base?: string; // where body_model.json and calibration.json are served
  onResult?: (size: string, rec: Recommendation) => void;
}

export async function createSizeFinder(opts: SizeFinderOptions = {}) {
  const base = opts.base ?? "/";
  const [model, calibration] = await Promise.all([
    fetch(`${base}body_model.json`).then((r) => r.json()),
    fetch(`${base}calibration.json`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
  ]);
  finder.model = model;
  finder.calibration = calibration;
  finder.onResult = opts.onResult ?? null;
  const host = document.createElement("div");
  host.id = "seam-size-finder";
  document.body.appendChild(host);
  mount(SizeFinder, { target: host });
  return {
    open(garment: Garment) {
      finder.reset(garment);
      finder.open = true;
    },
    close() { finder.close(); },
  };
}

export type { Garment, Recommendation };
