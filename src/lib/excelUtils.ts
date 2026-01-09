import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { Layer, Result } from "./calc";

export interface ExcelData {
  measurements: ExcelMeasurement[];
  defaultRho: number;
  targetDepth: number;
  depthMode: string;
}

export interface ExcelMeasurement {
  id: string;
  name: string;
  method: string; // Yöntem (MOC, Rayleigh, Exact vb.)
  layers: Layer[];
  expectedResults?: {
    Vsa_M1?: number;
    Vsa_M2?: number;
    Vsa_M3?: number;
    Vsa_M4?: number;
    Vsa_M5?: number;
    Vsa_M6?: number;
    Vsa_M7?: number;
  };
}

/**
 * 'son_alt.xlsx' formatındaki Excel dosyasından verileri okur.
 * Bu format yöntem sütunu içerir ve her ölçüm için hangi yöntem kullanılacağını belirtir.
 */
export function readExcelFile(file: File): Promise<ExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const measurements: ExcelMeasurement[] = [];
        const defaultRho = 1900;
        const targetDepth = 30;
        const depthMode = "SITE_HS";
        let measurementIdCounter = 1;

        // Kitaptaki her bir sayfayı dolaş
        workbook.SheetNames.forEach((sheetName) => {
          console.log(`📋 Sayfa işleniyor: ${sheetName}`);
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
          }) as unknown[][];

          console.log(
            `   📊 Sayfa ${sheetName} - Toplam satır sayısı: ${jsonData.length}`
          );
          if (jsonData.length < 2) {
            console.log(
              `   ⚠️  Sayfa ${sheetName} atlandı - Yetersiz veri (${jsonData.length} satır)`
            );
            return;
          }

          // Mevcut yaklaşım: Header arma ve sonra veri okuma
          let headerFound = false;
          let measurements_found_this_sheet = 0;

          // İlk olarak klasik header arama yaklaşımını dene
          let headerRowIndex = -1;
          let nameColIndex = -1;
          let cityColIndex = -1;
          let districtColIndex = -1;
          let methodColIndex = -1;
          let depthStartColIndex = -1;
          let depthEndColIndex = -1;
          let vsColIndex = -1;

          // Header satırını ara
          for (
            let rowIndex = 0;
            rowIndex < Math.min(jsonData.length, 15);
            rowIndex++
          ) {
            const row = jsonData[rowIndex];
            if (!row) continue;

            for (let colIndex = 0; colIndex < row.length; colIndex++) {
              const cell = row[colIndex];
              if (typeof cell === "string") {
                const cellLower = cell.toLowerCase().trim();

                if (
                  (cellLower.includes("isim") ||
                    cellLower.includes("ad") ||
                    cellLower.includes("istasyon") ||
                    cellLower.includes("lokasyon") ||
                    cellLower.includes("name") ||
                    cellLower.includes("station") ||
                    cellLower.includes("location") ||
                    cellLower.includes("ölçüm") ||
                    cellLower.includes("measurement")) &&
                  nameColIndex === -1
                ) {
                  headerRowIndex = rowIndex;
                  nameColIndex = colIndex;
                }
                // Şehir/İl sütunu
                if (
                  (cellLower.includes("il") ||
                    cellLower.includes("şehir") ||
                    cellLower.includes("city")) &&
                  cityColIndex === -1
                ) {
                  cityColIndex = colIndex;
                }
                // İlçe/County sütunu
                if (
                  (cellLower.includes("ilçe") ||
                    cellLower.includes("county") ||
                    cellLower.includes("district")) &&
                  districtColIndex === -1
                ) {
                  districtColIndex = colIndex;
                }
                if (
                  (cellLower.includes("yöntem") ||
                    cellLower.includes("method") ||
                    cellLower.includes("tip") ||
                    cellLower.includes("type") ||
                    cellLower.includes("formül") ||
                    cellLower.includes("formula")) &&
                  methodColIndex === -1
                ) {
                  methodColIndex = colIndex;
                }
                if (
                  (cellLower.includes("derinlik") &&
                    (cellLower.includes("baş") ||
                      cellLower.includes("üst") ||
                      cellLower.includes("top") ||
                      cellLower.includes("from") ||
                      cellLower.includes("start"))) ||
                  (cellLower.includes("depth") &&
                    (cellLower.includes("from") ||
                      cellLower.includes("start") ||
                      cellLower.includes("top")) &&
                    depthStartColIndex === -1)
                ) {
                  depthStartColIndex = colIndex;
                }
                if (
                  (cellLower.includes("derinlik") &&
                    (cellLower.includes("son") ||
                      cellLower.includes("alt") ||
                      cellLower.includes("bottom") ||
                      cellLower.includes("to") ||
                      cellLower.includes("end"))) ||
                  (cellLower.includes("depth") &&
                    (cellLower.includes("to") ||
                      cellLower.includes("end") ||
                      cellLower.includes("bottom")) &&
                    depthEndColIndex === -1)
                ) {
                  depthEndColIndex = colIndex;
                }
                if (
                  (cellLower.includes("vs") ||
                    cellLower.includes("hız") ||
                    cellLower.includes("velocity") ||
                    cellLower.includes("speed") ||
                    cellLower.includes("v ") ||
                    cellLower === "v" ||
                    cellLower.includes("shear")) &&
                  vsColIndex === -1
                ) {
                  vsColIndex = colIndex;
                }
              }
            }

            // Tüm gerekli sütunlar bulunduysa aramayı durdur (yöntem sütunu opsiyonel)
            if (
              nameColIndex !== -1 &&
              depthStartColIndex !== -1 &&
              depthEndColIndex !== -1 &&
              vsColIndex !== -1
            ) {
              headerFound = true;
              break;
            }
          }

          // Header bulunduysa klasik yaklaşımı kullan
          if (headerFound && headerRowIndex !== -1) {
            console.log(
              `   ✅ Header bulundu: satır ${headerRowIndex}, sütunlar: name=${nameColIndex}, method=${methodColIndex}, depthStart=${depthStartColIndex}, depthEnd=${depthEndColIndex}, vs=${vsColIndex}`
            );

            // YENİ YAKLAŞIM: Her satırı ayrı ayrı kontrol et, potansiyel ölçüm kombinasyonlarını ara
            const allPotentialMeasurements: Array<{
              name: string; // istasyon/ad
              method: string;
              city: string;
              district: string;
              rowIndex: number;
            }> = [];

            // Önce tüm potansiyel ölçüm isimlerini ve yöntemlerini topla
            for (
              let dataRowIndex = headerRowIndex + 1;
              dataRowIndex < jsonData.length;
              dataRowIndex++
            ) {
              const row = jsonData[dataRowIndex];
              if (!row) continue;

              const name = row[nameColIndex];
              const method = methodColIndex !== -1 ? row[methodColIndex] : null;
              const city = cityColIndex !== -1 ? row[cityColIndex] : null;
              const district =
                districtColIndex !== -1 ? row[districtColIndex] : null;

              if (
                name &&
                typeof name === "string" &&
                name.toString().trim() !== ""
              ) {
                const cleanName = name.toString().trim();
                const cleanMethod =
                  method && typeof method === "string"
                    ? method.toString().trim().toUpperCase()
                    : "MOC";
                const cleanCity =
                  city && typeof city === "string"
                    ? city.toString().trim()
                    : "";
                const cleanDistrict =
                  district && typeof district === "string"
                    ? district.toString().trim()
                    : "";

                // Bu isim-yöntem kombinasyonu daha önce var mı kontrol et
                const existingCombination = allPotentialMeasurements.find(
                  (m) =>
                    m.name === cleanName &&
                    m.method === cleanMethod &&
                    m.city === cleanCity &&
                    m.district === cleanDistrict
                );

                if (!existingCombination) {
                  allPotentialMeasurements.push({
                    name: cleanName,
                    method: cleanMethod,
                    city: cleanCity,
                    district: cleanDistrict,
                    rowIndex: dataRowIndex,
                  });
                  console.log(
                    `   🔍 Potansiyel ölçüm bulundu: ${cleanCity} - ${cleanDistrict} - "${cleanName}" - Yöntem: "${cleanMethod}"`
                  );
                }
              }
            }

            console.log(
              `   📋 ${allPotentialMeasurements.length} potansiyel ölçüm kombinasyonu bulundu`
            );

            // Fallback: Çok az kombinasyon bulunduysa (ör. 0-1) sırayla gruplayarak ölçüm çıkar
            if (allPotentialMeasurements.length <= 1) {
              console.log(
                "   ℹ️ Potansiyel kombinasyon sayısı yetersiz, sıralı gruplama parser'ı kullanılıyor"
              );
              let currentName = "";
              let currentMethod = "MOC";
              let currentCity = sheetName;
              let currentDistrict = "";
              let currentLayers: Layer[] = [];
              let layerIdCounter = 1;

              const finalizeCurrent = () => {
                if (currentLayers.length === 0) return;
                const displayNameBase = `${currentCity} - ${currentDistrict} - ${
                  currentName || "İstasyon"
                }`;
                const safeDisplayName = displayNameBase
                  .replace(/ -  - /g, " - ")
                  .replace(/ - $/, "");
                measurements.push({
                  id: `measurement-${measurementIdCounter++}`,
                  name: safeDisplayName,
                  method: currentMethod,
                  layers: [...currentLayers],
                  expectedResults: {
                    Vsa_M1: 0,
                    Vsa_M2: 0,
                    Vsa_M3: 0,
                    Vsa_M4: 0,
                  },
                });
                measurements_found_this_sheet++;
                console.log(
                  `   ✅ (Seq) Ölçüm kaydedildi: "${safeDisplayName}" - ${currentLayers.length} katman - Yöntem: ${currentMethod}`
                );
                currentLayers = [];
                layerIdCounter = 1;
              };

              for (
                let dataRowIndex = headerRowIndex + 1;
                dataRowIndex < jsonData.length;
                dataRowIndex++
              ) {
                const row = jsonData[dataRowIndex];
                if (!row) continue;

                const name = row[nameColIndex];
                const method =
                  methodColIndex !== -1 ? row[methodColIndex] : null;
                const city = cityColIndex !== -1 ? row[cityColIndex] : null;
                const district =
                  districtColIndex !== -1 ? row[districtColIndex] : null;
                const depthStart =
                  depthStartColIndex !== -1 ? row[depthStartColIndex] : null;
                const depthEnd =
                  depthEndColIndex !== -1 ? row[depthEndColIndex] : null;
                const vs = vsColIndex !== -1 ? row[vsColIndex] : null;

                const nextName =
                  name && typeof name === "string"
                    ? name.toString().trim()
                    : "";
                const nextMethod =
                  method && typeof method === "string"
                    ? method.toString().trim().toUpperCase()
                    : "";
                const nextCity =
                  city && typeof city === "string"
                    ? city.toString().trim()
                    : "";
                const nextDistrict =
                  district && typeof district === "string"
                    ? district.toString().trim()
                    : "";

                const headerPresent =
                  !!nextName || !!nextMethod || !!nextCity || !!nextDistrict;
                const headerChanged =
                  (nextName && nextName !== currentName) ||
                  (nextMethod && nextMethod !== currentMethod) ||
                  (nextCity && nextCity !== currentCity) ||
                  (nextDistrict && nextDistrict !== currentDistrict);

                // Başlık göründü ve değiştiyse: yeni bloğa geç
                if (headerPresent && headerChanged) {
                  finalizeCurrent();
                  if (nextName) currentName = nextName;
                  if (nextMethod) currentMethod = nextMethod || currentMethod;
                  if (nextCity) currentCity = nextCity;
                  if (nextDistrict) currentDistrict = nextDistrict;
                } else if (headerPresent && currentLayers.length === 0) {
                  // İlk bloğun başlığı
                  if (nextName) currentName = nextName;
                  if (nextMethod) currentMethod = nextMethod || currentMethod;
                  if (nextCity) currentCity = nextCity;
                  if (nextDistrict) currentDistrict = nextDistrict;
                }

                // Katman ekle
                if (depthStart != null && depthEnd != null && vs != null) {
                  const depthStartNum = parseFloat(String(depthStart));
                  const depthEndNum = parseFloat(String(depthEnd));
                  const vsNum = parseFloat(String(vs));
                  if (
                    !isNaN(depthStartNum) &&
                    !isNaN(depthEndNum) &&
                    !isNaN(vsNum) &&
                    vsNum > 0 &&
                    depthEndNum > depthStartNum
                  ) {
                    currentLayers.push({
                      id: (layerIdCounter++).toString(),
                      d: depthEndNum - depthStartNum,
                      vs: vsNum,
                      rho: "",
                    });
                  }
                } else {
                  // Tamamen boş satır ve katman var ise finalize et
                  const isRowEmpty =
                    !nextName &&
                    !nextMethod &&
                    !nextCity &&
                    !nextDistrict &&
                    !depthStart &&
                    !depthEnd &&
                    !vs;
                  if (isRowEmpty && currentLayers.length > 0) {
                    finalizeCurrent();
                  }
                }
              }

              // Son bloğu finalize et
              finalizeCurrent();
            } else {
              // Şimdi her potansiyel ölçüm için katman verilerini topla
              for (const potentialMeasurement of allPotentialMeasurements) {
                const layers: Layer[] = [];
                let layerIdCounter = 1;

                // Bu ölçüm için tüm satırlarda katman verisi ara
                for (
                  let dataRowIndex = headerRowIndex + 1;
                  dataRowIndex < jsonData.length;
                  dataRowIndex++
                ) {
                  const row = jsonData[dataRowIndex];
                  if (!row) continue;

                  const name = row[nameColIndex];
                  const method =
                    methodColIndex !== -1 ? row[methodColIndex] : null;
                  const city = cityColIndex !== -1 ? row[cityColIndex] : null;
                  const district =
                    districtColIndex !== -1 ? row[districtColIndex] : null;
                  const depthStart =
                    depthStartColIndex !== -1 ? row[depthStartColIndex] : null;
                  const depthEnd =
                    depthEndColIndex !== -1 ? row[depthEndColIndex] : null;
                  const vs = vsColIndex !== -1 ? row[vsColIndex] : null;

                  // Bu satır bu ölçüme ait mi?
                  const rowName =
                    name && typeof name === "string"
                      ? name.toString().trim()
                      : "";
                  const rowMethod =
                    method && typeof method === "string"
                      ? method.toString().trim().toUpperCase()
                      : "MOC";
                  const rowCity =
                    city && typeof city === "string"
                      ? city.toString().trim()
                      : "";
                  const rowDistrict =
                    district && typeof district === "string"
                      ? district.toString().trim()
                      : "";

                  // Bu satır bu ölçüme ait mi? Daha sıkı kontrol
                  const belongsToThisMeasurement =
                    rowName === potentialMeasurement.name &&
                    rowMethod === potentialMeasurement.method &&
                    rowCity === potentialMeasurement.city &&
                    rowDistrict === potentialMeasurement.district;

                  if (
                    belongsToThisMeasurement &&
                    depthStart != null &&
                    depthEnd != null &&
                    vs != null
                  ) {
                    const depthStartNum = parseFloat(String(depthStart));
                    const depthEndNum = parseFloat(String(depthEnd));
                    const vsNum = parseFloat(String(vs));

                    if (
                      !isNaN(depthStartNum) &&
                      !isNaN(depthEndNum) &&
                      !isNaN(vsNum) &&
                      vsNum > 0 &&
                      depthEndNum > depthStartNum
                    ) {
                      const thickness = depthEndNum - depthStartNum;
                      layers.push({
                        id: (layerIdCounter++).toString(),
                        d: thickness,
                        vs: vsNum,
                        rho: "",
                      });
                    }
                  }
                }

                // Ölçümü kaydet
                if (layers.length > 0) {
                  const displayCity = potentialMeasurement.city || sheetName;
                  const displayDistrict = potentialMeasurement.district || "";
                  const displayNameBase = `${displayCity} - ${displayDistrict} - ${potentialMeasurement.name}`;
                  const safeDisplayName = displayNameBase
                    .replace(/ -  - /g, " - ")
                    .replace(/ - $/, "");

                  const measurement: ExcelMeasurement = {
                    id: `measurement-${measurementIdCounter++}`,
                    name: safeDisplayName,
                    method: potentialMeasurement.method,
                    layers: [...layers],
                    expectedResults: {
                      Vsa_M1: 0,
                      Vsa_M2: 0,
                      Vsa_M3: 0,
                      Vsa_M4: 0,
                    },
                  };
                  measurements.push(measurement);
                  measurements_found_this_sheet++;
                  console.log(
                    `   ✅ Ölçüm kaydedildi: "${potentialMeasurement.name}" - ${layers.length} katman - Yöntem: ${potentialMeasurement.method}`
                  );
                } else {
                  console.log(
                    `   ❌ Ölçüm atlandı (katman yok): "${potentialMeasurement.name}" - Yöntem: ${potentialMeasurement.method}`
                  );
                }
              }
            }
          } else {
            // Header bulunamadı, alternatif yaklaşım: Her satırı kontrol et
            console.log(
              `   ❌ Header bulunamadı, alternatif yaklaşım deneniyor: ${sheetName}`
            );

            // Birleştirilmiş.xlsx formatını da dene (eski format)
            for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
              const row = jsonData[rowIndex];
              if (
                !row.some(
                  (cell) =>
                    typeof cell === "string" && cell.includes("İSTASYON KODU")
                )
              ) {
                continue;
              }

              const istasyonRowIndex = rowIndex;
              const ilRowIndex = istasyonRowIndex - 2;
              const ilceRowIndex = istasyonRowIndex - 1;
              const headerRowIndex = istasyonRowIndex + 1;

              // Bu satırdaki tüm ölçümleri işle (eski format)
              for (let col = 0; col < row.length; col += 4) {
                const istasyonKoduCell = row[col + 1];
                const derinlikBasHeader = jsonData[headerRowIndex]?.[col];

                if (
                  !istasyonKoduCell ||
                  typeof derinlikBasHeader !== "string" ||
                  !derinlikBasHeader.toLowerCase().includes("derinlik")
                ) {
                  continue;
                }

                const il = jsonData[ilRowIndex]?.[col + 1] || sheetName;
                const ilce = jsonData[ilceRowIndex]?.[col + 1] || "Bilinmiyor";
                const istasyonKodu = istasyonKoduCell;
                const measurementName =
                  `${il} - ${ilce} - ${istasyonKodu}`.trim();

                const currentMeasurement: ExcelMeasurement = {
                  id: (measurementIdCounter++).toString(),
                  name: measurementName,
                  method: "MOC", // Eski formatta yöntem bilgisi yok
                  layers: [],
                };

                let layerIdCounter = 1;
                for (
                  let dataRow = headerRowIndex + 1;
                  dataRow < jsonData.length;
                  dataRow++
                ) {
                  const rowData = jsonData[dataRow];
                  if (!rowData || rowData.length <= col) break;

                  const derinlikBas = rowData[col];
                  const derinlikSon = rowData[col + 1];
                  const vs = rowData[col + 2];

                  if (
                    derinlikBas == null ||
                    derinlikSon == null ||
                    vs == null
                  ) {
                    break;
                  }

                  const derinlikBasNum = parseFloat(String(derinlikBas));
                  const derinlikSonNum = parseFloat(String(derinlikSon));
                  const vsNum = parseFloat(String(vs));

                  if (
                    !isNaN(derinlikBasNum) &&
                    !isNaN(derinlikSonNum) &&
                    !isNaN(vsNum) &&
                    vsNum > 0 &&
                    derinlikSonNum > derinlikBasNum
                  ) {
                    const thickness = derinlikSonNum - derinlikBasNum;
                    currentMeasurement.layers.push({
                      id: (layerIdCounter++).toString(),
                      d: thickness,
                      vs: vsNum,
                      rho: "",
                    });
                  } else {
                    break;
                  }
                }

                if (currentMeasurement.layers.length > 0) {
                  measurements.push(currentMeasurement);
                  measurements_found_this_sheet++;
                }
              }
            }
          }

          console.log(
            `${sheetName} sayfasında ${measurements_found_this_sheet} ölçüm bulundu`
          );
        });

        console.log(`Toplam ${measurements.length} ölçüm bulundu`);

        if (measurements.length === 0) {
          throw new Error("Excel dosyasında geçerli ölçüm verisi bulunamadı");
        }

        resolve({
          measurements,
          defaultRho,
          targetDepth,
          depthMode,
        });
      } catch (error) {
        console.error("Excel dosyası okunurken hata oluştu:", error);
        reject(
          new Error("Excel dosyası okunamadı: " + (error as Error).message)
        );
      }
    };

    reader.onerror = (error) => {
      console.error("Dosya okuma hatası:", error);
      reject(new Error("Dosya okunamadı."));
    };
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Sonuçları Excel dosyası olarak indirir.
 */
