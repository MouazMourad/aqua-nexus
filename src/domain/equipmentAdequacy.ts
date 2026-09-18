import type { EquipmentKind,Tank } from "./types";

export type EquipmentAdequacyLevel="good"|"info"|"warn"|"danger";

export interface EquipmentAdequacyIssue{
  id:string;
  level:EquipmentAdequacyLevel;
  kind?:EquipmentKind;
  ar:string;
  en:string;
  recommendationAr?:string;
  recommendationEn?:string;
}

export interface EquipmentAdequacyResult{
  score:number;
  level:EquipmentAdequacyLevel;
  issues:EquipmentAdequacyIssue[];
  suggestions:EquipmentAdequacyIssue[];
  sizingCoverage:number;
  checked:number;
}

function loadRatio(tank:Tank){
  const load=tank.livestock.reduce((s,x)=>s+(x.load??1)*x.quantity,0);
  const capacity=Math.max(1,tank.systemVolumeLiters/35);
  return load/capacity;
}
function kinds(tank:Tank){return new Set(tank.equipment.filter(x=>x.status!=="off").map(x=>x.kind));}
function hasAny(set:Set<EquipmentKind>,list:EquipmentKind[]){return list.some(x=>set.has(x));}
function levelFromScore(score:number):EquipmentAdequacyLevel{return score<50?"danger":score<75?"warn":score<90?"info":"good";}

