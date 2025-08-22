// src/lib/calc.ts
import type { Preset } from "../presets";

export type Layer = {
  id: string;
  d: number | "";
  vs: number | "";
  rho?: number | ""; // kg/m³
};

export type Result = {
  H_M12: number; // M1/M2'de kullanılan H
  H_M3: number; // M3'te kullanılan H (Hs)
  Vsa_M1: number;
  Vsa_M2: number;
  Vsa_M3: number;
  Vsa_M4: number;
  Vsa_M5: number | null;
  Vsa_M6: number | null;
  Vsa_M7: number | null;
  T_M1: number | null;
  T_M2: number | null;
  T_M3: number | null;
};

/** --------------------------- yardımcılar --------------------------- **/

export function trimLayersToDepth(
  layers: Layer[],
  targetDepth: number
): Layer[] {
  const out: Layer[] = [];
  let acc = 0;
  for (const L of layers) {
    if (typeof L.d !== "number" || typeof L.vs !== "number") break;
    if (acc >= targetDepth) break;
    const remain = targetDepth - acc;
    const useD = Math.min(L.d, Math.max(0, remain));
    if (useD > 0) {
      out.push({
        id: L.id,
        d: useD,
        vs: L.vs,
        rho: typeof L.rho === "number" ? L.rho : undefined,
      });
      acc += useD;
    }
  }
  return out;
}

/** SI: rho [kg/m³], Vs [m/s] → G [Pa] */
export function computeG(vs: number, rhoKgPerM3: number): number {
  return rhoKgPerM3 * vs * vs; // Pa
}

/** Toplam kalınlık */
export function computeH(layers: Layer[]): number {
  return layers.reduce(
    (sum, L) => sum + (typeof L.d === "number" ? L.d : 0),
    0
  );
}

/** --------------------------- M1 / M2 / M4 --------------------------- **/

/** M1: Vsa = sqrt( Σ (d_i * Vs_i^2) / H ) */
export function computeVsaM1(layers: Layer[]): number | null {
  const H = computeH(layers);
  if (!(H > 0)) return null;
  let sum = 0;
  for (const L of layers) {
    if (typeof L.d !== "number" || typeof L.vs !== "number") return null;
    sum += L.d * L.vs * L.vs;
  }
  return Math.sqrt(sum / H);
}

/** M2: Vsa = Σ (d_i * Vs_i) / H */
export function computeVsaM2(layers: Layer[]): number | null {
  const H = computeH(layers);
  if (!(H > 0)) return null;
  let sum = 0;
  for (const L of layers) {
    if (typeof L.d !== "number" || typeof L.vs !== "number") return null;
    sum += L.d * L.vs;
  }
  return sum / H;
}

/** M4 (Japan Earthquake Code weighted version): T = sqrt(32 * Σ (d_i * (H_{i-1} + H_i)/2 / Vs_i^2)), Vsa = 4H / T */
export function computeVsaM4(layers: Layer[]): number | null {
  const H = computeH(layers);
  if (!(H > 0)) return null;
  let sum = 0;
  let accH = 0;
  for (const L of layers) {
    if (typeof L.d !== "number" || typeof L.vs !== "number") return null;
    if (!(L.d > 0) || !(L.vs > 0)) return null;
    const Hi_minus_1 = accH;
    accH += L.d;
    const Hi = accH;
    sum += (L.d * (Hi_minus_1 + Hi)) / 2 / (L.vs * L.vs);
  }
  if (!(sum > 0)) return null;
  const T = Math.sqrt(32 * sum);
  if (!(T > 0)) return null;
  return (4 * H) / T;
}

export function computeVsaM5(layers: Layer[]): number | null {
  const H = computeH(layers);
  if (!(H > 0)) return null;
  let sum = 0;
  for (const L of layers) {
    if (typeof L.d !== "number" || typeof L.vs !== "number" || L.vs <= 0)
      return null;
    sum += L.d / L.vs;
  }
  if (!(sum > 0)) return null;
  return H / sum;
}

