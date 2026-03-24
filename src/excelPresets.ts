// src/excelPresets.ts
import * as XLSX from "xlsx";
import type { Layer, Preset } from "./presets";

type ParsedProfile = {
  key: string;
  city: string;
  district: string;
  stationCode: string;
  method: string;
  layers: Layer[];
};

type HeaderMap = {
  city: number;
  district: number;
  stationCode: number;
  method: number;
  depthStart: number;
  depthEnd: number;
  vs: number;
  vp?: number;
};

function normalizeText(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stationCodeToString(value: unknown): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return `TK.${Math.trunc(numeric).toString().padStart(4, "0")}`;
  }

  if (/^tk\./i.test(raw)) return raw.toUpperCase();
  return raw;
}

function profileKey(
  city: string,
  district: string,
  stationCode: string,
  method: string,
): string {
  return [
    normalizeText(city),
    normalizeText(district),
    normalizeText(stationCode),
    normalizeText(method),
  ].join("|");
}

function findHeaderMap(rows: unknown[][]): HeaderMap | null {
  for (let r = 0; r < Math.min(rows.length, 10); r++) {
    const row = rows[r];
    if (!row) continue;

    const map: Partial<HeaderMap> = {};

    for (let c = 0; c < row.length; c++) {
      const header = normalizeText(row[c]);
      if (!header) continue;

      if ((header === "il" || header.includes("city")) && map.city == null) {
        map.city = c;
      }
      if (
        (header.includes("ilce") || header.includes("district")) &&
        map.district == null
      ) {
        map.district = c;
      }
      if (
        (header.includes("istasyon") || header.includes("station")) &&
        map.stationCode == null
      ) {
        map.stationCode = c;
      }
      if (
        (header.includes("yontem") || header.includes("method")) &&
        map.method == null
      ) {
        map.method = c;
      }
      if (
        header.includes("derinlik") &&
        (header.includes("bas") ||
          header.includes("start") ||
          header.includes("top")) &&
        map.depthStart == null
      ) {
        map.depthStart = c;
      }
      if (
        header.includes("derinlik") &&
        (header.includes("son") ||
          header.includes("end") ||
          header.includes("bottom")) &&
        map.depthEnd == null
      ) {
        map.depthEnd = c;
      }
      if (header === "vs" && map.vs == null) {
        map.vs = c;
      }
      if (header === "vp" && map.vp == null) {
        map.vp = c;
      }
    }

    if (
      map.city != null &&
      map.district != null &&
      map.stationCode != null &&
      map.method != null &&
      map.depthStart != null &&
      map.depthEnd != null &&
      map.vs != null
    ) {
      return map as HeaderMap;
    }
  }

  return null;
}

function parseWorkbookProfiles(
  workbook: XLSX.WorkBook,
  includeVp: boolean,
): Map<string, ParsedProfile> {
  const profiles = new Map<string, ParsedProfile>();

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
    }) as unknown[][];
    if (!rows.length) continue;

    const headers = findHeaderMap(rows);
    if (!headers) continue;

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;

      const city = String(row[headers.city] ?? "").trim();
      const district = String(row[headers.district] ?? "").trim();
      const stationCode = stationCodeToString(row[headers.stationCode]);
      const method =
        String(row[headers.method] ?? "MOC")
          .trim()
          .toUpperCase() || "MOC";

      const depthStart = Number(row[headers.depthStart]);
      const depthEnd = Number(row[headers.depthEnd]);
      const vs = Number(row[headers.vs]);

      if (
        !stationCode ||
        !Number.isFinite(depthStart) ||
        !Number.isFinite(depthEnd) ||
        !Number.isFinite(vs) ||
        depthEnd <= depthStart ||
        vs <= 0
      ) {
        continue;
      }

      const key = profileKey(city, district, stationCode, method);
      const layer: Layer = {
        id: "0",
        d: depthEnd - depthStart,
        vs,
        rho: "",
      };

      if (includeVp && headers.vp != null) {
        const vp = Number(row[headers.vp]);
        if (Number.isFinite(vp) && vp > 0) {
          layer.vp = vp;
        }
      }

      if (!profiles.has(key)) {
        profiles.set(key, {
          key,
          city,
          district,
          stationCode,
          method,
          layers: [],
        });
      }

      profiles.get(key)!.layers.push(layer);
    }
  }

  for (const profile of profiles.values()) {
    profile.layers = profile.layers.map((layer, idx) => ({
      ...layer,
      id: String(idx + 1),
    }));
  }

  return profiles;
}