export function equipmentAdequacy(tank:Tank):EquipmentAdequacyResult{
  const issues:EquipmentAdequacyIssue[]=[];
  const suggestions:EquipmentAdequacyIssue[]=[];
  const activeKinds=kinds(tank);
  const volume=Math.max(1,tank.systemVolumeLiters);
  const bio=loadRatio(tank);
  const hasCoral=tank.livestock.some(x=>x.category==="coral");
  const hasPlant=tank.livestock.some(x=>x.category==="plant");
  const sumpEnabled=Boolean(tank.sump?.enabled);

  const issue=(x:EquipmentAdequacyIssue)=>{if(!issues.some(i=>i.id===x.id))issues.push(x);};
  const suggest=(x:EquipmentAdequacyIssue)=>{if(!suggestions.some(i=>i.id===x.id))suggestions.push(x);};

  // Core system architecture.
  if(sumpEnabled&&!activeKinds.has("returnPump")){
    issue({id:"missing-return",kind:"returnPump",level:"danger",ar:"السامب مفعّل لكن ما في مضخة رجوع فعّالة مسجلة.",en:"The sump is enabled but no active return pump is registered.",recommendationAr:"أضف مضخة رجوع مناسبة لحجم النظام واربط قدرتها الفعلية بالبرنامج.",recommendationEn:"Add a return pump sized for the system and record its real flow."});
  }
  if(sumpEnabled&&!activeKinds.has("overflow")){
    issue({id:"missing-overflow",kind:"overflow",level:"danger",ar:"السامب مفعّل لكن ما في Overflow/مسار نزول مسجل.",en:"The sump is enabled but no overflow/drain path is registered.",recommendationAr:"سجل مسار الـOverflow لأن سلامة الصرف جزء أساسي من صحة النظام.",recommendationEn:"Register the overflow/drain path because drainage safety is part of system health."});
  }

  if(!hasAny(activeKinds,["heater"])){
    suggest({id:"missing-heater",kind:"heater",level:"warn",ar:"ما في سخان فعّال مسجل.",en:"No active heater is registered.",recommendationAr:"إذا الحوض استوائي، أضف/سجل تسخيناً مناسباً مع كنترول أو مراقبة مستقلة.",recommendationEn:"For a tropical tank, add/register suitable heating with independent control or monitoring."});
  }
  if(tank.type==="marine"&&!hasAny(activeKinds,["waveMaker","returnPump"])){
    issue({id:"missing-flow",kind:"waveMaker",level:"danger",ar:"ما في مصدر حركة ماء فعّال مسجل للحوض البحري.",en:"No active water-movement source is registered for this marine tank.",recommendationAr:"أضف حركة ماء مناسبة لتجنب المناطق الراكدة وتحسين الأكسجة.",recommendationEn:"Add appropriate water movement to avoid dead zones and improve oxygenation."});
  }
  if((hasCoral||hasPlant)&&!activeKinds.has("lighting")){
    issue({id:"missing-light",kind:"lighting",level:"danger",ar:hasCoral?"يوجد مرجان لكن ما في إضاءة فعّالة مسجلة.":"يوجد نباتات لكن ما في إضاءة فعّالة مسجلة.",en:hasCoral?"Corals are present but no active lighting is registered.":"Plants are present but no active lighting is registered.",recommendationAr:"سجل/أضف إضاءة مناسبة للكائنات الضوئية وحدد قدرتها أو قياس PAR عند توفره.",recommendationEn:"Register/add lighting suitable for photosynthetic livestock and record its capacity or PAR when available."});
  }
  if(tank.type==="marine"&&!activeKinds.has("ato")){
    suggest({id:"missing-ato",kind:"ato",level:"info",ar:"ما في ATO مسجل؛ ثبات الملوحة سيعتمد على التعويض اليدوي.",en:"No ATO is registered; salinity stability depends on manual top-off.",recommendationAr:"ATO مو إلزامي، لكنه مفيد جداً لثبات الملوحة خصوصاً مع تبخر يومي ملحوظ.",recommendationEn:"ATO is not mandatory, but it strongly helps salinity stability when evaporation is significant."});
  }
  if(tank.type==="marine"&&(bio>.45||volume>=150)&&!activeKinds.has("skimmer")){
    suggest({id:"missing-skimmer",kind:"skimmer",level:"warn",ar:"الحوض البحري عنده حجم/حمل يستفيد من سكيمر، لكن ما في سكيمر فعّال مسجل.",en:"This marine tank's size/bioload would benefit from a skimmer, but none is registered.",recommendationAr:"فكّر بإضافة سكيمر مناسب للحجم والحمل الحيوي، خصوصاً إذا NO3/PO4 يميلوا للارتفاع.",recommendationEn:"Consider a skimmer sized to volume and bioload, especially if NO3/PO4 trend upward."});
  }
  if(bio>.85&&!hasAny(activeKinds,["skimmer","rollerFilter","filterSock","reactor"])){
    issue({id:"high-load-low-export",level:"warn",ar:"الحمل الحيوي مرتفع وما في وسيلة تصدير/فلترة قوية مسجلة تكفي كطبقة دعم واضحة.",en:"Bioload is high and no strong export/filtration support is registered.",recommendationAr:"راجع كفاءة الفلترة الميكانيكية/العضوية والتصدير قبل زيادة الكائنات.",recommendationEn:"Review mechanical/organic filtration and nutrient export before adding livestock."});
  }

  // Current equipment status directly affects adequacy.
  for(const e of tank.equipment){
    if(e.status==="warning"||e.status==="service"){
      const critical=["returnPump","heater","overflow"].includes(e.kind);
      issue({id:`status-${e.id}`,kind:e.kind,level:critical?"danger":"warn",ar:`${e.name}: الحالة ${e.status==="warning"?"تحذير":"صيانة"}.`,en:`${e.name}: status is ${e.status}.`,recommendationAr:"افحص الجهاز وحدّث حالته بعد التأكد من أدائه.",recommendationEn:"Inspect the device and update its status after verifying performance."});
    }
    if(e.status==="off"&&["returnPump","heater","overflow"].includes(e.kind)){
      issue({id:`off-${e.id}`,kind:e.kind,level:"danger",ar:`${e.name} جهاز حرج ومسجل حالياً Off.`,en:`${e.name} is a critical device currently marked Off.`,recommendationAr:"تأكد أن إيقافه مقصود وأن هناك بديل يحافظ على الوظيفة الحرجة.",recommendationEn:"Confirm the shutdown is intentional and that backup capacity covers the critical function."});
    }
  }

  // Sizing checks where the user provided real capacity data.
  let sizingFields=0, sizingKnown=0, checked=0;

  const returns=tank.equipment.filter(x=>x.kind==="returnPump"&&x.status!=="off");
  if(returns.length){
    sizingFields++;checked++;
    const flow=returns.reduce((s,x)=>s+Number(x.flowLph||0),0);
    if(flow>0){
      sizingKnown++;
      const turnover=flow/volume;
      if(turnover<3){
        issue({id:"return-undersized",kind:"returnPump",level:"danger",ar:`تدفق مضخة الرجوع المسجل حوالي ${flow.toFixed(0)} L/h = ${turnover.toFixed(1)}× حجم النظام/ساعة، وهو منخفض.`,en:`Registered return flow is about ${flow.toFixed(0)} L/h = ${turnover.toFixed(1)}× system volume/hour, which is low.`,recommendationAr:"استهدف تقريباً 4–8× حجم النظام/ساعة كتدفق فعلي بعد الرفع والفواقد، حسب تصميم السامب.",recommendationEn:"Target roughly 4–8× system volume/hour as real post-head-loss flow, depending on sump design."});
      }else if(turnover<4){
        issue({id:"return-borderline",kind:"returnPump",level:"warn",ar:`تدفق الرجوع ${turnover.toFixed(1)}×/ساعة قريب من الحد الأدنى.`,en:`Return turnover of ${turnover.toFixed(1)}×/hour is close to the low end.`,recommendationAr:"راجع التدفق الفعلي بعد ارتفاع الضخ والأكواع قبل الحكم النهائي.",recommendationEn:"Verify real flow after head height and plumbing losses before final judgment."});
      }
    }else{
      suggest({id:"return-flow-missing",kind:"returnPump",level:"info",ar:"مضخة الرجوع موجودة لكن قيمة Flow L/h غير مسجلة، لذلك ما بقدر أحكم على حجمها.",en:"A return pump exists but Flow L/h is not recorded, so sizing cannot be verified.",recommendationAr:"أدخل التدفق الفعلي أو الاسمي للمضخة حتى يدخل حجمها بحساب الصحة.",recommendationEn:"Enter nominal or measured flow so pump sizing can contribute to health."});
    }
  }

  const waves=tank.equipment.filter(x=>x.kind==="waveMaker"&&x.status!=="off");
  if(tank.type==="marine"&&waves.length){
    sizingFields++;checked++;
    const flow=waves.reduce((s,x)=>s+Number(x.flowLph||0),0);
    if(flow>0){
      sizingKnown++;
      const turnover=flow/volume;
      const min=hasCoral?15:10;
      if(turnover<min){
        issue({id:"wave-underflow",kind:"waveMaker",level:"warn",ar:`إجمالي حركة الـWave Maker المسجلة حوالي ${turnover.toFixed(1)}× حجم الحوض/ساعة، وهي منخفضة نسبياً للكائنات الحالية.`,en:`Registered wave-maker flow is about ${turnover.toFixed(1)}× tank volume/hour, relatively low for current livestock.`,recommendationAr:hasCoral?"لـLPS/Soft كمرجع عام، راجع توزيع حركة تقريباً 15–30×/ساعة بدون ضرب المرجان مباشرة.":"راجع وجود حركة موزعة كافية ومنع المناطق الراكدة.",recommendationEn:hasCoral?"For LPS/soft systems, a general reference is roughly 15–30×/hour distributed flow without blasting corals directly.":"Review distributed circulation and eliminate dead zones."});
      }
    }else{
      suggest({id:"wave-flow-missing",kind:"waveMaker",level:"info",ar:"الـWave Maker موجود لكن Flow L/h غير مسجل.",en:"Wave makers exist but Flow L/h is not recorded.",recommendationAr:"أدخل تدفق كل مضخة حتى نقدر نقارن الحركة بحجم الحوض.",recommendationEn:"Enter each pump's flow so circulation can be compared with tank volume."});
    }
  }

  const skimmers=tank.equipment.filter(x=>x.kind==="skimmer"&&x.status!=="off");
  if(skimmers.length){
    sizingFields++;checked++;
    const rated=Math.max(...skimmers.map(x=>Number(x.ratedVolumeLiters||0)));
    if(rated>0){
      sizingKnown++;
      const target=volume*(bio>.85?1.3:1);
      if(rated<target*.8){
        issue({id:"skimmer-undersized",kind:"skimmer",level:"warn",ar:`تصنيف السكيمر المسجل ${rated.toFixed(0)} لتر مقابل نظام ${volume.toFixed(0)} لتر وحمله الحالي؛ قد يكون صغيراً.`,en:`Registered skimmer rating is ${rated.toFixed(0)} L versus a ${volume.toFixed(0)} L system and current load; it may be undersized.`,recommendationAr:"راجع تصنيف الشركة للحمل الفعلي، ولا تعتمد على رقم الحجم الاسمي وحده.",recommendationEn:"Review the manufacturer rating for actual bioload rather than relying only on nominal tank size."});
      }
    }else{
      suggest({id:"skimmer-rating-missing",kind:"skimmer",level:"info",ar:"السكيمر موجود لكن Rated Volume غير مسجل، لذلك ما بقدر أقيّم حجمه.",en:"A skimmer is present but its rated volume is not recorded, so sizing cannot be evaluated.",recommendationAr:"أدخل Rated Volume من مواصفات الشركة.",recommendationEn:"Enter the manufacturer's rated aquarium volume."});
    }
  }

  const heaters=tank.equipment.filter(x=>x.kind==="heater"&&x.status!=="off");
  if(heaters.length){
    sizingFields++;checked++;
    const watts=heaters.reduce((s,x)=>s+Number(x.powerWatts||0),0);
    if(watts>0){
      sizingKnown++;
      const wpl=watts/volume;
      if(wpl<.35){
        issue({id:"heater-undersized",kind:"heater",level:"warn",ar:`قدرة التسخين المسجلة ${watts.toFixed(0)}W = ${wpl.toFixed(2)} W/L، وقد تكون منخفضة حسب فرق حرارة الغرفة.`,en:`Registered heating power is ${watts.toFixed(0)} W = ${wpl.toFixed(2)} W/L, which may be low depending on room-to-tank temperature difference.`,recommendationAr:"اعتبر تقريباً 0.5–1 W/L مرجعاً أولياً فقط، والأهم ثبات الحرارة الفعلي ووجود تحكم آمن.",recommendationEn:"Use roughly 0.5–1 W/L only as a starting reference; actual temperature stability and safe control matter more."});
      }
    }else{
      suggest({id:"heater-power-missing",kind:"heater",level:"info",ar:"السخان موجود لكن قدرته بالواط غير مسجلة، لذلك ما بقدر أقارن حجمه بحجم الحوض.",en:"A heater is present but wattage is not recorded, so sizing cannot be compared with tank volume.",recommendationAr:"أدخل قدرة السخان W حتى تدخل بالحساب.",recommendationEn:"Enter heater wattage so sizing can be included."});
    }
  }

  const penalized=[...issues,...suggestions.filter(x=>x.level==="warn")];
  let score=100;
  for(const x of penalized){
    score-=x.level==="danger"?18:x.level==="warn"?8:0;
  }
  score=Math.max(0,Math.round(score));
  const sizingCoverage=sizingFields?Math.round(sizingKnown/sizingFields*100):100;
  return {score,level:levelFromScore(score),issues,suggestions,sizingCoverage,checked};
}
