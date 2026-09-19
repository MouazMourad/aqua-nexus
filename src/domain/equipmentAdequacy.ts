import type { EquipmentKind,Tank } from "./types";
import { equipmentReliability } from "./equipmentLifecycle";

export type EquipmentAdequacyLevel="good"|"info"|"warn"|"danger";
export type EquipmentSystemProfile="marine-fish"|"marine-reef"|"freshwater"|"freshwater-planted";

export interface EquipmentAdequacyIssue{
  id:string;
  level:EquipmentAdequacyLevel;
  kind?:EquipmentKind;
  ar:string;
  en:string;
  recommendationAr?:string;
  recommendationEn?:string;
}

export interface EquipmentHeadroom {
  key:string;
  valuePct:number;
  level:EquipmentAdequacyLevel;
  ar:string;
  en:string;
}

export interface EquipmentAdequacyResult{
  score:number;
  level:EquipmentAdequacyLevel;
  issues:EquipmentAdequacyIssue[];
  suggestions:EquipmentAdequacyIssue[];
  sizingCoverage:number;
  checked:number;
  presenceScore:number;
  capacityScore:number;
  statusScore:number;
  dataConfidence:number;
  reliabilityScore:number;
  lifecycleScore:number;
  redundancyScore:number;
  consumablesScore:number;
  profile:EquipmentSystemProfile;
  basisAr:string;
  basisEn:string;
  headroom:EquipmentHeadroom[];
}

function clamp(n:number){return Math.max(0,Math.min(100,Math.round(n)));}
function levelFromScore(score:number):EquipmentAdequacyLevel{return score<50?"danger":score<75?"warn":score<90?"info":"good";}
function active(tank:Tank,kind:EquipmentKind){return tank.equipment.filter(x=>x.kind===kind&&x.status!=="off");}
function has(tank:Tank,kind:EquipmentKind){return active(tank,kind).length>0;}
function loadRatio(tank:Tank){
  const load=tank.livestock.reduce((s,x)=>s+(x.load??1)*x.quantity,0);
  const capacity=Math.max(1,tank.systemVolumeLiters/35);
  return load/capacity;
}
function allKnownLivestock(tank:Tank){
  const current=tank.livestock;
  const acclimation=(tank.acclimationSessions??[]).flatMap(s=>s.items).filter(x=>x.status!=="deferred");
  return [...current,...acclimation];
}

export function inferEquipmentProfile(tank:Tank):EquipmentSystemProfile{
  if(tank.ecosystemProfile==="reef")return "marine-reef";
  if(tank.ecosystemProfile==="planted")return "freshwater-planted";
  if(tank.ecosystemProfile==="fishOnly")return tank.type==="marine"?"marine-fish":"freshwater";
  if(tank.ecosystemProfile==="mixed")return tank.type==="marine"?"marine-reef":"freshwater-planted";
  const livestock=allKnownLivestock(tank);
  const name=(tank.name||"").toLowerCase();
  const coral=livestock.some(x=>x.category==="coral")||/reef|مرجان|ريف/.test(name);
  const plant=livestock.some(x=>x.category==="plant")||/planted|مزروع|نبات/.test(name);
  if(tank.type==="marine")return coral?"marine-reef":"marine-fish";
  return plant?"freshwater-planted":"freshwater";
}

