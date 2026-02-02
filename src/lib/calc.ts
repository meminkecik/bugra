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
  Vsa_M3: number; // Meksika Kodu (MOC) veya Rayleigh
  Vsa_M4: number; // Japon Kodu
  Vsa_M5: number | null; // TBDY / NEHRP
  Vsa_M6: number | null; // Rayleigh Method (Adapted)
  Vsa_M7: number | null; // Önerilen Yöntem (Keskin & Bozdogan)
  Vsa_Exact: number | null; // Exact: Modified Finite Element Transfer Matrix Method
};

/** --------------------------- YARDIMCILAR --------------------------- **/

function normalizeRho(rhoVal: number): number {
  // Kullanıcı t/m³ girdiyse (örneğin 1.8-2.5 arası) kg/m³'e çevir
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

/** --------------------------- M1 / M2 / M4 / M5 (Geometrik/Basit) --------------------------- **/

/** M1: Karekök Ağırlıklı Hız (Literature) */
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

/** M2: Ağırlıklı Ortalama Hız (Literature) */
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

/** M4 (Japon Deprem Yönetmeliği): T tabanlı hesap */
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
    // Formül: sum [ d_i * ( (H_{i-1} + H_i)/2 ) / Vs_i^2 ]
    sum += (L.d * (Hi_minus_1 + Hi)) / 2 / (L.vs * L.vs);
  }
  if (!(sum > 0)) return null;
  // T = sqrt(32 * sum)
  const T = Math.sqrt(32 * sum);
  if (!(T > 0)) return null;
  return (4 * H) / T;
}

/** M5 (TBDY / NEHRP / Eurocode): Harmonik Ortalama (Seyahat Süresi) */
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

/** --------------------------- M3 / M6 / M7 / EXACT (Kütle & Rijitlik Bazlı) --------------------------- **/

/** M3 — MOC-2008 (Meksika Yönetmeliği) */
export function computeTM3_MOC(
  layersSurfaceDown: Layer[],
  defaultRhoKgPerM3: number = 1900
): number | null {
  if (!layersSurfaceDown.length) return null;

  // Hesaplama tabandan yüzeye doğru yapılabilir, ama formül toplam bazlıdır.
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

  // Ağırlık fonksiyonu w hesaplaması
  const w: number[] = [0];
  let acc = 0;
  for (const t of parts) {
    acc += t;
    w.push(acc / sum_d_over_G);
  }

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
    // Integral approximation term
    sum_rho_d_w2 += rho * d * (wt * wt + wt * wb + wb * wb);
  }
  if (!(sum_rho_d_w2 > 0)) return null;

  return 4 * Math.sqrt(sum_d_over_G * sum_rho_d_w2);
}

/** M6 — Rayleigh Method (Adapted for Soil Profiles) [cite: 1197] */
export function computeTM3_RAYLEIGH(
  layersSurfaceDown: Layer[],
  defaultRhoKgPerM3: number = 1900
): number | null {
  if (!layersSurfaceDown.length) return null;
  const n = layersSurfaceDown.length;
  // Tabandan yüzeye sıralama (i=0 Base, i=n-1 Surface)
  const bottomUp: Layer[] = [...layersSurfaceDown].reverse(); 
  const H = computeH(bottomUp);
  if (!(H > 0)) return null;

  const G: number[] = [];
  const rho: number[] = [];
  const d: number[] = bottomUp.map((L) => L.d as number);

  // Parametreleri hazırla
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

  // Kütlelerin (m_i) düğüm noktalarına atanması [cite: 1199]
  const m: number[] = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) {
    m[i] = (rho[i] * d[i] + rho[i + 1] * d[i + 1]) / 2;
  }
  m[n - 1] = (rho[n - 1] * d[n - 1]) / 2;

  // Düğüm yükseklikleri (Tabandan)
  const posFromBase: number[] = [];
  let accH = 0;
  for (let i = 0; i < n; i++) {
    accH += d[i];
    posFromBase[i] = accH;
  }

  // Rayleigh kuvvet dağılımı f_i [cite: 1203]
  let sumDen = 0;
  for (let i = 0; i < n; i++) {
    // (H - Hi) yerine burada tabandan yükseklik ile orantılı mod şekli varsayımı yaygındır
    // Ancak makalede f_i = m_i * u_i şeklinde basitleştirilebilir. 
    // Burada makaledeki (Eq 40) gibi lineer artan deplasman varsayımıyla kuvvet hesabı:
    sumDen += m[i] * posFromBase[i];
  }
  if (!(sumDen > 0)) return null;

  const f: number[] = [];
  for (let i = 0; i < n; i++) {
    f[i] = (m[i] * posFromBase[i]) / sumDen;
  }

  // Kesme Kuvvetleri Q_i [cite: 1207]
  const Q: number[] = new Array(n).fill(0);
  let cumF = 0;
  for (let i = n - 1; i >= 0; i--) {
    cumF += f[i];
    Q[i] = cumF; 
  }

  // Deplasmanlar delta_i [cite: 1205]
  const delta: number[] = new Array(n).fill(0);
  delta[0] = (Q[0] * d[0]) / G[0];
  for (let i = 1; i < n; i++) {
    delta[i] = delta[i - 1] + (Q[i] * d[i]) / G[i];
  }

  // T = 2*pi * sqrt( sum(m * delta^2) / sum(f * delta) )
  let sumMDelta2 = 0;
  let sumFDelta = 0;
  for (let i = 0; i < n; i++) {
    sumMDelta2 += m[i] * delta[i] ** 2;
    sumFDelta += f[i] * delta[i];
  }
  if (!(sumFDelta > 0)) return null;

  return 2 * Math.PI * Math.sqrt(sumMDelta2 / sumFDelta);
}

