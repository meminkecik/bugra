// src/lib/calc.ts

export type Layer = {
  id: string;
  d: number | "";
  vs: number | "";
  rho?: number | ""; // kg/m³
};

export type Result = {
  H_used: number; // Hesaplamada kullanılan toplam derinlik
  Vsa_M1: number;
  Vsa_M2: number;
  Vsa_M3: number; // Meksika Kodu (MOC)
  Vsa_M4: number;
  Vsa_M5: number | null;
  Vsa_M6: number | null;
  Vsa_M7: number | null; // Önerilen Yöntem
  Vsa_Exact: number | null; // Makaledeki "Exact" sütunu (Transfer Matrix)
};

/** --------------------------- yardımcılar --------------------------- **/

function normalizeRho(rhoVal: number): number {
  // Kullanıcı t/m³ girdiyse (1–30 arası) kg/m³'e çevir
  if (rhoVal > 0 && rhoVal < 50) return rhoVal * 1000;
  return rhoVal;
}

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

/** --------------------------- M3 (MOC-2008, Rayleigh, Exact) --------------------------- **/

/** M3 — MOC-2008 formülü (T_s = 4 * sqrt( (Σ d/G) * (Σ ρ d avg(w^2)) ) ) */
export function computeTM3_MOC(
  layersSurfaceDown: Layer[],
  defaultRhoKgPerM3: number = 1900
): number | null {
  if (!layersSurfaceDown.length) return null;

  const bottomUp = [...layersSurfaceDown].reverse();

  const parts: number[] = [];
  let sum_d_over_G = 0;
  for (const L of bottomUp) {
    if (typeof L.d !== "number" || typeof L.vs !== "number") return null;
    const rho = normalizeRho(
      typeof L.rho === "number" ? L.rho : defaultRhoKgPerM3
    );
    if (!(rho > 0)) return null;
    const G = computeG(L.vs, rho);
    const t = L.d / G;
    parts.push(t);
    sum_d_over_G += t;
  }
  if (!(sum_d_over_G > 0)) return null;

  const w: number[] = [0];
  let acc = 0;
  for (const t of parts) {
    acc += t;
    w.push(acc / sum_d_over_G);
  }

  // Σ(ρ d (w_top^2 + w_top*w_bot + w_bot^2)) — Tablo 1, M3
  let sum_rho_d_w2 = 0;
  for (let k = 0; k < bottomUp.length; k++) {
    const L = bottomUp[k];
    if (typeof L.d !== "number" || typeof L.vs !== "number") return null;
    const rho = normalizeRho(
      typeof L.rho === "number" ? L.rho : defaultRhoKgPerM3
    );
    const d = L.d;
    const wb = w[k],
      wt = w[k + 1];

    // --- DÜZELTME BAŞLANGICI ---
    // Makale Tablo 1'deki formülde  ve Meksika yönetmeliği uygulamasında
    // integralden gelen 1/3 çarpanı bu toplamın içinde yer almaz.
    // Önceki kodda: ... / 3 vardı. Bunu kaldırıyoruz.

    sum_rho_d_w2 += rho * d * (wt * wt + wt * wb + wb * wb);

    // --- DÜZELTME BİTİŞİ ---
  }
  if (!(sum_rho_d_w2 > 0)) return null;

  return 4 * Math.sqrt(sum_d_over_G * sum_rho_d_w2);
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

  // G_i, rho_i, d_i'yi doğrula ve dizilere ata
  const G: number[] = [];
  const rho: number[] = [];
  const d: number[] = bottomUp.map((L) => L.d as number);
  for (let i = 0; i < n; i++) {
    const rhoValue = normalizeRho(
      typeof bottomUp[i].rho === "number" && bottomUp[i].rho !== ""
        ? (bottomUp[i].rho as number)
        : defaultRhoKgPerM3
    );
    rho[i] = rhoValue;
    G[i] = computeG(bottomUp[i].vs as number, rhoValue);
    if (G[i] <= 0 || rhoValue <= 0 || d[i] <= 0) return null;
  }

  // DÜZELTME 1: Düğüm Kütlelerini (m_i) doğru hesapla
  // Kütleler, katmanların arayüzlerindeki n adet düğüm noktasına atanır.
  const m: number[] = new Array(n).fill(0);
  // i=0'dan n-2'ye kadar olan arayüz düğümleri (tabandan yukarı)
  for (let i = 0; i < n - 1; i++) {
    m[i] = (rho[i] * d[i] + rho[i + 1] * d[i + 1]) / 2;
  }
  // Yüzeydeki son düğüm (i=n-1)
  m[n - 1] = (rho[n - 1] * d[n - 1]) / 2;

  // DÜZELTME 2: Kütlelerin konumlarını düğüm noktaları olarak al
  // posFromBase[i], i'inci düğümün tabandan yüksekliğidir (i=0 -> 1. katman üstü)
  const posFromBase: number[] = [];
  let accH = 0;
  for (let i = 0; i < n; i++) {
    accH += d[i];
    posFromBase[i] = accH;
  }

  // f_i için payda (Σ m_i * y_i)
  let sumDen = 0;
  for (let i = 0; i < n; i++) {
    sumDen += m[i] * posFromBase[i];
  }
  if (!(sumDen > 0)) return null;

  // Yanal kuvvetler f_i (doğrusal şekil varsayımı)
  const f: number[] = [];
  for (let i = 0; i < n; i++) {
    f[i] = (m[i] * posFromBase[i]) / sumDen;
  }

  // Q_i: i'inci katmandaki kesme kuvveti (yukarıdaki düğüm kuvvetlerinin toplamı)
  // Diziyi ters çevirerek yüzeyden tabana doğru toplamak daha kolay.
  const Q: number[] = new Array(n).fill(0);
  let cumF = 0;
  for (let i = n - 1; i >= 0; i--) {
    // yüzeyden (n-1) tabana (0)
    cumF += f[i];
    Q[i] = cumF; // Q[i], i'inci katmanın (tabandan i'inci) içindeki kesme kuvvetidir
  }

  // δ_i: i'inci düğümdeki yer değiştirme (tabandan itibaren kümülatif)
  const delta: number[] = new Array(n).fill(0);
  // İlk katmanın (i=0) deformasyonu -> ilk düğümün (i=0) yer değiştirmesi
  delta[0] = (Q[0] * d[0]) / G[0];
  for (let i = 1; i < n; i++) {
    // Sonraki düğümlerin yer değiştirmesi = alttaki düğümün yer değiştirmesi + mevcut katmanın deformasyonu
    delta[i] = delta[i - 1] + (Q[i] * d[i]) / G[i];
  }

  // Rayleigh periyot formülü için toplamlar
  let sumMDelta2 = 0;
  let sumFDelta = 0;
  for (let i = 0; i < n; i++) {
    sumMDelta2 += m[i] * delta[i] ** 2;
    sumFDelta += f[i] * delta[i];
  }
  if (!(sumFDelta > 0)) return null;

  return 2 * Math.PI * Math.sqrt(sumMDelta2 / sumFDelta);
}

