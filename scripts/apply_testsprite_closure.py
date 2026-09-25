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

# Localize the raw tokens TestSprite found, without relying on a future i18n fallback.
p = Path("src/components/pages/TimelinePage.tsx")
s = p.read_text(encoding="utf-8")
needle = ' const types=useMemo(()=>[...new Set(allEvents.map(x=>x.type))].sort(),[allEvents]);\n'
insert = ''' const types=useMemo(()=>[...new Set(allEvents.map(x=>x.type))].sort(),[allEvents]);
 const timelineTypeText=(value:string)=>{
  const labels:Record<string,[string,string]>={
   recovery:["تعافٍ","Recovery"],chemistry:["كيمياء","Chemistry"],warning:["تنبيه","Warning"],setup:["إعداد","Setup"],
   manual:["يدوي","Manual"],maintenance:["صيانة","Maintenance"],livestock:["كائنات الحوض","Livestock"],feeding:["تغذية","Feeding"],
   "water-change":["تغيير ماء","Water change"],equipment:["معدات","Equipment"],acclimation:["إقلمة","Acclimation"],emergency:["طوارئ","Emergency"],travel:["سفر وغياب","Travel"],observation:["ملاحظة","Observation"]
  };
  const direct=labels[value];
  return direct?(lang==="ar"?direct[0]:direct[1]):eventTypeText(lang,value);
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
  const freshwaterChemistryTokens=["freshwater parameter","water parameter","chemistry","chemical","ammonia","nh3","nh4","nitrite","no2","nitrate","no3","gh","kh","water change","كيميا","كيمياء","امونيا","أمونيا","نتريت","نترات","تغيير ماء","تغيير مي","تغيير المي","معايير الماء","قيم الماء"];
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
p.write_text(s.replace(old2,new2,1),encoding="utf-8")
