import type { Equipment, EquipmentKind, Tank } from "./types";

export interface EquipmentProfile {
  titleAr:string;
  titleEn:string;
  howAr:string;
  howEn:string;
  lifespanAr:string;
  lifespanEn:string;
  tipsAr:string[];
  tipsEn:string[];
  issuesAr:string[];
  issuesEn:string[];
}

const P=(x:EquipmentProfile)=>x;

const generic=(titleAr:string,titleEn:string,howAr:string,howEn:string):EquipmentProfile=>P({
 titleAr,titleEn,howAr,howEn,
 lifespanAr:"يعتمد العمر التشغيلي على جودة الجهاز والصيانة الدورية.",
 lifespanEn:"Service life depends on equipment quality and regular maintenance.",
 tipsAr:["اتبع تعليمات الشركة المصنعة.","نظف الجهاز دورياً وراقب الأداء.","سجل الصيانة وأي تغير في التدفق أو الصوت."],
 tipsEn:["Follow the manufacturer's instructions.","Clean regularly and monitor performance.","Log maintenance and changes in flow or noise."],
 issuesAr:["انخفاض الأداء بسبب الاتساخ أو الانسداد.","تآكل الأجزاء المتحركة أو مواد الفلترة.","تسريب أو توقف غير متوقع."],
 issuesEn:["Reduced performance from dirt or clogging.","Wear of moving parts or filter media.","Leaks or unexpected shutdowns."]
});

