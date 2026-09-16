import type { Tank } from "./types";
import { chemistryAgeDays, chemistryHealth, tankHealthTrend, bioload } from "./health";
import { analyzeNutrients } from "./nutrientEngine";
import { mediaPredictions } from "./mediaPredictor";

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
  const nutrients = analyzeNutrients(tank);
  const media = mediaPredictions(tank);

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

  nutrients.signals.forEach(signal => {
    if (signal.level !== "good" || out.length === 0) out.push(signal);
  });

  media.forEach(({item,prediction})=>{
    if(prediction.state==="replace") out.push({
      level:"warn",
      ar:`ميديا ${item.name} تجاوزت عمرها المتوقع (${prediction.estimatedLifeDays} يوم تقريباً). راجعها أو استبدلها.`,
      en:`${item.name} has reached its estimated media life (~${prediction.estimatedLifeDays} days). Review or replace it.`
    });
    else if(prediction.state==="watch") out.push({
      level:"info",
      ar:`ميديا ${item.name} تقترب من نهاية عمرها المتوقع؛ المتبقي تقريباً ${prediction.remainingDays} يوم.`,
      en:`${item.name} is approaching its estimated media-life limit; roughly ${prediction.remainingDays} days remain.`
    });
  });

  const activeEmergency=(tank.emergencySessions??[]).find(x=>x.status==="active");
  if(activeEmergency) out.unshift({
    level:"danger",
    ar:`يوجد بروتوكول طوارئ نشط: ${activeEmergency.titleAr}. أكمل الخطوات قبل اعتبار الحالة مستقرة.`,
    en:`An emergency protocol is active: ${activeEmergency.titleEn}. Complete the response steps before considering the system stable.`
  });

  const activeTreatment=tank.quarantine.find(x=>x.status==="active"&&x.treatmentProduct);
  if(activeTreatment) out.push({
    level:"info",
    ar:`يوجد علاج حجر نشط لـ ${activeTreatment.organism}${activeTreatment.nextDoseAt?`؛ الجرعة التالية ${new Date(activeTreatment.nextDoseAt).toLocaleString()}`:""}.`,
    en:`Active quarantine treatment for ${activeTreatment.organism}${activeTreatment.nextDoseAt?`; next dose ${new Date(activeTreatment.nextDoseAt).toLocaleString()}`:""}.`
  });

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
  const nutrients = analyzeNutrients(tank);
  const nutrientRisk = ["both-depleted","phosphate-depleted","nitrate-depleted","elevated"].includes(nutrients.state);
  const mediaRisk=mediaPredictions(tank).some(x=>x.prediction.state==="replace");
  const emergencyActive=(tank.emergencySessions??[]).some(x=>x.status==="active");

  if (emergencyActive) return {
    ar:"التوقع غير مستقر حالياً لأن بروتوكول طوارئ ما يزال نشطاً. أكمل خطوات الاستجابة ثم أعد تقييم الكيمياء والمعدات قبل الاعتماد على توقع 7 أيام.",
    en:"Forecast is temporarily unstable because an emergency protocol is still active. Complete the response and recheck chemistry/equipment before relying on the 7-day outlook."
  };
  if (trend==="declining" || chem<60 || nutrientRisk || mediaRisk) return {
    ar:"إذا استمر الاتجاه الحالي فهناك احتمال تراجع إضافي خلال 7 أيام. ابدأ بالفحوص والمهام المتأخرة، راجع ميديا الفلترة، وصحح اختلال المغذيات تدريجياً دون تغييرات حادة.",
    en:"If the current trend continues, further decline is possible within 7 days. Start with overdue tests and maintenance, review filter media, then correct nutrient imbalance gradually without abrupt changes."
  };
  if (trend==="improving") return {
    ar:"الاتجاه الحالي إيجابي، ومع استمرار الصيانة والفحوص الأسبوعية واستقرار NO3/PO4 وميديا الفلترة يُتوقع بقاء النظام مستقراً أو تحسنه.",
    en:"The current trend is positive. With regular maintenance, weekly testing, stable NO3/PO4 and healthy filter media, the system is expected to remain stable or improve."
  };
  return {
    ar:"التوقع الحالي مستقر، بشرط استمرار الصيانة الأسبوعية وعدم تأخير قياسات الكيمياء أو السماح للمغذيات بالوصول إلى الصفر ومراجعة ميديا الفلترة عند اقتراب عمرها المتوقع.",
    en:"The current forecast is stable, provided weekly maintenance and chemistry testing stay on schedule, nutrients do not bottom out, and filter media is reviewed near its estimated end of life."
  };
}
