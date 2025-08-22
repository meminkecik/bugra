import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import type { Layer, Result } from "./calc";

export interface ExcelRow {
  layer: string;
  vsa: number | string;
  rho: number | string;
  depth: number | string;
}

export interface ExcelData {
  measurements: ExcelMeasurement[];
  defaultRho: number;
  targetDepth: number;
  depthMode: string;
}

export interface ExcelMeasurement {
  id: string;
  name: string;
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
 * Excel dosyasından veri okur
 */
export function readExcelFile(file: File): Promise<ExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Excel'i JSON'a çevir
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // İlk satır başlık, ikinci satırdan itibaren veri
        const rows = jsonData.slice(1) as any[][];

        const measurements: ExcelMeasurement[] = [];
        let defaultRho = 1900;
        let targetDepth = 30;
        let depthMode = "SITE_HS"; // Otomatik olarak tüm saha profili

        // Ölçümleri grupla
        let currentMeasurement: ExcelMeasurement | null = null;
        let layerIndex = 1;

        rows.forEach((row, rowIndex) => {
          if (row.length >= 4) {
            const [measurementName, vsa, rho, depth] = row;

            // Eğer ilk sütun sayısal değilse ve geçerli bir ölçüm adıysa, yeni ölçüm başlat
            if (
              typeof measurementName === "string" &&
              measurementName.trim() !== "" &&
              isNaN(parseFloat(measurementName)) &&
              measurementName !== "Katman"
            ) {
              // Önceki ölçümü kaydet
              if (currentMeasurement && currentMeasurement.layers.length > 0) {
                measurements.push(currentMeasurement);
              }

              // Yeni ölçüm başlat
              currentMeasurement = {
                id: (measurements.length + 1).toString(),
                name: measurementName.trim(),
                layers: [],
              };
              layerIndex = 1;
            }

            // Sayısal değerleri kontrol et
            const vsaNum = typeof vsa === "number" ? vsa : parseFloat(vsa);
            const rhoNum = typeof rho === "number" ? rho : parseFloat(rho);
            const depthNum =
              typeof depth === "number" ? depth : parseFloat(depth);

            if (
              !isNaN(vsaNum) &&
              !isNaN(depthNum) &&
              vsaNum > 0 &&
              depthNum > 0 &&
              currentMeasurement
            ) {
              currentMeasurement.layers.push({
                id: layerIndex.toString(),
                d: depthNum,
                vs: vsaNum,
                rho: !isNaN(rhoNum) && rhoNum > 0 ? rhoNum : "",
              });
              layerIndex++;
            }
          }
        });

        // Son ölçümü de ekle
        if (currentMeasurement && currentMeasurement.layers.length > 0) {
          measurements.push(currentMeasurement);
        }

        // Varsayılan yoğunluk ve hedef derinlik bilgilerini çıkar
        if (measurements.length > 0 && measurements[0].layers.length > 0) {
          // İlk ölçümün ilk katmanının yoğunluğu varsa varsayılan olarak kullan
          const firstRho = measurements[0].layers.find(
            (l) => typeof l.rho === "number" && l.rho > 0
          );
          if (firstRho) {
            defaultRho = firstRho.rho as number;
          }

          // İlk ölçümün toplam derinliğini hesapla
          const totalDepth = measurements[0].layers.reduce(
            (sum, l) => sum + (typeof l.d === "number" ? l.d : 0),
            0
          );
          if (totalDepth > 0) {
            targetDepth = totalDepth; // Tüm saha profili kullan
          }
        }

        resolve({
          measurements,
          defaultRho,
          targetDepth,
          depthMode,
        });
      } catch (error) {
        reject(new Error("Excel dosyası okunamadı: " + error));
      }
    };

    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Sonuçları Excel dosyası olarak indirir
 */