export const EQUIPMENT_PROFILES:Record<EquipmentKind,EquipmentProfile>={
 lighting:generic("الإضاءة","Lighting","توفر الطاقة الضوئية اللازمة للتمثيل الضوئي وتحدد شدة وطيف الإضاءة وفترة النهار داخل الحوض.","Provides light energy for photosynthesis and defines intensity, spectrum and photoperiod."),
 waveMaker:generic("صانع الأمواج","Wave Maker","يحرك الماء داخل الحوض ويمنع المناطق الراكدة ويوصل الأكسجين والغذاء للكائنات.","Moves water through the display, reducing dead zones and transporting oxygen and food."),
 skimmer:generic("السكيمر","Protein Skimmer","يزيل المركبات العضوية الذائبة عبر الرغوة قبل تحللها إلى مغذيات.","Removes dissolved organics through foam before they break down into nutrients."),
 returnPump:generic("مضخة الرجوع","Return Pump","تعيد الماء من السامب إلى الحوض وتحدد معدل تدوير الماء بين أجزاء النظام.","Returns water from the sump to the display and sets system turnover."),
 filterSock:generic("فلتر سوك","Filter Sock","فلترة ميكانيكية تلتقط الجزيئات قبل دخولها لبقية النظام.","Mechanical filtration that captures particles before they enter the rest of the system."),
 rollerFilter:generic("رولر فلتر","Roller Filter","يقدم فلترة ميكانيكية متجددة تلقائياً عبر رول الفلترة.","Provides automatically renewed mechanical filtration using filter fleece."),
 canisterFilter:P({titleAr:"فلتر كانستر",titleEn:"Canister Filter",howAr:"يسحب الماء عبر حاوية مغلقة تحتوي مراحل فلترة ميكانيكية وبيولوجية وكيميائية ثم يعيده للحوض، وهو شائع في أحواض المياه العذبة.",howEn:"Pulls water through a sealed canister containing mechanical, biological and chemical filtration stages before returning it to the tank; common in freshwater aquariums.",lifespanAr:"الجسم والمحرك عادة عدة سنوات مع الصيانة؛ الميديا ومواد الإحكام أجزاء استهلاكية حسب النوع والحالة.",lifespanEn:"Body and motor commonly last several years with maintenance; media and seals are consumables depending on type and condition.",tipsAr:["نظف الفلتر تدريجياً بماء الحوض عند الحاجة لتجنب خسارة البكتيريا النافعة.","راقب انخفاض التدفق كعلامة على انسداد الميديا أو الأنابيب.","افحص O-rings والوصلات بعد كل فتح لمنع التسريب."],tipsEn:["Clean gradually with aquarium water when appropriate to preserve beneficial bacteria.","Treat reduced flow as a sign of clogged media or tubing.","Inspect O-rings and fittings after opening to prevent leaks."],issuesAr:["انخفاض التدفق بسبب انسداد الميديا.","تسريب من الغطاء أو O-ring.","تراكم مواد عضوية عند تأخير الصيانة."],issuesEn:["Reduced flow from clogged media.","Leaks at the lid or O-ring.","Organic buildup when maintenance is delayed."]}),
 spongeFilter:P({titleAr:"فلتر إسفنجي",titleEn:"Sponge Filter",howAr:"يمرر الماء عبر إسفنجة توفر فلترة ميكانيكية ومساحة للبكتيريا النافعة، وغالباً يعمل بالهواء أو بمضخة صغيرة.",howEn:"Draws water through a sponge that provides mechanical filtration and surface area for beneficial bacteria, commonly powered by air or a small pump."),lifespanAr:"الجسم قد يستمر سنوات؛ الإسفنجة تستبدل فقط عند تدهورها الفعلي وليس وفق جدول قصير ثابت.",lifespanEn:"The body can last for years; replace the sponge when physically degraded rather than on a short fixed schedule.",tipsAr:["اعصر الإسفنجة بلطف في ماء مأخوذ من الحوض عند التنظيف.","لا تستبدل كل الميديا البيولوجية دفعة واحدة.","راقب تدفق الهواء أو الماء وتأكد أن الإسفنجة غير مسدودة."],tipsEn:["Gently rinse or squeeze the sponge in removed aquarium water when cleaning.","Do not replace all biological media at once.","Monitor air/water flow and keep the sponge from clogging."],issuesAr:["انسداد الإسفنجة وانخفاض التدفق.","ضعف مضخة الهواء أو انسداد مجرى الهواء.","فقدان جزء من البكتيريا النافعة بسبب تنظيف قاسٍ أو استبدال كامل."],issuesEn:["Clogged sponge and reduced flow.","Weak air pump or blocked airline.","Loss of beneficial bacteria after aggressive cleaning or complete replacement."]}),
 reactor:generic("الرياكتور","Media Reactor","يمرر الماء بمعدل مضبوط عبر ميديا كيميائية أو بيولوجية.","Pushes controlled flow through chemical or biological media."),
 heater:P({titleAr:"السخان",titleEn:"Heater",howAr:"يرفع حرارة الماء ويعمل عادة عبر ترموستات داخلي أو كنترولر خارجي.",howEn:"Heats aquarium water using an internal thermostat or external controller.",lifespanAr:"تقريباً 2–5 سنوات؛ يفضل اعتباره قطعة حرجة وفحصه باستمرار.",lifespanEn:"Roughly 2–5 years; treat it as a critical component and monitor closely.",tipsAr:["استخدم كنترولر مستقل إن أمكن.","لا تخرجه ساخناً من الماء.","قسّم القدرة على سخانين في الأنظمة الكبيرة لتقليل نقطة الفشل الواحدة."],tipsEn:["Use an independent controller when possible.","Do not remove while hot.","Split heating across two units in larger systems to reduce single-point failure."],issuesAr:["تعليق على وضع التشغيل ورفع الحرارة.","فشل وعدم التسخين.","تشقق الزجاج أو تسرب كهربائي."],issuesEn:["Stuck ON causing overheating.","Failure to heat.","Glass damage or electrical leakage."]}),
 doser:generic("الدوزر","Dosing Pump","يضخ كميات صغيرة ومحددة من السوائل وفق جدول زمني للحفاظ على ثبات العناصر.","Delivers measured liquid doses on a schedule to maintain stable chemistry."),
 uv:generic("UV Sterilizer","UV Sterilizer","يمرر الماء قرب مصباح UV-C لتقليل الكائنات العالقة عند جرعة تماس مناسبة.","Passes water near a UV-C lamp to reduce suspended organisms when contact dose is adequate."),
 ozone:generic("مولد الأوزون","Ozone Generator","ينتج O3 لتحسين أكسدة المركبات العضوية وصفاء الماء مع ضرورة التحكم والمراقبة المناسبة.","Generates O3 to oxidize organics and improve water clarity with appropriate control and monitoring."),
 ato:generic("تعويض التبخر ATO","ATO","يعوض الماء المتبخر تلقائياً للحفاظ على ثبات مستوى الماء والملوحة.","Automatically replaces evaporated freshwater to stabilize level and salinity."),
 refugiumLight:generic("إضاءة الرفيوجيوم","Refugium Light","توفر ضوءاً للطحالب الكبيرة للمساعدة على استهلاك المغذيات.","Provides light for macroalgae to support nutrient uptake."),
 turfScrubber:generic("Algae Turf Scrubber","Algae Turf Scrubber","ينمي طبقة طحالب مقصودة لاستهلاك المغذيات ثم تصديرها بالحصاد.","Intentionally grows algae to consume nutrients that are exported through harvesting."),
 probe:generic("مجس قياس","Probe / Sensor","يقيس قيمة مثل pH أو ORP أو الموصلية ويرسلها للكنترولر أو نظام المراقبة.","Measures values such as pH, ORP or conductivity and sends them to a controller or monitor."),
 co2:P({titleAr:"نظام CO₂",titleEn:"CO₂ System",howAr:"يحقن ثاني أكسيد الكربون بشكل مضبوط في الأحواض المزروعة لدعم نمو النباتات مع أولوية سلامة الأسماك.",howEn:"Injects controlled carbon dioxide in planted aquariums to support plant growth while fish safety remains the priority.",lifespanAr:"المنظم والصمامات عادة عدة سنوات؛ الأسطوانة قابلة لإعادة التعبئة والـdiffuser والأنابيب تحتاج فحصاً دورياً.",lifespanEn:"Regulators and valves commonly last several years; cylinders are refillable while diffusers and tubing need periodic inspection.",tipsAr:["راقب الأسماك والتنفس قبل مطاردة نمو أسرع للنبات.","افحص التسريب والضغط والـsolenoid والـdiffuser دورياً.","لا تعوض عدم استقرار CO₂ بزيادة الإضاءة أو السماد عشوائياً."],tipsEn:["Watch fish respiration and behavior before chasing faster plant growth.","Inspect pressure, leaks, solenoid and diffuser regularly.","Do not compensate for unstable CO₂ by blindly increasing light or fertilizer."],issuesAr:["تسريب أو نفاد الأسطوانة.","عدم ثبات الحقن أو انسداد الـdiffuser.","زيادة CO₂ بما يهدد أكسجة وسلامة الأسماك."],issuesEn:["Leaks or depleted cylinder.","Unstable injection or clogged diffuser.","Excess CO₂ compromising fish oxygenation and safety."]}),
 overflow:generic("الأوفر فلو والسباكة","Overflow & Plumbing","ينقل الماء بالجاذبية من الحوض إلى السامب ويحدد أمان واستقرار مسار الصرف.","Moves water by gravity from display to sump and defines drainage safety and stability."),
 other:generic("تجهيزة أخرى","Other Equipment","جهاز مخصص يضاف للنظام؛ يجب الرجوع إلى تعليمات الشركة المصنعة لتحديد طريقة عمله وحدود التشغيل.","Custom device added to the system; use the manufacturer's guidance for operation and limits.")
};

export function equipmentProfile(kind:EquipmentKind){return EQUIPMENT_PROFILES[kind]??EQUIPMENT_PROFILES.other;}

export function deviceEnergy(e:Equipment,pricePerKwh:number){
  const watts=Math.max(0,Number(e.powerWatts||0));
  const hours=Math.max(0,Math.min(24,Number(e.hoursPerDay||0)));
  const dailyKwh=watts*hours/1000;
  const monthlyKwh=dailyKwh*30;
  return {dailyKwh,monthlyKwh,monthlyCost:monthlyKwh*Math.max(0,pricePerKwh)};
}

export function tankEnergy(tank:Tank){
  const price=Math.max(0,Number(tank.energySettings?.pricePerKwh||0));
  const rows=tank.equipment.map(e=>({equipment:e,...deviceEnergy(e,price)}));
  return {
    rows,
    dailyKwh:rows.reduce((s,x)=>s+x.dailyKwh,0),
    monthlyKwh:rows.reduce((s,x)=>s+x.monthlyKwh,0),
    monthlyCost:rows.reduce((s,x)=>s+x.monthlyCost,0),
    configured:rows.filter(x=>(x.equipment.powerWatts||0)>0&&(x.equipment.hoursPerDay||0)>0).length
  };
}
