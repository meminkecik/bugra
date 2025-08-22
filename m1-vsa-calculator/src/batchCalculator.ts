// src/batchCalculator.ts
import { PRESETS } from "./presets";
import { computeResults } from "./lib/calc";

export type BatchResult = {
  preset: string;
  Vsa: {
    M1: number;
    M2: number;
    M3: number;
    M4: number;
    M5: number | null;
    M6: number | null;
    M7: number | null;
  };
  expected: {
    M1: number;
    M2: number;
    M3: number;
    M4?: number;
    M5?: number;
    M6?: number;
    M7?: number;
  };
  diff: {
    M1: string;
    M2: string;
    M3: string;
    M4: string;
    M5: string;
    M6: string;
    M7: string;
  };
  H_used: number;
  depths: {
    M1M2: string;
    M3: string;
  };
};

export type BatchOutput = {
  meta: {
    timestamp: string;
    rho_default: number;
    m1m2_depth: string;
    m3_depth_mode: string;
  };
  results: BatchResult[];
};

export function calculateAllPresets(showT: boolean = false): BatchOutput {
  const timestamp = new Date().toISOString();
  const results: BatchResult[] = [];

  for (const preset of PRESETS) {
    // M1/M2 için tam profil, M3 için VS30 (30m)
    const result = computeResults(
      preset.layers,
      showT,
      preset.defaultRho,
      Number.POSITIVE_INFINITY, // M1/M2: tam profil
      30, // M3: VS30
      "TARGET", "MOC"
    );

    if (result) {
      const batchResult: BatchResult = {
        preset: preset.name,
        Vsa: {
          M1: result.Vsa_M1,
          M2: result.Vsa_M2,
          M3: result.Vsa_M3,
          M4: result.Vsa_M4,
          M5: result.Vsa_M5,
          M6: result.Vsa_M6,
          M7: result.Vsa_M7,
        },
        expected: {
          M1: preset.expected.Vsa_M1,
          M2: preset.expected.Vsa_M2,
          M3: preset.expected.Vsa_M3,
          M4: preset.expected.Vsa_M4,
          M5: preset.expected.Vsa_M5,
          M6: preset.expected.Vsa_M6,
          M7: preset.expected.Vsa_M7,
        },
        diff: {
          M1: formatDiff(result.Vsa_M1, preset.expected.Vsa_M1),
          M2: formatDiff(result.Vsa_M2, preset.expected.Vsa_M2),
          M3: formatDiff(result.Vsa_M3, preset.expected.Vsa_M3),
          M4: formatDiff(result.Vsa_M4, preset.expected.Vsa_M4),
          M5: formatDiff(result.Vsa_M5, preset.expected.Vsa_M5),
          M6: formatDiff(result.Vsa_M6, preset.expected.Vsa_M6),
          M7: formatDiff(result.Vsa_M7, preset.expected.Vsa_M7),
        },
        H_used: result.H_M12,
        depths: {
          M1M2: `${result.H_M12.toFixed(1)}m (tam profil)`,
           M3: `${result.H_M3.toFixed(1)}m (VS30)`,
        },
      };
      results.push(batchResult);
    }
  }

  return {
    meta: {
      timestamp,
      rho_default: 1900,
      m1m2_depth: "tam profil",
      m3_depth_mode: "VS30 (30m)",
    },
    results,
  };
}

function formatDiff(
  calculated: number | null,
  expected: number | undefined
): string {
  if (calculated == null || expected == undefined) return "—";
  const diff = ((calculated - expected) / expected) * 100;
  return `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`;
}

export function formatResultsForDisplay(batchOutput: BatchOutput): string {
  return JSON.stringify(batchOutput, null, 2);
}

export function formatResultsAsTable(batchOutput: BatchOutput): string {
  let table = "Preset\tM1\tM2\tM3\tM4\tM5\tM6\tM7\tH_used\tM3_Depth\n";

  for (const result of batchOutput.results) {
    table += `${result.preset}\t`;
    table += `${result.Vsa.M1.toFixed(1)}\t`;
    table += `${result.Vsa.M2.toFixed(1)}\t`;
    table += `${result.Vsa.M3.toFixed(1)}\t`;
    table += `${result.Vsa.M4.toFixed(1)}\t`;
    table += `${result.Vsa.M5?.toFixed(1) || "—"}\t`;
    table += `${result.Vsa.M6?.toFixed(1) || "—"}\t`;
    table += `${result.Vsa.M7?.toFixed(1) || "—"}\t`;
    table += `${result.H_used.toFixed(1)}\t`;
    table += `${result.depths.M3}\n`;
  }

  return table;
}