export function exportToExcel(
  measurements: ExcelMeasurement[],
  results: Result[],
  defaultRho: number,
  targetDepth: number,
  depthMode: string
): void {
  // Sonuç verilerini hazırla
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
      "Ölçüm",
      "H (M1/M2)",
      "H (M3)",
      "Vsa M1",
      "Vsa M2",
      "Vsa M3",
      "Vsa M4",
      "Vsa M5",
      "Vsa M6",
      "Vsa M7",
    ],
    ...results.map((result, index) => [
      measurements[index]?.name || `Ölçüm ${index + 1}`,
      result.H_M12.toFixed(2),
      result.H_M3.toFixed(2),
      result.Vsa_M1.toFixed(1),
      result.Vsa_M2.toFixed(1),
      result.Vsa_M3.toFixed(1),
      result.Vsa_M4.toFixed(1),
      result.Vsa_M5?.toFixed(1) || "—",
      result.Vsa_M6?.toFixed(1) || "—",
      result.Vsa_M7?.toFixed(1) || "—",
    ]),
  ];

  // T periyotları da ekle
  const hasTValues = results.some((r) => r.T_M1 || r.T_M2 || r.T_M3);
  if (hasTValues) {
    resultData.push([""]);
    resultData.push(["T Periyotları Özeti"]);
    resultData.push(["Ölçüm", "T M1", "T M2", "T M3"]);
    resultData.push(
      ...results.map((result, index) => [
        measurements[index]?.name || `Ölçüm ${index + 1}`,
        result.T_M1?.toFixed(3) || "—",
        result.T_M2?.toFixed(3) || "—",
        result.T_M3?.toFixed(3) || "—",
      ])
    );
  }

  // Excel çalışma kitabı oluştur
  const worksheet = XLSX.utils.aoa_to_sheet(resultData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "VSA Özet Sonuçları");

  // Detay sayfası ekle
  measurements.forEach((measurement, index) => {
    const result = results[index];
    if (result) {
      const detailData = [
        [`${measurement.name} - Detaylı Sonuçlar`],
        [""],
        ["Zemin Katmanları"],
        ["Katman", "Kalınlık (m)", "Vs (m/s)", "ρ (kg/m³)"],
        ...measurement.layers.map((layer) => [
          layer.id,
          layer.d,
          layer.vs,
          typeof layer.rho === "number" ? layer.rho : defaultRho,
        ]),
        [""],
        ["Hesaplama Sonuçları"],
        ["Parametre", "Değer", "Birim"],
        ["H (M1/M2)", result.H_M12, "m"],
        ["H (M3)", result.H_M3, "m"],
        ["Vsa M1", result.Vsa_M1, "m/s"],
        ["Vsa M2", result.Vsa_M2, "m/s"],
        ["Vsa M3", result.Vsa_M3, "m/s"],
        ["Vsa M4", result.Vsa_M4, "m/s"],
        ["Vsa M5", result.Vsa_M5 || "—", "m/s"],
        ["Vsa M6", result.Vsa_M6 || "—", "m/s"],
        ["Vsa M7", result.Vsa_M7 || "—", "m/s"],
      ];

      if (result.T_M1 || result.T_M2 || result.T_M3) {
        detailData.push([""]);
        detailData.push(["T Periyotları"]);
        detailData.push(["Parametre", "Değer", "Birim"]);
        if (result.T_M1) detailData.push(["T M1", result.T_M1, "s"]);
        if (result.T_M2) detailData.push(["T M2", result.T_M2, "s"]);
        if (result.T_M3) detailData.push(["T M3", result.T_M3, "s"]);
      }

      const detailWorksheet = XLSX.utils.aoa_to_sheet(detailData);
      XLSX.utils.book_append_sheet(
        workbook,
        detailWorksheet,
        measurement.name.substring(0, 31)
      );
    }
  });

  // Hücre genişliklerini ayarla
  const colWidths = [
    { wch: 25 }, // Ölçüm/Katman/Parametre
    { wch: 15 }, // Değer
    { wch: 10 }, // Birim
  ];
  worksheet["!cols"] = colWidths;

  // Excel dosyasını indir
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  saveAs(blob, `vsa-coklu-sonuclari-${timestamp}.xlsx`);
}

/**
 * Örnek Excel tablosu oluşturur ve indirir
 */
export function downloadSampleExcel(): void {
  const sampleData = [
    ["Ölçüm Adı", "Vs (m/s)", "ρ (kg/m³)", "Kalınlık (m)"],
    ["Saha 1", "", "", ""],
    ["", 180, 1900, 5],
    ["", 300, 2000, 10],
    ["", 600, 2100, 15],
    ["", 800, 2200, 20],
    ["", 1200, 2300, 25],
    [""],
    ["Saha 2", "", "", ""],
    ["", 200, 1950, 8],
    ["", 350, 2050, 12],
    ["", 650, 2150, 18],
    ["", 900, 2250, 22],
    ["", 1300, 2350, 30],
    [""],
    ["Saha 3", "", "", ""],
    ["", 150, 1850, 6],
    ["", 250, 1950, 9],
    ["", 500, 2050, 14],
    ["", 750, 2150, 19],
    ["", 1100, 2250, 28],
    [""],
    ["Açıklama:"],
    ["- İlk satır başlık satırıdır, değiştirilmemelidir"],
    ["- Ölçüm Adı: Saha/Proje adı (isteğe bağlı, boş bırakılabilir)"],
    ["- Vs: Kesme dalga hızı (m/s) - Zorunlu"],
    ["- ρ: Yoğunluk (kg/m³) - Boş bırakılabilir (varsayılan kullanılır)"],
    ["- Kalınlık: Katman kalınlığı (m) - Zorunlu"],
    [""],
    ["Çoklu Ölçüm Formatı:"],
    ["- Her ölçüm için bir başlık satırı ekleyin (örn: 'Saha 1')"],
    ["- Başlık satırından sonra katman verilerini girin"],
    ["- Boş satırlarla ölçümleri ayırın"],
    ["- Maksimum 20 ölçüm desteklenir"],
    [""],
    ["Not:"],
    ["- En az 1 katman olmalıdır"],
    ["- Vs ve Kalınlık pozitif sayı olmalıdır"],
    ["- ρ boş bırakılırsa varsayılan yoğunluk (1900 kg/m³) kullanılır"],
    ["- Dosya .xlsx formatında kaydedilmelidir"],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Örnek Veri");

  // Hücre genişliklerini ayarla
  const colWidths = [
    { wch: 20 }, // Katman
    { wch: 15 }, // Vs
    { wch: 15 }, // ρ
    { wch: 15 }, // Kalınlık
  ];
  worksheet["!cols"] = colWidths;

  // Excel dosyasını indir
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  saveAs(blob, "ornek-vsa-veri.xlsx");
}

/**
 * Dosya yükleme için input elementi oluşturur
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
