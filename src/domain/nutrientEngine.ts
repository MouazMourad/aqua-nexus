import type { Tank } from "./types";
import { measuredChemistryReadings } from "./chemistryDataQuality";

export type NutrientTrend = "rising" | "stable" | "falling" | "unknown";
export type NutrientState =
  | "balanced"
  | "phosphate-depleted"
  | "nitrate-depleted"
  | "both-depleted"
  | "elevated"
  | "imbalanced"
  | "insufficient-data";

export interface NutrientSignal {
  level: "info" | "good" | "warn" | "danger";
  ar: string;
  en: string;
}

export interface NutrientAnalysis {
  no3: number | null;
  po4: number | null;
  nToPAtomicRatio: number | null;
  no3Trend: NutrientTrend;
  po4Trend: NutrientTrend;
  state: NutrientState;
  signals: NutrientSignal[];
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function trend(current: number | null, previous: number | null, deadband: number): NutrientTrend {
  if (current === null || previous === null) return "unknown";
  const delta = current - previous;
  if (Math.abs(delta) <= deadband) return "stable";
  return delta > 0 ? "rising" : "falling";
}

// Converts common hobby-test readings (mg/L NO3 and mg/L PO4) into an approximate
// atomic N:P indicator. This is context only; it is not treated as a target or a
// deterministic algae/dinoflagellate predictor.
function atomicNPRatio(no3: number, po4: number) {
  if (no3 <= 0 || po4 <= 0) return null;
  const nitrateMoles = no3 / 62.0049;
  const phosphateMoles = po4 / 94.9714;
  return nitrateMoles / phosphateMoles;
}

export function analyzeNutrients(tank: Tank): NutrientAnalysis {
  const measured = measuredChemistryReadings(tank);
  const latest = measured[0]?.values ?? {};
  const previous = measured[1]?.values ?? {};
  const no3 = numeric(latest.NO3);
  const po4 = numeric(latest.PO4);
  const prevNo3 = numeric(previous.NO3);
  const prevPo4 = numeric(previous.PO4);
  const no3Trend = trend(no3, prevNo3, 1);
  const po4Trend = trend(po4, prevPo4, 0.01);
  const signals: NutrientSignal[] = [];

  if (no3 === null || (tank.type === "marine" && po4 === null)) {
    return {
      no3,
      po4,
      nToPAtomicRatio: no3 !== null && po4 !== null ? atomicNPRatio(no3, po4) : null,
      no3Trend,
      po4Trend,
      state: "insufficient-data",
      signals: [{
        level: "info",
        ar: "بيانات المغذيات غير مكتملة؛ يلزم قياس NO3 وPO4 للحصول على تحليل توازن موثوق.",
        en: "Nutrient data is incomplete; NO3 and PO4 are needed for a reliable balance analysis."
      }]
    };
  }

  if (tank.type === "freshwater") {
    const state: NutrientState = no3 !== null && no3 > 40 ? "elevated" : "balanced";
    if (no3 !== null && no3 > 40) signals.push({
      level: "warn",
      ar: `النترات مرتفعة (${no3.toFixed(1)} ppm). راجع التغذية وتغيير الماء وكفاءة الفلترة.`,
      en: `Nitrate is elevated (${no3.toFixed(1)} ppm). Review feeding, water changes and filtration.`
    });
    else signals.push({
      level: "good",
      ar: "لا تظهر حالياً إشارة قوية إلى اختلال مغذيات من قراءة NO3.",
      en: "The current NO3 reading does not show a strong nutrient imbalance signal."
    });
    return { no3, po4, nToPAtomicRatio: null, no3Trend, po4Trend, state, signals };
  }

  const n = no3 ?? 0;
  const p = po4 ?? 0;
  const ratio = atomicNPRatio(n, p);
  let state: NutrientState = "balanced";

  if (n <= 1 && p <= 0.01) {
    state = "both-depleted";
    signals.push({
      level: "danger",
      ar: "NO3 وPO4 قريبان جداً من الصفر. تجنب المزيد من خفض المغذيات وراقب الحوض عن قرب.",
      en: "NO3 and PO4 are both near zero. Avoid further nutrient reduction and monitor the tank closely."
    });
  } else if (p <= 0.01) {
    state = "phosphate-depleted";
    signals.push({
      level: "warn",
      ar: `الفوسفات منخفض جداً (${p.toFixed(3)} ppm) بينما NO3 = ${n.toFixed(1)} ppm. لا تخفض PO4 أكثر حالياً.`,
      en: `Phosphate is very low (${p.toFixed(3)} ppm) while NO3 is ${n.toFixed(1)} ppm. Avoid further PO4 reduction for now.`
    });
  } else if (n <= 1) {
    state = "nitrate-depleted";
    signals.push({
      level: "warn",
      ar: `النترات منخفضة جداً (${n.toFixed(1)} ppm) بينما PO4 = ${p.toFixed(3)} ppm. راقب توازن التغذية والتصدير.`,
      en: `Nitrate is very low (${n.toFixed(1)} ppm) while PO4 is ${p.toFixed(3)} ppm. Review feeding and nutrient export balance.`
    });
  } else if (n > 30 || p > 0.25) {
    state = "elevated";
    signals.push({
      level: "warn",
      ar: `المغذيات مرتفعة: NO3 ${n.toFixed(1)} ppm وPO4 ${p.toFixed(3)} ppm. راجع التغذية والفلترة وتغيير الماء.`,
      en: `Nutrients are elevated: NO3 ${n.toFixed(1)} ppm and PO4 ${p.toFixed(3)} ppm. Review feeding, filtration and water changes.`
    });
  } else if (ratio !== null && (ratio < 6 || ratio > 35)) {
    state = "imbalanced";
    signals.push({
      level: "info",
      ar: `مؤشر N:P الذري التقريبي = ${ratio.toFixed(1)}. استخدمه كاتجاه فقط، وليس كهدف ثابت أو تشخيص مباشر للطحالب.`,
      en: `Approximate atomic N:P indicator = ${ratio.toFixed(1)}. Use it as context only, not as a fixed target or direct algae diagnosis.`
    });
  } else {
    signals.push({
      level: "good",
      ar: "توازن NO3/PO4 الحالي لا يظهر إشارة قوية إلى اختلال مغذيات.",
      en: "The current NO3/PO4 balance does not show a strong nutrient-imbalance signal."
    });
  }

  if (po4Trend === "falling" && p <= 0.03) signals.push({
    level: "warn",
    ar: "PO4 يتجه للانخفاض وهو قريب من الحد الأدنى؛ راقب وسائط إزالة الفوسفات والريفوجيوم قبل الوصول للصفر.",
    en: "PO4 is falling and already near the low end; review phosphate-removal media and refugium export before it reaches zero."
  });

  if (no3Trend === "rising" && po4Trend === "rising") signals.push({
    level: "info",
    ar: "NO3 وPO4 يرتفعان معاً؛ افحص ما إذا تغيرت التغذية أو الحمل البيولوجي أو كفاءة التصدير مؤخراً.",
    en: "NO3 and PO4 are rising together; check for recent changes in feeding, bioload or nutrient export."
  });

  return { no3, po4, nToPAtomicRatio: ratio, no3Trend, po4Trend, state, signals };
}
