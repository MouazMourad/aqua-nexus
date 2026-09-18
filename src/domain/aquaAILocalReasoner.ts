import type { Tank } from "./types";
import type { AquaQuestionIntent } from "./aquaAIIntent";
import { chemistryGuidance } from "./chemistryGuidance";
import { bioload, chemistryAgeDays, maintenanceHealth } from "./health";
import { tankStateView } from "./tankIntelligence";
import { eventChemistryLinks, proactivePredictions } from "./tankLearning";
import { learnedTankSignals, repeatedResponsePatterns, tankBaselines } from "./tankPatterns";
import { analyzeNutrients } from "./nutrientEngine";

export type LocalReasoningLevel="good"|"info"|"warn"|"danger";
export type LocalReasoningConfidence="low"|"medium"|"high";

export interface LocalReasoningSignal{
 id:string;
 level:LocalReasoningLevel;
 confidence:LocalReasoningConfidence;
 source:"data"|"chemistry"|"trend"|"history"|"equipment"|"maintenance"|"livestock"|"bioload"|"acclimation"|"nutrients"|"learning";
 ar:string;
 en:string;
 score:number;
}

export interface LocalReasoningAction{
 id:string;
 priority:number;
 level:LocalReasoningLevel;
 page:string;
 ar:string;
 en:string;
 whyAr:string;
 whyEn:string;
 recheckAr:string;
 recheckEn:string;
}

export interface LocalReasoningResult{
 summaryAr:string;
 summaryEn:string;
 signals:LocalReasoningSignal[];
 actions:LocalReasoningAction[];
 evidenceAr:string[];
 evidenceEn:string[];
 confidence:LocalReasoningConfidence;
 mentionedLivestock:string[];
 mentionedEquipment:string[];
}

function norm(s:string){
 return (s||"").toLowerCase().normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[^a-z0-9\u0600-\u06ff]+/g," ").replace(/\s+/g," ").trim();
}
function containsName(question:string,name?:string){
 if(!name)return false;
 const q=norm(question),n=norm(name);
 return n.length>=3&&q.includes(n);
}
function confidenceFromEvidence(tank:Tank,signalCount:number):LocalReasoningConfidence{
 const history=tank.chemistry.length+tank.timeline.length;
 if(history>=12&&signalCount>=3)return "high";
 if(history>=4&&signalCount>=1)return "medium";
 return "low";
}
function relevantParam(intent:AquaQuestionIntent,param:string){return !intent.params.length||intent.params.includes(param as any);}
function topicRelevant(intent:AquaQuestionIntent,topic:string){return intent.topics.includes("general" as any)||intent.topics.includes(topic as any);}

