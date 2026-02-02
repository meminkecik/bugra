import { describe, expect, it } from "vitest";
import { PAPER_PRESETS } from "./presets";
import { computeResults } from "./lib/calc";

function pctDiff(calc: number, exp: number): number {
  return Math.abs((calc - exp) / exp) * 100;
}

describe("Exact method verification (Keskin & Bozdogan 2024 Table 14)", () => {
  const MAX_DIFF_PCT = 0.5;

  for (const preset of PAPER_PRESETS) {
    it(`${preset.name}: Exact within ${MAX_DIFF_PCT}%`, () => {
      const expExact = preset.expected.Exact;
      expect(expExact).toBeTypeOf("number");

      const result = computeResults(
        preset.layers,
        preset.defaultRho,
        Number.POSITIVE_INFINITY,
        Number.POSITIVE_INFINITY,
        "TOTAL",
        "MOC"
      );

      expect(result, "computeResults returned null").not.toBeNull();
      expect(result!.Vsa_Exact, "Vsa_Exact is null").not.toBeNull();

      const d = pctDiff(result!.Vsa_Exact as number, expExact as number);
      expect(
        d,
        `Exact mismatch for ${preset.name}: calc=${(result!.Vsa_Exact as number).toFixed(
          3
        )}, exp=${(expExact as number).toFixed(3)}, diff=${d.toFixed(3)}%`
      ).toBeLessThanOrEqual(MAX_DIFF_PCT);
    });
  }
});