/** M3 — Exact Transfer Matrix Method for fundamental period */
export function computeTM3_EXACT(
  layersSurfaceDown: Layer[],
  defaultRhoKgPerM3: number = 1900
): number | null {
  if (!layersSurfaceDown.length) return null;
  const bottomUp = [...layersSurfaceDown].reverse().map((L) => ({
    d: L.d as number,
    vs: L.vs as number,
    rho: normalizeRho(typeof L.rho === "number" ? L.rho : defaultRhoKgPerM3),
  }));
  const H = bottomUp.reduce((s, L) => s + L.d, 0);
  if (!(H > 0)) return null;

  function transferMatrix(omega: number, d: number, vs: number, rho: number) {
    const alpha = (omega * d) / vs;
    const cos_a = Math.cos(alpha);
    const sin_a = Math.sin(alpha);
    const eps = 1e-10; // zero omega avoidance
    const term2 = sin_a / (rho * vs * omega + eps);
    const term3 = -rho * vs * omega * sin_a;
    return [
      [cos_a, term2],
      [term3, cos_a],
    ];
  }

  function matMul(a: number[][], b: number[][]): number[][] {
    return [
      [
        a[0][0] * b[0][0] + a[0][1] * b[1][0],
        a[0][0] * b[0][1] + a[0][1] * b[1][1],
      ],
      [
        a[1][0] * b[0][0] + a[1][1] * b[1][0],
        a[1][0] * b[0][1] + a[1][1] * b[1][1],
      ],
    ];
  }

  function computeM22(omega: number): number {
    let M: number[][] = [
      [1, 0],
      [0, 1],
    ];
    for (const L of bottomUp) {
      const mat = transferMatrix(omega, L.d, L.vs, L.rho);
      M = matMul(mat, M);
    }
    return M[1][1];
  }

  // Find lowest omega >0 where M22(omega) = 0 using sign change and bisection
  const maxOmega = 1000;
  const dOmega = 0.01;
  const tol = 1e-6;
  let omega = dOmega;
  let f_prev = computeM22(0); // should be 1
  while (omega < maxOmega) {
    const f = computeM22(omega);
    if (f * f_prev <= 0) {
      // Sign change, refine with bisection
      let a = omega - dOmega;
      let b = omega;
      while (b - a > tol) {
        const mid = (a + b) / 2;
        const fm = computeM22(mid);
        if (fm * f_prev <= 0) {
          b = mid;
        } else {
          a = mid;
        }
      }
      const omega0 = (a + b) / 2;
      return (2 * Math.PI) / omega0;
    }
    f_prev = f;
    omega += dOmega;
  }
  return null;
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
  useSingleLayerConstant: boolean = false
): number | null {
  if (!layersSurfaceDown.length) return null;

  const n = layersSurfaceDown.length;
  const bottomUp = [...layersSurfaceDown].reverse();
  const H = computeH(bottomUp);
  if (!(H > 0)) return null;

  const d: number[] = [];
  const rho: number[] = [];
  const G: number[] = [];

  for (let i = 0; i < n; i++) {
    const Li = bottomUp[i];
    if (typeof Li.d !== "number" || Li.d <= 0) return null;
    if (typeof Li.vs !== "number" || Li.vs <= 0) return null;

    // Rho kontrolü
    const rhoVal = normalizeRho(
      typeof Li.rho === "number" ? Li.rho : defaultRhoKgPerM3
    );
    if (!(rhoVal > 0)) return null;

    d[i] = Li.d;
    rho[i] = rhoVal;
    G[i] = computeG(Li.vs, rhoVal);
  }

  // S_i Hesabı (Kümülatif kütle)
  const S: number[] = [];
  let cumMassAbove = 0;
  // Yüzeyden aşağı (n-1 -> 0)
  for (let i = n - 1; i >= 0; i--) {
    S[i] = cumMassAbove + (rho[i] * d[i]) / 2;
    cumMassAbove += rho[i] * d[i];
  }

  let sum_term = 0;
  for (let i = 0; i < n; i++) {
    sum_term += (S[i] * d[i]) / G[i];
  }

  if (!(sum_term > 0)) return null;

  const k = n === 1 && useSingleLayerConstant ? 4 * Math.sqrt(2) : 5.515;

  // Makale Örnek 310 ile uyumlu: Karekök toplamın dışında.
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
 *  - "TOTAL": M3, M6, M7, Exact için tüm profil derinliği kullanılır
 *  - "TARGET": M3, M6, M7, Exact için targetDepthM3 (örn. Vs30 için 30 m) kullanılır
 * m3Formula:
 *  - "MOC": T_s = 4 * sqrt( (Σ d/G) * (Σ ρ d avg(w^2)) )
 *  - "RAYLEIGH": T = 2π * sqrt( Σ m_i δ_i² / Σ f_i δ_i )
 *  - "EXACT": Transfer Matrix Method ile tam doğal periyot hesabı
 *
 * @param targetDepthM12 - M1, M2, M4, M5 için hedef derinlik (varsayılan: tüm profil)
 * @param targetDepthM3 - M3, M6, M7, Exact için hedef derinlik (varsayılan: 30m)
 */
export function computeResults(
  layersSurfaceDown: Layer[],
  defaultRho: number = 1900,
  targetDepthM12: number = Number.POSITIVE_INFINITY, // M1, M2, M4, M5 için
  targetDepthM3: number = Number.POSITIVE_INFINITY, // M3, M6, M7 için (varsayılan: tüm profil)
  m3DepthMode: "TOTAL" | "TARGET" = "TOTAL",
  m3Formula: "MOC" | "RAYLEIGH" | "EXACT" = "MOC"
): Result | null {
  // 1. Grup: M1, M2, M4, M5 (Geometrik Metodlar)
  const Ls12 = isFinite(targetDepthM12)
    ? trimLayersToDepth(layersSurfaceDown, targetDepthM12)
    : layersSurfaceDown;

  if (!Ls12.length) return null;

  // 2. Grup: M3, M6, M7, Exact (Kütle/Transfer Metodları)
  let Ls3: Layer[], H3: number;

  if (m3DepthMode === "TOTAL") {
    // "TOTAL" modunda: targetDepth ne olursa olsun, eldeki tüm katmanları kullan
    Ls3 = layersSurfaceDown;
    H3 = computeProfileDepth(layersSurfaceDown);
  } else {
    // "TARGET" modunda: Verilen targetDepthM3'e (örn: 30m) kadar kes
    Ls3 = trimLayersToDepth(layersSurfaceDown, targetDepthM3);
    H3 = computeH(Ls3);
  }

  if (!Ls3.length || !(H3 > 0)) return null;

  // Temel Geometrik Yöntemler (M1, M2, M4, M5) - Ls12 kullanır
  const Vsa_M1 = computeVsaM1(Ls12);
  const Vsa_M2 = computeVsaM2(Ls12);
  const Vsa_M4 = computeVsaM4(Ls12);
  const Vsa_M5 = computeVsaM5(Ls12);

  // Kütle Bazlı Yöntemler (M6, M7) - Ls3 kullanır
  const Vsa_M6 = computeVsaM6(Ls3, defaultRho);
  const Vsa_M7 = computeVsaM7(Ls3, defaultRho);

  if (
    Vsa_M1 == null ||
    Vsa_M2 == null ||
    Vsa_M4 == null ||
    Vsa_M5 == null ||
    Vsa_M6 == null ||
    Vsa_M7 == null
  )
    return null;

  // --- M3 (Meksika Kodu - MOC veya seçilen formül) ---
  const T_M3 =
    m3Formula === "MOC"
      ? computeTM3_MOC(Ls3, defaultRho)
      : m3Formula === "RAYLEIGH"
      ? computeTM3_RAYLEIGH(Ls3, defaultRho)
      : computeTM3_EXACT(Ls3, defaultRho);
  const Vsa_M3 = computeVsaFromT(H3, T_M3);

  // --- Exact (Transfer Matrix) ---
  const T_Exact = computeTM3_EXACT(Ls3, defaultRho);
  const Vsa_Exact = computeVsaFromT(H3, T_Exact);

  if (Vsa_M3 == null || Vsa_Exact == null) return null;

  return {
    H_used: H3, // M3/Exact derinliğini "kullanılan derinlik" olarak raporluyoruz
    Vsa_M1,
    Vsa_M2,
    Vsa_M3,
    Vsa_M4,
    Vsa_M5,
    Vsa_M6,
    Vsa_M7,
    Vsa_Exact,
  };
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
  m3Formula: "MOC" | "RAYLEIGH" | "EXACT" = "EXACT"
): number | null {
  const Ls = trimLayersToDepth(layers, H);
  const Hused = computeH(Ls);
  if (!(Hused > 0)) return null;
  const T =
    m3Formula === "MOC"
      ? computeTM3_MOC(Ls, rhoDefault)
      : m3Formula === "RAYLEIGH"
      ? computeTM3_RAYLEIGH(Ls, rhoDefault)
      : computeTM3_EXACT(Ls, rhoDefault);
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
  m3Formula: "MOC" | "RAYLEIGH" | "EXACT" = "EXACT"
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
