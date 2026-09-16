import type { Tank } from "./types";
import { tankStateScore } from "./tankIntelligence";

export type VisionSymptom="whiteSpots"|"tissueLoss"|"paleColor"|"darkColor"|"closedPolyps"|"lesion"|"finDamage"|"rapidBreathing"|"algaeFilm"|"unknown";

export interface VisionMetrics{
 colorIndex:number;
 brightnessIndex:number;
 captureScore:number;
 contrastIndex?:number;
 sharpnessIndex?:number;
 clarityIndex?:number;
 glarePercent?:number;
 shadowPercent?:number;
 palePixelPercent?:number;
 greenDominancePercent?:number;
 brightSpotPercent?:number;
 redDominancePercent?:number;
 blueDominancePercent?:number;
 edgeDensity?:number;
}

export interface VisionTriageInput{
 livestockId?:string;
 symptoms:VisionSymptom[];
 notes?:string;
 metrics:VisionMetrics;
 previousMetrics?:VisionMetrics;
 previousTimestamp?:string;
}

export interface VisionTriageResult{
 level:"monitor"|"attention"|"urgent";
 confidence:"low"|"medium";
 confidenceScore:number;
 summaryAr:string;summaryEn:string;
 observationsAr:string[];observationsEn:string[];
 possibilitiesAr:string[];possibilitiesEn:string[];
 nextAr:string[];nextEn:string[];
 contextAr:string[];contextEn:string[];
 comparisonAr?:string;comparisonEn?:string;
 engine:"aqua-local-best-vision/v1";
}

const DAY=86400000;
function ageDays(ts?:string){if(!ts)return 999;return Math.max(0,(Date.now()-new Date(ts).getTime())/DAY);}
function clamp(n:number,min=0,max=100){return Math.max(min,Math.min(max,n));}
function n(v:number|undefined,fallback=0){return Number.isFinite(v)?Number(v):fallback;}
function latestChemistry(tank:Tank){return tank.chemistry.slice().sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())[0];}

export function captureConsistency(current:VisionMetrics,previous?:VisionMetrics){
 if(!previous)return {score:current.captureScore,noteAr:"هاي أول لقطة معيارية؛ اللقطة التالية رح تسمح بمقارنة أقوى.",noteEn:"This is the first standardized capture; the next one will allow a stronger comparison."};
 const brightnessPenalty=Math.min(35,Math.abs(current.brightnessIndex-previous.brightnessIndex)*1.7);
 const bluePenalty=Math.min(20,Math.abs(n(current.blueDominancePercent)-n(previous.blueDominancePercent))*.7);
 const clarityPenalty=Math.min(20,Math.abs(n(current.clarityIndex,current.captureScore)-n(previous.clarityIndex,previous.captureScore))*.35);
 const score=clamp(Math.round((current.captureScore+previous.captureScore)/2-brightnessPenalty-bluePenalty-clarityPenalty));
 return {score,noteAr:score>=72?"ظروف التصوير متقاربة ومناسبة للمقارنة الزمنية.":"ظروف التصوير مختلفة نسبياً؛ اعتبر تغيّر اللون/الوضوح مؤشراً تقريبياً فقط.",noteEn:score>=72?"Capture conditions are similar enough for time-series comparison.":"Capture conditions differ; treat color/clarity changes as approximate signals only."};
}