export function computeVsaM6(
  layers: Layer[],
  defaultRhoKgPerM3: number = 1900
): number | null {
  const H = computeH(layers);
  if (!(H > 0)) return null;
  const T = computeTM3_RAYLEIGH(layers, defaultRhoKgPerM3);
  if (T == null) return null;
  return (4 * H) / T;
}

export function computeVsaM7(
  layers: Layer[],
  defaultRhoKgPerM3: number = 1900
): number | null {
  const H = computeH(layers);
  if (!(H > 0)) return null;
  const T = computeTM7_PROPOSED(layers, defaultRhoKgPerM3);
  if (T == null) return null;
  return (4 * H) / T;
}

/** --------------------------- M3 (MOC-2008 ve Rayleigh) --------------------------- **/

/** w arayüzleri (bedrock→surface): w[0]=0 (anakaya), w[N]=1 (yüzey)
 *  Girdi layers: surface→bedrock (kırpılmış). İçeride ters çeviririz.
 *  w, MOC-2008’de tanımlandığı gibi d/G kümülatifinin normalize edilmesiyle elde edilir. */
function computeWInterfacesBedrockUp(
  layersSurfaceDown: Layer[],
  defaultRhoKgPerM3: number
): { w: number[]; dOverG_sum: number; bottomUp: Layer[] } | null {
  if (!layersSurfaceDown.length) return null;
  const bottomUp = [...layersSurfaceDown].reverse();

  // d/G parçaları
  const parts: number[] = [];
  let denom = 0;
  for (const L of bottomUp) {
    if (typeof L.d !== "number" || typeof L.vs !== "number") return null;
    const rho = typeof L.rho === "number" ? L.rho : defaultRhoKgPerM3;
    const G = computeG(L.vs, rho); // Pa
    const t = L.d / G; // m/Pa
    parts.push(t);
    denom += t;
  }
  if (!(denom > 0)) return null;

  // w[0]=0; kümülatif topla ve 0..1'e ölçekle
  const w: number[] = [0];
  let s = 0;
  for (const t of parts) {
    s += t;
    w.push(s / denom);
  }
  return { w, dOverG_sum: denom, bottomUp };
}

/** M3 — MOC-2008 formülü (T_s = 4 * sqrt( (Σ d/G) * (Σ ρ d avg(w^2)) ) ) */
export function computeTM3_MOC(
  layersSurfaceDown: Layer[],
  defaultRhoKgPerM3: number = 1900
): number | null {
  const info = computeWInterfacesBedrockUp(
    layersSurfaceDown,
    defaultRhoKgPerM3
  );
  if (!info) return null;
  const { w, dOverG_sum, bottomUp } = info;

  // Kütle terimi: Σ ρ_i d_i * avg(w^2)_i
  let massTerm = 0; // kg/m²
  for (let k = 0; k < bottomUp.length; k++) {
    const L = bottomUp[k];
    if (typeof L.d !== "number" || typeof L.vs !== "number") return null;
    const rho = typeof L.rho === "number" ? L.rho : defaultRhoKgPerM3; // kg/m³
    const d = L.d;
    const w_bot = w[k];
    const w_top = w[k + 1];
    const avg_w2 = (w_top * w_top + w_top * w_bot + w_bot * w_bot) / 3; // —
    massTerm += rho * d * avg_w2; // kg/m³ * m = kg/m²
  }
  if (!(massTerm > 0 && dOverG_sum > 0)) return null;

  // Ts (s) — MOC-2008
  const Ts = 4 * Math.sqrt(dOverG_sum * massTerm * 3);
  return Ts;
}

