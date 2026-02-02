// src/presets.ts
import type { Layer } from "./lib/calc";

export type { Layer };
export type Preset = {
  name: string;
  description?: string;
  layers: Layer[];
  expected: {
    Vsa_M1: number;
    Vsa_M2: number;
    Vsa_M3: number;
    Vsa_M4?: number;
    Vsa_M5?: number;
    Vsa_M6?: number;
    Vsa_M7?: number;
    Exact?: number;
  };
  defaultRho: number; // kg/m³
  autoDepthMode: "VS30" | "SITE_HS" | "CUSTOM"; // Otomatik derinlik modu
  autoDepthValue: number; // Otomatik derinlik değeri (m)
};

export const PAPER_PRESETS: Preset[] = [
  {
    name: "Yoshida",
    description: "Keskin & Bozdogan (2024) — Table 2 deep profile (H=380m)",
    defaultRho: 1900,
    layers: [
      { id: "1", d: 2, vs: 107 },
      { id: "2", d: 2, vs: 176 },
      { id: "3", d: 2.5, vs: 201 },
      { id: "4", d: 2.5, vs: 193 },
      { id: "5", d: 6.5, vs: 239 },
      { id: "6", d: 6.5, vs: 234 },
      { id: "7", d: 10, vs: 248 },
      { id: "8", d: 8, vs: 309 },
      { id: "9", d: 10, vs: 378 },
      { id: "10", d: 130, vs: 379 },
      { id: "11", d: 180, vs: 690 },
      { id: "12", d: 20, vs: 1100 },
    ],
    expected: {
      Vsa_M1: 590,
      Vsa_M2: 550,
      Vsa_M3: 674,
      Vsa_M4: 563,
      Vsa_M5: 461,
      Vsa_M6: 596,
      Vsa_M7: 587,
      Exact: 605,
    },
    autoDepthMode: "SITE_HS",
    autoDepthValue: 380,
  },
  {
    name: "Ozkan",
    description: "Keskin & Bozdogan (2024) — Table 3 (H=35.5m)",
    defaultRho: 1900,
    layers: [
      { id: "1", d: 7, vs: 120 },
      { id: "2", d: 1.5, vs: 150 },
      { id: "3", d: 4, vs: 250 },
      { id: "4", d: 5, vs: 370 },
      { id: "5", d: 18, vs: 500 },
    ],
    expected: {
      Vsa_M1: 397,
      Vsa_M2: 364,
      Vsa_M3: 381,
      Vsa_M4: 343,
      Vsa_M5: 265,
      Vsa_M6: 362,
      Vsa_M7: 382,
      Exact: 378,
    },
    autoDepthMode: "SITE_HS",
    autoDepthValue: 35.5,
  },
  {
    name: "Vijendra",
    description: "Keskin & Bozdogan (2024) — Table 6 (H≈100m; rho varies)",
    defaultRho: 1900,
    // Not: rho değerleri tabloda t/m³ verilmiş olabilir; `calc.ts` 50'den küçükse kg/m³'e çevirir.
    layers: [
      { id: "1", d: 2.5, vs: 175.26, rho: 1.93 },
      { id: "2", d: 5.52, vs: 133.5, rho: 1.93 },
      { id: "3", d: 4.69, vs: 178.0, rho: 1.93 },
      { id: "4", d: 5.61, vs: 178.0, rho: 1.77 },
      { id: "5", d: 3.05, vs: 207.26, rho: 1.77 },
      { id: "6", d: 7.47, vs: 164.59, rho: 1.77 },
      { id: "7", d: 4.72, vs: 317.3, rho: 1.83 },
      { id: "8", d: 11.06, vs: 267.31, rho: 1.83 },
      { id: "9", d: 19.11, vs: 267.31, rho: 2.06 },
      { id: "10", d: 11.28, vs: 267.31, rho: 1.85 },
      { id: "11", d: 8.23, vs: 385.88, rho: 1.85 },
      { id: "12", d: 4.79, vs: 385.88, rho: 2.01 }
    ],
    expected: {
      Vsa_M1: 266,
      Vsa_M2: 255,
      Vsa_M3: 292,
      Vsa_M4: 267,
      Vsa_M5: 233,
      Vsa_M6: 283,
      Vsa_M7: 278,
      Exact: 279,
    },
    autoDepthMode: "SITE_HS",
    autoDepthValue: 100.0,
  },
  {
    name: "Gullu",
    description: "Keskin & Bozdogan (2024) — Table 8 Example 7 (H=165m)",
    defaultRho: 1900,
    layers: [
      { id: "1", d: 5, vs: 180 },
      { id: "2", d: 13, vs: 200 },
      { id: "3", d: 36, vs: 360 },
      { id: "4", d: 38, vs: 400 },
      { id: "5", d: 38, vs: 440 },
      { id: "6", d: 35, vs: 460 },
    ],
    expected: {
      Vsa_M1: 398,
      Vsa_M2: 391,
      Vsa_M3: 476,
      Vsa_M4: 419,
      Vsa_M5: 366,
      Vsa_M6: 442,
      Vsa_M7: 429,
      Exact: 431,
    },
    autoDepthMode: "SITE_HS",
    autoDepthValue: 165,
  },
];