export function exportToExcel(
  measurements: ExcelMeasurement[],
  results: Result[],
  vs30Results: Result[],
  defaultRho: number,
  targetDepth: number,
  depthMode: string
): void {
  // Şehir ve ilçe bilgilerini parse et
  const parseLocationInfo = (measurementName: string) => {
    const parts = measurementName.split(" - ");
    return {
      sehir: parts[0] || "Bilinmiyor",
      ilce: parts[1] || "Bilinmiyor",
      istasyon: parts[2] || "Bilinmiyor",
    };
  };

  // Sonuç verilerini hazırla - Şehir ve ilçe bilgileriyle
  const resultData = [
    ["VSA Hesaplama Sonuçları - Çoklu Ölçüm"],
    [""],
    ["Giriş Parametreleri"],
    ["Varsayılan Yoğunluk (kg/m³)", defaultRho],
    ["Hedef Derinlik (m)", targetDepth],
    ["Derinlik Modu", depthMode],
    ["Toplam Ölçüm Sayısı", measurements.length],
    [""],
    ["Özet Sonuçlar"],
    [
      "Şehir",
      "İlçe",
      "İstasyon Kodu",
      "Hesaplama Yöntemi",
      "Katman Sayısı",
      "Toplam Derinlik (m)",
      "H (m)",
      "Vsa M1 (m/s)",
      "Vsa M2 (m/s)",
      "Vsa M3 (m/s)",
      "Vsa M4 (m/s)",
      "Vsa M5 (m/s)",
      "Vsa M6 (m/s)",
      "Vsa M7 (m/s)",
      "Vsa Exact (m/s)",
    ],
    ...results.map((result, index) => {
      const location = parseLocationInfo(
        measurements[index]?.name || `Ölçüm ${index + 1}`
      );
      const measurement = measurements[index];
      const totalDepth =
        measurement?.layers.reduce((sum, layer) => sum + Number(layer.d), 0) ||
        0;

      return [
        location.sehir,
        location.ilce,
        location.istasyon,
        measurement?.method || "MOC",
        measurement?.layers.length.toString() || "0",
        totalDepth.toFixed(2),
        result.H_used.toFixed(2),
        result.Vsa_M1.toFixed(1),
        result.Vsa_M2.toFixed(1),
        result.Vsa_M3.toFixed(1),
        result.Vsa_M4.toFixed(1),
        result.Vsa_M5?.toFixed(1) || "—",
        result.Vsa_M6?.toFixed(1) || "—",
        result.Vsa_M7?.toFixed(1) || "—",
        result.Vsa_Exact?.toFixed(1) || "—",
      ];
    }),
  ];

  // Excel çalışma kitabı oluştur
  const wb = XLSX.utils.book_new();
  const summaryWs = XLSX.utils.aoa_to_sheet(resultData);

  // Özet sayfasının sütun genişliklerini ayarla
  summaryWs["!cols"] = [
    { wch: 15 }, // Şehir
    { wch: 15 }, // İlçe
    { wch: 25 }, // İstasyon Kodu
    { wch: 15 }, // Hesaplama Yöntemi
    { wch: 12 }, // Katman Sayısı
    { wch: 15 }, // Toplam Derinlik
    { wch: 12 }, // H
    { wch: 12 }, // Vsa M1
    { wch: 12 }, // Vsa M2
    { wch: 12 }, // Vsa M3
    { wch: 12 }, // Vsa M4
    { wch: 12 }, // Vsa M5
    { wch: 12 }, // Vsa M6
    { wch: 12 }, // Vsa M7
    { wch: 12 }, // Vsa Exact
  ];
  XLSX.utils.book_append_sheet(wb, summaryWs, "VSA Özet Sonuçları");

  // Şehir bazında özet sayfası ekle
  const citySummaryData = [
    ["Şehir Bazında Özet İstatistikler"],
    [""],
    [
      "Şehir",
      "Ölçüm Sayısı",
      "Ortalama Katman Sayısı",
      "Ortalama Derinlik (m)",
      "Ortalama Vsa M1",
      "Ortalama Vsa M2",
      "Ortalama Vsa M3",
      "Min Vsa M1",
      "Max Vsa M1",
    ],
  ];

  // Şehir bazında grupla
  const cityGroups: {
    [key: string]: {
      count: number;
      layerCounts: number[];
      depths: number[];
      vsaM1: number[];
      vsaM2: number[];
      vsaM3: number[];
    };
  } = {};

  results.forEach((result, index) => {
    const location = parseLocationInfo(
      measurements[index]?.name || `Ölçüm ${index + 1}`
    );
    const city = location.sehir;

    if (!cityGroups[city]) {
      cityGroups[city] = {
        count: 0,
        layerCounts: [],
        depths: [],
        vsaM1: [],
        vsaM2: [],
        vsaM3: [],
      };
    }

    const measurement = measurements[index];
    const totalDepth =
      measurement?.layers.reduce((sum, layer) => sum + Number(layer.d), 0) || 0;

    cityGroups[city].count++;
    cityGroups[city].layerCounts.push(measurement?.layers.length || 0);
    cityGroups[city].depths.push(totalDepth);
    cityGroups[city].vsaM1.push(result.Vsa_M1);
    cityGroups[city].vsaM2.push(result.Vsa_M2);
    cityGroups[city].vsaM3.push(result.Vsa_M3);
  });

  // Şehir istatistiklerini hesapla
  Object.keys(cityGroups).forEach((city) => {
    const group = cityGroups[city];
    const avgLayerCount =
      group.layerCounts.reduce((a, b) => a + b, 0) / group.layerCounts.length;
    const avgDepth =
      group.depths.reduce((a, b) => a + b, 0) / group.depths.length;
    const avgM1 = group.vsaM1.reduce((a, b) => a + b, 0) / group.vsaM1.length;
    const avgM2 = group.vsaM2.reduce((a, b) => a + b, 0) / group.vsaM2.length;
    const avgM3 = group.vsaM3.reduce((a, b) => a + b, 0) / group.vsaM3.length;
    const minM1 = Math.min(...group.vsaM1);
    const maxM1 = Math.max(...group.vsaM1);

    citySummaryData.push([
      city,
      group.count.toString(),
      avgLayerCount.toFixed(1),
      avgDepth.toFixed(2),
      avgM1.toFixed(1),
      avgM2.toFixed(1),
      avgM3.toFixed(1),
      minM1.toFixed(1),
      maxM1.toFixed(1),
    ]);
  });

  const citySummaryWs = XLSX.utils.aoa_to_sheet(citySummaryData);
  citySummaryWs["!cols"] = [
    { wch: 20 }, // Şehir
    { wch: 12 }, // Ölçüm Sayısı
    { wch: 18 }, // Ortalama Katman Sayısı
    { wch: 18 }, // Ortalama Derinlik
    { wch: 15 }, // Ortalama Vsa M1
    { wch: 15 }, // Ortalama Vsa M2
    { wch: 15 }, // Ortalama Vsa M3
    { wch: 12 }, // Min Vsa M1
    { wch: 12 }, // Max Vsa M1
  ];
  XLSX.utils.book_append_sheet(wb, citySummaryWs, "Şehir Özeti");

  // Detay sayfası ekle (sayfa adı çakışmalarını önlemek için benzersizleştir)
  const usedSheetNames = new Set<string>();

  function makeSafeSheetName(base: string): string {
    // Excel sheet name rules: max 31 chars, no []:*?/\\
    const sanitized = base.replace(/[*?:\\/\[\]]/g, "_");
    return sanitized.substring(0, 31);
  }

  function getUniqueSheetName(base: string): string {
    let name = makeSafeSheetName(base);
    if (!usedSheetNames.has(name)) {
      usedSheetNames.add(name);
      return name;
    }
    // Çakışma varsa sayısal ek ile benzersiz yap
    let counter = 2;
    while (true) {
      const suffix = `_${counter}`;
      const trimmed = base.substring(0, Math.max(0, 31 - suffix.length));
      const candidate = makeSafeSheetName(trimmed + suffix);
      if (!usedSheetNames.has(candidate)) {
        usedSheetNames.add(candidate);
        return candidate;
      }
      counter++;
    }
  }

  measurements.forEach((measurement, index) => {
    const result = results[index];
    if (result) {
      const location = parseLocationInfo(measurement.name);
      const detailData = [
        [
          `${location.sehir} - ${location.ilce} - ${location.istasyon} - Detaylı Sonuçlar`,
        ],
        [""],
        ["Konum Bilgileri"],
        ["Şehir", location.sehir],
        ["İlçe", location.ilce],
        ["İstasyon Kodu", location.istasyon],
        [""],
        ["Girdi Verileri Özeti"],
        ["Toplam Katman Sayısı", measurement.layers.length],
        [
          "Toplam Derinlik (m)",
          measurement.layers
            .reduce((sum, layer) => sum + Number(layer.d), 0)
            .toFixed(2),
        ],
        [
          "Min Vs (m/s)",
          Math.min(...measurement.layers.map((l) => Number(l.vs))).toFixed(1),
        ],
        [
          "Max Vs (m/s)",
          Math.max(...measurement.layers.map((l) => Number(l.vs))).toFixed(1),
        ],
        [
          "Ortalama Vs (m/s)",
          (
            measurement.layers.reduce(
              (sum, layer) => sum + Number(layer.vs),
              0
            ) / measurement.layers.length
          ).toFixed(1),
        ],
        [""],
        ["Zemin Katmanları Detayı"],
        [
          "Katman",
          "Kalınlık (m)",
          "Vs (m/s)",
          "ρ (kg/m³)",
          "Kümülatif Derinlik (m)",
        ],
        ...measurement.layers.map((layer, layerIndex) => {
          const cumulativeDepth = measurement.layers
            .slice(0, layerIndex + 1)
            .reduce((sum, l) => sum + Number(l.d), 0);
          return [
            layer.id,
            Number(layer.d).toFixed(2),
            Number(layer.vs),
            typeof layer.rho === "number" && layer.rho > 0
              ? layer.rho
              : defaultRho,
            cumulativeDepth.toFixed(2),
          ];
        }),
        [""],
        ["Hesaplama Sonuçları"],
        ["Parametre", "Değer", "Birim"],
        ["H (Toplam)", result.H_used.toFixed(2), "m"],
        ["Vsa M1", result.Vsa_M1.toFixed(1), "m/s"],
        ["Vsa M2", result.Vsa_M2.toFixed(1), "m/s"],
        ["Vsa M3 (MOC)", result.Vsa_M3.toFixed(1), "m/s"],
        ["Vsa M4", result.Vsa_M4.toFixed(1), "m/s"],
        ["Vsa M5", result.Vsa_M5?.toFixed(1) || "—", "m/s"],
        ["Vsa M6", result.Vsa_M6?.toFixed(1) || "—", "m/s"],
        ["Vsa M7", result.Vsa_M7?.toFixed(1) || "—", "m/s"],
        ["Vsa Exact", result.Vsa_Exact?.toFixed(1) || "—", "m/s"],
      ];

      // VS30 sonuçlarını ekle
      const vs30Result = vs30Results[index];
      if (vs30Result) {
        detailData.push([""]);
        detailData.push(["VS30 Hesaplama Sonuçları"]);
        detailData.push(["Parametre", "Değer", "Birim"]);
        detailData.push(["H (Toplam)", vs30Result.H_used.toFixed(2), "m"]);
        detailData.push(["Vsa M1", vs30Result.Vsa_M1.toFixed(1), "m/s"]);
        detailData.push(["Vsa M2", vs30Result.Vsa_M2.toFixed(1), "m/s"]);
        detailData.push(["Vsa M3 (MOC)", vs30Result.Vsa_M3.toFixed(1), "m/s"]);
        detailData.push(["Vsa M4", vs30Result.Vsa_M4.toFixed(1), "m/s"]);
        detailData.push([
          "Vsa M5",
          vs30Result.Vsa_M5?.toFixed(1) || "—",
          "m/s",
        ]);
        detailData.push([
          "Vsa M6",
          vs30Result.Vsa_M6?.toFixed(1) || "—",
          "m/s",
        ]);
        detailData.push([
          "Vsa M7",
          vs30Result.Vsa_M7?.toFixed(1) || "—",
          "m/s",
        ]);
        detailData.push([
          "Vsa Exact",
          vs30Result.Vsa_Exact?.toFixed(1) || "—",
          "m/s",
        ]);
      }

      const detailWs = XLSX.utils.aoa_to_sheet(detailData);
      // Detay sayfalarının sütun genişliklerini ayarla
      detailWs["!cols"] = [
        { wch: 25 }, // Parametre/Katman
        { wch: 15 }, // Değer
        { wch: 10 }, // Birim
        { wch: 12 }, // Kümülatif Derinlik (sadece katmanlar için)
        { wch: 12 }, // Ek sütun
      ];
      // Sayfa adı: Şehir_İlçe_İstasyon_Yöntem (benzersiz)
      const methodTag = (measurement.method || "").toString().trim().toUpperCase();
      const baseSheetName = `${location.sehir}_${location.ilce}_${location.istasyon}${methodTag ? `_${methodTag}` : ""}`;
      const uniqueSheetName = getUniqueSheetName(baseSheetName);
      XLSX.utils.book_append_sheet(wb, detailWs, uniqueSheetName);
    }
  });

  // Excel dosyasını indir
  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  saveAs(blob, `vsa-coklu-sonuclari-${timestamp}.xlsx`);
}