/** M3 — Rayleigh (paper-adapted): T = 2π * sqrt( Σ m_i δ_i² / Σ f_i δ_i ) with linear assumed shape */
export function computeTM3_RAYLEIGH(
  layersSurfaceDown: Layer[],
  defaultRhoKgPerM3: number = 1900
): number | null {
  if (!layersSurfaceDown.length) return null;
  const n = layersSurfaceDown.length;
  const bottomUp: Layer[] = [...layersSurfaceDown].reverse(); // base (i=0) to surface (i=n-1)
  const H = computeH(bottomUp);
  if (!(H > 0)) return null;

  // Compute G_i, rho_i, validate
  const G: number[] = [];
  const rho: number[] = [];
  const d: number[] = bottomUp.map((L) => L.d as number);
  for (let i = 0; i < n; i++) {
    const rhoValue =
      typeof bottomUp[i].rho === "number" && bottomUp[i].rho !== ""
        ? bottomUp[i].rho
        : defaultRhoKgPerM3;
    rho[i] = rhoValue;
    G[i] = computeG(bottomUp[i].vs as number, rhoValue);
    if (G[i] <= 0 || rhoValue <= 0 || d[i] <= 0) return null;
  }

  // Lumped masses m_i (i=0 base layer mass to i=n-1 surface) - symmetric lumping
  const m: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      m[i] = (rho[i] * d[i]) / 2;
    } else {
      m[i] = (rho[i] * d[i] + rho[i + 1] * d[i + 1]) / 2;
    }
  }

  // Positions: height from base to mass i (mid-layer approx)
  const posFromBase: number[] = [];
  let accH = 0;
  for (let i = 0; i < n; i++) {
    posFromBase[i] = accH + d[i] / 2;
    accH += d[i];
  }

  // Denominator for f_i
  let sumDen = 0;
  for (let i = 0; i < n; i++) {
    sumDen += m[i] * posFromBase[i];
  }
  if (!(sumDen > 0)) return null;

  // Forces f_i
  const f: number[] = [];
  for (let i = 0; i < n; i++) {
    f[i] = (m[i] * posFromBase[i]) / sumDen;
  }

  // Cumulative shear Q_i for layer i (sum forces above layer i, i.e. from surface down)
  const Q: number[] = [];
  let cumF = 0;
  for (let i = n - 1; i >= 0; i--) {
    // Start from surface
    cumF += f[i];
    Q[i] = cumF;
  }

  // Deflections δ_i at mass i, cumulative from base
  const delta: number[] = [];
  delta[0] = (Q[0] * d[0]) / G[0];
  for (let i = 1; i < n; i++) {
    delta[i] = delta[i - 1] + (Q[i] * d[i]) / G[i];
  }

  // Sums for Rayleigh
  let sumMDelta2 = 0;
  let sumFDelta = 0;
  for (let i = 0; i < n; i++) {
    sumMDelta2 += m[i] * delta[i] ** 2;
    sumFDelta += f[i] * delta[i];
  }
  if (!(sumFDelta > 0)) return null;

  return 2 * Math.PI * Math.sqrt(sumMDelta2 / sumFDelta);
}

/** New: Proposed method from the paper (M7): T = 5.515 * sum sqrt( S_i * d_i / G_i ), Vsa = 4H / T */
/** M7 (Bozdogan & Keskin, düzeltilmiş): 
 *  T = k * sqrt( Σ (S_i * d_i / G_i) ),  Vsa = 4H / T
 *  Burada S_i = (üstteki kümülatif kütle) + (katmanın yarı kütlesi),
 *  G_i = ρ_i * Vs_i^2, k ≈ 5.515 (çok katmanlı kalibrasyon).
 */
