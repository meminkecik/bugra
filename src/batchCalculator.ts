// src/batchCalculator.ts
import { PRESETS } from "./presets";
import { computeResults } from "./lib/calc";

export type BatchResult = {
  preset: string;
  depthUsed: string; // Hangi derinliğin kullanıldığı bilgisi
  Vsa: {
    M1: number;
    M2: number;
    M3: number;
    M4: number;
    M5: number;
    M6: number;
    M7: number;
    Exact: number;
  };
  // Beklenen değerler (Makale verileriyle karşılaştırma için)
  expected?: {
    M1: number;
    M2: number;
    M3: number;
    M4?: number;
    M5?: number;
    M6?: number;
    M7?: number;
    Exact?: number;
  };
  // Fark analizi
  diff?: {
    M1: string;
    M2: string;
    M3: string;
    M4: string;
    M5: string;
    M6: string;
    M7: string;
    Exact: string;
  };
};

/**
 * Toplu Hesaplama Fonksiyonu
 * @param targetDepth - Eğer sayı verilirse (örn: 30), hesaplamalar o derinlik için yapılır.
 * Eğer undefined/null verilirse, tüm profil derinliği kullanılır (Makale Modu).
 */
export function calculateAllPresets(targetDepth?: number): {
  results: BatchResult[];
} {
  const results: BatchResult[] = [];
  const isCustomDepth = typeof targetDepth === "number" && targetDepth > 0;

  for (const preset of PRESETS) {
    // Derinlik Modu Ayarları
    const depthToUse = isCustomDepth ? targetDepth : Number.POSITIVE_INFINITY;
    const m3Mode = isCustomDepth ? "TARGET" : "TOTAL";

    // Hesaplama
    // Exact metodu artık "Modified Finite Element Transfer Matrix Method" (Eq 25) kullanır.
    const result = computeResults(
      preset.layers,
      preset.defaultRho || 1900,
      depthToUse, 
      depthToUse, 
      m3Mode, 
      "MOC" // M3 sütunu için standart Meksika formülü
    );

    if (result) {
      const resVsa = {
        M1: result.Vsa_M1,
        M2: result.Vsa_M2,
        M3: result.Vsa_M3,
        M4: result.Vsa_M4,
        M5: result.Vsa_M5 ?? 0,
        M6: result.Vsa_M6 ?? 0,
        M7: result.Vsa_M7 ?? 0,
        Exact: result.Vsa_Exact ?? 0,
      };

      // Beklenen değerleri preset'ten al (Sadece tam profil modunda)
      const exp = !isCustomDepth ? preset.expected : undefined;

      const batchResult: BatchResult = {
        preset: preset.name,
        depthUsed: `${result.H_used.toFixed(1)}m`,
        Vsa: resVsa,
      };

      // Fark Hesaplama
      if (exp) {
        batchResult.expected = {
          M1: exp.Vsa_M1,
          M2: exp.Vsa_M2,
          M3: exp.Vsa_M3,
          M4: exp.Vsa_M4,
          M5: exp.Vsa_M5,
          M6: exp.Vsa_M6,
          M7: exp.Vsa_M7,
          Exact: exp.Exact,
        };
        batchResult.diff = {
          M1: formatDiff(resVsa.M1, exp.Vsa_M1),
          M2: formatDiff(resVsa.M2, exp.Vsa_M2),
          M3: formatDiff(resVsa.M3, exp.Vsa_M3),
          M4: formatDiff(resVsa.M4, exp.Vsa_M4),
          M5: formatDiff(resVsa.M5, exp.Vsa_M5),
          M6: formatDiff(resVsa.M6, exp.Vsa_M6),
          M7: formatDiff(resVsa.M7, exp.Vsa_M7),
          Exact: formatDiff(resVsa.Exact, exp.Exact),
        };
      }

      results.push(batchResult);
    }
  }
  return { results };
}

function formatDiff(calc: number, exp: number | undefined): string {
  if (exp === undefined) return "-";
  // Yüzdelik sapma: (Hesaplanan - Beklenen) / Beklenen
  const d = ((calc - exp) / exp) * 100;
  return `${d > 0 ? "+" : ""}${d.toFixed(1)}%`;
}

export function printTable(data: { results: BatchResult[] }) {
  console.log(
    "Preset".padEnd(12) +
      "Depth".padEnd(8) +
      "M1".padEnd(8) +
      "M2".padEnd(8) +
      "M3".padEnd(8) +
      "M7".padEnd(8) +
      "Exact".padEnd(8) +
      (data.results[0]?.diff ? "Diff(Exact)" : "")
  );
  console.log("-".repeat(95));

  data.results.forEach((r) => {
    let line =
      r.preset.slice(0, 10).padEnd(12) +
      r.depthUsed.padEnd(8) +
      r.Vsa.M1.toFixed(1).padEnd(8) +
      r.Vsa.M2.toFixed(1).padEnd(8) +
      r.Vsa.M3.toFixed(1).padEnd(8) +
      r.Vsa.M7.toFixed(1).padEnd(8) +
      r.Vsa.Exact.toFixed(1).padEnd(8);

    if (r.diff) {
      // Exact metodun sapması (Kodun doğruluğunu kontrol için 0'a yakın olmalı)
      line += ` (Ex:${r.diff.Exact})`;
    }

    console.log(line);
  });
}