export const LOCAL_PRESETS: Preset[] = [
  {
    name: "Özkan",
    layers: [
      { id: "1", d: 7, vs: 120 },
      { id: "2", d: 1.5, vs: 150 },
      { id: "3", d: 4, vs: 250 },
      { id: "4", d: 5, vs: 370 },
      { id: "5", d: 18, vs: 500 },
    ],
    expected: {
      Vsa_M1: 397,
      Vsa_M2: 364,
      Vsa_M3: 381,
      Vsa_M4: 343,
      Vsa_M5: 265,
      Vsa_M6: 362,
      Vsa_M7: 382,
      Exact: 378,
    },
    defaultRho: 1900,
    autoDepthMode: "SITE_HS",
    autoDepthValue: 35.5,
  },
  {
    name: "Takabatake",
    layers: [
      { id: "1", d: 15, vs: 146.6 },
      { id: "2", d: 2, vs: 166.6 },
      { id: "3", d: 4, vs: 305.2 },
      { id: "4", d: 2, vs: 342.2 },
      { id: "5", d: 6, vs: 472.9 },
    ],
    expected: {
      Vsa_M1: 283,
      Vsa_M2: 251,
      Vsa_M3: 225,
      Vsa_M4: 226,
      Vsa_M5: 199,
      Vsa_M6: 236,
      Vsa_M7: 226,
    },
    defaultRho: 1900,
    autoDepthMode: "SITE_HS",
    autoDepthValue: 29.0,
  },
  {
    name: "Hasanoğlu",
    layers: [
      { id: "1", d: 3.5, vs: 140 },
      { id: "2", d: 8.5, vs: 140 },
      { id: "3", d: 9, vs: 200 },
      { id: "4", d: 16, vs: 200 },
      { id: "5", d: 23, vs: 375 },
      { id: "6", d: 25, vs: 500 },
    ],
    expected: {
      Vsa_M1: 352,
      Vsa_M2: 324,
      Vsa_M3: 367,
      Vsa_M4: 322,
      Vsa_M5: 262,
      Vsa_M6: 346,
      Vsa_M7: 343,
    },
    defaultRho: 1900,
    autoDepthMode: "SITE_HS",
    autoDepthValue: 85.0,
  },
  {
    name: "Antakya (3126)",
    layers: [
      { id: "1", d: 1.08, vs: 313 },
      { id: "2", d: 1.35, vs: 317 },
      { id: "3", d: 1.69, vs: 312 },
      { id: "4", d: 2.11, vs: 294 },
      { id: "5", d: 2.63, vs: 275 },
      { id: "6", d: 3.3, vs: 284 },
      { id: "7", d: 4.11, vs: 335 },
      { id: "8", d: 5.15, vs: 382 },
      { id: "9", d: 6.44, vs: 424 },
      { id: "10", d: 6.96, vs: 650 },
    ],
    expected: {
      Vsa_M1: 428,
      Vsa_M2: 407,
      Vsa_M3: 430,
      Vsa_M4: 417,
      Vsa_M5: 374,
      Vsa_M6: 432,
      Vsa_M7: 427,
    },
    defaultRho: 1900,
    autoDepthMode: "SITE_HS",
    autoDepthValue: 34.82,
  },
  {
    name: "Dulkadiroğlu (4621)",
    layers: [
      { id: "1", d: 2.39, vs: 698 },
      { id: "2", d: 2.99, vs: 717 },
      { id: "3", d: 3.74, vs: 683 },
      { id: "4", d: 4.68, vs: 601 },
      { id: "5", d: 5.84, vs: 620 },
      { id: "6", d: 7.3, vs: 835 },
      { id: "7", d: 9.13, vs: 1013 },
    ],
    expected: {
      Vsa_M1: 796,
      Vsa_M2: 780,
      Vsa_M3: 808,
      Vsa_M4: 801,
      Vsa_M5: 751,
      Vsa_M6: 837,
      Vsa_M7: 810,
    },
    defaultRho: 1900,
    autoDepthMode: "SITE_HS",
    autoDepthValue: 36.07,
  },
];

export const PRESETS: Preset[] = [...PAPER_PRESETS, ...LOCAL_PRESETS];