export function equipmentAdequacy(tank:Tank):EquipmentAdequacyResult{
  const issues:EquipmentAdequacyIssue[]=[];
  const suggestions:EquipmentAdequacyIssue[]=[];
  const headroom:EquipmentHeadroom[]=[];
  const profile=inferEquipmentProfile(tank);
  const volume=Math.max(1,tank.systemVolumeLiters);
  const bio=loadRatio(tank);
  const sump=Boolean(tank.sump?.enabled);
  let presenceScore=100,statusScore=100;
  const capacityScores:number[]=[];
  let expectedSizing=0,knownSizing=0,checked=0;

  const issue=(x:EquipmentAdequacyIssue,penalty=0)=>{if(!issues.some(i=>i.id===x.id)){issues.push(x);presenceScore-=penalty;}};
  const suggest=(x:EquipmentAdequacyIssue)=>{if(!suggestions.some(i=>i.id===x.id))suggestions.push(x);};
  const capacity=(score:number,known:boolean)=>{capacityScores.push(clamp(score));expectedSizing++;if(known)knownSizing++;checked++;};

  // Required/important architecture by aquarium profile.
  if(sump&&!has(tank,"returnPump"))issue({id:"missing-return",kind:"returnPump",level:"danger",ar:"السامب مفعّل لكن ما في مضخة رجوع فعّالة مسجلة.",en:"The sump is enabled but no active return pump is registered.",recommendationAr:"أضف مضخة رجوع وسجّل Flow L/h حتى ينحسب التدفق الفعلي مقابل حجم النظام.",recommendationEn:"Add a return pump and record Flow L/h so real turnover can be compared with system volume."},28);
  if(sump&&!has(tank,"overflow"))issue({id:"missing-overflow",kind:"overflow",level:"danger",ar:"السامب مفعّل لكن ما في Overflow/مسار نزول مسجل.",en:"The sump is enabled but no overflow/drain path is registered.",recommendationAr:"سجل/أضف مسار Overflow مناسب لأن استمرارية الصرف جزء من سلامة النظام.",recommendationEn:"Register/add an appropriate overflow because safe drainage is part of system reliability."},22);

  if(profile==="marine-reef"&&!has(tank,"lighting"))issue({id:"missing-light",kind:"lighting",level:"danger",ar:"هذا الحوض مصنف Reef لكن ما في إضاءة فعّالة مسجلة.",en:"This tank is classified as Reef but no active aquarium lighting is registered.",recommendationAr:"أضف إضاءة Reef مناسبة وسجّل PAR أو مساحة التغطية؛ حذف الإنارة لازم يخفض تقييم التجهيزات فوراً.",recommendationEn:"Add reef-capable lighting and record PAR or coverage; removing lighting must immediately reduce equipment adequacy."},30);
  if(profile==="freshwater-planted"&&!has(tank,"lighting"))issue({id:"missing-light",kind:"lighting",level:"danger",ar:"هذا الحوض مصنف Planted لكن ما في إضاءة فعّالة مسجلة.",en:"This tank is classified as Planted but no active aquarium lighting is registered.",recommendationAr:"أضف إضاءة مناسبة للنباتات وسجّل PAR أو مساحة التغطية.",recommendationEn:"Add plant-suitable lighting and record PAR or coverage."},30);

  if(profile==="marine-reef"&&!has(tank,"waveMaker"))issue({id:"missing-wave",kind:"waveMaker",level:"danger",ar:"حوض Reef بدون Wave Maker فعّال؛ حركة الماء داخل العرض ما بتكفي تُفترض من مضخة الرجوع وحدها.",en:"A Reef tank has no active wave maker; display circulation should not be assumed from the return pump alone.",recommendationAr:"أضف Wave Maker وسجّل Flow L/h حتى تنحسب الحركة مقارنةً بحجم الحوض.",recommendationEn:"Add a wave maker and record Flow L/h so circulation can be sized against tank volume."},24);
  if(profile==="marine-fish"&&!has(tank,"waveMaker")&&!has(tank,"returnPump"))issue({id:"missing-flow",kind:"waveMaker",level:"danger",ar:"ما في مصدر حركة ماء فعّال مسجل للحوض البحري.",en:"No active water-movement source is registered for this marine tank.",recommendationAr:"أضف حركة ماء مناسبة وسجّل التدفق.",recommendationEn:"Add appropriate water movement and record its flow."},24);

  if(!has(tank,"heater")){
    const p=tank.type==="marine"?12:8;
    issue({id:"missing-heater",kind:"heater",level:"warn",ar:"ما في سخان فعّال مسجل؛ ما بقدر اعتبر منظومة الحرارة مكتملة.",en:"No active heater is registered, so temperature control cannot be considered complete.",recommendationAr:"إذا الحوض استوائي، أضف/سجل سخان مناسب مع قدرة W ومراقبة حرارة مستقلة.",recommendationEn:"For a tropical tank, add/register suitable heating with wattage and independent temperature monitoring."},p);
  }
  if(tank.type==="marine"&&!has(tank,"ato"))suggest({id:"missing-ato",kind:"ato",level:"info",ar:"ما في ATO مسجل؛ ثبات الملوحة يعتمد على التعويض اليدوي.",en:"No ATO is registered; salinity stability depends on manual top-off.",recommendationAr:"ATO مو إلزامي لكنه إضافة موصى بها لثبات الملوحة.",recommendationEn:"ATO is optional but recommended for salinity stability."});
  if(tank.type==="marine"&&(bio>.45||volume>=150)&&!has(tank,"skimmer"))issue({id:"missing-skimmer",kind:"skimmer",level:"warn",ar:"حجم/حمل الحوض يستفيد من Skimmer لكن ما في واحد فعّال مسجل.",en:"This tank size/bioload would benefit from a skimmer, but none is active.",recommendationAr:"أضف Skimmer مناسب وسجّل Rated Volume من مواصفات الشركة.",recommendationEn:"Add a suitable skimmer and record the manufacturer rated volume."},10);

  // Device condition affects adequacy independently from presence.
  for(const e of tank.equipment){
    if(e.status==="warning"||e.status==="service"){
      const critical=["returnPump","heater","overflow"].includes(e.kind);
      statusScore-=critical?24:10;
      issue({id:`status-${e.id}`,kind:e.kind,level:critical?"danger":"warn",ar:`${e.name}: الحالة ${e.status==="warning"?"تحذير":"صيانة"}.`,en:`${e.name}: status is ${e.status}.`,recommendationAr:"افحص الجهاز وحدّث حالته بعد التأكد من أدائه.",recommendationEn:"Inspect the device and update its status after verifying performance."});
    }
    if(e.status==="off"&&["returnPump","heater","overflow","lighting","waveMaker"].includes(e.kind)){
      statusScore-=20;
      issue({id:`off-${e.id}`,kind:e.kind,level:"danger",ar:`${e.name} مسجل Off وتأثيره يدخل مباشرة بكفاية النظام.`,en:`${e.name} is marked Off and directly reduces system adequacy.`,recommendationAr:"تأكد أن الإيقاف مقصود وأن وظيفة الجهاز مغطاة ببديل.",recommendationEn:"Confirm the shutdown is intentional and the function is covered by another device."});
    }
  }

  // Capacity / sizing checks. Unknown capacity is NOT treated as 100%.
  if(sump){
    const list=active(tank,"returnPump"),flow=list.reduce((s,x)=>s+Number(x.flowLph||0),0);
    if(!list.length)capacity(0,false);
    else if(flow<=0){capacity(55,false);suggest({id:"return-flow-missing",kind:"returnPump",level:"warn",ar:"مضخة الرجوع موجودة لكن Flow L/h غير مسجل؛ ما في أساس كافي لإعطاء 100%.",en:"A return pump exists but Flow L/h is missing; there is not enough evidence for a 100% score.",recommendationAr:"أدخل التدفق الاسمي أو الأفضل التدفق الفعلي بعد الرفع والأكواع.",recommendationEn:"Enter nominal flow, preferably measured post-head-loss flow."});}
    else {const t=flow/volume;knownSizing++;expectedSizing++;checked++;capacityScores.push(t<3?35:t<4?70:t<=10?100:85);const hp=Math.round((t/4-1)*100);headroom.push({key:"return",valuePct:hp,level:hp<0?"warn":"good",ar:`هامش تدفق الرجوع ${hp>=0?"+":""}${hp}% فوق/تحت الحد المرجعي الأدنى 4×/ساعة.`,en:`Return-flow headroom is ${hp>=0?"+":""}${hp}% versus the 4×/hour lower reference.`});if(t<4)issue({id:"return-under",kind:"returnPump",level:t<3?"danger":"warn",ar:`تدفق الرجوع ${flow.toFixed(0)} L/h = ${t.toFixed(1)}× حجم النظام/ساعة.`,en:`Return flow ${flow.toFixed(0)} L/h = ${t.toFixed(1)}× system volume/hour.`,recommendationAr:"راجع هدف تقريبي 4–8×/ساعة كتدفق فعلي بعد الفواقد.",recommendationEn:"Review a rough target of 4–8×/hour as real flow after losses."});}
  }

  if(tank.type==="marine"){
    const list=active(tank,"waveMaker"),flow=list.reduce((s,x)=>s+Number(x.flowLph||0),0),target=profile==="marine-reef"?15:10;
    if(profile==="marine-reef"&&!list.length)capacity(0,false);
    else if(list.length&&flow<=0){capacity(55,false);suggest({id:"wave-flow-missing",kind:"waveMaker",level:"warn",ar:"الـWave Maker موجود لكن Flow L/h غير مسجل، لذلك قوة الحركة غير محسوبة فعلياً.",en:"Wave makers exist but Flow L/h is missing, so circulation strength is not actually verified.",recommendationAr:"أدخل Flow L/h لكل Wave Maker.",recommendationEn:"Enter Flow L/h for each wave maker."});}
    else if(flow>0){const t=flow/volume;knownSizing++;expectedSizing++;checked++;capacityScores.push(t<target*.6?35:t<target?70:t<=40?100:85);const hp=Math.round((t/target-1)*100);headroom.push({key:"wave",valuePct:hp,level:hp<0?"warn":"good",ar:`هامش حركة الماء ${hp>=0?"+":""}${hp}% مقارنة بالحد المرجعي ${target}×/ساعة.`,en:`Display-flow headroom is ${hp>=0?"+":""}${hp}% versus the ${target}×/hour reference.`});if(t<target)issue({id:"wave-under",kind:"waveMaker",level:"warn",ar:`حركة الـWave Maker حوالي ${t.toFixed(1)}× حجم النظام/ساعة مقابل مرجع أولي ${target}× أو أكثر لهذا البروفايل.`,en:`Wave-maker circulation is about ${t.toFixed(1)}× system volume/hour versus an initial reference of ${target}× or more for this profile.`,recommendationAr:"ارفع/وزع الحركة تدريجياً وتأكد من عدم ضرب المرجان مباشرة.",recommendationEn:"Increase/distribute flow gradually without blasting livestock directly."});}
  }

  const sk=active(tank,"skimmer");
  if(sk.length){
    const rated=Math.max(...sk.map(x=>Number(x.ratedVolumeLiters||0)));
    if(rated<=0){capacity(60,false);suggest({id:"skimmer-rating-missing",kind:"skimmer",level:"warn",ar:"السكيمر موجود لكن Rated Volume غير مسجل؛ حجمه غير مثبت ضمن التقييم.",en:"A skimmer exists but Rated Volume is missing, so its sizing is unverified.",recommendationAr:"أدخل Rated Volume من مواصفات الشركة.",recommendationEn:"Enter the manufacturer rated volume."});}
    else {const target=volume*(bio>.85?1.3:1);knownSizing++;expectedSizing++;checked++;const r=rated/target;capacityScores.push(r<.6?40:r<.8?70:r<=2.5?100:90);const hp=Math.round((r-1)*100);headroom.push({key:"skimmer",valuePct:hp,level:hp<0?"warn":"good",ar:`هامش تصنيف السكيمر ${hp>=0?"+":""}${hp}% مقارنة بالحاجة التقديرية المرتبطة بالحجم والحمل.`,en:`Skimmer-rating headroom is ${hp>=0?"+":""}${hp}% versus estimated size/load need.`});if(r<.8)issue({id:"skimmer-under",kind:"skimmer",level:"warn",ar:`Rated Volume للسكيمر ${rated.toFixed(0)}L مقابل حاجة تقديرية ${target.toFixed(0)}L.`,en:`Skimmer rated volume is ${rated.toFixed(0)}L versus an estimated need of ${target.toFixed(0)}L.`,recommendationAr:"راجع موديل أكبر أو قدرة تصدير أعلى حسب الحمل الفعلي.",recommendationEn:"Review a larger model or stronger export capacity for the actual load."});}
  }

  const heaters=active(tank,"heater");
  if(heaters.length){
    const watts=heaters.reduce((s,x)=>s+Number(x.powerWatts||0),0);
    if(watts<=0){capacity(60,false);suggest({id:"heater-power-missing",kind:"heater",level:"warn",ar:"السخان موجود لكن قدرته W غير مسجلة، لذلك حجمه غير محسوب.",en:"A heater exists but wattage is missing, so sizing is not verified.",recommendationAr:"أدخل قدرة السخان بالواط.",recommendationEn:"Enter heater wattage."});}
    else {const wpl=watts/volume;knownSizing++;expectedSizing++;checked++;capacityScores.push(wpl<.25?35:wpl<.5?70:wpl<=1.5?100:90);const hp=Math.round((wpl/.5-1)*100);headroom.push({key:"heater",valuePct:hp,level:hp<0?"warn":"good",ar:`هامش قدرة التسخين ${hp>=0?"+":""}${hp}% مقارنة بمرجع أولي 0.5 W/L.`,en:`Heating-capacity headroom is ${hp>=0?"+":""}${hp}% versus an initial 0.5 W/L reference.`});if(wpl<.5)issue({id:"heater-under",kind:"heater",level:"warn",ar:`قدرة التسخين ${watts.toFixed(0)}W = ${wpl.toFixed(2)} W/L وقد تكون منخفضة حسب حرارة الغرفة.`,en:`Heating power is ${watts.toFixed(0)}W = ${wpl.toFixed(2)} W/L and may be low depending on room temperature.`,recommendationAr:"اعتبر 0.5–1 W/L مرجعاً أولياً فقط وراقب ثبات الحرارة الفعلي.",recommendationEn:"Use 0.5–1 W/L only as a starting reference and verify actual temperature stability."});}
  }

  if(profile==="marine-reef"||profile==="freshwater-planted"){
    const lights=active(tank,"lighting");
    if(!lights.length)capacity(0,false);
    else {
      const par=Math.max(...lights.map(x=>Number(x.parAtTargetDepth||0)));
      const covL=Math.max(...lights.map(x=>Number(x.coverageLengthCm||0)));
      const covW=Math.max(...lights.map(x=>Number(x.coverageWidthCm||0)));
      const hasData=par>0||(covL>0&&covW>0);
      if(!hasData){capacity(50,false);suggest({id:"light-sizing-missing",kind:"lighting",level:"warn",ar:"الإنارة موجودة لكن ما في PAR أو Coverage؛ الواط وحده ما بكفي للحكم على قوة الإنارة.",en:"Lighting exists but PAR or coverage is missing; wattage alone is not enough to judge lighting adequacy.",recommendationAr:"سجّل PAR عند عمق الكائنات أو أبعاد Coverage من الشركة/القياس.",recommendationEn:"Record PAR at livestock depth or fixture coverage dimensions."});}
      else {
        knownSizing++;expectedSizing++;checked++;let s=100;
        if(par>0){const min=profile==="marine-reef"?60:30;const hp=Math.round((par/min-1)*100);headroom.push({key:"lighting-par",valuePct:hp,level:hp<0?"warn":"good",ar:`هامش PAR المسجل ${hp>=0?"+":""}${hp}% مقارنة بالحد المرجعي الأولي ${min}.`,en:`Recorded PAR headroom is ${hp>=0?"+":""}${hp}% versus the initial reference of ${min}.`});if(par<min*.6)s=Math.min(s,35);else if(par<min)s=Math.min(s,70);}
        if(covL>0&&covW>0){const lr=covL/Math.max(1,tank.display.length),wr=covW/Math.max(1,tank.display.width),r=Math.min(lr,wr);if(r<.6)s=Math.min(s,40);else if(r<.85)s=Math.min(s,70);}
        capacityScores.push(s);
        if(s<80)issue({id:"light-under",kind:"lighting",level:"warn",ar:"بيانات PAR/Coverage الحالية تشير إن تغطية أو شدة الإنارة قد تكون أقل من حاجة البروفايل.",en:"Current PAR/coverage data suggests lighting intensity or coverage may be below this profile needs.",recommendationAr:"راجع PAR عند مواقع الكائنات والتغطية الفعلية قبل زيادة الشدة عشوائياً.",recommendationEn:"Review PAR at livestock positions and real coverage before increasing intensity blindly."});
      }
    }
  }

  const reliability=equipmentReliability(tank);
  for(const x of reliability.issues){if(!issues.some(i=>i.id===x.id))issues.push(x);}
  for(const x of reliability.suggestions){if(!suggestions.some(i=>i.id===x.id))suggestions.push(x);}
  const capacityScore=capacityScores.length?clamp(capacityScores.reduce((a,b)=>a+b,0)/capacityScores.length):70;
  const dataConfidence=expectedSizing?clamp(knownSizing/expectedSizing*100):0;
  const sizingCoverage=dataConfidence;
  presenceScore=clamp(presenceScore);statusScore=clamp(statusScore);
  // 100% now requires presence + verified sizing + healthy condition + lifecycle/redundancy readiness.
  let score=clamp(presenceScore*.30+capacityScore*.30+statusScore*.15+reliability.score*.25);
  if(dataConfidence<50)score=Math.min(score,86);
  if(dataConfidence===0&&capacityScores.length)score=Math.min(score,82);
  const level=levelFromScore(score);
  const basisAr=`${Math.round(score)}% = وجود الأساسيات ${presenceScore}% ×30% + القدرة/الحجم ${capacityScore}% ×30% + حالة الأجهزة ${statusScore}% ×15% + الاعتمادية/العمر/الاحتياط ${reliability.score}% ×25%. ثقة بيانات السعة ${dataConfidence}%.`;
  const basisEn=`${Math.round(score)}% = core presence ${presenceScore}% ×30% + sizing/capacity ${capacityScore}% ×30% + device condition ${statusScore}% ×15% + lifecycle/redundancy readiness ${reliability.score}% ×25%. Capacity-data confidence ${dataConfidence}%.`;
  return {score,level,issues,suggestions,sizingCoverage,checked,presenceScore,capacityScore,statusScore,dataConfidence,reliabilityScore:reliability.score,lifecycleScore:reliability.lifecycleScore,redundancyScore:reliability.redundancyScore,consumablesScore:reliability.consumablesScore,profile,basisAr,basisEn,headroom};
}
