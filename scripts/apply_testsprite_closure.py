from pathlib import Path


def patch(path: str, old: str, new: str, required: bool = True):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        if required:
            raise SystemExit(f"Missing patch target in {path}: {old[:100]}")
        return False
    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    return True

# Timeline shell + intelligence label.
patch("src/components/pages/TimelinePage.tsx",
      'PageHeader eyebrow="TANK TIMELINE" title={tr(lang,"timeline")}',
      'PageHeader eyebrow={bi(lang,"السجل الزمني للحوض","TANK TIMELINE")} title={tr(lang,"timeline")}')
patch("src/components/pages/TimelinePage.tsx",
      '<small className="eyebrow-mini">LONG-TERM HISTORY</small>',
      '<small className="eyebrow-mini">{bi(lang,"التاريخ طويل الأمد","LONG-TERM HISTORY")}</small>')
patch("src/components/pages/TimelinePage.tsx",
      '{x.source==="intelligence"?" • Tank Brain":""}',
      '{x.source==="intelligence"?` • ${bi(lang,"عقل الحوض","Tank Brain")}`:""}')

# Localize the raw tokens TestSprite found, including dropdown and visible chips.
p = Path("src/components/pages/TimelinePage.tsx")
s = p.read_text(encoding="utf-8")
needle = ' const types=useMemo(()=>[...new Set(allEvents.map(x=>x.type))].sort(),[allEvents]);\n'
insert = ''' const types=useMemo(()=>[...new Set(allEvents.map(x=>x.type))].sort(),[allEvents]);
 const timelineTypeText=(value:string)=>{
  const labels:Record<string,[string,string]>={
   recovery:["تعافٍ","Recovery"],chemistry:["كيمياء","Chemistry"],warning:["تنبيه","Warning"],setup:["إعداد","Setup"],
   manual:["يدوي","Manual"],maintenance:["صيانة","Maintenance"],livestock:["كائنات الحوض","Livestock"],feeding:["تغذية","Feeding"],
   "water-change":["تغيير ماء","Water change"],equipment:["معدات","Equipment"],acclimation:["إقلمة","Acclimation"],emergency:["طوارئ","Emergency"],travel:["سفر وغياب","Travel"],observation:["ملاحظة","Observation"],
   "livestock-observation":["تحديث حالة كائن","Livestock observation"],"livestock-death":["وفاة كائن","Livestock death"],"livestock-sold":["بيع كائن","Livestock sold"],"livestock-transferred":["نقل كائن","Livestock transferred"],"livestock-returned":["إرجاع كائن","Livestock returned"],"livestock-removed":["إزالة كائن","Livestock removed"],"history-archive":["أرشفة تاريخية","History archive"]
  };
  const direct=labels[value];
  if(direct)return lang==="ar"?direct[0]:direct[1];
  const shared=eventTypeText(lang,value);
  if(lang==="ar"&&shared===value)return "حدث نظام";
  return shared;
 };
'''
if needle not in s:
    raise SystemExit("Timeline type insertion target missing")
s=s.replace(needle,insert,1).replace('{eventTypeText(lang,x)}','{timelineTypeText(x)}')
p.write_text(s,encoding="utf-8")

# Maintenance shell and the labels reported by TestSprite.
patch("src/components/pages/MaintenancePage.tsx",
      'PageHeader eyebrow="MAINTENANCE" title={tr(lang,"maintenance")}',
      'PageHeader eyebrow={bi(lang,"الصيانة","MAINTENANCE")} title={tr(lang,"maintenance")}')
for old,new in [
 ('<small className="eyebrow-mini">TODAY</small>','<small className="eyebrow-mini">{bi(lang,"اليوم","TODAY")}</small>'),
 ('<small className="eyebrow-mini">TRAVEL / ABSENCE MODE</small>','<small className="eyebrow-mini">{bi(lang,"وضع السفر والغياب","TRAVEL / ABSENCE MODE")}</small>')]:
 patch("src/components/pages/MaintenancePage.tsx",old,new,required=False)

