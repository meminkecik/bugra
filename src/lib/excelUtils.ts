import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
// Bu importların projenizde doğru şekilde yapılandırıldığını varsayıyoruz.
// import type { Layer, Result } from "./calc";

// Projenizdeki Layer ve Result arayüzlerini buraya ekleyebilir
// veya yukarıdaki gibi import edebilirsiniz. Şimdilik örnek tanımlar kullanılıyor.
export interface Layer {
  id: string;
  d: number; // Kalınlık
  vs: number; // Vs değeri
  rho: number | string; // Yoğunluk
}

export interface Result {
  H_M12: number;
  H_M3: number;
  Vsa_M1: number;
  Vsa_M2: number;
  Vsa_M3: number;
  Vsa_M4: number;
  Vsa_M5?: number;
  Vsa_M6?: number;
  Vsa_M7?: number;
  T_M1?: number;
  T_M2?: number;
  T_M3?: number;
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
 * 'birleştirilmiş.xlsx' formatındaki Excel dosyasından verileri okur.
 * Bu format, her şehir için ayrı sayfalar ve her sayfada yatay olarak
 * düzenlenmiş çoklu ölçüm istasyonları içerir.
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

        // Kitaptaki her bir sayfayı (her bir şehri) dolaş
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
          }) as unknown[][];

          if (jsonData.length < 5) return; // Yeterli veri yoksa sayfayı atla

          // Tüm 'İSTASYON KODU' satırlarını bul ve işle
          for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
            const row = jsonData[rowIndex];
            if (
              !row.some(
                (cell) =>
                  typeof cell === "string" && cell.includes("İSTASYON KODU")
              )
            ) {
              continue; // İSTASYON KODU satırı değilse atla
            }

            const istasyonRowIndex = rowIndex;
            const ilRowIndex = istasyonRowIndex - 2;
            const ilceRowIndex = istasyonRowIndex - 1;
            const headerRowIndex = istasyonRowIndex + 1;

            // Bu satırdaki tüm ölçümleri işle
            for (let col = 0; col < row.length; col += 4) {
              const istasyonKoduCell = row[col + 1];
              const derinlikBasHeader = jsonData[headerRowIndex]?.[col];

              // Bu sütun bloğunun geçerli bir ölçüm olup olmadığını kontrol et
              if (
                !istasyonKoduCell ||
                typeof derinlikBasHeader !== "string" ||
                !derinlikBasHeader.toLowerCase().includes("derinlik")
              ) {
                continue; // Geçerli değilse bir sonraki bloğa geç
              }

              // Ölçüm bilgilerini çıkar
              const il = jsonData[ilRowIndex]?.[col + 1] || sheetName;
              const ilce = jsonData[ilceRowIndex]?.[col + 1] || "Bilinmiyor";
              const istasyonKodu = istasyonKoduCell;
              const measurementName =
                `${il} - ${ilce} - ${istasyonKodu}`.trim();

              const currentMeasurement: ExcelMeasurement = {
                id: (measurementIdCounter++).toString(),
                name: measurementName,
                layers: [],
              };

              let layerIdCounter = 1;
              // Başlık satırının altından başlayarak katman verilerini oku
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

                // Veri satırının sonuna gelip gelmediğimizi kontrol et
                if (derinlikBas == null || derinlikSon == null || vs == null) {
                  break;
                }

                const derinlikBasNum = parseFloat(String(derinlikBas));
                const derinlikSonNum = parseFloat(String(derinlikSon));
                const vsNum = parseFloat(String(vs));

                // Değerler sayısal ve geçerli ise katmanı ekle
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
                    d: thickness, // Kalınlığı hesapla
                    vs: vsNum,
                    rho: "", // Yoğunluk verisi bu formatta yok, varsayılan kullanılacak
                  });
                } else {
                  // Geçersiz veri varsa bu ölçümün katmanlarını okumayı bitir
                  break;
                }
              }

              // Eğer ölçüme en az bir katman eklendiyse listeye al
              if (currentMeasurement.layers.length > 0) {
                measurements.push(currentMeasurement);
              }
            }
          }
        });

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
 * Bu fonksiyonun işlevselliği, girdi formatından bağımsız olduğu için değiştirilmemiştir.
 */
