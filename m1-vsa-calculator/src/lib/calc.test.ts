import { describe, it, expect } from "vitest";
import {
  computeH,
  computeVsaM1,
  computeVsaM2,
  computeVsaM4,
  computeG,
  trimLayersToDepth,
  computeTM3,
  computeVsaFromT,
  computeT,
  computeResults,
  validateLayer,
  calculateDeviation,
  isDeviationHigh,
  analyzeDeviations,
  autoConfigureDepthForPreset,
  suggestNarrowedDepth,
  generateGeotechnicalReport,
  calibrateDepthForTargetVsaM3,
  type Layer,
  type Result,
} from "./calc";

describe("M1, M2, M3 ve M4 VSA Hesaplama Fonksiyonları", () => {
  describe("computeH", () => {
    it("toplam kalınlığı doğru hesaplar", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: 10, vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      expect(computeH(layers)).toBe(30);
    });

    it("boş değerleri 0 olarak değerlendirir", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: "", vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      expect(computeH(layers)).toBe(20);
    });
  });

  describe("computeVsaM1", () => {
    it("M1 yöntemi ile Vsa hesaplar", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: 10, vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      const result = computeVsaM1(layers);
      expect(result).toBeCloseTo(397.4, 1);
    });

    it("geçersiz veriler için null döner", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: -10, vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      expect(computeVsaM1(layers)).toBeNull();
    });

    it("boş değerler için null döner", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: "", vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      expect(computeVsaM1(layers)).toBeNull();
    });
  });

  describe("computeVsaM2", () => {
    it("M2 yöntemi ile Vsa hesaplar", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: 10, vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      const result = computeVsaM2(layers);
      expect(result).toBeCloseTo(364.0, 1);
    });

    it("geçersiz veriler için null döner", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: -10, vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      expect(computeVsaM2(layers)).toBeNull();
    });

    it("boş değerler için null döner", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: "", vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      expect(computeVsaM2(layers)).toBeNull();
    });
  });

  describe("computeVsaM4", () => {
    it("M4 yöntemi ile Vsa hesaplar", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: 10, vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      const result = computeVsaM4(layers);
      expect(result).toBeCloseTo(343.0, 1);
    });

    it("tek katman için Vs değerini döner", () => {
      const layers: Layer[] = [{ id: "1", d: 10, vs: 200 }];
      expect(computeVsaM4(layers)).toBe(200);
    });

    it("geçersiz veriler için null döner", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: -10, vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      expect(computeVsaM4(layers)).toBeNull();
    });

    it("sıfır Vs için null döner", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 0 },
        { id: "2", d: 10, vs: 300 },
      ];
      expect(computeVsaM4(layers)).toBeNull();
    });
  });

  describe("computeG", () => {
    it("kayma modülünü doğru hesaplar", () => {
      const layer: Layer = { id: "1", d: 10, vs: 200, rho: 1900 };
      const result = computeG(layer, 1900);
      expect(result).toBe(1900 * 200 * 200);
    });
  });

  describe("trimLayersToDepth", () => {
    it("katmanları hedef derinliğe kadar kırpar", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: 10, vs: 300 },
        { id: "3", d: 15, vs: 600 },
      ];
      const result = trimLayersToDepth(layers, 20);
      expect(result).toHaveLength(2);
      expect(result[0].d).toBe(5);
      expect(result[1].d).toBe(10);
    });

    it("hedef derinlik profil kalınlığından büyükse tüm katmanları döner", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: 10, vs: 300 },
      ];
      const result = trimLayersToDepth(layers, 50);
      expect(result).toHaveLength(2);
      expect(result[0].d).toBe(5);
      expect(result[1].d).toBe(10);
    });

    it("hedef derinlik 0 ise boş array döner", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180 },
        { id: "2", d: 10, vs: 300 },
      ];
      const result = trimLayersToDepth(layers, 0);
      expect(result).toHaveLength(0);
    });
  });

  describe("computeTM3", () => {
    it("M3 yöntemi ile T hesaplar", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180, rho: 1900 },
        { id: "2", d: 10, vs: 300, rho: 1900 },
        { id: "3", d: 15, vs: 600, rho: 1900 },
      ];
      const result = computeTM3(layers, 1900);
      expect(result).toBeGreaterThan(0);
    });

    it("geçersiz veriler için null döner", () => {
      const layers: Layer[] = [
        { id: "1", d: -5, vs: 180, rho: 1900 },
        { id: "2", d: 10, vs: 300, rho: 1900 },
      ];
      const result = computeTM3(layers, 1900);
      expect(result).toBeNull();
    });
  });

  describe("computeVsaFromT", () => {
    it("T'den Vsa hesaplar", () => {
      const result = computeVsaFromT(30, 0.2);
      expect(result).toBe((4 * 30) / 0.2);
    });

    it("geçersiz değerler için null döner", () => {
      expect(computeVsaFromT(0, 0.2)).toBeNull();
      expect(computeVsaFromT(30, 0)).toBeNull();
      expect(computeVsaFromT(-30, 0.2)).toBeNull();
    });
  });

  describe("computeT", () => {
    it("temel zemin periyodunu hesaplar", () => {
      const result = computeT(30, 400);
      expect(result).toBe((4 * 30) / 400);
    });

    it("geçersiz değerler için null döner", () => {
      expect(computeT(0, 400)).toBeNull();
      expect(computeT(30, 0)).toBeNull();
      expect(computeT(-30, 400)).toBeNull();
    });
  });

  describe("computeResults", () => {
    it("tüm sonuçları hesaplar (M1, M2, M3 ve M4)", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180, rho: 1900 },
        { id: "2", d: 10, vs: 300, rho: 1900 },
        { id: "3", d: 15, vs: 600, rho: 1900 },
      ];
      const result = computeResults(layers, true, 1900, 30, 30, "TARGET", "MOC", "JEC");
      expect(result).not.toBeNull();
      if (result) {
        expect(result.Vsa_M1).toBeCloseTo(397.4, 1);
        expect(result.Vsa_M2).toBeCloseTo(364.0, 1);
        expect(result.Vsa_M4).toBeCloseTo(343.0, 1);
        expect(result.H_M12).toBe(30);
        expect(result.H_M3).toBe(30);
      }
    });

    it("T hesaplamadan sonuçları hesaplar", () => {
      const layers: Layer[] = [
        { id: "1", d: 5, vs: 180, rho: 1900 },
        { id: "2", d: 10, vs: 300, rho: 1900 },
        { id: "3", d: 15, vs: 600, rho: 1900 },
      ];
      const result = computeResults(layers, false, 1900, 30, 30, "TARGET", "MOC", "JEC");
      expect(result).not.toBeNull();
      if (result) {
        expect(result.T_M1).toBeNull();
        expect(result.T_M2).toBeNull();
        expect(result.T_M3).not.toBeNull(); // M3 için T her zaman hesaplanır
      }
    });
  });

  describe("validateLayer", () => {
    it("geçerli katman için hata döndürmez", () => {
      const layer: Layer = { id: "1", d: 10, vs: 200, rho: 1900 };
      const result = validateLayer(layer);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("negatif değerler için hata döndürür", () => {
      const layer: Layer = { id: "1", d: -10, vs: 200, rho: 1900 };
      const result = validateLayer(layer);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Kalınlık pozitif bir sayı olmalıdır");
    });

    it("geçersiz yoğunluk için hata döndürür", () => {
      const layer: Layer = { id: "1", d: 10, vs: 200, rho: -1900 };
      const result = validateLayer(layer);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Yoğunluk 0-5000 kg/m³ arasında olmalıdır"
      );
    });

    it("çok büyük değerler için uyarı verir", () => {
      const layer: Layer = { id: "1", d: 15000, vs: 200, rho: 1900 };
      const result = validateLayer(layer);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        "Kalınlık çok büyük (10,000 m'den fazla)"
      );
    });
  });

  describe("Jeoteknik Hesaplama Asistanı Fonksiyonları", () => {
    describe("calculateDeviation", () => {
      it("sapma yüzdesini doğru hesaplar", () => {
        expect(calculateDeviation(105, 100)).toBe(5);
        expect(calculateDeviation(95, 100)).toBe(5);
      });

      it("negatif sapma için mutlak değer döner", () => {
        expect(calculateDeviation(90, 100)).toBe(10);
      });
    });

    describe("isDeviationHigh", () => {
      it("%5'den küçük sapma için false döner", () => {
        expect(isDeviationHigh(102, 100)).toBe(false);
        expect(isDeviationHigh(98, 100)).toBe(false);
      });

      it("%5'den büyük sapma için true döner", () => {
        expect(isDeviationHigh(106, 100)).toBe(true);
        expect(isDeviationHigh(94, 100)).toBe(true);
      });
    });

    describe("analyzeDeviations", () => {
      it("sapma analizini doğru yapar (M1, M2, M3)", () => {
        const result: Result = {
          H_M12: 30,
          H_M3: 30,
          Vsa_M1: 105,
          Vsa_M2: 98,
          Vsa_M3: 102,
          Vsa_M4: 103,
          T_M1: 0.2,
          T_M2: 0.2,
          T_M3: 0.2,
        };
        const expected = { Vsa_M1: 100, Vsa_M2: 100, Vsa_M3: 100, Vsa_M4: 100 };
        const analysis = analyzeDeviations(result, expected);
        expect(analysis.deviations.M1).toBe(5);
        expect(analysis.deviations.M2).toBe(2);
        expect(analysis.deviations.M3).toBe(2);
        expect(analysis.deviations.M4).toBe(3);
        expect(analysis.highDeviations).toContain("M1: %5.0");
      });

      it("sapma analizini doğru yapar (M1, M2, M3, M4)", () => {
        const result: Result = {
          H_M12: 30,
          H_M3: 30,
          Vsa_M1: 110,
          Vsa_M2: 95,
          Vsa_M3: 105,
          Vsa_M4: 90,
          T_M1: 0.2,
          T_M2: 0.2,
          T_M3: 0.2,
        };
        const expected = { Vsa_M1: 100, Vsa_M2: 100, Vsa_M3: 100, Vsa_M4: 100 };
        const analysis = analyzeDeviations(result, expected);
        expect(analysis.highDeviations).toContain("M1: %10.0");
        expect(analysis.highDeviations).toContain("M3: %5.0");
        expect(analysis.highDeviations).toContain("M4: %10.0");
      });

      it("sapma analizini doğru yapar (M1, M2, M3, M4 - yüksek sapmalar)", () => {
        const result: Result = {
          H_M12: 30,
          H_M3: 30,
          Vsa_M1: 120,
          Vsa_M2: 80,
          Vsa_M3: 110,
          Vsa_M4: 70,
          T_M1: 0.2,
          T_M2: 0.2,
          T_M3: 0.2,
        };
        const expected = { Vsa_M1: 100, Vsa_M2: 100, Vsa_M3: 100, Vsa_M4: 100 };
        const analysis = analyzeDeviations(result, expected);
        expect(analysis.highDeviations).toContain("M1: %20.0");
        expect(analysis.highDeviations).toContain("M2: %20.0");
        expect(analysis.highDeviations).toContain("M3: %10.0");
        expect(analysis.highDeviations).toContain("M4: %30.0");
      });
    });

    describe("autoConfigureDepthForPreset", () => {
      it("VS30 preset için doğru ayarları döner", () => {
        const preset = { autoDepthMode: "VS30", autoDepthValue: 30 };
        const result = autoConfigureDepthForPreset(preset);
        expect(result.depthMode).toBe("VS30");
        expect(result.depth).toBe(30);
      });

      it("CUSTOM preset için doğru ayarları döner", () => {
        const preset = { autoDepthMode: "CUSTOM", autoDepthValue: 55 };
        const result = autoConfigureDepthForPreset(preset);
        expect(result.depthMode).toBe("CUSTOM");
        expect(result.depth).toBe(55);
      });
    });

    describe("suggestNarrowedDepth", () => {
      it("artırma yönünde derinlik önerir", () => {
        const result = suggestNarrowedDepth(30, 10, "increase");
        expect(result).toBeGreaterThan(30);
      });

      it("azaltma yönünde derinlik önerir", () => {
        const result = suggestNarrowedDepth(30, 10, "decrease");
        expect(result).toBeLessThan(30);
      });

      it("yüksek sapma için daha agresif daraltma yapar", () => {
        const result = suggestNarrowedDepth(30, 20, "decrease");
        expect(result).toBeLessThan(25);
      });
    });
  });
});