export function computeTM7_PROPOSED(
  layersSurfaceDown: Layer[],
  defaultRhoKgPerM3: number = 1900,
  useSingleLayerConstant: boolean = false // tek katman için opsiyonel 5.657
): number | null {
  if (!layersSurfaceDown.length) return null;

  const n = layersSurfaceDown.length;
  const bottomUp = [...layersSurfaceDown].reverse(); // base → surface
  const H = computeH(bottomUp);
  if (!(H > 0)) return null;

  // d_i, ρ_i, G_i doğrulama
  const d: number[] = [];
  const rho: number[] = [];
  const G: number[] = [];
  for (let i = 0; i < n; i++) {
    const Li = bottomUp[i];
    if (typeof Li.d !== "number" || Li.d <= 0) return null;
    if (typeof Li.vs !== "number" || Li.vs <= 0) return null;

    const rhoVal = typeof Li.rho === "number" ? Li.rho : defaultRhoKgPerM3;
    if (!(rhoVal > 0)) return null;

    d[i] = Li.d;
    rho[i] = rhoVal;
    G[i] = computeG(Li.vs, rhoVal); // Pa
    if (!(G[i] > 0)) return null;
  }

  // S_i: (üstteki kümülatif kütle) + (katmanın yarı kütlesi)
  const S: number[] = [];
  let cumMassAbove = 0;
  for (let i = n - 1; i >= 0; i--) {
    S[i] = cumMassAbove + (rho[i] * d[i]) / 2; // kg/m²
    cumMassAbove += rho[i] * d[i];
  }

  // δ_peak = Σ (S_i * d_i / G_i)
  let sum_term = 0;
  for (let i = 0; i < n; i++) {
    sum_term += (S[i] * d[i]) / G[i]; // boyutsal olarak m/Pa
  }
  if (!(sum_term > 0)) return null;

  // Kalibrasyon katsayısı: çok katmanlı için 5.515; tek katman opsiyonel 5.657
  const k = (n === 1 && useSingleLayerConstant) ? 4 * Math.sqrt(2) : 5.515;

  // T (s)
  return k * Math.sqrt(sum_term);
}

/** --------------------------- ASWV–FSP ilişkisi --------------------------- **/

/** ASWV–FSP: Vsa = 4H / T  */
export function computeVsaFromT(H: number, T: number | null): number | null {
  if (!isFinite(H) || H <= 0 || !T || !isFinite(T) || T <= 0) return null;
  return (4 * H) / T;
}

/** T = 4H / Vsa  */
export function computeT(H: number, Vsa: number | null): number | null {
  if (!isFinite(H) || H <= 0 || !Vsa || !isFinite(Vsa) || Vsa <= 0) return null;
  return (4 * H) / Vsa;
}

/** --------------------------- Sonuçlar --------------------------- **/
/**
 * m3DepthMode:
 *  - "TOTAL": M3 için Hs = toplam profil kalınlığı
 *  - "TARGET": M3 için Hs = targetDepthM3 (örn. Vs30 için 30 m)
 * m3Formula:
 *  - "MOC": T_s = 4 * sqrt( (Σ d/G) * (Σ ρ d avg(w^2)) )
 *  - "RAYLEIGH": T = 2π * sqrt( Σ ρ d avg(w^2) / Σ (G/d)(Δw)^2 )
 */
export function computeResults(
  layersSurfaceDown: Layer[],
  showT: boolean,
  defaultRho: number = 1900,
  targetDepthM12: number = Number.POSITIVE_INFINITY, // M1/M2: tüm profil
  targetDepthM3: number = 30, // M3: hedef derinlik
  m3DepthMode: "TOTAL" | "TARGET" = "TOTAL",
  m3Formula: "MOC" | "RAYLEIGH" = "MOC"
): Result | null {
  // --- M1/M2/M4 (genelde tüm profil) ---
  const Ls12 = isFinite(targetDepthM12)
    ? trimLayersToDepth(layersSurfaceDown, targetDepthM12)
    : layersSurfaceDown;
  if (!Ls12.length) return null;
  const H12 = computeH(Ls12);
  const Vsa_M1 = computeVsaM1(Ls12);
  const Vsa_M2 = computeVsaM2(Ls12);
  const Vsa_M4 = computeVsaM4(Ls12);
  const Vsa_M5 = computeVsaM5(Ls12);
  const Vsa_M6 = computeVsaM6(Ls12, defaultRho);
  const Vsa_M7 = computeVsaM7(Ls12, defaultRho);
  if (
    !(H12 > 0) ||
    Vsa_M1 == null ||
    Vsa_M2 == null ||
    Vsa_M4 == null ||
    Vsa_M5 == null ||
    Vsa_M6 == null ||
    Vsa_M7 == null
  )
    return null;

  // --- M3 (Hs seçimi) ---
  let Ls3: Layer[], H3: number;
  if (m3DepthMode === "TOTAL") {
    Ls3 = layersSurfaceDown;
    H3 = computeProfileDepth(layersSurfaceDown);
  } else {
    Ls3 = trimLayersToDepth(layersSurfaceDown, targetDepthM3);
    H3 = computeH(Ls3);
  }
  if (!Ls3.length || !(H3 > 0)) return null;

  // T_M3: formül seçimi
  const T_M3_tmp =
    m3Formula === "MOC"
      ? computeTM3_MOC(Ls3, defaultRho)
      : computeTM3_RAYLEIGH(Ls3, defaultRho);

  const Vsa_M3 = computeVsaFromT(H3, T_M3_tmp);
  if (Vsa_M3 == null) return null;

  const result: Result = {
    H_M12: H12,
    H_M3: H3,
    Vsa_M1,
    Vsa_M2,
    Vsa_M3,
    Vsa_M4,
    Vsa_M5,
    Vsa_M6,
    Vsa_M7,
    T_M1: null,
    T_M2: null,
    T_M3: null,
  };

  if (showT) {
    result.T_M1 = computeT(H12, Vsa_M1);
    result.T_M2 = computeT(H12, Vsa_M2);
    result.T_M3 = T_M3_tmp ?? null;
  }
  return result;
}