function mergeVpIntoBaseProfiles(
  baseProfiles: Map<string, ParsedProfile>,
  vpProfiles: Map<string, ParsedProfile>,
): Preset[] {
  const presets: Preset[] = [];

  for (const [key, baseProfile] of baseProfiles) {
    const vpProfile = vpProfiles.get(key);

    const mergedLayers: Layer[] = baseProfile.layers.map((baseLayer, idx) => {
      const vpLayerByIndex = vpProfile?.layers[idx];
      let mergedVp: number | "" | undefined = undefined;

      if (
        vpLayerByIndex &&
        typeof vpLayerByIndex.vp === "number" &&
        vpLayerByIndex.vp > 0
      ) {
        mergedVp = vpLayerByIndex.vp;
      } else if (vpProfile) {
        const byDepthAndVs = vpProfile.layers.find((candidate) => {
          if (
            typeof candidate.d !== "number" ||
            typeof candidate.vs !== "number" ||
            typeof baseLayer.d !== "number" ||
            typeof baseLayer.vs !== "number"
          ) {
            return false;
          }
          return (
            Math.abs(candidate.d - baseLayer.d) < 0.01 &&
            Math.abs(candidate.vs - baseLayer.vs) < 0.5
          );
        });

        if (
          byDepthAndVs &&
          typeof byDepthAndVs.vp === "number" &&
          byDepthAndVs.vp > 0
        ) {
          mergedVp = byDepthAndVs.vp;
        }
      }

      return {
        ...baseLayer,
        id: String(idx + 1),
        ...(mergedVp ? { vp: mergedVp } : {}),
      };
    });

    const hasAnyVp = mergedLayers.some(
      (layer) => typeof layer.vp === "number" && layer.vp > 0,
    );
    const display =
      `${baseProfile.city} - ${baseProfile.district} - ${baseProfile.stationCode}`
        .replace(/\s+-\s+-\s+/g, " - ")
        .replace(/\s+-\s+$/g, "")
        .trim();

    presets.push({
      name: `${display} (${baseProfile.method})`,
      description: hasAnyVp
        ? "Vp: son_alt_yeni.xlsx ile eşleşen istasyondan aktarıldı"
        : "Vp değeri son_alt_yeni.xlsx içinde bulunamadı",
      layers: mergedLayers,
      expected: { Vsa_M1: 0, Vsa_M2: 0, Vsa_M3: 0, Vsa_M4: 0 },
      defaultRho: 1900,
      autoDepthMode: "VS30",
      autoDepthValue: 30.0,
    });
  }

  return presets;
}

/**
 * Proje içindeki son_alt.xlsx dosyasından preset'leri oluşturur
 * Dropdown'da (Örnek profili seç) gösterilir.
 */
export async function loadExcelPresets(): Promise<Preset[]> {
  try {
    const [baseResponse, vpResponse] = await Promise.all([
      fetch("/son_alt.xlsx"),
      fetch("/son_alt_yeni.xlsx"),
    ]);

    if (!baseResponse.ok) {
      throw new Error(`son_alt.xlsx yüklenemedi: ${baseResponse.status}`);
    }
    if (!vpResponse.ok) {
      throw new Error(`son_alt_yeni.xlsx yüklenemedi: ${vpResponse.status}`);
    }

    const [baseBuffer, vpBuffer] = await Promise.all([
      baseResponse.arrayBuffer(),
      vpResponse.arrayBuffer(),
    ]);

    const baseWorkbook = XLSX.read(baseBuffer, { type: "array" });
    const vpWorkbook = XLSX.read(vpBuffer, { type: "array" });

    const baseProfiles = parseWorkbookProfiles(baseWorkbook, false);
    const vpProfiles = parseWorkbookProfiles(vpWorkbook, true);

    return mergeVpIntoBaseProfiles(baseProfiles, vpProfiles);
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