export function buildVisionTriage(tank:Tank,input:VisionTriageInput):VisionTriageResult{
 const subject=tank.livestock.find(x=>x.id===input.livestockId);
 const latest=latestChemistry(tank);
 const old=ageDays(latest?.timestamp)>7;
 const s=new Set(input.symptoms);
 const m=input.metrics;
 const observationsAr:string[]=[];const observationsEn:string[]=[];
 const possibilitiesAr:string[]=[];const possibilitiesEn:string[]=[];
 const nextAr:string[]=[];const nextEn:string[]=[];
 let level:VisionTriageResult["level"]="monitor";

 const clarity=n(m.clarityIndex,m.captureScore),sharp=n(m.sharpnessIndex),glare=n(m.glarePercent),pale=n(m.palePixelPercent),green=n(m.greenDominancePercent),bright=n(m.brightSpotPercent),red=n(m.redDominancePercent),blue=n(m.blueDominancePercent),contrast=n(m.contrastIndex);

 if(m.captureScore>=72&&clarity>=58){observationsAr.push("اللقطة جيدة بما يكفي لبناء مؤشرات بصرية محلية معقولة.");observationsEn.push("The capture is good enough for useful local visual signals.");}
 else if(m.captureScore<55||clarity<42){observationsAr.push("جودة/وضوح اللقطة محدود، لذلك ثقة التحليل البصري أقل.");observationsEn.push("Capture quality/clarity is limited, so visual confidence is lower.");}

 if(glare>=7){observationsAr.push(`انعكاس/وهج مرتفع تقريباً (${glare.toFixed(1)}%) وقد يخفي تفاصيل صغيرة.`);observationsEn.push(`Glare/specular highlights are elevated (~${glare.toFixed(1)}%) and may hide small details.`);}
 if(blue>=45){observationsAr.push("الصورة تحت تأثير أزرق قوي؛ مقارنة اللون الحقيقي لازم تُفسر بحذر.");observationsEn.push("The image has a strong blue cast; true-color interpretation should be cautious.");}
 if(green>=14){observationsAr.push("في نسبة ملحوظة من مناطق خضراء مهيمنة بصرياً؛ قد تكون طحالب/نباتات/إضاءة حسب نطاق الصورة.");observationsEn.push("A noticeable share of green-dominant regions is present; this may be algae, plants or lighting depending on scope.");}
 if(subject?.category==="coral"&&pale>=20){observationsAr.push("في نسبة مرتفعة نسبياً من مناطق فاتحة قليلة التشبع حول اللقطة؛ ممكن تعكس شحوباً أو تأثير الإضاءة.");observationsEn.push("There is a relatively high share of pale low-saturation regions; this may reflect pallor or lighting effects.");}
 if(subject?.category==="fish"&&s.has("whiteSpots")&&bright>=2.5){observationsAr.push("اللقطة تحتوي نقاطاً شديدة السطوع متفرقة؛ مع بلاغ البقع البيضاء تستحق مقارنة زمنية، لكنها ليست تشخيصاً.");observationsEn.push("The capture contains scattered very-bright points; with reported white spots they merit time-series comparison, but are not diagnostic.");}
 if((s.has("lesion")||s.has("finDamage"))&&red>=4){observationsAr.push("في مناطق حمراء مهيمنة بصرياً متوافقة مع البلاغ عن أذية/آفة، بدون إثبات السبب.");observationsEn.push("Red-dominant regions are present and align with the reported damage/lesion, without proving the cause.");}
 if(contrast<22&&sharp<28&&m.captureScore>=50){observationsAr.push("التباين والتفاصيل الدقيقة منخفضة؛ العكورة ممكنة لكن ضبابية التصوير تعطي نفس النتيجة، لذلك لا نعتبرها قياس عكورة.");observationsEn.push("Contrast and fine detail are low; haze is possible, but camera blur can look the same, so this is not a turbidity measurement.");}
 if(!observationsAr.length){observationsAr.push("ما في نمط بصري قوي وواضح من المؤشرات المحلية الحالية.");observationsEn.push("No strong, clear visual pattern is present in the current local signals.");}

 if(s.has("whiteSpots")){
  possibilitiesAr.push("بقع سطحية/مخاط/انعكاس أو طفيليات خارجية محتملة؛ الصورة وحدها لا تكفي لتحديد السبب.");
  possibilitiesEn.push("Surface spots, mucus, reflections or an external parasite are possible; the image alone cannot identify the cause.");
  nextAr.push("راقب التنفس والشهية وانتشار البقع، وخذ صورة ثانية بنفس الإضاءة خلال 12–24 ساعة.");
  nextEn.push("Watch breathing, appetite and spot spread, and take a second image under the same lighting in 12–24 hours.");
  level="attention";
 }
 if(s.has("rapidBreathing")){
  possibilitiesAr.push("التنفس السريع قد يرتبط بالأكسجة، الإجهاد، جودة الماء أو مشكلة خيشومية.");
  possibilitiesEn.push("Rapid breathing can relate to oxygenation, stress, water quality or a gill problem.");
  nextAr.push("افحص الحرارة والأمونيا/النتريت وحركة سطح الماء فوراً.");
  nextEn.push("Check temperature, ammonia/nitrite and surface agitation promptly.");
  level="urgent";
 }
 if(s.has("tissueLoss")){
  possibilitiesAr.push("تراجع النسيج قد يترافق مع عدم استقرار الكيمياء، تدفق/إضاءة غير مناسبين أو عدوى ثانوية.");
  possibilitiesEn.push("Tissue loss can accompany chemistry instability, unsuitable flow/light or secondary infection.");
  nextAr.push("قارن KH والملوحة والحرارة مع القراءات السابقة وافحص التدفق المباشر حول المرجان.");
  nextEn.push("Compare KH, salinity and temperature with prior readings and inspect direct flow around the coral.");
  level="urgent";
 }
 if(s.has("closedPolyps")||s.has("paleColor")||s.has("darkColor")){
  possibilitiesAr.push("تغير اللون أو انغلاق البوليب قد يكون استجابة للإضاءة، المغذيات، التدفق أو الإجهاد العام.");
  possibilitiesEn.push("Color change or polyp closure may reflect lighting, nutrients, flow or general stress.");
  nextAr.push("قارن آخر NO3/PO4 والإضاءة والتدفق ولا تغيّر أكثر من عامل بنفس الوقت.");
  nextEn.push("Compare recent NO3/PO4, lighting and flow; avoid changing multiple variables at once.");
  if(level==="monitor")level="attention";
 }
 if(s.has("lesion")||s.has("finDamage")){
  possibilitiesAr.push("الإصابة الظاهرة قد تكون رضّاً أو عدوانية أو عدوى ثانوية؛ يلزم تتبع تطورها زمنياً.");
  possibilitiesEn.push("Visible damage may be trauma, aggression or secondary infection; time-series follow-up is important.");
  nextAr.push("التقط صورة معيارية جديدة خلال 24–48 ساعة وقارن اتساع الإصابة والسلوك.");
  nextEn.push("Take another standardized photo in 24–48 hours and compare lesion extent and behavior.");
  if(level==="monitor")level="attention";
 }
 if(s.has("algaeFilm")||(!subject&&green>=14)){
  possibilitiesAr.push("النمو الأخضر/الغشاء قد يرتبط بالإضاءة والمغذيات وتوازن التصدير، لكن اللون وحده لا يثبت نوع الطحالب.");
  possibilitiesEn.push("Green growth/film may relate to light, nutrients and export balance, but color alone cannot identify algae type.");
  nextAr.push("قارن NO3/PO4 ومدة الإضاءة وسجل تنظيف الزجاج/الصخور لتعرف إذا النمو يتسارع فعلاً.");
  nextEn.push("Compare NO3/PO4, photoperiod and glass/rock cleaning history to confirm whether growth is accelerating.");
  if(level==="monitor")level="attention";
 }
 if(!possibilitiesAr.length){
  possibilitiesAr.push(subject?"المؤشرات الحالية أقرب للمراقبة والمقارنة الزمنية من كونها علامة نوعية لمشكلة محددة.":"الصورة الكاملة تعطي مؤشرات عن اللون/الوضوح/النمو الظاهر، لكن لا توجد علامة نوعية كافية لمشكلة محددة.");
  possibilitiesEn.push(subject?"Current signals are more useful for monitoring and time-series comparison than for identifying a specific problem.":"A whole-tank image can show color/clarity/visible-growth signals, but there is no specific enough sign for a focused problem.");
 }

 let comparisonAr:string|undefined,comparisonEn:string|undefined;
 if(input.previousMetrics){
  const consistency=captureConsistency(m,input.previousMetrics);
  if(consistency.score>=72){
   const colorDelta=m.colorIndex-input.previousMetrics.colorIndex;
   const clarityDelta=clarity-n(input.previousMetrics.clarityIndex,input.previousMetrics.captureScore);
   const greenDelta=green-n(input.previousMetrics.greenDominancePercent);
   const piecesAr:string[]=[];const piecesEn:string[]=[];
   if(Math.abs(colorDelta)>=7){piecesAr.push(`مؤشر التشبع ${colorDelta>0?"أعلى":"أقل"} بنحو ${Math.abs(colorDelta)} نقطة`);piecesEn.push(`saturation index is ${colorDelta>0?"higher":"lower"} by ~${Math.abs(colorDelta)} points`);}
   if(Math.abs(clarityDelta)>=10){piecesAr.push(`الوضوح ${clarityDelta>0?"أفضل":"أضعف"} بنحو ${Math.abs(Math.round(clarityDelta))} نقطة`);piecesEn.push(`clarity is ${clarityDelta>0?"better":"weaker"} by ~${Math.abs(Math.round(clarityDelta))} points`);}
   if(Math.abs(greenDelta)>=5){piecesAr.push(`المناطق الخضراء ${greenDelta>0?"زادت":"انخفضت"} بنحو ${Math.abs(greenDelta).toFixed(1)}%`);piecesEn.push(`green-dominant area ${greenDelta>0?"increased":"decreased"} by ~${Math.abs(greenDelta).toFixed(1)}%`);}
   if(piecesAr.length){comparisonAr=`مقارنة باللقطة السابقة المتقاربة: ${piecesAr.join("، ")}.`;comparisonEn=`Compared with the similar prior capture: ${piecesEn.join(", ")}.`;observationsAr.push(comparisonAr);observationsEn.push(comparisonEn);}
   else {comparisonAr="اللقطة متقاربة مع السابقة وما في تغير بصري كبير بالمؤشرات المحلية.";comparisonEn="This capture is comparable to the previous one with no large change in local visual signals.";}
  } else {
   comparisonAr="في لقطة سابقة، لكن ظروف التصوير مختلفة كثيراً لعمل مقارنة موثوقة.";comparisonEn="A previous capture exists, but conditions differ too much for a reliable comparison.";
  }
 }

 if(old){nextAr.push("آخر فحص كيميائي قديم؛ سجل فحصاً جديداً قبل ربط الصورة بسبب كيميائي.");nextEn.push("The latest chemistry test is stale; log a fresh test before linking the image to chemistry.");}
 if(m.captureScore<55){nextAr.push("أعد الصورة بإضاءة ثابتة، نظف الزجاج، خفف الانعكاس وثبّت المسافة لتحسين الثقة.");nextEn.push("Retake under stable lighting, clean glass, reduce glare and keep distance fixed to improve confidence.");}
 if(subject?.category==="coral"&&!s.has("tissueLoss")){nextAr.push("للمرجان: راجع KH والملوحة والحرارة وأي تعديل حديث بالإضاءة أو التدفق.");nextEn.push("For coral: review KH, salinity, temperature and any recent light/flow change.");}
 if(subject?.category==="fish"&&!s.has("rapidBreathing")){nextAr.push("للسمك: راقب الشهية والتنفس والسلوك وقارن صورة معيارية ثانية قبل الاستنتاج.");nextEn.push("For fish: watch appetite, breathing and behavior and compare a second standardized image before concluding.");}
 if(!subject){nextAr.push("لصورة الحوض كاملة: قارن صفاء الماء، حركة السطح، نمو الزجاج/الصخور وآخر صيانة مع صورة سابقة.");nextEn.push("For a whole-tank image: compare water clarity, surface movement, glass/rock growth and recent maintenance with a prior image.");}

 const state=tankStateScore(tank);
 const contextAr=[`حالة الحوض الحالية ${state}%.`,subject?`الكائن: ${subject.name} • حالته المسجلة ${subject.health}.`:"نطاق الصورة: الحوض كامل.",latest?`آخر فحص كيميائي منذ ${Math.floor(ageDays(latest.timestamp))} يوم.`:"لا توجد قراءة كيمياء مسجلة."];
 const contextEn=[`Current tank state ${state}%.`,subject?`Organism: ${subject.nameEn||subject.name} • logged status ${subject.health}.`:"Image scope: whole tank.",latest?`Latest chemistry test is ${Math.floor(ageDays(latest.timestamp))} day(s) old.`:"No chemistry reading is logged."];

 let score=38;
 score+=Math.min(25,m.captureScore*.25);
 if(latest&&!old)score+=12;
 if(subject)score+=6;
 if(input.symptoms.some(x=>x!=="unknown"))score+=8;
 if(input.previousMetrics&&captureConsistency(m,input.previousMetrics).score>=72)score+=8;
 if(glare>10||m.captureScore<45)score-=12;
 score=clamp(Math.round(score),20,88);
 const confidence:VisionTriageResult["confidence"]=score>=62?"medium":"low";

 const summaryAr=level==="urgent"?"في إشارات تستحق متابعة سريعة. Local Best AI يربط الصورة بسياق الحوض لكنه لا يعتبرها تشخيصاً مؤكداً.":level==="attention"?"في ملاحظة بصرية/سلوكية تستحق المتابعة وربطها بتاريخ الحوض قبل أي تغيير كبير.":"ما في إشارة طارئة واضحة؛ القيمة الأقوى حالياً هي المتابعة والمقارنة الزمنية لنفس الحوض.";
 const summaryEn=level==="urgent"?"There are signals that deserve prompt follow-up. Local Best AI links the image to tank context but does not treat it as a confirmed diagnosis.":level==="attention"?"A visual/behavioral signal deserves follow-up and tank-history review before any major change.":"No clear emergency signal is present; the strongest value is continued time-series comparison for this tank.";

 return {level,confidence,confidenceScore:score,summaryAr,summaryEn,observationsAr:observationsAr.slice(0,6),observationsEn:observationsEn.slice(0,6),possibilitiesAr:possibilitiesAr.slice(0,5),possibilitiesEn:possibilitiesEn.slice(0,5),nextAr:nextAr.slice(0,5),nextEn:nextEn.slice(0,5),contextAr,contextEn,comparisonAr,comparisonEn,engine:"aqua-local-best-vision/v1"};
}