export function exportToExcel(
  measurements: ExcelMeasurement[],
  results: Result[],
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
      "Katman Sayısı",
      "Toplam Derinlik (m)",
      "H (M1/M2) (m)",
      "H (M3) (m)",
      "Vsa M1 (m/s)",
      "Vsa M2 (m/s)",
      "Vsa M3 (m/s)",
      "Vsa M4 (m/s)",
      "Vsa M5 (m/s)",
      "Vsa M6 (m/s)",
      "Vsa M7 (m/s)",
    ],
    ...results.map((result, index) => {
      const location = parseLocationInfo(
        measurements[index]?.name || `Ölçüm ${index + 1}`
      );
      const measurement = measurements[index];
      const totalDepth =
        measurement?.layers.reduce((sum, layer) => sum + layer.d, 0) || 0;

      return [
        location.sehir,
        location.ilce,
        location.istasyon,
        measurement?.layers.length.toString() || "0",
        totalDepth.toFixed(2),
        result.H_M12.toFixed(2),
        result.H_M3.toFixed(2),
        result.Vsa_M1.toFixed(1),
        result.Vsa_M2.toFixed(1),
        result.Vsa_M3.toFixed(1),
        result.Vsa_M4.toFixed(1),
        result.Vsa_M5?.toFixed(1) || "—",
        result.Vsa_M6?.toFixed(1) || "—",
        result.Vsa_M7?.toFixed(1) || "—",
      ];
    }),
  ];

  // T periyotları da ekle
  const hasTValues = results.some((r) => r.T_M1 || r.T_M2 || r.T_M3);
  if (hasTValues) {
    resultData.push([""]);
    resultData.push(["T Periyotları Özeti"]);
    resultData.push([
      "Şehir",
      "İlçe",
      "İstasyon Kodu",
      "T M1 (s)",
      "T M2 (s)",
      "T M3 (s)",
    ]);
    resultData.push(
      ...results.map((result, index) => {
        const location = parseLocationInfo(
          measurements[index]?.name || `Ölçüm ${index + 1}`
        );
        return [
          location.sehir,
          location.ilce,
          location.istasyon,
          result.T_M1?.toFixed(3) || "—",
          result.T_M2?.toFixed(3) || "—",
          result.T_M3?.toFixed(3) || "—",
        ];
      })
    );
  }

  // Excel çalışma kitabı oluştur
  const wb = XLSX.utils.book_new();
  const summaryWs = XLSX.utils.aoa_to_sheet(resultData);

  // Özet sayfasının sütun genişliklerini ayarla
  summaryWs["!cols"] = [
    { wch: 15 }, // Şehir
    { wch: 15 }, // İlçe
    { wch: 25 }, // İstasyon Kodu
    { wch: 12 }, // Katman Sayısı
    { wch: 15 }, // Toplam Derinlik
    { wch: 12 }, // H (M1/M2)
    { wch: 12 }, // H (M3)
    { wch: 12 }, // Vsa M1
    { wch: 12 }, // Vsa M2
    { wch: 12 }, // Vsa M3
    { wch: 12 }, // Vsa M4
    { wch: 12 }, // Vsa M5
    { wch: 12 }, // Vsa M6
    { wch: 12 }, // Vsa M7
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
      measurement?.layers.reduce((sum, layer) => sum + layer.d, 0) || 0;

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

  // Detay sayfası ekle
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
            .reduce((sum, layer) => sum + layer.d, 0)
            .toFixed(2),
        ],
        [
          "Min Vs (m/s)",
          Math.min(...measurement.layers.map((l) => l.vs)).toFixed(1),
        ],
        [
          "Max Vs (m/s)",
          Math.max(...measurement.layers.map((l) => l.vs)).toFixed(1),
        ],
        [
          "Ortalama Vs (m/s)",
          (
            measurement.layers.reduce((sum, layer) => sum + layer.vs, 0) /
            measurement.layers.length
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
            .reduce((sum, l) => sum + l.d, 0);
          return [
            layer.id,
            layer.d.toFixed(2),
            layer.vs,
            typeof layer.rho === "number" && layer.rho > 0
              ? layer.rho
              : defaultRho,
            cumulativeDepth.toFixed(2),
          ];
        }),
        [""],
        ["Hesaplama Sonuçları"],
        ["Parametre", "Değer", "Birim"],
        ["H (M1/M2)", result.H_M12.toFixed(2), "m"],
        ["H (M3)", result.H_M3.toFixed(2), "m"],
        ["Vsa M1", result.Vsa_M1.toFixed(1), "m/s"],
        ["Vsa M2", result.Vsa_M2.toFixed(1), "m/s"],
        ["Vsa M3", result.Vsa_M3.toFixed(1), "m/s"],
        ["Vsa M4", result.Vsa_M4.toFixed(1), "m/s"],
        ["Vsa M5", result.Vsa_M5?.toFixed(1) || "—", "m/s"],
        ["Vsa M6", result.Vsa_M6?.toFixed(1) || "—", "m/s"],
        ["Vsa M7", result.Vsa_M7?.toFixed(1) || "—", "m/s"],
      ];

      if (result.T_M1 || result.T_M2 || result.T_M3) {
        detailData.push([""]);
        detailData.push(["T Periyotları"]);
        detailData.push(["Parametre", "Değer", "Birim"]);
        if (result.T_M1) detailData.push(["T M1", result.T_M1.toFixed(3), "s"]);
        if (result.T_M2) detailData.push(["T M2", result.T_M2.toFixed(3), "s"]);
        if (result.T_M3) detailData.push(["T M3", result.T_M3.toFixed(3), "s"]);
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
      // Sayfa adının 31 karakteri geçmemesini sağla
      const safeSheetName =
        `${location.sehir}_${location.ilce}_${location.istasyon}`
          .replace(/[*?:\\/[\]]/g, "_")
          .substring(0, 31);
      XLSX.utils.book_append_sheet(wb, detailWs, safeSheetName);
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
 * Bu fonksiyonun işlevselliği genel olduğu için değiştirilmemiştir.
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
