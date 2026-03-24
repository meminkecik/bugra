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
    Vsa_M8?: number;
    Vsa_M9?: number;
    Vsa_M10?: number;
    Vsa_Ref?: number;
    Exact?: number;
  };
  defaultRho: number; // kg/m³
  autoDepthMode: "VS30" | "SITE_HS" | "CUSTOM"; // Otomatik derinlik modu
  autoDepthValue: number; // Otomatik derinlik değeri (m)
};

// M8 TEST PRESTELERİ - Vp verisi ve Exact değerleri olan istasyonlar
export const M8_TEST_PRESETS: Preset[] = [
  // --- GRUP 1: KESKİN & BOZDOĞAN (2024) REFERANS DEĞERLİ İSTASYONLAR ---
  {
    name: "● Antakya (TK.3126)",
    description:
      "Keskin & Bozdogan (2024) Table 13. Exact T=0.3254s -> Vsa ~430 m/s",
    defaultRho: 1800,
    layers: [
      { id: "1", d: 1.49, vs: 282, vp: 935, rho: 1750 },
      { id: "2", d: 1.86, vs: 287, vp: 935, rho: 1750 },
      { id: "3", d: 2.32, vs: 270, vp: 935, rho: 1750 },
      { id: "4", d: 2.91, vs: 248, vp: 935, rho: 1750 },
      { id: "5", d: 3.63, vs: 295, vp: 1117, rho: 1850 },
      { id: "6", d: 4.54, vs: 385, vp: 1544, rho: 1950 },
      { id: "7", d: 5.68, vs: 453, vp: 1544, rho: 1950 },
      { id: "8", d: 7.1, vs: 493, vp: 1544, rho: 2000 },
      { id: "9", d: 5.47, vs: 527, vp: 1544, rho: 2000 },
    ],
    expected: { Vsa_M1: 428, Vsa_M2: 407, Vsa_M3: 430, Exact: 430 },
    autoDepthMode: "SITE_HS",
    autoDepthValue: 35.0,
  },
  {
    name: "● Dulkadiroğlu (TK.4621)",
    description:
      "Keskin & Bozdogan (2024) Table 13. Exact T=0.1772s -> Vsa ~814 m/s",
    defaultRho: 2100,
    layers: [
      { id: "1", d: 2.39, vs: 698, vp: 1524, rho: 2000 },
      { id: "2", d: 2.99, vs: 717, vp: 1524, rho: 2000 },
      { id: "3", d: 3.74, vs: 683, vp: 1524, rho: 2000 },
      { id: "4", d: 4.68, vs: 601, vp: 1524, rho: 2000 },
      { id: "5", d: 5.84, vs: 620, vp: 1779, rho: 2100 },
      { id: "6", d: 7.3, vs: 835, vp: 1976, rho: 2200 },
      { id: "7", d: 9.13, vs: 1013, vp: 1976, rho: 2250 },
    ],
    expected: { Vsa_M1: 796, Vsa_M2: 780, Vsa_M3: 808, Exact: 814 },
    autoDepthMode: "SITE_HS",
    autoDepthValue: 36.07,
  },

  // --- GRUP 2: TK RAPORLARINDAN SAHA (H/V) PERİYODU OLANLAR ---
  // Not: Exact değeri = (4 * Toplam Derinlik) / (Rapordaki Hakim Periyot) formülüyle Vsa'ya çevrilmiştir.
  {
    name: "● Hatay - Altınözü (TK.3116)",
    description: "TK.3116 Raporu. Rapor T0=0.23s. Sert zemin, Vp yüksek.",
    defaultRho: 2200,
    layers: [
      { id: "1", d: 0.94, vs: 884, vp: 2782, rho: 2200 },
      { id: "2", d: 1.18, vs: 914, vp: 2782, rho: 2200 },
      { id: "3", d: 1.47, vs: 914, vp: 2821, rho: 2200 },
      { id: "4", d: 1.84, vs: 883, vp: 2821, rho: 2200 },
      { id: "5", d: 2.3, vs: 799, vp: 2821, rho: 2200 },
      { id: "6", d: 2.87, vs: 814, vp: 2821, rho: 2200 },
      { id: "7", d: 3.59, vs: 933, vp: 2821, rho: 2200 },
      { id: "8", d: 4.49, vs: 1059, vp: 2821, rho: 2300 },
      { id: "9", d: 5.61, vs: 1112, vp: 2821, rho: 2300 },
      { id: "10", d: 5.71, vs: 1047, vp: 2821, rho: 2300 },
    ],
    // H=30m, T=0.23s -> Vsa = 120/0.23 = 521 m/s
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Exact: 521 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● Hatay - Hassa (TK.3117)",
    description: "TK.3117 Raporu. Rapor T0=0.24s.",
    defaultRho: 2000,
    layers: [
      { id: "1", d: 2.89, vs: 583, vp: 1411, rho: 2000 },
      { id: "2", d: 3.62, vs: 579, vp: 1411, rho: 2000 },
      { id: "3", d: 4.51, vs: 534, vp: 1411, rho: 2000 },
      { id: "4", d: 5.65, vs: 500, vp: 1674, rho: 2100 },
      { id: "5", d: 7.06, vs: 623, vp: 1839, rho: 2200 },
      { id: "6", d: 6.27, vs: 791, vp: 1839, rho: 2200 },
    ],
    // H=30m, T=0.24s -> Vsa = 500 m/s
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Exact: 500 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● Hatay - Reyhanlı (TK.3124)",
    description: "TK.3124 Raporu. Rapor T0=0.81s (Oldukça yumuşak).",
    defaultRho: 1750,
    layers: [
      { id: "1", d: 1.06, vs: 223, vp: 657, rho: 1750 },
      { id: "2", d: 1.32, vs: 224, vp: 657, rho: 1750 },
      { id: "3", d: 1.65, vs: 211, vp: 657, rho: 1750 },
      { id: "4", d: 2.06, vs: 229, vp: 657, rho: 1800 },
      { id: "5", d: 2.58, vs: 249, vp: 712, rho: 1800 },
      { id: "6", d: 3.23, vs: 280, vp: 877, rho: 1900 },
      { id: "7", d: 4.03, vs: 311, vp: 877, rho: 1900 },
      { id: "8", d: 5.04, vs: 348, vp: 877, rho: 1900 },
      { id: "9", d: 6.3, vs: 531, vp: 877, rho: 2000 },
      { id: "10", d: 2.73, vs: 531, vp: 877, rho: 2000 },
    ],
    // H=30m, T=0.81s -> Vsa = 148 m/s (Zemin büyütmesi yüksek)
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Exact: 148 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● Malatya - Doğanşehir (TK.4405)",
    description: "TK.4405 Raporu. Rapor T0=0.13s (Çok sert zemin).",
    defaultRho: 2100,
    layers: [
      { id: "1", d: 5.59, vs: 549, vp: 1095, rho: 2000 },
      { id: "2", d: 7.0, vs: 533, vp: 1184, rho: 2000 },
      { id: "3", d: 8.74, vs: 559, vp: 1299, rho: 2100 },
      { id: "4", d: 8.67, vs: 676, vp: 1299, rho: 2100 },
    ],
    // H=30m, T=0.13s -> Vsa = 923 m/s
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Exact: 923 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● K.Maraş - Nurhak (TK.4617)",
    description: "TK.4617 Raporu. Rapor T0=0.19s.",
    defaultRho: 1900,
    layers: [
      { id: "1", d: 1.91, vs: 524, vp: 1139, rho: 1900 },
      { id: "2", d: 2.38, vs: 515, vp: 1139, rho: 1900 },
      { id: "3", d: 2.99, vs: 391, vp: 1139, rho: 1900 },
      { id: "4", d: 3.72, vs: 397, vp: 1139, rho: 1900 },
      { id: "5", d: 4.66, vs: 651, vp: 1324, rho: 2000 },
      { id: "6", d: 5.82, vs: 855, vp: 1424, rho: 2100 },
      { id: "7", d: 7.28, vs: 623, vp: 1726, rho: 2100 },
      { id: "8", d: 1.24, vs: 907, vp: 1726, rho: 2200 },
    ],
    // H=30m, T=0.19s -> Vsa = 631 m/s
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Exact: 631 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● K.Maraş - Ekinözü (TK.4620)",
    description: "TK.4620 Raporu. Rapor T0=0.21s.",
    defaultRho: 1950,
    layers: [
      { id: "1", d: 1.54, vs: 492, vp: 959, rho: 1900 },
      { id: "2", d: 1.94, vs: 493, vp: 959, rho: 1900 },
      { id: "3", d: 2.41, vs: 473, vp: 959, rho: 1900 },
      { id: "4", d: 3.02, vs: 441, vp: 964, rho: 1900 },
      { id: "5", d: 3.77, vs: 426, vp: 996, rho: 1900 },
      { id: "6", d: 4.72, vs: 451, vp: 1044, rho: 2000 },
      { id: "7", d: 5.9, vs: 515, vp: 1044, rho: 2000 },
      { id: "8", d: 6.7, vs: 551, vp: 1044, rho: 2000 },
    ],
    // H=30m, T=0.21s -> Vsa = 571 m/s
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Exact: 571 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● K.Maraş - Andırın (TK.4628)",
    description: "TK.4628 Raporu. Rapor T0=0.55s. Tabakalı yapı.",
    defaultRho: 1850,
    layers: [
      { id: "1", d: 3.56, vs: 369, vp: 1315, rho: 1850 },
      { id: "2", d: 4.44, vs: 634, vp: 1315, rho: 1950 },
      { id: "3", d: 5.56, vs: 238, vp: 1402, rho: 1800 },
      { id: "4", d: 6.95, vs: 428, vp: 1455, rho: 1900 },
      { id: "5", d: 8.69, vs: 650, vp: 1463, rho: 2000 },
      { id: "6", d: 0.8, vs: 603, vp: 1508, rho: 2000 },
    ],
    // H=30m, T=0.55s -> Vsa = 218 m/s (Yumuşak ara tabaka etkisi)
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Exact: 218 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● Kilis - Polateli (TK.7901)",
    description: "TK.7901 Raporu. Rapor T0=0.14s (Kaya).",
    defaultRho: 2100,
    layers: [
      { id: "1", d: 3.05, vs: 414, vp: 1048, rho: 2000 },
      { id: "2", d: 3.81, vs: 366, vp: 1058, rho: 2000 },
      { id: "3", d: 4.77, vs: 384, vp: 1158, rho: 2000 },
      { id: "4", d: 5.96, vs: 581, vp: 1226, rho: 2100 },
      { id: "5", d: 7.45, vs: 584, vp: 1226, rho: 2100 },
      { id: "6", d: 4.96, vs: 725, vp: 1226, rho: 2200 },
    ],
    // H=30m, T=0.14s -> Vsa = 857 m/s
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Exact: 857 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },

  // --- GRUP 3: KULLANICI EXACT DEĞERİ OLAN İSTASYONLAR ---
  {
    name: "● KRT - Kartepe (TK.0119)",
    description: "TK.0119 Raporu. Kullanıcı Exact: 664.9 m/s",
    defaultRho: 1800,
    layers: [
      { id: "1", d: 1.2, vs: 308, vp: 552, rho: 1700 },
      { id: "2", d: 1.4, vs: 193, vp: 687, rho: 1750 },
      { id: "3", d: 1.8, vs: 334, vp: 894, rho: 1800 },
      { id: "4", d: 2.2, vs: 393, vp: 996, rho: 1850 },
      { id: "5", d: 2.8, vs: 316, vp: 1263, rho: 1900 },
      { id: "6", d: 3.6, vs: 469, vp: 1436, rho: 2000 },
      { id: "7", d: 4.3, vs: 617, vp: 1896, rho: 2100 },
      { id: "8", d: 5.5, vs: 724, vp: 2333, rho: 2200 },
      { id: "9", d: 6.9, vs: 839, vp: 2435, rho: 2250 },
    ],
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Exact: 664.9 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● Yarımca (TK.0120)",
    description: "TK.0120 Raporu. Kullanıcı Exact: 474.1 m/s",
    defaultRho: 1900,
    layers: [
      { id: "1", d: 1.23, vs: 334, vp: 1232, rho: 1950 },
      { id: "2", d: 1.54, vs: 334, vp: 1232, rho: 1950 },
      { id: "3", d: 1.92, vs: 336, vp: 1232, rho: 1950 },
      { id: "4", d: 2.4, vs: 268, vp: 1271, rho: 1960 },
      { id: "5", d: 3.0, vs: 261, vp: 1295, rho: 1970 },
      { id: "6", d: 3.75, vs: 406, vp: 1572, rho: 2050 },
      { id: "7", d: 4.69, vs: 513, vp: 1621, rho: 2100 },
      { id: "8", d: 5.86, vs: 516, vp: 1621, rho: 2100 },
      { id: "9", d: 5.61, vs: 527, vp: 1621, rho: 2100 },
    ],
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Exact: 474.1 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● Malatya - Yeşilyurt (TK.4408)",
    description: "TK.4408 Raporu. Yüksek Vp değerleri.",
    defaultRho: 2100,
    layers: [
      { id: "1", d: 2.1, vs: 597, vp: 1234, rho: 2000 },
      { id: "2", d: 2.7, vs: 487, vp: 1573, rho: 2150 },
      { id: "3", d: 3.3, vs: 408, vp: 1916, rho: 2200 },
      { id: "4", d: 4.1, vs: 490, vp: 2089, rho: 2300 },
      { id: "5", d: 5.2, vs: 752, vp: 2161, rho: 2350 },
      { id: "6", d: 6.5, vs: 885, vp: 2201, rho: 2400 },
      { id: "7", d: 6.1, vs: 1011, vp: 2282, rho: 2450 },
    ],
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● K.Maraş - Pazarcık (TK.4610)",
    description: "TK.4610 Raporu. 2023 Depremi merkez üssü.",
    defaultRho: 1900,
    layers: [
      { id: "1", d: 1.8, vs: 240, vp: 424, rho: 1700 },
      { id: "2", d: 2.2, vs: 216, vp: 465, rho: 1800 },
      { id: "3", d: 2.8, vs: 230, vp: 528, rho: 1900 },
      { id: "4", d: 3.5, vs: 268, vp: 613, rho: 2000 },
      { id: "5", d: 4.3, vs: 273, vp: 722, rho: 2100 },
      { id: "6", d: 5.5, vs: 364, vp: 857, rho: 2200 },
      { id: "7", d: 6.8, vs: 446, vp: 1017, rho: 2250 },
      { id: "8", d: 3.1, vs: 501, vp: 1192, rho: 2300 },
    ],
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
  {
    name: "● Osmaniye - Bahçe (TK.8002)",
    description: "TK.8002 Raporu. Düşük Vs başlangıcı.",
    defaultRho: 1850,
    layers: [
      { id: "1", d: 1.4, vs: 256, vp: 820, rho: 1850 },
      { id: "2", d: 1.7, vs: 183, vp: 849, rho: 1850 },
      { id: "3", d: 2.2, vs: 352, vp: 886, rho: 1900 },
      { id: "4", d: 2.7, vs: 308, vp: 926, rho: 1900 },
      { id: "5", d: 3.3, vs: 471, vp: 965, rho: 1950 },
      { id: "6", d: 4.2, vs: 457, vp: 1006, rho: 2000 },
      { id: "7", d: 5.3, vs: 504, vp: 1052, rho: 2000 },
      { id: "8", d: 6.6, vs: 684, vp: 1096, rho: 2100 },
      { id: "9", d: 2.6, vs: 725, vp: 1133, rho: 2200 },
    ],
    expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0 },
    autoDepthMode: "VS30",
    autoDepthValue: 30,
  },
];

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
      { id: "12", d: 4.79, vs: 385.88, rho: 2.01 },
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
];

export const PRESETS: Preset[] = [
  ...M8_TEST_PRESETS,
  ...PAPER_PRESETS,
  ...LOCAL_PRESETS,
];