/** Basit doğrulama */
export function validateLayer(layer: Layer): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (typeof layer.d !== "number" || layer.d <= 0)
    errors.push("Kalınlık pozitif bir sayı olmalıdır");
  if (typeof layer.vs !== "number" || layer.vs <= 0)
    errors.push("Kesme dalga hızı pozitif bir sayı olmalıdır");
  if (typeof layer.rho === "number" && (layer.rho <= 0 || layer.rho > 5000))
    errors.push("Yoğunluk 0-5000 kg/m³ arasında olmalıdır");
  if (typeof layer.d === "number" && layer.d > 10000)
    errors.push("Kalınlık çok büyük (10,000 m'den fazla)");
  if (typeof layer.vs === "number" && layer.vs > 6000)
    errors.push("Kesme dalga hızı çok büyük (6,000 m/s'den fazla)");
  return { isValid: errors.length === 0, errors };
}

function computeProfileDepth(layers: Layer[]): number {
  return layers.reduce((s, L) => s + (typeof L.d === "number" ? L.d : 0), 0);
}

/** --------- M3 derinlik kalibrasyonu / raporlama yardımcıları (değişmedi) --------- **/

function computeVsaM3AtDepth(
  layers: Layer[],
  rhoDefault: number,
  H: number,
  m3Formula: "MOC" | "RAYLEIGH" = "MOC"
): number | null {
  const Ls = trimLayersToDepth(layers, H);
  const Hused = computeH(Ls);
  if (!(Hused > 0)) return null;
  const T =
    m3Formula === "MOC"
      ? computeTM3_MOC(Ls, rhoDefault)
      : computeTM3_RAYLEIGH(Ls, rhoDefault);
  return computeVsaFromT(Hused, T);
}

// golden-section, calibrateDepthForTargetVsaM3, sapma analizleri vs. (aynen)
function goldenSectionMin(
  f: (x: number) => number,
  a: number,
  b: number,
  iters = 40,
  tol = 1e-3
): number {
  const phi = (Math.sqrt(5) - 1) / 2;
  let x1 = b - phi * (b - a);
  let x2 = a + phi * (b - a);
  let f1 = f(x1);
  let f2 = f(x2);
  for (let i = 0; i < iters && Math.abs(b - a) > tol; i++) {
    if (f1 > f2) {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + phi * (b - a);
      f2 = f(x2);
    } else {
      b = x2;
      x2 = x1;
      f2 = f1;
      x1 = b - phi * (b - a);
      f1 = f(x1);
    }
  }
  const fa = f(a),
    fb = f(b);
  if (Math.abs(fa - fb) < 1e-12) return Math.min(a, b);
  return fa <= fb ? a : b;
}

