import { useState, useEffect, useMemo, useRef } from "react";
import {
  computeResults,
  validateLayer,
  calibrateDepthForTargetVsaM3,
  analyzeDeviations,
  generateGeotechnicalReport,
  autoConfigureDepthForPreset,
  suggestNarrowedDepth,
  type Layer,
} from "./lib/calc";
import { PRESETS, type Preset } from "./presets";

import {
  readExcelFile,
  exportToExcel,
  downloadSampleExcel,
  createFileInput,
  type ExcelData,
} from "./lib/excelUtils";
import "./App.css";

type DepthMode = "VS30" | "SITE_HS" | "CUSTOM";

function App() {
  const [layers, setLayers] = useState<Layer[]>([
    { id: "1", d: 5, vs: 180, rho: "" },
    { id: "2", d: 10, vs: 300, rho: "" },
    { id: "3", d: 15, vs: 600, rho: "" },
  ]);
  const [showT, setShowT] = useState(false);
  const [defaultRho, setDefaultRho] = useState(1900);
  const [depthMode, setDepthMode] = useState<DepthMode>("VS30");
  const [customDepth, setCustomDepth] = useState<number>(30);
  const [currentPreset, setCurrentPreset] = useState<Preset | null>(null);
  const [deviationAnalysis, setDeviationAnalysis] = useState<any>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelMeasurements, setExcelMeasurements] = useState<
    ExcelMeasurement[]
  >([]);
  const [currentMeasurementIndex, setCurrentMeasurementIndex] =
    useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Hedef derinliği belirle
  const targetDepth = useMemo(() => {
    if (depthMode === "VS30") return 30;
    if (depthMode === "SITE_HS") return 9999; // efektif "tüm profil"
    return Math.max(1, Number(customDepth) || 30);
  }, [depthMode, customDepth]);

  // Sonuçları hesapla - Batch hesaplama ile aynı mantık
  const result = useMemo(() => {
    const targetDepthM12 = Number.POSITIVE_INFINITY;
    const targetDepthM3 = targetDepth;
    const m3Mode: "TOTAL" | "TARGET" =
      depthMode === "SITE_HS" ? "TOTAL" : "TARGET"; // VS30/CUSTOM=TARGET, SITE_HS=TOTAL

    return computeResults(
      layers,
      showT,
      defaultRho,
      targetDepthM12,
      targetDepthM3,
      m3Mode // <<< eklendi
    );
  }, [layers, showT, defaultRho, targetDepth, depthMode]);

  // Sapma analizi
  useEffect(() => {
    if (result && currentPreset) {
      const analysis = analyzeDeviations(result, currentPreset.expected);
      setDeviationAnalysis(analysis);
    }
  }, [result, currentPreset]);

  // Hataları hesapla
  const errors = useMemo(() => {
    const allErrors: string[] = [];
    layers.forEach((layer) => {
      const validation = validateLayer(layer);
      if (!validation.isValid) {
        allErrors.push(...validation.errors);
      }
    });
    return allErrors;
  }, [layers]);

  // Katman ekle
  const addLayer = () => {
    const newId = (layers.length + 1).toString();
    setLayers([...layers, { id: newId, d: 0, vs: 0, rho: "" }]);
  };

  // Katman kaldır
  const removeLayer = (id: string) => {
    setLayers(layers.filter((layer) => layer.id !== id));
  };

  // Katman güncelle
  const updateLayer = (
    id: string,
    field: keyof Layer,
    value: string | number
  ) => {
    setLayers(
      layers.map((layer) =>
        layer.id === id ? { ...layer, [field]: value } : layer
      )
    );
  };

  // Preset değiştiğinde otomatik derinlik ayarla
  const handlePresetChange = (presetName: string) => {
    const preset = PRESETS.find((p) => p.name === presetName);
    if (!preset) return;

    setLayers(preset.layers);
    setDefaultRho(preset.defaultRho);
    setCurrentPreset(preset);

    // Otomatik derinlik modu ayarla (mevcut)
    const { depthMode: autoMode, targetDepth: autoDepth } =
      autoConfigureDepthForPreset(preset);

    // Hedef M3 varsa: derinliği kalibre et (seed = autoDepth)
    if (preset.expected?.Vsa_M3) {
      const Hstar = calibrateDepthForTargetVsaM3(
        preset.layers,
        preset.defaultRho ?? 1900,
        preset.expected.Vsa_M3,
        5,
        120,
        0.5,
        60,
        autoDepth // seedDepth
      );
      if (Hstar) {
        setDepthMode("CUSTOM");
        setCustomDepth(Number(Hstar.toFixed(2)));
        return; // burada bitir, kalibre edilen derinlik kullanılacak
      }
    }

    // Kalibrasyon yapılamazsa fallback:
    setDepthMode(autoMode === "VS30" ? "VS30" : "CUSTOM");
    if (autoMode === "CUSTOM") setCustomDepth(autoDepth);
  };

  // Otomatik kalibrasyon
  const handleAutoCalibrate = () => {
    const target = currentPreset?.expected?.Vsa_M3;
    if (!target || !currentPreset) return;

    const seed = currentPreset.autoDepthValue ?? 30; // preset’ten ipucu
    const Hstar = calibrateDepthForTargetVsaM3(
      layers,
      defaultRho,
      target,
      5,
      120,
      0.5,
      60,
      seed
    );
    if (Hstar) {
      setDepthMode("CUSTOM");
      setCustomDepth(Number(Hstar.toFixed(2)));
    }
  };

  // Derinlik aralığı daraltma önerisi
  const handleNarrowDepth = () => {
    if (!deviationAnalysis || !currentPreset) return;

    // En yüksek sapma olan yöntemi bul (M4, M5, M6 ve M7 dahil)
    const deviations = [
      deviationAnalysis.deviations.M1,
      deviationAnalysis.deviations.M2,
      deviationAnalysis.deviations.M3,
      ...(deviationAnalysis.deviations.M4
        ? [deviationAnalysis.deviations.M4]
        : []),
      ...(deviationAnalysis.deviations.M5
        ? [deviationAnalysis.deviations.M5]
        : []),
      ...(deviationAnalysis.deviations.M6
        ? [deviationAnalysis.deviations.M6]
        : []),
      ...(deviationAnalysis.deviations.M7
        ? [deviationAnalysis.deviations.M7]
        : []),
    ];
    const maxDeviation = Math.max(...deviations);

    // M3 için yeni derinlik öner
    const newDepth = suggestNarrowedDepth(
      customDepth,
      maxDeviation,
      maxDeviation > 10 ? "decrease" : "decrease"
    );

    setCustomDepth(Number(newDepth.toFixed(1)));
  };



  // Veri sıfırla
  const resetData = () => {
    setLayers([
      { id: "1", d: 5, vs: 180, rho: "" },
      { id: "2", d: 10, vs: 300, rho: "" },
      { id: "3", d: 15, vs: 600, rho: "" },
    ]);
    setDefaultRho(1900);
    setCurrentPreset(null);
    setDepthMode("VS30");
    setCustomDepth(30);
    setDeviationAnalysis(null);
  };

  // Jeoteknik rapor indir
  const downloadGeotechnicalReport = () => {
    if (!result || !currentPreset) return;

    const report = generateGeotechnicalReport(
      currentPreset,
      depthMode === "SITE_HS" ? "VS30" : depthMode,
      targetDepth,
      result,
      showT
    );

    const blob = new Blob([report], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jeoteknik-rapor-${
      currentPreset.name
    }-${depthMode.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };



  // Excel dosyası yükle
  const handleExcelUpload = async (file: File) => {
    setExcelLoading(true);
    setExcelError(null);

    try {
      const excelData: ExcelData = await readExcelFile(file);

      if (excelData.measurements.length === 0) {
        throw new Error("Excel dosyasında geçerli ölçüm verisi bulunamadı");
      }

      if (excelData.measurements.length > 20) {
        throw new Error("Maksimum 20 ölçüm desteklenir");
      }

      // Excel verilerini sakla
      setExcelMeasurements(excelData.measurements);
      setCurrentMeasurementIndex(0);

      // İlk ölçümü uygulamaya yükle
      const firstMeasurement = excelData.measurements[0];
      setLayers(firstMeasurement.layers);
      setDefaultRho(excelData.defaultRho);
      
      // Otomatik olarak tüm saha profili modunu seç
      setDepthMode("SITE_HS");
      
      // Toplam derinliği hesapla ve custom depth olarak ayarla
      const totalDepth = firstMeasurement.layers.reduce(
        (sum, l) => sum + (typeof l.d === "number" ? l.d : 0),
        0
      );
      setCustomDepth(totalDepth);

      // Preset'i temizle
      setCurrentPreset(null);
      setDeviationAnalysis(null);
    } catch (error) {
      setExcelError(
        error instanceof Error ? error.message : "Excel dosyası okunamadı"
      );
    } finally {
      setExcelLoading(false);
    }
  };

  // Excel dosyası seç
  const selectExcelFile = () => {
    if (!fileInputRef.current) {
      fileInputRef.current = createFileInput(handleExcelUpload);
      document.body.appendChild(fileInputRef.current);
    }
    fileInputRef.current.click();
  };

  // Ölçüm değiştir
  const changeMeasurement = (index: number) => {
    if (index >= 0 && index < excelMeasurements.length) {
      setCurrentMeasurementIndex(index);
      const measurement = excelMeasurements[index];
      setLayers(measurement.layers);
    }
  };

  // Önceki ölçüm
  const previousMeasurement = () => {
    if (currentMeasurementIndex > 0) {
      changeMeasurement(currentMeasurementIndex - 1);
    }
  };

  // Sonraki ölçüm
  const nextMeasurement = () => {
    if (currentMeasurementIndex < excelMeasurements.length - 1) {
      changeMeasurement(currentMeasurementIndex + 1);
    }
  };

  // Excel olarak sonuçları indir (çoklu ölçüm)
  const downloadExcelResults = async () => {
    if (!result || excelMeasurements.length === 0) return;

    // Tüm ölçümler için sonuçları hesapla
    const allResults: Result[] = [];

    for (const measurement of excelMeasurements) {
      const tempLayers = measurement.layers;
      const tempResult = computeResults(
        tempLayers,
        showT,
        defaultRho,
        Number.POSITIVE_INFINITY,
        targetDepth,
        depthMode === "SITE_HS" ? "TOTAL" : "TARGET"
      );

      if (tempResult) {
        allResults.push(tempResult);
      } else {
        // Hata durumunda boş sonuç ekle
        allResults.push({
          H_M12: 0,
          H_M3: 0,
          Vsa_M1: 0,
          Vsa_M2: 0,
          Vsa_M3: 0,
          Vsa_M4: 0,
          Vsa_M5: null,
          Vsa_M6: null,
          Vsa_M7: null,
          T_M1: null,
          T_M2: null,
          T_M3: null,
        });
      }
    }

    exportToExcel(
      excelMeasurements,
      allResults,
      defaultRho,
      targetDepth,
      depthMode
    );
  };

  // useEffect: defaultRho değiştiğinde katmanları güncelle
  useEffect(() => {
    setLayers(
      layers.map((layer) => ({
        ...layer,
        rho: layer.rho === "" ? "" : layer.rho,
      }))
    );
  }, [defaultRho]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold text-gray-900">
            Jeoteknik Hesaplama Asistanı
          </h1>
          <p className="text-lg text-gray-600">
            Çok katmanlı zemin için ortalama kesme dalga hızı hesaplama
          </p>

          {/* Excel İşlemleri */}
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={selectExcelFile}
              disabled={excelLoading}
              className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
            >
              {excelLoading ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Yükleniyor...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                    />
                  </svg>
                  Excel Dosyası Yükle
                </>
              )}
            </button>

            <button
              onClick={downloadSampleExcel}
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Örnek Excel İndir
            </button>
          </div>

          {/* Excel Hata Mesajı */}
          {excelError && (
            <div className="mt-4 rounded-md bg-red-50 p-3">
              <div className="flex items-center gap-2 text-sm text-red-800">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <strong>Excel Hatası:</strong> {excelError}
              </div>
            </div>
          )}

          {/* Çoklu Ölçüm Navigasyonu */}
          {excelMeasurements.length > 0 && (
            <div className="mt-4 rounded-md bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-blue-800">
                  <strong>Çoklu Ölçüm:</strong> {excelMeasurements.length} ölçüm
                  yüklendi
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={previousMeasurement}
                    disabled={currentMeasurementIndex === 0}
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    ← Önceki
                  </button>
                  <span className="text-sm text-blue-700">
                    {currentMeasurementIndex + 1} / {excelMeasurements.length}
                  </span>
                  <button
                    onClick={nextMeasurement}
                    disabled={
                      currentMeasurementIndex === excelMeasurements.length - 1
                    }
                    className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Sonraki →
                  </button>
                </div>
              </div>
              <div className="mt-2 text-xs text-blue-600">
                <strong>Mevcut Ölçüm:</strong>{" "}
                {excelMeasurements[currentMeasurementIndex]?.name ||
                  `Ölçüm ${currentMeasurementIndex + 1}`}
              </div>
            </div>
          )}
        </div>

        {/* Seçilen Profil Bilgisi */}
        {currentPreset && (
          <section className="mb-6 rounded-lg bg-blue-50 p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-blue-900">
              Seçilen Örnek Profil: {currentPreset.name}
            </h2>
            <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
              <div>
                <strong>Derinlik Modu:</strong>{" "}
                {depthMode === "VS30"
                  ? "Vs30"
                  : depthMode === "SITE_HS"
                  ? "Saha Hs"
                  : "Özel"}
              </div>
              <div>
                <strong>Hedef Derinlik:</strong> {targetDepth.toFixed(1)} m
              </div>
              <div>
                <strong>Kullanılan Derinlik (M1/M2):</strong>{" "}
                {result?.H_M12.toFixed(1) || "—"} m
              </div>
              <div>
                <strong>Kullanılan Derinlik (M3):</strong>{" "}
                {result?.H_M3.toFixed(1) || "—"} m
              </div>
            </div>
          </section>
        )}





        {/* Derinlik Modu Kontrolleri */}
        <section className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Derinlik Modu
          </h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              Derinlik modu
              <select
                className="ml-2 rounded border border-neutral-300 px-2 py-1"
                value={depthMode}
                onChange={(e) => setDepthMode(e.target.value as DepthMode)}
              >
                <option value="VS30">Vs30 (30 m)</option>
                <option value="SITE_HS">Saha Hs (tüm profil)</option>
                <option value="CUSTOM">Özel</option>
              </select>
            </label>

            {depthMode === "CUSTOM" && (
              <label className="text-sm">
                Özel derinlik (m)
                <input
                  type="number"
                  min={1}
                  className="ml-2 w-24 rounded border border-neutral-300 px-2 py-1"
                  value={customDepth}
                  onChange={(e) => setCustomDepth(Number(e.target.value))}
                />
              </label>
            )}


          </div>
        </section>

        {/* Giriş Formu */}
        <section className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Zemin Katmanları
            </h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showT}
                  onChange={(e) => setShowT(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">
                  T (temel zemin periyodu) hesapla
                </span>
              </label>
              <button
                onClick={addLayer}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Katman Ekle
              </button>
            </div>
          </div>

          {/* Varsayılan Yoğunluk */}
          <div className="mb-4">
            <label className="text-sm">
              Varsayılan Yoğunluk (kg/m³):
              <input
                type="number"
                min="100"
                max="5000"
                value={defaultRho}
                onChange={(e) => setDefaultRho(Number(e.target.value))}
                className="ml-2 w-24 rounded border border-gray-300 px-2 py-1"
              />
            </label>
          </div>

          {/* Örnek Profil Seçimi */}
          <div className="mb-4">
            <label className="text-sm">
              Örnek profili seç:
              <select
                className="ml-2 rounded border border-gray-300 px-2 py-1"
                onChange={(e) => handlePresetChange(e.target.value)}
                value=""
              >
                <option value="">Seçiniz...</option>
                {PRESETS.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Katman Tablosu */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    #
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    d (m)
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    Vs (m/s)
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    ρᵢ (kg/m³)
                  </th>
                  <th className="border border-gray-300 px-3 py-2 text-left">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody>
                {layers.map((layer, index) => (
                  <tr key={layer.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2">
                      {index + 1}
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={layer.d || ""}
                        onChange={(e) =>
                          updateLayer(layer.id, "d", Number(e.target.value))
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={layer.vs || ""}
                        onChange={(e) =>
                          updateLayer(layer.id, "vs", Number(e.target.value))
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <input
                        type="number"
                        min="100"
                        max="5000"
                        step="50"
                        value={layer.rho || ""}
                        onChange={(e) =>
                          updateLayer(
                            layer.id,
                            "rho",
                            e.target.value === "" ? "" : Number(e.target.value)
                          )
                        }
                        placeholder={defaultRho.toString()}
                        className="w-20 rounded border border-gray-300 px-2 py-1"
                      />
                    </td>
                    <td className="border border-gray-300 px-3 py-2">
                      <button
                        onClick={() => removeLayer(layer.id)}
                        className="rounded bg-red-500 px-2 py-1 text-white hover:bg-red-600"
                        disabled={layers.length === 1}
                      >
                        Kaldır
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Hata Mesajları */}
          {errors.length > 0 && (
            <div className="mt-4 rounded-md bg-red-50 p-4">
              <h3 className="text-sm font-medium text-red-800">Hatalar:</h3>
              <ul className="mt-2 list-inside list-disc text-sm text-red-700">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Butonlar */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={resetData}
              className="rounded bg-gray-500 px-4 py-2 text-white hover:bg-gray-600"
            >
              Veri Sıfırla
            </button>

            <button
              onClick={downloadExcelResults}
              disabled={!result}
              className="rounded bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
            >
              Excel İndir
            </button>
            {currentPreset && (
              <button
                onClick={downloadGeotechnicalReport}
                disabled={!result}
                className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
              >
                Jeoteknik Rapor İndir
              </button>
            )}
          </div>
        </section>

        {/* Sonuçlar */}
        {result && (
          <section className="mb-6 rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Sonuçlar
            </h2>

            {/* Kullanılan H Bilgisi */}
            <div className="mb-4 rounded-md bg-blue-50 p-3">
              <div className="text-sm text-blue-800">
                <strong>H (M1/M2):</strong> {result.H_M12.toFixed(2)} m
                {depthMode === "VS30" && " (Vs30 hedefi: 30 m)"}
                {depthMode === "SITE_HS" && " (tüm profil)"}
                {depthMode === "CUSTOM" && ` (özel hedef: ${customDepth} m)`}
              </div>
              <div className="text-sm text-blue-800">
                <strong>H (M3):</strong> {result.H_M3.toFixed(2)} m
              </div>
              <div className="mt-2 text-xs text-blue-600">
                <strong>Hesaplama Detayı:</strong> M1/M2: tam profil, M3:{" "}
                {targetDepth.toFixed(1)}m derinlik
              </div>
            </div>

            {/* VSA Sonuçları */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
              <div className="rounded-lg bg-blue-50 p-4">
                <h3 className="mb-2 font-semibold text-blue-900">M1 Sonucu</h3>
                <div className="text-2xl font-bold text-blue-700">
                  {result.Vsa_M1.toFixed(1)} m/s
                </div>
                {showT && result.T_M1 && (
                  <div className="mt-2 text-sm text-blue-600">
                    T: {result.T_M1.toFixed(3)} s
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-green-50 p-4">
                <h3 className="mb-2 font-semibold text-green-900">M2 Sonucu</h3>
                <div className="text-2xl font-bold text-green-700">
                  {result.Vsa_M2.toFixed(1)} m/s
                </div>
                {showT && result.T_M2 && (
                  <div className="mt-2 text-sm text-green-600">
                    T: {result.T_M2.toFixed(3)} s
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-purple-50 p-4">
                <h3 className="mb-2 font-semibold text-purple-900">
                  M3 Sonucu
                </h3>
                <div className="text-2xl font-bold text-purple-700">
                  {result.Vsa_M3.toFixed(1)} m/s
                </div>
                {showT && result.T_M3 && (
                  <div className="mt-2 text-sm text-purple-600">
                    T: {result.T_M3.toFixed(3)} s
                  </div>
                )}
              </div>

              <div className="rounded-lg bg-orange-50 p-4">
                <h3 className="mb-2 font-semibold text-orange-900">
                  M4 Sonucu
                </h3>
                <div className="text-2xl font-bold text-orange-700">
                  {result.Vsa_M4.toFixed(1)} m/s
                </div>
              </div>

              <div className="rounded-lg bg-red-50 p-4">
                <h3 className="mb-2 font-semibold text-red-900">M5 Sonucu</h3>
                <div className="text-2xl font-bold text-red-700">
                  {result.Vsa_M5?.toFixed(1) || "—"} m/s
                </div>
              </div>

              <div className="rounded-lg bg-indigo-50 p-4">
                <h3 className="mb-2 font-semibold text-indigo-900">
                  M6 Sonucu
                </h3>
                <div className="text-2xl font-bold text-indigo-700">
                  {result.Vsa_M6?.toFixed(1) || "—"} m/s
                </div>
              </div>

              <div className="rounded-lg bg-teal-50 p-4">
                <h3 className="mb-2 font-semibold text-teal-900">M7 Sonucu</h3>
                <div className="text-2xl font-bold text-teal-700">
                  {result.Vsa_M7?.toFixed(1) || "—"} m/s
                </div>
              </div>
            </div>

            {/* Sapma Analizi ve Derinlik Daraltma Önerisi */}
            {deviationAnalysis && currentPreset && (
              <div className="mt-6 rounded-lg bg-yellow-50 p-4">
                <h3 className="mb-3 font-semibold text-yellow-900">
                  Sapma Analizi
                </h3>

                {/* Beklenen Çıktılar */}
                <div className="mb-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-7">
                  <div>
                    <strong>M1:</strong> {currentPreset.expected.Vsa_M1} m/s
                  </div>
                  <div>
                    <strong>M2:</strong> {currentPreset.expected.Vsa_M2} m/s
                  </div>
                  <div>
                    <strong>M3:</strong> {currentPreset.expected.Vsa_M3} m/s
                  </div>
                  <div>
                    <strong>M4:</strong> {currentPreset.expected.Vsa_M4 || "—"}{" "}
                    m/s
                  </div>
                  <div>
                    <strong>M5:</strong> {currentPreset.expected.Vsa_M5 || "—"}{" "}
                    m/s
                  </div>
                  <div>
                    <strong>M6:</strong> {currentPreset.expected.Vsa_M6 || "—"}{" "}
                    m/s
                  </div>
                  <div>
                    <strong>M7:</strong> {currentPreset.expected.Vsa_M7 || "—"}{" "}
                    m/s
                  </div>
                </div>

                {/* Sapma Yüzdeleri */}
                <div className="mb-3 text-sm">
                  <strong>Sapma Yüzdeleri:</strong>
                  <ul className="mt-1 list-inside list-disc">
                    <li>M1: %{deviationAnalysis.deviations.M1.toFixed(1)}</li>
                    <li>M2: %{deviationAnalysis.deviations.M2.toFixed(1)}</li>
                    <li>M3: %{deviationAnalysis.deviations.M3.toFixed(1)}</li>
                    {deviationAnalysis.deviations.M4 && (
                      <li>M4: %{deviationAnalysis.deviations.M4.toFixed(1)}</li>
                    )}
                    {deviationAnalysis.deviations.M5 && (
                      <li>M5: %{deviationAnalysis.deviations.M5.toFixed(1)}</li>
                    )}
                    {deviationAnalysis.deviations.M6 && (
                      <li>M6: %{deviationAnalysis.deviations.M6.toFixed(1)}</li>
                    )}
                    {deviationAnalysis.deviations.M7 && (
                      <li>M7: %{deviationAnalysis.deviations.M7.toFixed(1)}</li>
                    )}
                  </ul>
                </div>

                {/* Derinlik Daraltma Önerisi */}
                {deviationAnalysis.needsNarrowing && (
                  <div className="rounded-md bg-orange-100 p-3">
                    <div className="text-sm text-orange-800">
                      <strong>⚠️ Yüksek Sapma Tespit Edildi!</strong>
                      <br />
                      Derinlik aralığını daraltmamı ister misiniz?
                    </div>
                    <button
                      onClick={handleNarrowDepth}
                      className="mt-2 rounded bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700"
                    >
                      Derinliği Daralt
                    </button>
                  </div>
                )}

                {/* Düşük Sapma Mesajı */}
                {!deviationAnalysis.needsNarrowing && (
                  <div className="text-sm text-green-700">
                    ✅ Sapmalar kabul edilebilir seviyede (%5'den küçük)
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Excel Format Bilgisi */}
        <section className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Excel Dosya Formatı
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="rounded-md bg-blue-50 p-4">
              <h3 className="mb-2 font-semibold text-blue-900">
                Excel Dosyası Nasıl Hazırlanır? (Çoklu Ölçüm)
              </h3>
              <div className="space-y-2">
                <p>
                  <strong>1. Format:</strong> Excel dosyası .xlsx formatında
                  olmalıdır
                </p>
                <p>
                  <strong>2. Sütun Sırası:</strong> [Ölçüm Adı] [Vs (m/s)] [ρ
                  (kg/m³)] [Kalınlık (m)]
                </p>
                <p>
                  <strong>3. İlk Satır:</strong> Başlık satırı olmalıdır (örn:
                  "Ölçüm Adı", "Vs", "ρ", "Kalınlık")
                </p>
                <p>
                  <strong>4. Çoklu Ölçüm:</strong> Her ölçüm için başlık satırı
                  ekleyin
                </p>
                <p>
                  <strong>5. Veri Satırları:</strong> Başlık satırından sonra
                  katman verileri
                </p>
                <p>
                  <strong>6. Zorunlu Alanlar:</strong> Vs ve Kalınlık mutlaka
                  doldurulmalıdır
                </p>
                                 <p>
                   <strong>7. İsteğe Bağlı:</strong> ρ boş bırakılırsa varsayılan
                   değer (1900 kg/m³) kullanılır
                 </p>
                 <p>
                   <strong>8. Maksimum:</strong> 20 ölçüm desteklenir
                 </p>
                 <p>
                   <strong>9. Derinlik Modu:</strong> Otomatik olarak "Saha Hs (tüm profil)" seçilir
                 </p>
              </div>
            </div>

            <div className="rounded-md bg-green-50 p-4">
              <h3 className="mb-2 font-semibold text-green-900">
                Örnek Veri Yapısı (Çoklu Ölçüm):
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300 text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-2 py-1">
                        Ölçüm Adı
                      </th>
                      <th className="border border-gray-300 px-2 py-1">
                        Vs (m/s)
                      </th>
                      <th className="border border-gray-300 px-2 py-1">
                        ρ (kg/m³)
                      </th>
                      <th className="border border-gray-300 px-2 py-1">
                        Kalınlık (m)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1">
                        Saha 1
                      </td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1"></td>
                      <td className="border border-gray-300 px-2 py-1">180</td>
                      <td className="border border-gray-300 px-2 py-1">1900</td>
                      <td className="border border-gray-300 px-2 py-1">5</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1"></td>
                      <td className="border border-gray-300 px-2 py-1">300</td>
                      <td className="border border-gray-300 px-2 py-1">2000</td>
                      <td className="border border-gray-300 px-2 py-1">10</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1"></td>
                      <td className="border border-gray-300 px-2 py-1">600</td>
                      <td className="border border-gray-300 px-2 py-1">2100</td>
                      <td className="border border-gray-300 px-2 py-1">15</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1">
                        Saha 2
                      </td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                      <td className="border border-gray-300 px-2 py-1"></td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1"></td>
                      <td className="border border-gray-300 px-2 py-1">200</td>
                      <td className="border border-gray-300 px-2 py-1">1950</td>
                      <td className="border border-gray-300 px-2 py-1">8</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-2 py-1"></td>
                      <td className="border border-gray-300 px-2 py-1">350</td>
                      <td className="border border-gray-300 px-2 py-1">2050</td>
                      <td className="border border-gray-300 px-2 py-1">12</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-md bg-yellow-50 p-4">
              <h3 className="mb-2 font-semibold text-yellow-900">
                Önemli Notlar:
              </h3>
              <ul className="list-inside list-disc space-y-1">
                <li>En az 1 katman olmalıdır</li>
                <li>Vs ve Kalınlık pozitif sayı olmalıdır</li>
                <li>ρ değeri 100-5000 kg/m³ arasında olmalıdır</li>
                <li>Toplam derinlik 1000 m'yi geçmemelidir</li>
                <li>Vs değeri 6000 m/s'yi geçmemelidir</li>
                                 <li>Maksimum 20 ölçüm desteklenir</li>
                 <li>Her ölçüm için en az 1 katman olmalıdır</li>
                 <li>Derinlik modu otomatik olarak "Saha Hs (tüm profil)" olarak ayarlanır</li>
                 <li>Kullanıcı isterse derinlik modunu değiştirebilir</li>
                 <li>
                   Örnek Excel dosyasını indirip referans olarak
                   kullanabilirsiniz
                 </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Formüller */}
        <section className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Formüller
          </h2>
          <div className="space-y-3 text-sm text-gray-700">
            <div>
              <strong>M1:</strong> Vsa = √(Σ(dᵢ × Vsᵢ²) / H) - Katmanların kesme
              dalga hızlarının ağırlıklı kare ortalamasının karekökü
            </div>
            <div>
              <strong>M2:</strong> Vsa = Σ(dᵢ × Vsᵢ) / H - Katmanların kesme
              dalga hızlarının ağırlıklı aritmetik ortalaması
            </div>
            <div>
              <strong>M3:</strong> T = 2π × √(Σ(ρᵢ dᵢ × avg(w²)ᵢ) / Σ((Gᵢ/dᵢ) ×
              (Δwᵢ)²)) - Rayleigh uyumlu, tam SI
            </div>
            <div>
              <strong>M4:</strong> Vsa = H / Σ(dᵢ / Vsᵢ) — Zamana göre
              ağırlıklandırılmış (harmonik) ortalama
            </div>
            <div>
              <strong>M5:</strong> Vsa = H / Σ(dᵢ / Vsᵢ) — Harmonik ortalama (M4
              ile aynı formül, farklı uygulama)
            </div>
            <div>
              <strong>M6:</strong> Vsa = 4H / T — Rayleigh periyodu kullanarak
              ASWV-FSP ilişkisi
            </div>
            <div>
              <strong>M7:</strong> Vsa = 4H / T — Önerilen yeni yöntem (T =
              5.515 × Σ√(Sᵢ × dᵢ / Gᵢ))
            </div>
            <div>
              <strong>ASWV–FSP:</strong> Vsa = 4H / T - Ortalama kesme dalga
              hızı ile temel zemin periyodu arasındaki ilişki
            </div>
            <div className="mt-4 text-xs text-gray-500">
              <strong>Not:</strong> H = Σdᵢ (toplam kalınlık), dᵢ = katman
              kalınlığı (m), Vsᵢ = kesme dalga hızı (m/s), ρᵢ = yoğunluk
              (kg/m³), Gᵢ = kayma modülü (Pa), wᵢ = statik mod yaklaşık biçimi
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;