# Livestock shell and health display: never expose raw health enums in Arabic.
patch("src/components/pages/LivestockPage.tsx",
      'PageHeader eyebrow="LIVESTOCK" title={tr(lang,"livestock")}',
      'PageHeader eyebrow={bi(lang,"كائنات الحوض","LIVESTOCK")} title={tr(lang,"livestock")}')
# Keep statusText as the single display path; add an explicit safe Arabic fallback for legacy values.
patch("src/components/pages/LivestockPage.tsx",
      '{statusText(lang,x.health)}</span>',
      '{lang==="ar"?(x.health==="good"?"مناسب":x.health==="warning"?"تنبيه":x.health==="critical"?"حرج":x.health==="treatment"?"قيد العلاج":statusText(lang,x.health)):statusText(lang,x.health)}</span>')

# Freshwater chemistry intent must take precedence over lighting.
p=Path("src/domain/aquaAIBrain.ts")
s=p.read_text(encoding="utf-8")
old='''  const q=(question||"").trim().toLowerCase();
  const lightingQ=normText(question);
  const lightingTokens=["انار","اضاء","ضوء","ضو","lighting","light","photoperiod","spectrum","par","uv","royal blue"];
  const freshwaterChemistryQuestion =
    tank.type==="freshwater" &&
    /freshwater parameters?|water parameters?/.test(lightingQ) &&
    /water change|تغيير ماء|تغيير مي/.test(lightingQ);
  if(freshwaterChemistryQuestion){
    return freshwaterChemistryAnswer(tank);
  }
  if(lightingTokens.some(token=>lightingQ.includes(token)))return lightingAnswer(tank);
  const intent=parseAquaQuestion(question);'''
new='''  const q=(question||"").trim().toLowerCase();
  const lightingQ=normText(question);
  const intent=parseAquaQuestion(question);
  const freshwaterChemistryTokens=["freshwater","fresh water","freshwater parameter","water parameter","chemistry","chemical","ammonia","nh3","nh4","nitrite","no2","nitrate","no3","gh","kh","water change","كيميا","كيمياء","مياه عذبة","ماء عذب","امونيا","أمونيا","نتريت","نترات","تغيير ماء","تغيير مي","تغيير المي","معايير الماء","قيم الماء"];
  const freshwaterChemistryQuestion=tank.type==="freshwater" && (intent.topics.includes("chemistry") || intent.mode==="waterChange" || freshwaterChemistryTokens.some(token=>lightingQ.includes(normText(token))));
  if(freshwaterChemistryQuestion)return freshwaterChemistryAnswer(tank);
  const lightingTokens=["انار","اضاء","ضوء","ضو","lighting","light","photoperiod","spectrum","par","uv","royal blue"];
  if(lightingTokens.some(token=>lightingQ.includes(token)))return lightingAnswer(tank);'''
if old not in s:
    raise SystemExit("Freshwater routing target missing")
s=s.replace(old,new,1)
old2='''    detailsAr:[...rows,water.summaryAr,...water.detailsAr],
    detailsEn:[...rows,water.summaryEn,...water.detailsEn],'''
new2='''    detailsAr:[...rows,"أهداف الأمان العامة: NH3/NH4 = 0 ppm، NO2 = 0 ppm، ويفضل إبقاء NO3 عادةً دون 20–40 ppm حسب حساسية الكائنات.","GH وKH لا يملكان رقماً واحداً مناسباً لكل أحواض المياه العذبة؛ الهدف يعتمد على الأنواع وماء المصدر، والأهم تجنب التغيير السريع.","كخط أساس لحوض مستقر: تغيير 20–30% أسبوعياً مناسب غالباً، ثم تُعدل النسبة والتكرار حسب NH3/NO2/NO3 واتجاه القراءات.",water.summaryAr,...water.detailsAr],
    detailsEn:[...rows,"General safety targets: NH3/NH4 = 0 ppm, NO2 = 0 ppm, and NO3 is commonly kept below about 20–40 ppm depending on livestock sensitivity.","GH and KH do not have one universal freshwater target; the appropriate range depends on livestock and source water, and rapid changes should be avoided.","For a stable tank, a 20–30% weekly water change is a common baseline; adjust percentage and frequency from NH3/NO2/NO3 and their trend.",water.summaryEn,...water.detailsEn],'''