export function calibrateDepthForTargetVsaM3(
  layers: Layer[],
  rhoDefault: number,
  vsaTarget: number,
  Hmin = 5,
  Hmax = 120,
  tolV = 0.5,
  maxIter = 60,
  seedDepth?: number,
  m3Formula: "MOC" | "RAYLEIGH" = "MOC"
): number | null {
  const Hprof = computeProfileDepth(layers);
  if (!(Hprof > 0)) return null;
  Hmax = Math.min(Hmax, Hprof);
  Hmin = Math.max(Hmin, 1);
  if (Hmin >= Hmax) Hmin = Math.max(1, Math.min(Hprof, Hmax * 0.5));

  const err = (H: number) => {
    const v = computeVsaM3AtDepth(layers, rhoDefault, H, m3Formula);
    return v == null ? Number.POSITIVE_INFINITY : Math.abs(v - vsaTarget);
  };

  const N = 60;
  let bestH = Hmin,
    bestE = err(Hmin);
  let a = Hmin,
    b = Hmax;
  if (seedDepth && seedDepth > Hmin && seedDepth < Hmax) {
    a = Math.max(Hmin, seedDepth * 0.5);
    b = Math.min(Hmax, seedDepth * 1.5);
  }
  for (let i = 0; i <= N; i++) {
    const H = a + (i * (b - a)) / N;
    const e = err(H);
    if (e < bestE || (Math.abs(e - bestE) < 1e-12 && H < bestH)) {
      bestE = e;
      bestH = H;
    }
  }
  if (bestE <= tolV) return Number(bestH.toFixed(2));

  const span = Math.max(2, 0.2 * (b - a));
  const left = Math.max(Hmin, bestH - span);
  const right = Math.min(Hmax, bestH + span);
  const Hopt = goldenSectionMin(err, left, right, maxIter, 1e-3);

  const eOpt = err(Hopt);
  const candidates = [
    { H: Hopt, e: eOpt },
    { H: bestH, e: bestE },
  ].sort((p, q) => (p.e === q.e ? p.H - q.H : p.e - q.e));
  return Number(candidates[0].H.toFixed(2));
}

/** --------------------------- Jeoteknik Asistan --------------------------- **/

export function calculateDeviation(
  calculated: number,
  expected: number
): number {
  return Math.abs((calculated - expected) / expected) * 100;
}

export function isDeviationHigh(calculated: number, expected: number): boolean {
  return calculateDeviation(calculated, expected) > 5;
}

