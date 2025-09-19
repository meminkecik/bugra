// src/excelPresets.ts
import * as XLSX from "xlsx";
import type { Layer, Preset } from "./presets";

/**
 * Proje içindeki son_alt.xlsx dosyasından preset'leri oluşturur
 * Dropdown'da (Örnek profili seç) gösterilir.
 */
export async function loadExcelPresets(): Promise<Preset[]> {
  try {
    // Excel dosyasını fetch ile oku (public/ altında olmalı)
    const response = await fetch("/son_alt.xlsx");
    if (!response.ok) {
      throw new Error(`Excel dosyası yüklenemedi: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const presets: Preset[] = [];

    // Her sayfayı (her şehri) dolaş
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
      }) as unknown[][];

      if (jsonData.length < 2) return;

      // Header sütunlarını tespit et
      let headerRowIndex = -1;
      let nameColIndex = -1;
      let methodColIndex = -1;
      let cityColIndex = -1;
      let districtColIndex = -1;
      let depthStartColIndex = -1;
      let depthEndColIndex = -1;
      let vsColIndex = -1;

      for (let r = 0; r < Math.min(jsonData.length, 15); r++) {
        const row = jsonData[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (typeof cell !== "string") continue;
          const s = cell.toLowerCase().trim();
          if (
            (s.includes("isim") ||
              s.includes("ad") ||
              s.includes("istasyon") ||
              s.includes("lokasyon") ||
              s.includes("name") ||
              s.includes("station") ||
              s.includes("location")) &&
            nameColIndex === -1
          ) {
            headerRowIndex = r;
            nameColIndex = c;
          }
          if (
            (s.includes("yöntem") ||
              s.includes("method") ||
              s.includes("tip") ||
              s.includes("type")) &&
            methodColIndex === -1
          ) {
            methodColIndex = c;
          }
          if (
            (s.includes("il") || s.includes("şehir") || s.includes("city")) &&
            cityColIndex === -1
          ) {
            cityColIndex = c;
          }
          if (
            (s.includes("ilçe") ||
              s.includes("county") ||
              s.includes("district")) &&
            districtColIndex === -1
          ) {
            districtColIndex = c;
          }
          if (
            s.includes("derinlik") &&
            (s.includes("baş") ||
              s.includes("üst") ||
              s.includes("from") ||
              s.includes("start") ||
              s.includes("top")) &&
            depthStartColIndex === -1
          ) {
            depthStartColIndex = c;
          }
          if (
            s.includes("derinlik") &&
            (s.includes("son") ||
              s.includes("alt") ||
              s.includes("to") ||
              s.includes("end") ||
              s.includes("bottom")) &&
            depthEndColIndex === -1
          ) {
            depthEndColIndex = c;
          }
          if (
            (s.includes("vs") ||
              s.includes("hız") ||
              s.includes("velocity") ||
              s.includes("speed") ||
              s === "v") &&
            vsColIndex === -1
          ) {
            vsColIndex = c;
          }
        }
        if (
          nameColIndex !== -1 &&
          depthStartColIndex !== -1 &&
          depthEndColIndex !== -1 &&
          vsColIndex !== -1
        )
          break;
      }

      if (headerRowIndex === -1) return;

      // Sıralı gruplama ile ölçümleri oluştur
      let currentName = "";
      let currentMethod = "MOC";
      let currentCity = sheetName;
      let currentDistrict = "";
      let layerIdCounter = 1;
      let currentLayers: Layer[] = [];

      const finalize = () => {
        if (currentLayers.length === 0) return;
        const baseName = currentName || "İstasyon";
        const display = `${currentCity} - ${currentDistrict} - ${baseName}`
          .replace(/ -  - /g, " - ")
          .replace(/ - $/, "");
        presets.push({
          name: `${display} (${currentMethod})`,
          layers: [...currentLayers],
          expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Vsa_M4: 0 },
          defaultRho: 1900,
          autoDepthMode: "VS30",
          autoDepthValue: 30.0,
        });
        currentLayers = [];
        layerIdCounter = 1;
      };

      for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
        const row = jsonData[r];
        if (!row) continue;
        const name = nameColIndex !== -1 ? row[nameColIndex] : null;
        const method = methodColIndex !== -1 ? row[methodColIndex] : null;
        const city = cityColIndex !== -1 ? row[cityColIndex] : null;
        const district = districtColIndex !== -1 ? row[districtColIndex] : null;
        const depthStart =
          depthStartColIndex !== -1 ? row[depthStartColIndex] : null;
        const depthEnd = depthEndColIndex !== -1 ? row[depthEndColIndex] : null;
        const vs = vsColIndex !== -1 ? row[vsColIndex] : null;

        const nextName = typeof name === "string" ? name.trim() : "";
        const nextMethod =
          typeof method === "string" ? method.trim().toUpperCase() : "";
        const nextCity = typeof city === "string" ? city.trim() : "";
        const nextDistrict =
          typeof district === "string" ? district.trim() : "";

        const headerPresent =
          !!nextName || !!nextMethod || !!nextCity || !!nextDistrict;
        const headerChanged =
          (nextName && nextName !== currentName) ||
          (nextMethod && nextMethod !== currentMethod) ||
          (nextCity && nextCity !== currentCity) ||
          (nextDistrict && nextDistrict !== currentDistrict);

        if (headerPresent && headerChanged) {
          finalize();
          if (nextName) currentName = nextName;
          if (nextMethod) currentMethod = nextMethod || currentMethod;
          if (nextCity) currentCity = nextCity;
          if (nextDistrict) currentDistrict = nextDistrict;
        } else if (headerPresent && currentLayers.length === 0) {
          if (nextName) currentName = nextName;
          if (nextMethod) currentMethod = nextMethod || currentMethod;
          if (nextCity) currentCity = nextCity;
          if (nextDistrict) currentDistrict = nextDistrict;
        }

        if (depthStart != null && depthEnd != null && vs != null) {
          const d1 = parseFloat(String(depthStart));
          const d2 = parseFloat(String(depthEnd));
          const v = parseFloat(String(vs));
          if (!isNaN(d1) && !isNaN(d2) && !isNaN(v) && v > 0 && d2 > d1) {
            currentLayers.push({
              id: (layerIdCounter++).toString(),
              d: d2 - d1,
              vs: v,
              rho: "",
            });
          }
        } else {
          const isRowEmpty =
            !nextName &&
            !nextMethod &&
            !nextCity &&
            !nextDistrict &&
            !depthStart &&
            !depthEnd &&
            !vs;
          if (isRowEmpty && currentLayers.length > 0) finalize();
        }
      }

      finalize();
    });

    return presets;
  } catch (error) {
    console.error("Excel dosyası okunurken hata oluştu:", error);
    return [];
  }
}

/**
 * Excel preset'lerini mevcut preset'lerle birleştirir
 */
export async function getCombinedPresets(): Promise<Preset[]> {
  const excelPresets = await loadExcelPresets();
  const { PRESETS } = await import("./presets");

  // Excel preset'lerini başa ekle
  return [...excelPresets, ...PRESETS];
}
