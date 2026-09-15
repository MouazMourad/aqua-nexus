import type { Tank } from "./types";
import { chemistryAgeDays, chemistryHealth, tankHealthTrend, bioload } from "./health";

export interface SmartInsight {
  level: "info"|"good"|"warn"|"danger";
  ar: string;
  en: string;
}

export function smartInsights(tank: Tank): SmartInsight[] {
  const out: SmartInsight[] = [];
  const latest = tank.chemistry[0]?.values ?? {};
  const age = chemistryAgeDays(tank);
  const trend = tankHealthTrend(tank);
  const bio = bioload(tank);

  if (age > 7) out.push({
    level:"warn",
    ar:`مر ${Math.floor(age)} يوماً على آخر فحص كيميائي. يجب إجراء فحص جديد.`,
    en:`It has been ${Math.floor(age)} days since the last chemistry test. A new test is due.`
  });

  if (trend === "declining") out.push({
    level:"danger",
    ar:"اتجاه صحة الحوض يتراجع مقارنة بالقراءة السابقة.",
    en:"Tank health is declining compared with the previous reading."
  });
  if (trend === "improving") out.push({
    level:"good",
    ar:"اتجاه صحة الحوض يتحسن مقارنة بالقراءة السابقة.",
    en:"Tank health is improving compared with the previous reading."
  });

  if (bio.ratio > 1) out.push({
    level:"warn",
    ar:"الحمل البيولوجي مرتفع بالنسبة لحجم النظام الحالي.",
    en:"Biological load is high for the current system volume."
  });

  // Event correlation: recent livestock add + NO3 rising.
  if (tank.chemistry.length >= 2) {
    const n0 = Number(tank.chemistry[0].values.NO3 ?? 0);
    const n1 = Number(tank.chemistry[1].values.NO3 ?? n0);
    const recentAdd = tank.timeline.find(e => /livestock|كائن|سمك|مرجان/i.test(`${e.type} ${e.textAr} ${e.textEn}`));
    if (n0 > n1 * 1.25 && recentAdd) out.push({
      level:"info",
      ar:"لوحظ ارتفاع في NO3 بعد حدث إضافة كائنات. راقب الحمل البيولوجي والتغذية.",
      en:"NO3 increased after a livestock-related event. Monitor bioload and feeding."
    });
  }

  if (typeof latest.PO4 === "number" && latest.PO4 > .18 && tank.type==="marine") out.push({
    level:"warn",
    ar:"الفوسفات مرتفع؛ راقب التغذية والفلترة وتكرار تغيير الماء.",
    en:"Phosphate is elevated; review feeding, filtration and water-change frequency."
  });

  if (!out.length) out.push({
    level:"good",
    ar:"لا توجد إشارات ذكية حرجة حالياً.",
    en:"No critical smart signals are currently detected."
  });
  return out;
}

export function forecastTank(tank: Tank) {
  const chem = chemistryHealth(tank);
  const trend = tankHealthTrend(tank);
  if (trend==="declining" || chem<60) return {
    ar:"إذا استمر الاتجاه الحالي فهناك احتمال تراجع إضافي خلال 7 أيام. نفّذ الفحوص والمهام المتأخرة أولاً.",
    en:"If the current trend continues, further decline is possible within 7 days. Complete overdue tests and maintenance first."
  };
  if (trend==="improving") return {
    ar:"الاتجاه الحالي إيجابي، ومع استمرار الصيانة والفحوص الأسبوعية يُتوقع بقاء النظام مستقراً أو تحسنه.",
    en:"The current trend is positive. With regular maintenance and weekly testing, the system is expected to remain stable or improve."
  };
  return {
    ar:"التوقع الحالي مستقر، بشرط استمرار الصيانة الأسبوعية وعدم تأخير قياسات الكيمياء.",
    en:"The current forecast is stable, provided weekly maintenance and chemistry testing stay on schedule."
  };
}
