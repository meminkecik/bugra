// src/presets.ts
import type { Layer } from "./lib/calc";

export type Preset = {
  name: string;
  layers: Layer[];
  expected: {
    Vsa_M1: number;
    Vsa_M2: number;
    Vsa_M3: number;
    Vsa_M4?: number;
    Vsa_M5?: number;
    Vsa_M6?: number;
    Vsa_M7?: number;
  };
  defaultRho: number; // kg/m³
  autoDepthMode: "VS30" | "CUSTOM"; // Otomatik derinlik modu
  autoDepthValue: number; // Otomatik derinlik değeri (m)
};

export const PRESETS: Preset[] = [
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
    },
    defaultRho: 1900,
    autoDepthMode: "VS30",
    autoDepthValue: 30.0,
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
    autoDepthMode: "CUSTOM",
    autoDepthValue: 27.0,
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
    autoDepthMode: "CUSTOM",
    autoDepthValue: 55.0,
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
    autoDepthMode: "VS30",
    autoDepthValue: 30.0,
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
    autoDepthMode: "VS30",
    autoDepthValue: 30.0,
  },
];