/**
 * Yeni veri formatına uygun bir örnek Excel tablosu oluşturur ve indirir.
 */
export function downloadSampleExcel(): void {
  const sampleData = [
    [], // Üstte boşluk için
    ["İL", "ÖRNEKİL", "", "", "İL", "ÖRNEKİL"],
    ["İLÇE", "MERKEZ", "", "", "İLÇE", "DİĞER İLÇE"],
    ["İSTASYON KODU", "0101 (MASW)", "", "", "İSTASYON KODU", "0102 (REMİ)"],
    [
      "Derinlik Baş (m)",
      "Derinlik Son (m)",
      "Vs (m/s)",
      "",
      "Derinlik Baş (m)",
      "Derinlik Son (m)",
      "Vs (m/s)",
    ],
    [0, 3, 350, "", 0, 5, 250],
    [3, 8, 450, "", 5, 12, 400],
    [8, 20, 600, "", 12, 30, 750],
    [20, 35, 800, "", 30, 55, 900],
    [],
    [],
    ["Açıklamalar:"],
    ["- Bu şablon, 'birleştirilmiş.xlsx' dosyasıyla aynı formatı kullanır."],
    ["- Her şehir verisi için Excel'de ayrı bir sayfa oluşturabilirsiniz."],
    [
      "- Bir sayfada birden fazla ölçüm, aralarında bir boş sütun bırakılarak yan yana eklenebilir.",
    ],
    [
      "- Her ölçüm bloğu 'İL', 'İLÇE' ve 'İSTASYON KODU' bilgilerini içermelidir.",
    ],
    [
      "- Veri başlıkları 'Derinlik Baş (m)', 'Derinlik Son (m)' ve 'Vs (m/s)' olmalıdır.",
    ],
    [
      "- Yoğunluk (ρ) bilgisi bu şablonda kullanılmaz, hesaplama sırasında varsayılan değer (1900 kg/m³) atanır.",
    ],
    ["- Tüm derinlik ve Vs değerleri pozitif sayı olmalıdır."],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Örnek Veri");

  // Hücre genişliklerini ayarla
  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
    { wch: 5 },
    { wch: 18 },
    { wch: 18 },
    { wch: 15 },
  ];

  // Excel dosyasını indir
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  saveAs(blob, "ornek-vsa-veri-yeni-format.xlsx");
}

/**
 * Dosya yükleme için input elementi oluşturur.
 */
export function createFileInput(
  onFileSelect: (file: File) => void
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.xls";
  input.style.display = "none";

  input.onchange = (e) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      onFileSelect(target.files[0]);
    }
  };

  return input;
}