export function analyzeDeviations(
  result: Result,
  expected: {
    Vsa_M1: number;
    Vsa_M2: number;
    Vsa_M3: number;
    Vsa_M4?: number;
    Vsa_M5?: number;
    Vsa_M6?: number;
    Vsa_M7?: number;
  }
): {
  deviations: {
    M1: number;
    M2: number;
    M3: number;
    M4?: number;
    M5?: number;
    M6?: number;
    M7?: number;
  };
  highDeviations: string[];
  needsNarrowing: boolean;
} {
  const deviations = {
    M1: calculateDeviation(result.Vsa_M1, expected.Vsa_M1),
    M2: calculateDeviation(result.Vsa_M2, expected.Vsa_M2),
    M3: calculateDeviation(result.Vsa_M3, expected.Vsa_M3),
    ...(expected.Vsa_M4 && {
      M4: calculateDeviation(result.Vsa_M4, expected.Vsa_M4),
    }),
    ...(expected.Vsa_M5 &&
      result.Vsa_M5 && {
        M5: calculateDeviation(result.Vsa_M5, expected.Vsa_M5),
      }),
    ...(expected.Vsa_M6 &&
      result.Vsa_M6 && {
        M6: calculateDeviation(result.Vsa_M6, expected.Vsa_M6),
      }),
    ...(expected.Vsa_M7 &&
      result.Vsa_M7 && {
        M7: calculateDeviation(result.Vsa_M7, expected.Vsa_M7),
      }),
  };

  const highDeviations: string[] = [];
  if (isDeviationHigh(result.Vsa_M1, expected.Vsa_M1)) {
    highDeviations.push(`M1: %${deviations.M1.toFixed(1)}`);
  }
  if (isDeviationHigh(result.Vsa_M2, expected.Vsa_M2)) {
    highDeviations.push(`M2: %${deviations.M2.toFixed(1)}`);
  }
  if (isDeviationHigh(result.Vsa_M3, expected.Vsa_M3)) {
    highDeviations.push(`M3: %${deviations.M3.toFixed(1)}`);
  }
  if (expected.Vsa_M4 && isDeviationHigh(result.Vsa_M4, expected.Vsa_M4)) {
    highDeviations.push(`M4: %${deviations.M4!.toFixed(1)}`);
  }
  if (
    expected.Vsa_M5 &&
    result.Vsa_M5 &&
    isDeviationHigh(result.Vsa_M5, expected.Vsa_M5)
  ) {
    highDeviations.push(`M5: %${deviations.M5!.toFixed(1)}`);
  }
  if (
    expected.Vsa_M6 &&
    result.Vsa_M6 &&
    isDeviationHigh(result.Vsa_M6, expected.Vsa_M6)
  ) {
    highDeviations.push(`M6: %${deviations.M6!.toFixed(1)}`);
  }
  if (
    expected.Vsa_M7 &&
    result.Vsa_M7 &&
    isDeviationHigh(result.Vsa_M7, expected.Vsa_M7)
  ) {
    highDeviations.push(`M7: %${deviations.M7!.toFixed(1)}`);
  }

  return {
    deviations,
    highDeviations,
    needsNarrowing: highDeviations.length > 0,
  };
}

export function generateGeotechnicalReport(
  preset: Preset,
  depthMode: "VS30" | "CUSTOM",
  targetDepth: number,
  result: Result,
  showT: boolean = true
): string {
  const analysis = analyzeDeviations(result, preset.expected);
  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      preset: preset.name,
      depthMode: depthMode,
      targetDepth: `${targetDepth.toFixed(1)} m`,
      usedDepthM12: `${result.H_M12.toFixed(1)} m`,
      usedDepthM3: `${result.H_M3.toFixed(1)} m`,
    },
    input: {
      layers: preset.layers,
      defaultRho: preset.defaultRho,
      showT: showT,
    },
    results: {
      H_M12: result.H_M12,
      H_M3: result.H_M3,
      Vsa_M1: result.Vsa_M1,
      Vsa_M2: result.Vsa_M2,
      Vsa_M3: result.Vsa_M3,
      Vsa_M4: result.Vsa_M4,
      Vsa_M5: result.Vsa_M5,
      Vsa_M6: result.Vsa_M6,
      Vsa_M7: result.Vsa_M7,
      ...(showT && {
        T_M1: result.T_M1,
        T_M2: result.T_M2,
        T_M3: result.T_M3,
      }),
    },
    expected: preset.expected,
    analysis: {
      deviations: analysis.deviations,
      highDeviations: analysis.highDeviations,
      needsNarrowing: analysis.needsNarrowing,
      recommendation: analysis.needsNarrowing
        ? "Derinlik aralığını daraltmamı ister misiniz?"
        : "Sapmalar kabul edilebilir seviyede (%5'den küçük)",
    },
  };
  return JSON.stringify(report, null, 2);
}

export function autoConfigureDepthForPreset(preset: Preset): {
  depthMode: "VS30" | "CUSTOM";
  targetDepth: number;
} {
  return {
    depthMode: preset.autoDepthMode,
    targetDepth: preset.autoDepthValue,
  };
}

export function suggestNarrowedDepth(
  currentDepth: number,
  deviation: number,
  direction: "increase" | "decrease"
): number {
  const factor = deviation > 10 ? 0.8 : 0.9;
  return direction === "increase"
    ? currentDepth * (2 - factor)
    : currentDepth * factor;
}