/** * EXACT METHOD: Modified Finite Element Transfer Matrix Method
 * Based on Source 1 (Article 13034), Equation (25)  and (27).
 * Calculates the fundamental period by finding the root of T_n(omega) = 0.
 */
export function computeTM3_EXACT(
  layersSurfaceDown: Layer[],
  defaultRhoKgPerM3: number = 1900
): number | null {
  if (!layersSurfaceDown.length) return null;
  
  // Hesaplama Tabandan (Base) Yüzeye (Surface) doğru yapılır.
  // i=0: En alt katman (Taban), i=n-1: En üst katman (Yüzey)
  const bottomUp = [...layersSurfaceDown].reverse().map((L) => ({
    d: L.d as number,
    vs: L.vs as number,
    rho: normalizeRho(typeof L.rho === "number" ? L.rho : defaultRhoKgPerM3),
    G: 0 // Hesapla doldurulacak
  }));

  // G = rho * Vs^2
  bottomUp.forEach(L => {
    L.G = computeG(L.vs, L.rho);
  });

  // T_n fonksiyonu: Verilen açısal frekans (omega) için yüzeydeki boundary condition değerini döndürür.
  // Bu değer 0 olduğunda rezonans (doğal frekans) yakalanmış olur.
  function computeTn(omega: number): number {
    if (omega === 0) return 1e15; // Statik durum (sonsuz rijitlik kabulü ile)

    // --- Başlangıç: Katman 1 (Taban) ---
    // Equation (27): T1 = G1 * a1 * cot(a1 * h1) 
    const L1 = bottomUp[0];
    const a1 = omega / L1.vs; // Wave number parameter [cite: 79]
    const arg1 = a1 * L1.d;
    
    // JS Math.tan kullanır, cot(x) = 1/tan(x)
    const T1 = L1.G * a1 * (1.0 / Math.tan(arg1));
    
    let T_prev = T1;

    // --- Yineleme: Katman 2'den n'e kadar ---
    // Equation (25) 
    for (let i = 1; i < bottomUp.length; i++) {
      const Li = bottomUp[i];
      const ai = omega / Li.vs;
      const argi = ai * Li.d;
      
      const Gai = Li.G * ai;
      const cotTerm = 1.0 / Math.tan(argi);
      
      // Equation (25) Implementation:
      // T_i = [ - (Gi*ai)^2 + T_{i-1} * Gi*ai * cot(ai*hi) ] / [ T_{i-1} + Gi*ai * cot(ai*hi) ]
      
      const termK = Gai * cotTerm; // Gi * ai * cot(ai*hi)
      const termS = Gai * Gai;     // (Gi * ai)^2

      const numerator = -termS + T_prev * termK;
      const denominator = T_prev + termK;

      // Singularity (Payda sıfır) kontrolü
      if (Math.abs(denominator) < 1e-12) {
          // Asimptotik nokta. İşaret değişimi takibi için büyük değer döndür.
          return denominator >= 0 ? 1e15 : -1e15; 
      }

      T_prev = numerator / denominator;
    }

    return T_prev; // T_n değeri (Yüzeydeki değer)
  }

  // --- Kök Bulma (Root Finding) ---
  // T_n(omega) = 0 yapan ilk pozitif omega'yı arıyoruz 
  
  const dOmega = 0.1; // Adım aralığı (hassasiyet için düşürülebilir)
  const maxOmega = 2000; // Üst sınır
  let omega = dOmega;
  
  let f_prev = computeTn(omega);
  
  while (omega < maxOmega) {
    const nextOmega = omega + dOmega;
    const f_curr = computeTn(nextOmega);

    // İşaret değişimi yakalandı mı?
    // Asimptotik sıçramalar (örn: +sonsuzdan -sonsuza) kök değildir.
    // Ancak T_n fonksiyonu sürekli (continuous) kabul edilir, asimptotlar hariç.
    // Temel periyot için genellikle ilk "smooth" geçişi ararız.
    
    if (f_curr * f_prev <= 0) {
      // Bisection Method (İkiye bölme) ile hassas kök bulma
      let a = omega;
      let b = nextOmega;
      const tol = 1e-6;
      
      for(let k=0; k<100; k++) {
        const mid = (a + b) / 2;
        const f_mid = computeTn(mid);
        
        if (f_mid * f_prev <= 0) {
          b = mid;
        } else {
          a = mid;
          f_prev = f_mid; 
        }
        
        if (Math.abs(b - a) < tol) break;
      }
      
      const omegaFundamental = (a + b) / 2;
      return (2 * Math.PI) / omegaFundamental; // T = 2*pi / omega
    }

    f_prev = f_curr;
    omega = nextOmega;
  }

  return null;
}

