// src/excelPresets.ts
import * as XLSX from "xlsx";
import type { Layer, Preset } from "./presets";

/**
 * Birleştirilmiş.xlsx dosyasından preset'leri oluşturur
 */
export async function loadExcelPresets(): Promise<Preset[]> {
  try {
    // Excel dosyasını fetch ile oku
    const response = await fetch("/Birleştirilmiş.xlsx");
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
      }) as any[][];

      if (jsonData.length < 5) return; // Yeterli veri yoksa sayfayı atla

      // Tüm 'İSTASYON KODU' satırlarını bul ve işle
      for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        if (
          !row.some(
            (cell) => typeof cell === "string" && cell.includes("İSTASYON KODU")
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
          const presetName = `${il} - ${ilce} - ${istasyonKodu}`.trim();

          const layers: Layer[] = [];
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

            const derinlikBasNum = parseFloat(derinlikBas);
            const derinlikSonNum = parseFloat(derinlikSon);
            const vsNum = parseFloat(vs);

            // Değerler sayısal ve geçerli ise katmanı ekle
            if (
              !isNaN(derinlikBasNum) &&
              !isNaN(derinlikSonNum) &&
              !isNaN(vsNum) &&
              vsNum > 0 &&
              derinlikSonNum > derinlikBasNum
            ) {
              const thickness = derinlikSonNum - derinlikBasNum;
              layers.push({
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

          // Eğer ölçüme en az bir katman eklendiyse preset olarak ekle
          if (layers.length > 0) {
            const preset: Preset = {
              name: presetName,
              layers: layers,
              expected: {
                Vsa_M1: 0, // Excel'de beklenen değerler yok, 0 olarak bırak
                Vsa_M2: 0,
                Vsa_M3: 0,
                Vsa_M4: 0,
              },
              defaultRho: 1900,
              autoDepthMode: "VS30", // Varsayılan olarak VS30 kullan
              autoDepthValue: 30.0,
            };
            presets.push(preset);
          }
        }
      }
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
