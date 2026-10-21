export type Units = "imperial" | "metric";

// ft/in and lb where people use them, cm and kg everywhere else.
export function defaultUnits(): Units {
  const langs = typeof navigator === "undefined" ? [] : [...(navigator.languages || []), navigator.language];
  return langs.some((l) => /-(US|LR|MM)$/i.test(l || "")) ? "imperial" : "metric";
}

export const cmToFtIn = (cm: number) => {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round((totalIn - ft * 12) * 2) / 2;
  if (inch >= 12) { ft += 1; inch -= 12; }
  return { ft, inch };
};
export const ftInToCm = (ft: number, inch: number) => (ft * 12 + inch) * 2.54;
export const kgToLb = (kg: number) => kg / 0.45359237;
export const lbToKg = (lb: number) => lb * 0.45359237;

export function formatLength(cm: number, units: Units, decimals = 1): string {
  if (units === "metric") return `${cm.toFixed(decimals)} cm`;
  return `${(cm / 2.54).toFixed(1)} in`;
}

export function formatHeight(cm: number, units: Units): string {
  if (units === "metric") return `${Math.round(cm)} cm`;
  const { ft, inch } = cmToFtIn(cm);
  return `${ft}′ ${inch}″`;
}