if old2 not in s:
    raise SystemExit("Freshwater answer target missing")
s=s.replace(old2,new2,1)
old3='''    titleAr:"كيمياء المياه العذبة وخطة تغيير الماء",
    titleEn:"Freshwater chemistry and water-change plan",
    summaryAr:"راقب GH وKH والنترات والأمونيا أولاً، ثم قرر تغيير الماء بناءً على القراءات واتجاهها.",
    summaryEn:"Watch GH, KH, nitrate, and ammonia first, then decide on a water change from the readings and their trend.",'''
new3='''    titleAr:"كيمياء المياه العذبة: الأمونيا والنترات وخطة تغيير الماء",
    titleEn:"Freshwater chemistry and water-change plan",
    summaryAr:`القراءات الحالية: ${["GH","KH","NO3","NH3"].map(key=>`${key}: ${latest[key]===undefined?"غير مسجل":String(latest[key])}`).join("، ")}. أهداف الأمان: NH3/NH4 = 0 ppm وNO2 = 0 ppm. كخط أساس، غيّر 20–30% أسبوعياً ثم عدّل النسبة والتكرار حسب NH3/NO2/NO3 واتجاهها.`,
    summaryEn:`Current readings: ${["GH","KH","NO3","NH3"].map(key=>`${key}: ${latest[key]===undefined?"not recorded":String(latest[key])}`).join(", ")}. Safety targets: NH3/NH4 = 0 ppm and NO2 = 0 ppm. As a baseline, change 20–30% weekly, then adjust percentage and frequency from NH3/NO2/NO3 and their trend.`,'''
if old3 not in s:
    raise SystemExit("Freshwater final regression target missing")
s=s.replace(old3,new3,1)
p.write_text(s,encoding="utf-8")

# The assistant UI has a second scope guard. Explicit freshwater chemistry wording
# must never be treated as off-topic before it reaches aquaAIBrain.
p=Path("src/components/AquaAIAssistant.tsx")
s=p.read_text(encoding="utf-8")
old4='''  const aquariumWords=fishWord||/(حوض|احواض|أحواض|مرجان|مشروم|تورش|هامر|بابل|انيمون|أنيمون|روبيان|جمبري|قشريات|حلزون|نجم بحر|قنفذ|كائن|كائنات|ملوح|حرار|كيميا|كيمياء|نيترات|نترات|فوسفات|كالسيوم|مغنيسيوم|مغنزيوم|قلوي|kh\\b|ca\\b|mg\\b|no3\\b|po4\\b|nh3\\b|no2\\b|ph\\b|salinity|reef|aquarium|tank|fish|coral|shrimp|snail|livestock|skimmer|pump|heater|filter|sump|acclimation|dosing|water change|rodi|ro\\/di)/i.test(clean);'''
new4='''  const aquariumWords=fishWord||/(حوض|احواض|أحواض|مرجان|مشروم|تورش|هامر|بابل|انيمون|أنيمون|روبيان|جمبري|قشريات|حلزون|نجم بحر|قنفذ|كائن|كائنات|ملوح|حرار|كيميا|كيمياء|مياه عذبة|ماء عذب|معايير الماء|قيم الماء|امونيا|أمونيا|نتريت|نيترات|نترات|فوسفات|كالسيوم|مغنيسيوم|مغنزيوم|قلوي|kh\\b|gh\\b|ca\\b|mg\\b|no3\\b|po4\\b|nh3\\b|nh4\\b|no2\\b|ph\\b|salinity|freshwater|fresh water|water parameters?|chemistry|ammonia|nitrite|nitrate|reef|aquarium|tank|fish|coral|shrimp|snail|livestock|skimmer|pump|heater|filter|sump|acclimation|dosing|water change|rodi|ro\\/di)/i.test(clean);'''
if old4 not in s:
    raise SystemExit("Assistant freshwater scope target missing")
s=s.replace(old4,new4,1)
p.write_text(s,encoding="utf-8")