export function reasonLocally(tank:Tank,intent:AquaQuestionIntent):LocalReasoningResult{
 const guide=chemistryGuidance(tank),state=tankStateView(tank),bio=bioload(tank),nutrients=analyzeNutrients(tank);
 const age=chemistryAgeDays(tank);
 const today=new Date().toISOString().slice(0,10);
 const signals:LocalReasoningSignal[]=[];
 const actions:LocalReasoningAction[]=[];
 const explicitTopics=intent.topics.filter(x=>x!=="general");
 const broadQuestion=explicitTopics.length===0||intent.topics.includes("general");
 const chemistryRelevant=broadQuestion||intent.topics.includes("chemistry")||intent.params.length>0;
 const livestockRelevant=broadQuestion||intent.topics.includes("livestock");
 const pushSignal=(x:LocalReasoningSignal)=>{if(!signals.some(s=>s.id===x.id))signals.push(x);};
 const pushAction=(x:LocalReasoningAction)=>{if(!actions.some(a=>a.id===x.id))actions.push(x);};

 const mentionedLivestock=tank.livestock.filter(x=>containsName(intent.raw,x.name)||containsName(intent.raw,x.nameEn)).map(x=>x.id);
 const mentionedEquipment=tank.equipment.filter(x=>containsName(intent.raw,x.name)||containsName(intent.raw,x.brand)||containsName(intent.raw,x.model)).map(x=>x.id);

 for(const item of tank.livestock.filter(x=>mentionedLivestock.includes(x.id))){
  const age=item.addedAt?Math.max(0,Math.floor((Date.now()-new Date(item.addedAt).getTime())/86400000)):undefined;
  pushSignal({id:`mentioned-livestock-${item.id}`,level:item.health==="treatment"?"danger":item.health==="watch"?"warn":"good",confidence:"high",source:"livestock",score:item.health==="treatment"?94:item.health==="watch"?74:38,ar:`${item.name}: العدد ${item.quantity} • الحالة ${item.health==="good"?"جيدة":item.health==="watch"?"مراقبة":"علاج"}${age!==undefined?` • موجود بالحوض منذ ${age} يوم`:""}.`,en:`${item.nameEn||item.name}: quantity ${item.quantity} • status ${item.health}${age!==undefined?` • in tank for ${age} day(s)`:""}.`});
 }
 for(const item of tank.equipment.filter(x=>mentionedEquipment.includes(x.id))){
  pushSignal({id:`mentioned-equipment-${item.id}`,level:item.status==="warning"?"warn":item.status==="service"?"warn":"good",confidence:"high",source:"equipment",score:item.status==="warning"||item.status==="service"?76:36,ar:`${item.name}: الحالة ${item.status}${item.brand?` • ${item.brand}`:""}${item.model?` ${item.model}`:""}.`,en:`${item.name}: status ${item.status}${item.brand?` • ${item.brand}`:""}${item.model?` ${item.model}`:""}.`});
 }

 for(const issue of guide.dataIssues){
  if(!chemistryRelevant)continue;
  if(!relevantParam(intent,issue.key))continue;
  pushSignal({id:`data-${issue.key}`,level:"danger",confidence:"high",source:"data",score:100,ar:issue.reasonAr,en:issue.reasonEn});
  pushAction({id:`fix-data-${issue.key}`,priority:100,level:"danger",page:"chemistry",ar:issue.actionAr,en:issue.actionEn,whyAr:"لأن أي تصحيح للحوض مبني على قراءة مكتوبة بصيغة خاطئة ممكن يكون أسوأ من عدم التصحيح.",whyEn:"A physical correction based on a misformatted reading can be worse than no correction.",recheckAr:"بعد تصحيح الإدخال أعد حساب صحة الكيمياء قبل أي جرعة أو تغيير كبير.",recheckEn:"After correcting the entry, recalculate chemistry health before any dose or major change."});
 }

 if(chemistryRelevant){
  for(const issue of guide.problems.filter(x=>!x.suspectedFormat)){
   if(!relevantParam(intent,issue.key))continue;
   const level:LocalReasoningLevel=issue.level==="danger"?"danger":"warn";
   pushSignal({id:`chem-${issue.key}`,level,confidence:"high",source:"chemistry",score:90+(100-(issue.score??100))/5,ar:issue.reasonAr,en:issue.reasonEn});
   pushAction({id:`chem-action-${issue.key}`,priority:80+(100-(issue.score??100))/4,level,page:"chemistry",ar:`${issue.titleAr}: ${issue.actionAr}`,en:`${issue.titleEn}: ${issue.actionEn}`,whyAr:issue.reasonAr,whyEn:issue.reasonEn,recheckAr:"صحح عامل واحد فقط ثم أعد القياس قبل الانتقال لتعديل آخر.",recheckEn:"Correct one factor at a time, then retest before changing another."});
  }
 }

 const latest=tank.chemistry[0]?.values??{};
 if(chemistryRelevant){
 const val=(key:string)=>typeof latest[key]==="number"&&Number.isFinite(latest[key])?Number(latest[key]):undefined;
 const kh=val("KH"),ca=val("Ca"),mg=val("Mg"),no3=val("NO3"),po4=val("PO4"),nh3=val("NH3"),no2=val("NO2"),ph=val("pH");
 if(tank.type==="marine"&&kh!==undefined&&ca!==undefined&&kh<7.5&&ca>460){
  pushSignal({id:"relation-kh-ca",level:"warn",confidence:"high",source:"chemistry",score:93,ar:`KH منخفض (${kh}) بينما Ca مرتفع (${ca}). هاد عدم توازن أهم من قراءة كل عامل لحاله.`,en:`KH is low (${kh}) while Ca is high (${ca}). This imbalance matters more than reading either value alone.`});
  pushAction({id:"relation-kh-ca-action",priority:94,level:"warn",page:"chemistry",ar:"أعد فحص KH وCa معاً، ولا تبدأ جرعة متوازنة ترفع الاثنين قبل تأكيد القراءات.",en:"Retest KH and Ca together, and avoid starting a balanced additive that raises both until the readings are confirmed.",whyAr:"رفع KH بمنتج يرفع Ca أيضاً ممكن يزيد الكالسيوم المرتفع أكثر.",whyEn:"Raising KH with a product that also raises Ca can push already-high calcium even higher.",recheckAr:"بعد تأكيد القراءتين، صحح العامل المحتاج فقط وبشكل تدريجي.",recheckEn:"After confirming both readings, correct only the parameter that needs correction and do it gradually."});
 }
 if(no3!==undefined&&po4!==undefined&&no3>15&&po4>0.1){
  pushSignal({id:"relation-nutrients-high",level:"warn",confidence:"high",source:"nutrients",score:86,ar:`NO3 (${no3}) وPO4 (${po4}) مرتفعان معاً؛ النمط يوحي بحمل عضوي/تصدير مغذيات غير كافٍ أكثر من مشكلة عنصر منفرد.`,en:`NO3 (${no3}) and PO4 (${po4}) are both elevated; the pattern points more toward organic load or insufficient nutrient export than a single-parameter problem.`});
  pushAction({id:"relation-nutrients-action",priority:83,level:"warn",page:"maintenance",ar:"راجع أولاً مصادر الحمل العضوي: بقايا أو كائن ميت، الجوارب/الفلاتر، التغذية، السكيمر وتراكم الرواسب.",en:"First review organic-load sources: debris or dead livestock, socks/mechanical filters, feeding, skimming, and detritus buildup.",whyAr:"خفض رقم واحد كيميائياً بدون معالجة المصدر ممكن يرجعه بسرعة أو يخل بتوازن المغذيات.",whyEn:"Chemically lowering one number without fixing the source can make it rebound or unbalance nutrients.",recheckAr:"أعد NO3 وPO4 بعد معالجة السبب وتغيير ماء مناسب إن لزم.",recheckEn:"Retest NO3 and PO4 after addressing the source and performing an appropriate water change if needed."});
 }
 if(nh3!==undefined&&nh3>0){
  pushSignal({id:"relation-ammonia",level:"danger",confidence:"high",source:"chemistry",score:99,ar:`NH3 ليس صفراً (${nh3}). هاي أولوية قبل أي تحسين تجميلي ببقية القيم.`,en:`NH3 is not zero (${nh3}). This takes priority over cosmetic optimization of other values.`});
 }
 if(tank.type==="freshwater"&&no2!==undefined&&no2>0){
  pushSignal({id:"relation-nitrite",level:"danger",confidence:"high",source:"chemistry",score:98,ar:`NO2 ليس صفراً (${no2}) ويجب التعامل معه كإشارة خلل بالاستقرار البيولوجي.`,en:`NO2 is not zero (${no2}) and should be treated as a biological-stability warning.`});
 }
 if(ph!==undefined&&ph>=8&&ph<=8.3&&kh!==undefined&&kh<7.5&&tank.type==="marine"){
  pushSignal({id:"relation-ph-kh",level:"info",confidence:"high",source:"chemistry",score:44,ar:`pH طبيعي (${ph}) رغم أن KH منخفض (${kh})؛ لا يوجد سبب لمطاردة pH حالياً.`,en:`pH is normal (${ph}) even though KH is low (${kh}); there is no reason to chase pH right now.`});
 }
 }
 if(age>7&&chemistryRelevant){
  pushSignal({id:"stale-chemistry",level:"warn",confidence:"high",source:"data",score:70,ar:`آخر فحص كيميائي عمره ${Math.floor(age)} يوم، لذلك جزء من الاستنتاجات يحتاج قراءة أحدث.`,en:`The latest chemistry test is ${Math.floor(age)} days old, so part of the reasoning needs fresher data.`});
  pushAction({id:"retest-chemistry",priority:88,level:"warn",page:"chemistry",ar:"أعد فحص الكيمياء قبل اتخاذ قرار كبير.",en:"Retest chemistry before making a major decision.",whyAr:"القراءات القديمة تقلل الثقة بالقرار الحالي.",whyEn:"Stale readings reduce confidence in the current decision.",recheckAr:"أعد التحليل مباشرة بعد تسجيل القراءة الجديدة.",recheckEn:"Re-run the analysis immediately after logging the new reading."});
 }

 const criticalEquipment=tank.equipment.filter(x=>x.status==="warning"||x.status==="service");
 for(const item of criticalEquipment){
  if(!(topicRelevant(intent,"equipment")||intent.topics.includes("general")||mentionedEquipment.includes(item.id)))continue;
  const critical=["returnPump","heater","overflow"].includes(item.kind);
  pushSignal({id:`equip-${item.id}`,level:critical?"danger":"warn",confidence:"high",source:"equipment",score:critical?96:72,ar:`${item.name} مسجل بحالة ${item.status==="warning"?"تحذير":"صيانة"}.`,en:`${item.name} is marked as ${item.status}.`});
  pushAction({id:`equip-action-${item.id}`,priority:critical?98:72,level:critical?"danger":"warn",page:"equipment",ar:`افحص ${item.name} ووظيفته الفعلية الآن.`,en:`Inspect ${item.name} and verify its real operation now.`,whyAr:critical?"لأنه جهاز حرج لاستمرار الدوران/الحرارة/الأمان.":"لأن الجهاز مسجل بحاجة انتباه أو صيانة.",whyEn:critical?"It is critical to circulation, temperature, or system safety.":"The device is logged as needing attention or service.",recheckAr:"بعد الفحص حدّث حالة الجهاز وراقب أثره على الحوض.",recheckEn:"After inspection, update the device status and monitor tank response."});
 }

 const overdue=tank.maintenance.filter(x=>!x.done&&x.nextDue&&x.nextDue<=today);
 if(overdue.length&&(topicRelevant(intent,"maintenance")||intent.topics.includes("general"))){
  pushSignal({id:"maintenance-overdue",level:maintenanceHealth(tank)<50?"danger":"warn",confidence:"high",source:"maintenance",score:65,ar:`هناك ${overdue.length} مهمة صيانة مستحقة؛ أقربها ${overdue[0].title}.`,en:`There are ${overdue.length} overdue maintenance task(s); first: ${overdue[0].titleEn||overdue[0].title}.`});
  pushAction({id:"maintenance-action",priority:62,level:"warn",page:"maintenance",ar:`ابدأ بمهمة الصيانة الأعلى تأثيراً: ${overdue[0].title}.`,en:`Start with the highest-impact due task: ${overdue[0].titleEn||overdue[0].title}.`,whyAr:"تأخر الصيانة ممكن يفسر جزءاً من تراجع الاستقرار أو تراكم المغذيات.",whyEn:"Delayed maintenance can contribute to reduced stability or nutrient accumulation.",recheckAr:"بعد التنفيذ حدّث المهمة وراقب القراءة التالية.",recheckEn:"After completion, update the task and watch the next reading."});
 }

 if(intent.asksAboutBioload&&livestockRelevant){
  const level:LocalReasoningLevel=bio.status==="danger"?"danger":bio.status==="high"?"warn":bio.status==="good"?"good":"info";
  const labelAr=bio.status==="danger"?"خطر":bio.status==="high"?"مرتفع":bio.status==="good"?"جيد":"منخفض";
  const labelEn=bio.status==="danger"?"danger":bio.status==="high"?"high":bio.status==="good"?"good":"low";
  pushSignal({id:"bioload-status",level,confidence:"high",source:"bioload",score:96,ar:`الحمل الحيوي الحالي حوالي ${Math.round(bio.ratio*100)}% من القدرة التقديرية، وتصنيفه ${labelAr}. الحمل المحسوب ${Number(bio.load.toFixed(1))} مقابل قدرة تقديرية ${Number((tank.systemVolumeLiters/35).toFixed(1))} وحدة حمل.`,en:`Current bioload is about ${Math.round(bio.ratio*100)}% of estimated capacity and is classified as ${labelEn}. Calculated load is ${Number(bio.load.toFixed(1))} versus an estimated capacity of ${Number((tank.systemVolumeLiters/35).toFixed(1))} load units.`});
  if(bio.status==="danger"||bio.status==="high"){
   pushAction({id:"bioload-focused-action",priority:95,level:bio.status==="danger"?"danger":"warn",page:"livestock",ar:"لا تضيف كائنات جديدة حالياً؛ راجع التغذية وكفاءة الفلترة وNO3/PO4 ثم خفف الحمل أو حسّن القدرة قبل أي إضافة.",en:"Do not add new livestock now; review feeding, filtration capacity and NO3/PO4, then reduce load or improve capacity before another addition.",whyAr:"الحمل الحيوي المرتفع يقلل هامش الأمان ويرفع الضغط على الفلترة والمغذيات.",whyEn:"High bioload reduces the safety margin and increases pressure on filtration and nutrients.",recheckAr:"أعد تقييم الحمل الحيوي مع NO3/PO4 بعد الاستقرار.",recheckEn:"Reassess bioload together with NO3/PO4 after stabilization."});
  }else{
   pushAction({id:"bioload-focused-action",priority:65,level:"good",page:"livestock",ar:"الحمل الحالي لا يحتاج تخفيف بحد ذاته. حافظ على الإضافات تدريجية وراقب NO3/PO4 بعد أي إضافة جديدة.",en:"The current load does not need reduction by itself. Keep additions gradual and monitor NO3/PO4 after any new livestock.",whyAr:"النسبة الحالية ضمن هامش مقبول حسب تقدير النظام.",whyEn:"The current ratio is within the system's acceptable estimated margin.",recheckAr:"راجع الحمل الحيوي بعد كل إضافة جديدة أو تغير واضح بالمغذيات.",recheckEn:"Recheck bioload after each new addition or a clear nutrient change."});
  }
 }

 if(!intent.asksAboutBioload&&(bio.status==="high"||bio.status==="danger")&&livestockRelevant){
  pushSignal({id:"bioload",level:bio.status==="danger"?"danger":"warn",confidence:"high",source:"bioload",score:bio.status==="danger"?92:68,ar:`الحمل الحيوي حوالي ${Math.round(bio.ratio*100)}% وهو ${bio.status==="danger"?"مرتفع جداً":"مرتفع"}.`,en:`Bioload is about ${Math.round(bio.ratio*100)}% and is ${bio.status==="danger"?"very high":"high"}.`});
  pushAction({id:"bioload-action",priority:bio.status==="danger"?90:66,level:bio.status==="danger"?"danger":"warn",page:"livestock",ar:"أوقف إضافة كائنات جديدة مؤقتاً وراجع كفاءة الفلترة والتغذية.",en:"Pause new livestock additions and review filtration capacity and feeding.",whyAr:"الحمل الحيوي المرتفع يقلل هامش الأمان عند أي تغير كيميائي أو عطل.",whyEn:"High bioload reduces the safety margin during chemistry shifts or equipment failures.",recheckAr:"أعد تقييم NO3/PO4 والحمل الحيوي بعد الاستقرار.",recheckEn:"Reassess NO3/PO4 and bioload after stabilization."});
 }

 const watched=tank.livestock.filter(x=>x.health==="watch"||x.health==="treatment");
 for(const item of watched){
  if(!(topicRelevant(intent,"livestock")||intent.topics.includes("general")||mentionedLivestock.includes(item.id)))continue;
  pushSignal({id:`livestock-${item.id}`,level:item.health==="treatment"?"danger":"warn",confidence:"high",source:"livestock",score:item.health==="treatment"?88:58,ar:`${item.name} حالته ${item.health==="treatment"?"تحت العلاج":"تحت المراقبة"}.`,en:`${item.nameEn||item.name} is ${item.health==="treatment"?"under treatment":"under watch"}.`});
  pushAction({id:`livestock-action-${item.id}`,priority:item.health==="treatment"?84:55,level:item.health==="treatment"?"danger":"warn",page:"livestock",ar:`راقب ${item.name} وسجّل تغير السلوك أو الاستجابة قبل تعديل أكثر من عامل بالحوض.`,en:`Monitor ${item.nameEn||item.name} and log behavior or response before changing multiple tank variables.`,whyAr:"حالة الكائن لازم تُقرأ مع الكيمياء والأحداث، مو بمعزل عنها.",whyEn:"Livestock condition should be interpreted with chemistry and recent events, not in isolation.",recheckAr:"حدّث حالته بعد المراقبة أو العلاج.",recheckEn:"Update its status after observation or treatment."});
 }

 const activeAcclimation=(tank.acclimationSessions??[]).filter(x=>x.status!=="completed");
 if(activeAcclimation.length){
  pushSignal({id:"active-acclimation",level:"info",confidence:"high",source:"acclimation",score:35,ar:"هناك جلسة أقلمة نشطة حالياً.",en:"An acclimation session is active."});
  pushAction({id:"acclimation-stability",priority:50,level:"info",page:"acclimation",ar:"تجنب تغييرات كبيرة بالحوض أثناء الأقلمة إلا إذا في طارئ.",en:"Avoid major tank changes during active acclimation unless there is an emergency.",whyAr:"لأن تغيير البيئة أثناء إدخال كائنات جديدة يصعب فصل سبب أي استجابة أو إجهاد.",whyEn:"Changing the environment during livestock introduction makes stress and root-cause interpretation harder.",recheckAr:"أعد تقييم الحوض بعد انتهاء الأقلمة واستقرار الكائنات.",recheckEn:"Reassess after acclimation is complete and livestock settles."});
 }

 if(activeAcclimation.length&&guide.problems.some(x=>x.level==="warn"||x.level==="danger")){
  pushAction({id:"acclimation-change-gate",priority:78,level:"warn",page:"acclimation",ar:"أثناء الأقلمة لا تعمل عدة تصحيحات كبيرة مع بعض؛ نفذ فقط الإجراء الضروري الأعلى أولوية ثم راقب.",en:"During acclimation, avoid several major corrections at once; perform only the highest-priority necessary action, then observe.",whyAr:"الكائنات الجديدة تحت إجهاد انتقال وأي تغييرات متعددة بتصعّب معرفة سبب الاستجابة.",whyEn:"New livestock is already under transition stress, and multiple changes make the response harder to interpret.",recheckAr:"أعد تقييم الكيمياء وسلوك الكائنات بعد انتهاء الأقلمة.",recheckEn:"Reassess chemistry and livestock behavior after acclimation."});
 }
 for(const p of proactivePredictions(tank)){
  if(!chemistryRelevant)continue;
  if(!(intent.mode==="forecast"||intent.mode==="trend"||relevantParam(intent,p.parameter)))continue;
  pushSignal({id:p.id,level:p.level==="danger"?"danger":p.level==="warn"?"warn":"info",confidence:p.confidence,source:"trend",score:p.level==="danger"?82:p.level==="warn"?60:35,ar:p.ar,en:p.en});
 }

 for(const baseline of tankBaselines(tank)){
  if(!chemistryRelevant)continue;
  if(baseline.status==="within"&&baseline.consumptionState!=="faster")continue;
  if(!relevantParam(intent,baseline.parameter))continue;
  const ar=baseline.consumptionState==="faster"
    ?`${baseline.parameter} عم ينخفض أسرع من نمط الحوض المعتاد.`
    :`${baseline.parameter} حالياً ${baseline.status==="above-usual"?"أعلى":"أخفض"} من المجال المعتاد لهذا الحوض نفسه.`;
  const en=baseline.consumptionState==="faster"
    ?`${baseline.parameter} is declining faster than this tank usually does.`
    :`${baseline.parameter} is currently ${baseline.status==="above-usual"?"above":"below"} this tank usual range.`;
  pushSignal({id:`baseline-${baseline.parameter}`,level:baseline.consumptionState==="faster"?"warn":"info",confidence:baseline.samples>=5?"high":"medium",source:"learning",score:50,ar,en});
 }

 const links=eventChemistryLinks(tank);
 for(const link of links){
  if(!chemistryRelevant)continue;
  if(intent.params.length&&!link.chemistryChanges.some(c=>intent.params.includes(c.parameter as any)))continue;
  if(intent.mode!=="why"&&intent.mode!=="compare"&&intent.mode!=="trend")continue;
  pushSignal({id:link.id,level:link.level==="danger"?"danger":link.level==="warn"?"warn":"info",confidence:"medium",source:"history",score:48,ar:`ارتباط زمني محتمل: ${link.ar}`,en:`Possible temporal association: ${link.en}`});
 }

 for(const p of repeatedResponsePatterns(tank)){
  if(!chemistryRelevant)continue;
  if(intent.params.length&&!intent.params.includes(p.parameter as any))continue;
  if(intent.mode!=="why"&&intent.mode!=="trend"&&intent.mode!=="forecast")continue;
  pushSignal({id:p.id,level:"info",confidence:p.confidence,source:"learning",score:p.confidence==="high"?52:40,ar:p.ar,en:p.en});
 }

 for(const s of learnedTankSignals(tank)){
  if(!chemistryRelevant)continue;
  if(intent.mode!=="why"&&intent.mode!=="trend"&&intent.mode!=="status")continue;
  pushSignal({id:s.id,level:s.level==="warn"?"warn":s.level==="good"?"good":"info",confidence:"medium",source:"learning",score:s.level==="warn"?48:28,ar:s.ar,en:s.en});
 }

 const nutrientSignals=nutrients.signals.filter(x=>x.level!=="good");
 for(let i=0;i<nutrientSignals.length;i++){
  const s=nutrientSignals[i];
  if(!chemistryRelevant)continue;
  pushSignal({id:`nutrient-${i}`,level:s.level==="danger"?"danger":s.level==="warn"?"warn":"info",confidence:"high",source:"nutrients",score:55,ar:s.ar,en:s.en});
 }

 if(chemistryRelevant&&intent.mode==="compare"&&tank.chemistry.length>=2){
  const a=tank.chemistry[0],b=tank.chemistry[1];
  const keys=[...new Set([...Object.keys(a.values),...Object.keys(b.values)])];
  for(const key of keys){
   const now=a.values[key],before=b.values[key];
   if(typeof now!=="number"||typeof before!=="number")continue;
   if(intent.params.length&&!intent.params.includes(key as any))continue;
   const delta=now-before;
   if(Math.abs(delta)<1e-9)continue;
   pushSignal({id:`compare-${key}`,level:"info",confidence:"high",source:"trend",score:42,ar:`${key} تغيّر من ${before} إلى ${now} (${delta>0?"+":""}${Number(delta.toFixed(3))}).`,en:`${key} changed from ${before} to ${now} (${delta>0?"+":""}${Number(delta.toFixed(3))}).`});
  }
 }

 if(!signals.length){
  pushSignal({id:"state",level:state.band==="critical"?"danger":state.band==="stressed"||state.band==="watch"?"warn":"good",confidence:"medium",source:"data",score:30,ar:`حالة النظام ${state.score}% — ${state.ar}.`,en:`System state is ${state.score}% — ${state.en}.`});
 }
 if(!actions.length){
  pushAction({id:"monitor",priority:10,level:"good",page:"dashboard",ar:"استمر بالمراقبة وسجّل أي تغير مهم بدل إجراء تعديل غير ضروري.",en:"Keep monitoring and log meaningful changes rather than making an unnecessary adjustment.",whyAr:"ما في إشارة قوية حالياً تبرر تغييراً كبيراً.",whyEn:"There is no strong current signal justifying a major change.",recheckAr:"راجع الحالة مع القراءة أو الحدث القادم.",recheckEn:"Review again after the next reading or event."});
 }

 signals.sort((a,b)=>b.score-a.score);
 actions.sort((a,b)=>b.priority-a.priority);
 const top=signals[0];
 const summaryAr=top.level==="danger"?`في أولوية واضحة لازم تنحل أولاً: ${top.ar}`:top.level==="warn"?`الحوض بحاجة متابعة موجهة: ${top.ar}`:`أهم ما يظهر حالياً: ${top.ar}`;
 const summaryEn=top.level==="danger"?`There is a clear first priority: ${top.en}`:top.level==="warn"?`The tank needs targeted attention: ${top.en}`:`Main current signal: ${top.en}`;
 const confidence=confidenceFromEvidence(tank,signals.length);
 const patternCount=repeatedResponsePatterns(tank).length;
 const evidenceAr=[`${tank.chemistry.length} قراءات كيميائية`,`${tank.timeline.length} أحداث`,`${tank.livestock.length} سجلات كائنات`,`${tank.equipment.length} أجهزة`,`${patternCount} أنماط متكررة متعلمة`];
 const evidenceEn=[`${tank.chemistry.length} chemistry readings`,`${tank.timeline.length} events`,`${tank.livestock.length} livestock records`,`${tank.equipment.length} equipment records`,`${patternCount} learned repeated patterns`];
 return {summaryAr,summaryEn,signals:signals.slice(0,8),actions:actions.slice(0,6),evidenceAr,evidenceEn,confidence,mentionedLivestock,mentionedEquipment};
}