/** M7 (Proposed Method): Keskin & Bozdoğan (2024) [cite: 1145] */
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

    const rhoVal = normalizeRho(
      typeof Li.rho === "number" ? Li.rho : defaultRhoKgPerM3
    );
    if (!(rhoVal > 0)) return null;

    d[i] = Li.d;
    rho[i] = rhoVal;
    G[i] = computeG(Li.vs, rhoVal);
  }

  // S_i Hesabı: Eq (34) [cite: 1150]
  // S_i = (Üstteki kümülatif kütle) + (Katmanın yarım kütlesi)
  const S: number[] = [];
  let cumMassAbove = 0;
  // Yüzeyden aşağı doğru (n-1 -> 0) iterasyon
  for (let i = n - 1; i >= 0; i--) {
    S[i] = cumMassAbove + (rho[i] * d[i]) / 2;
    cumMassAbove += rho[i] * d[i];
  }

  // Toplamın hesaplanması: sum( S_i * d_i / G_i )
  let sum_term = 0;
  for (let i = 0; i < n; i++) {
    sum_term += (S[i] * d[i]) / G[i];
  }

  if (!(sum_term > 0)) return null;

  // katsayı k: Eq (33) için 5.515 [cite: 1145]
  // Tek katman için özel katsayı opsiyonel (Teorik: 4*sqrt(2) ≈ 5.66)
  const k = n === 1 && useSingleLayerConstant ? 5.657 : 5.515;

  return k * Math.sqrt(sum_term);
}

/** --------------------------- ASWV–FSP Dönüşümleri --------------------------- **/

/** Vsa = 4H / T  [cite: 1180] */
export function computeVsaFromT(H: number, T: number | null): number | null {
  if (!isFinite(H) || H <= 0 || !T || !isFinite(T) || T <= 0) return null;
  return (4 * H) / T;
}

/** --------------------------- M6 / M7 Wrapper Fonksiyonları --------------------------- **/

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

/** --------------------------- Compute Results (Ana Fonksiyon) --------------------------- **/

export function computeResults(
  layersSurfaceDown: Layer[],
  defaultRho: number = 1900,
  targetDepthM12: number = Number.POSITIVE_INFINITY, 
  targetDepthM3: number = Number.POSITIVE_INFINITY, 
  m3DepthMode: "TOTAL" | "TARGET" = "TOTAL",
  m3Formula: "MOC" | "RAYLEIGH" | "EXACT" = "MOC"
): Result | null {
  // 1. Grup: M1, M2, M4, M5 (Geometrik/Basit Metodlar)
  const Ls12 = isFinite(targetDepthM12)
    ? trimLayersToDepth(layersSurfaceDown, targetDepthM12)
    : layersSurfaceDown;

  if (!Ls12.length) return null;

  // 2. Grup: M3, M6, M7, Exact (Kütle/Transfer Metodları - Derinlik Duyarlı)
  let Ls3: Layer[], H3: number;

  if (m3DepthMode === "TOTAL") {
    Ls3 = layersSurfaceDown;
    H3 = computeProfileDepth(layersSurfaceDown);
  } else {
    Ls3 = trimLayersToDepth(layersSurfaceDown, targetDepthM3);
    H3 = computeH(Ls3);
  }

  if (!Ls3.length || !(H3 > 0)) return null;

  const Vsa_M1 = computeVsaM1(Ls12);
  const Vsa_M2 = computeVsaM2(Ls12);
  const Vsa_M4 = computeVsaM4(Ls12);
  const Vsa_M5 = computeVsaM5(Ls12);

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

  // --- M3 (Seçilen formüle göre MOC veya diğerleri) ---
  const T_M3 =
    m3Formula === "MOC"
      ? computeTM3_MOC(Ls3, defaultRho)
      : m3Formula === "RAYLEIGH"
      ? computeTM3_RAYLEIGH(Ls3, defaultRho)
      : computeTM3_EXACT(Ls3, defaultRho);
  const Vsa_M3 = computeVsaFromT(H3, T_M3);

  // --- Exact (Modified Finite Element Transfer Matrix Method) ---
  const T_Exact = computeTM3_EXACT(Ls3, defaultRho);
  const Vsa_Exact = computeVsaFromT(H3, T_Exact);

  if (Vsa_M3 == null || Vsa_Exact == null) return null;

  return {
    H_used: H3,
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
  return { isValid: errors.length === 0, errors };
}

function computeProfileDepth(layers: Layer[]): number {
  return layers.reduce((s, L) => s + (typeof L.d === "number" ? L.d : 0), 0);
}

// (İsteğe bağlı kalibrasyon fonksiyonları buraya eklenebilir, orijinal yapı korunarak)