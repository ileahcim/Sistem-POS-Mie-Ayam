// Thermal head tuning: how dark and how sharp the printer burns the paper.
// The Blueprint ECO80D prints normal text crisply but bold / double-size text
// came out smeared, and the factory heating values are the usual suspect, so
// they are sent at the start of every print job and the owner can change them
// from Pengaturan without a code change. Pure data + validation, shared by the
// ESC/POS builder, the settings action and the settings form.
//
// Commands (Zjiang-style thermal firmware; documented, but NOT guaranteed on
// every printer — a printer that does not know one prints its parameter bytes
// as stray characters, which the Tes Ketajaman makes visible):
//   ESC 7 n1 n2 n3   n1 = max heating dots, in units of 8 (n1=7 → 64 dots
//                    fired at once); n2 = heating time, units of 10 µs (80 →
//                    800 µs); n3 = heating interval, units of 10 µs (2 → 20 µs)
//   DC2 # n          n bits 0-4 = print density (50% + 5% × n, n = 0..31)
//                    (bits 5-7 = break time, ×250 µs — left at 0 here)

import type { PrintTuning } from "./types";

export const NO_TUNING: PrintTuning = { density: null, heatDots: null, heatTime: null, heatInterval: null };

// ESC 7 always carries all three parameters, so when only some are set the
// rest fall back to these documented factory values.
export const HEAT_DEFAULTS = { heatDots: 7, heatTime: 80, heatInterval: 2 } as const;

export const PRINT_TUNING_LIMITS: Record<keyof PrintTuning, { min: number; max: number }> = {
  density: { min: 0, max: 31 },
  heatDots: { min: 0, max: 255 },
  heatTime: { min: 0, max: 255 },
  heatInterval: { min: 0, max: 255 },
};

// Shown in Pengaturan: what each field is called, which command it feeds and
// what the printer does when the field is left empty.
export const PRINT_TUNING_FIELDS: {
  key: keyof PrintTuning;
  label: string;
  command: string;
  placeholder: string;
}[] = [
  { key: "density", label: "Kepekatan", command: "DC2 # · 0-31", placeholder: "bawaan" },
  { key: "heatTime", label: "Lama pemanasan", command: "ESC 7 · 0-255 (× 10 µs)", placeholder: String(HEAT_DEFAULTS.heatTime) },
  { key: "heatDots", label: "Titik pemanas", command: "ESC 7 · 0-255 (× 8 titik)", placeholder: String(HEAT_DEFAULTS.heatDots) },
  { key: "heatInterval", label: "Jeda pemanasan", command: "ESC 7 · 0-255 (× 10 µs)", placeholder: String(HEAT_DEFAULTS.heatInterval) },
];

// Error message for the first bad field, or null when every set field is an
// integer inside its range. Empty (null) fields are always fine.
export function validatePrintTuning(tuning: PrintTuning): string | null {
  for (const field of PRINT_TUNING_FIELDS) {
    const value = tuning[field.key];
    if (value == null) continue;
    const { min, max } = PRINT_TUNING_LIMITS[field.key];
    if (!Number.isInteger(value) || value < min || value > max) {
      return `${field.label} harus bilangan bulat ${min}-${max}, atau dikosongkan.`;
    }
  }
  return null;
}
