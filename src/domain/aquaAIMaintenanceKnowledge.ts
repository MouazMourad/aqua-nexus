import type { EquipmentKind } from "./types";

export interface MaintenanceProcedure{
 titleAr:string; titleEn:string;
 stepsAr:string[]; stepsEn:string[];
 cautionAr:string; cautionEn:string;
 recheckAr:string; recheckEn:string;
 suggestedIntervalDays?:number;
}

const K:Partial<Record<EquipmentKind,MaintenanceProcedure>>={
 skimmer:{
  titleAr:"صيانة السكيمر",titleEn:"Skimmer maintenance",
  stepsAr:[
   "افصل الكهرباء عن السكيمر قبل الفك.",
   "افرغ كأس التجميع ونظف الكأس والرقبة من الرواسب.",
   "افصل مضخة السكيمر ونظف مدخل الهواء والـVenturi من الملح والترسبات.",
   "افتح المضخة ونظف الـimpeller والحجرة بماء مناسب؛ للترسبات الكلسية استخدم نقعاً مناسباً ثم اشطف جيداً.",
   "أعد التركيب وتأكد أن خرطوم الهواء غير مسدود وأن مستوى الماء حول السكيمر مناسب.",
   "شغله وراقب الفقاعات ومستوى الرغوة والتسريب لمدة عدة دقائق، ثم أعد ضبطه إذا لزم."
  ],
  stepsEn:[
   "Disconnect power before disassembly.",
   "Empty and clean the collection cup and neck.",
   "Remove the skimmer pump and clean the air intake and venturi from salt/deposits.",
   "Open the pump and clean the impeller/chamber; soak mineral deposits appropriately, then rinse well.",
   "Reassemble and verify the air line is clear and the surrounding water level is correct.",
   "Restart and watch bubbles, foam level and leaks for several minutes, then readjust if needed."
  ],
  cautionAr:"لا تفك أي جزء كهربائي وهو موصول، ولا ترجع الجهاز للحوض قبل شطف أي مادة تنظيف بالكامل.",
  cautionEn:"Never disassemble electrical parts while powered, and rinse any cleaning agent completely before returning equipment to the tank.",
  recheckAr:"بعد الصيانة راقب ثبات الفقاعات، سحب الهواء، مستوى الرغوة وعدم وجود تسريب أو صوت غير طبيعي.",
  recheckEn:"After service, verify stable bubbles, air draw, foam level, and no leaks or unusual noise.",
  suggestedIntervalDays:30
 },
 returnPump:{
  titleAr:"صيانة مضخة الرجوع",titleEn:"Return-pump maintenance",
  stepsAr:["افصل الكهرباء.","أغلق أو أمّن مسار الماء إذا كان الفك يسبب رجوع ماء.","فك المضخة ونظف جسمها ومدخلها.","نظف الـimpeller والروتور والترسبات الكلسية.","افحص الجلود/الحلقات والوصلات ثم أعد التركيب.","شغل المضخة وتأكد من التدفق وعدم وجود تسريب أو اهتزاز غير طبيعي."],
  stepsEn:["Disconnect power.","Secure plumbing/water path if removal can cause backflow.","Remove and clean the pump body and intake.","Clean the impeller/rotor and mineral deposits.","Inspect seals/O-rings and fittings, then reassemble.","Restart and verify flow, leaks and abnormal vibration."],
  cautionAr:"أي مضخة رئيسية مرتبطة بدوران الحوض جهاز حرج؛ حضّر خطة مؤقتة للدوران إذا كانت الصيانة ستطول.",
  cautionEn:"A main return pump is critical to circulation; provide temporary circulation if service will take long.",
  recheckAr:"راقب التدفق، مستوى السامب، الصوت والحرارة بعد التشغيل.",
  recheckEn:"Check flow, sump level, noise and temperature after restart.",
  suggestedIntervalDays:90
 },
 waveMaker:{
  titleAr:"صيانة مضخة الموج",titleEn:"Wave-maker maintenance",
  stepsAr:["افصل الكهرباء.","أخرج المضخة ونظف الحماية الخارجية.","فك الجزء الميكانيكي ونظف المروحة/الروتور من الطحالب والترسبات.","اشطف جيداً وأعد التركيب.","ثبتها باتجاه آمن وشغلها تدريجياً."],
  stepsEn:["Disconnect power.","Remove and clean the outer guard.","Disassemble the mechanical section and clean propeller/rotor deposits.","Rinse well and reassemble.","Mount in a safe direction and restart gradually."],
  cautionAr:"تأكد أن الكائنات والأنيمون بعيدة عن المروحة قبل التشغيل.",
  cautionEn:"Make sure livestock and anemones are clear of the propeller before restart.",
  recheckAr:"راقب التدفق، الاهتزاز والصوت بعد التشغيل.",
  recheckEn:"Verify flow, vibration and noise after restart.",
  suggestedIntervalDays:60
 },
 heater:{
  titleAr:"فحص وصيانة السخان",titleEn:"Heater inspection & maintenance",
  stepsAr:["افصل الكهرباء واترك السخان يبرد قبل إخراجه.","نظف الترسبات بلطف بدون خدش الزجاج/الغلاف.","افحص الكابل والجسم لأي تشقق أو تغير لون.","قارن حرارة الحوض بترمومتر مستقل.","أعده لمكان تدفق جيد ثم شغله بعد غمره بالكامل حسب تعليمات الجهاز."],
  stepsEn:["Disconnect power and let the heater cool before removal.","Clean deposits gently without scratching the housing.","Inspect cable/body for cracks or discoloration.","Compare tank temperature with an independent thermometer.","Return it to a well-flowed area and power it only when properly submerged per manufacturer instructions."],
  cautionAr:"أي تشقق أو تلف بالكابل يعني استبدال الجهاز، مو إصلاحه داخل الحوض.",
  cautionEn:"Any crack or cable damage means replacement, not in-tank repair.",
  recheckAr:"راقب الحرارة عدة ساعات وتأكد ما في تجاوز أو تذبذب غير طبيعي.",
  recheckEn:"Monitor temperature for several hours and verify there is no overshoot or abnormal cycling.",
  suggestedIntervalDays:90
 },
 filterSock:{
  titleAr:"صيانة جرابات الفلترة",titleEn:"Filter-sock maintenance",
  stepsAr:["أخرج الجراب قبل ما يفيض أو ينسد.","استبدله بجراب نظيف فوراً.","اغسل الجراب المستعمل جيداً بطريقة آمنة للحوض.","اتركه يجف/يُشطف بالكامل قبل إعادة الاستخدام.","نظف منطقة الحامل من الرواسب."],
  stepsEn:["Remove the sock before it clogs/overflows.","Replace it immediately with a clean sock.","Wash the used sock thoroughly with an aquarium-safe method.","Ensure it is fully rinsed/dried before reuse.","Clean detritus around the holder."],
  cautionAr:"لا تستخدم منظفات أو معطرات تبقى آثارها على القماش.",
  cautionEn:"Do not use detergents or fragrances that can leave residue in the fabric.",
  recheckAr:"راقب فرق مستوى الماء وتدفق السامب بعد الاستبدال.",
  recheckEn:"Verify sump flow and water-level difference after replacement.",
  suggestedIntervalDays:3
 },
 doser:{
  titleAr:"صيانة الدوزر",titleEn:"Doser maintenance",
  stepsAr:["أوقف القناة قبل العمل.","افحص الخرطوم والوصلات لأي تشقق أو هواء.","نظف رأس المضخة حسب نوعه.","اعمل Prime للخط عند الحاجة.","عاير حجم الجرعة بقياس فعلي، ثم حدث قيمة المعايرة."],
  stepsEn:["Stop the channel before service.","Inspect tubing/fittings for cracks or air.","Clean the pump head as appropriate.","Prime the line if needed.","Calibrate dose volume by actual measurement and update calibration."],
  cautionAr:"لا تعاير الدوزر فوق الحوض مباشرة لتجنب جرعة زائدة بالخطأ.",
  cautionEn:"Do not calibrate directly over the tank to avoid accidental overdosing.",
  recheckAr:"نفذ جرعة اختبار مقاسة وتأكد من عدم وجود سيفون أو تقطير مستمر.",
  recheckEn:"Run a measured test dose and verify no siphoning or continuous dripping.",
  suggestedIntervalDays:90
 },
 uv:{
  titleAr:"صيانة UV",titleEn:"UV maintenance",
  stepsAr:["افصل الكهرباء وأوقف التدفق.","اترك الوحدة تبرد.","افتحها حسب تصميمها ونظف غلاف الكوارتز من الترسبات.","افحص الجلود والوصلات.","راجع عمر اللمبة واستبدلها حسب ساعات التشغيل/توصية الشركة.","أعد التركيب وشغل التدفق أولاً ثم الكهرباء."],
  stepsEn:["Disconnect power and stop flow.","Allow the unit to cool.","Open as designed and clean the quartz sleeve.","Inspect seals and fittings.","Check lamp age and replace based on operating hours/manufacturer guidance.","Reassemble, restore flow first, then power."],
  cautionAr:"لا تنظر مباشرة لضوء UV ولا تشغل اللمبة مكشوفة.",
  cautionEn:"Never look directly at UV light or operate the lamp exposed.",
  recheckAr:"تأكد من عدم وجود تسريب ومن رجوع التدفق الطبيعي.",
  recheckEn:"Verify no leaks and normal flow after restart.",
  suggestedIntervalDays:90
 },
 ozone:{
  titleAr:"فحص نظام الأوزون",titleEn:"Ozone-system inspection",
  stepsAr:["أوقف مولد الأوزون قبل الصيانة.","افحص خرطوم الهواء والصمامات والوصلات.","نظف/بدل مواد التجفيف أو الكربون حسب النظام.","تأكد من عدم وجود تشقق بالأنابيب.","أعد التشغيل على الإعداد المعتاد وراقب ORP إن كان متاحاً."],
  stepsEn:["Turn off the ozone generator before maintenance.","Inspect air tubing, valves and fittings.","Service drying media/carbon as applicable.","Check tubing for cracks.","Restart at the normal setting and monitor ORP if available."],
  cautionAr:"الأوزون مؤكسد قوي؛ لا تسمح بتسربه للغرفة أو وصوله مباشرة للكائنات بدون مسار أمان مناسب.",
  cautionEn:"Ozone is a strong oxidizer; prevent room leakage and direct livestock exposure without appropriate safety handling.",
  recheckAr:"راقب الرائحة، ORP، وعمل الكربون/التصريف بعد التشغيل.",
  recheckEn:"Monitor odor, ORP and carbon/exhaust handling after restart.",
  suggestedIntervalDays:30
 },
 probe:{
  titleAr:"صيانة ومعايرة المجس",titleEn:"Probe maintenance & calibration",
  stepsAr:["أخرج المجس حسب تعليماته بدون تجفيف الأنواع التي يجب أن تبقى رطبة.","اشطفه بماء مناسب.","نظف الترسبات بلطف.","عايره بمحاليل معايرة صحيحة وغير منتهية.","أعده للحوض وانتظر استقرار القراءة."],
  stepsEn:["Remove the probe per its instructions; do not dry probes that must remain wet.","Rinse appropriately.","Clean deposits gently.","Calibrate using correct, unexpired standards.","Return it to service and wait for the reading to stabilize."],
  cautionAr:"لا تفرك سطح المجس الحساس بقوة ولا تستخدم محلول معايرة ملوث.",
  cautionEn:"Do not aggressively scrub sensitive probe surfaces or reuse contaminated calibration solution.",
  recheckAr:"قارن القراءة بمحلول مرجعي أو جهاز مستقل إن أمكن.",
  recheckEn:"Compare against a reference solution or independent meter when possible.",
  suggestedIntervalDays:30
 }
};

export function maintenanceProcedure(kind:EquipmentKind){
 return K[kind]||{
  titleAr:"صيانة الجهاز",titleEn:"Equipment maintenance",
  stepsAr:["افصل الكهرباء إن كان الجهاز كهربائياً.","نظف الأجزاء الملامسة للماء من الرواسب.","افحص الوصلات والأجزاء المتحركة.","أعد التركيب وشغل الجهاز وراقب الأداء."],
  stepsEn:["Disconnect power if electrical.","Clean water-contact parts.","Inspect fittings and moving parts.","Reassemble, restart and verify performance."],
  cautionAr:"اتبع تعليمات الشركة للموديل المحدد إذا كانت متوفرة.",
  cautionEn:"Follow the manufacturer instructions for the exact model when available.",
  recheckAr:"راقب الجهاز بعد التشغيل وتأكد من عدم وجود تسريب أو صوت غير طبيعي.",
  recheckEn:"Observe after restart and verify no leaks or abnormal noise.",
  suggestedIntervalDays:60
 };
}
