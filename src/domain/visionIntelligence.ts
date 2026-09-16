import type { Tank } from "./types";
import { tankStateScore } from "./tankIntelligence";

export type VisionSymptom="whiteSpots"|"tissueLoss"|"paleColor"|"darkColor"|"closedPolyps"|"lesion"|"finDamage"|"rapidBreathing"|"algaeFilm"|"unknown";

export interface VisionMetrics{colorIndex:number;brightnessIndex:number;captureScore:number;}
export interface VisionTriageInput{livestockId?:string;symptoms:VisionSymptom[];notes?:string;metrics:VisionMetrics;}
export interface VisionTriageResult{
 level:"monitor"|"attention"|"urgent";
 confidence:"low"|"medium";
 summaryAr:string;summaryEn:string;
 possibilitiesAr:string[];possibilitiesEn:string[];
 nextAr:string[];nextEn:string[];
 contextAr:string[];contextEn:string[];
}

const DAY=86400000;
function ageDays(ts?:string){if(!ts)return 999;return Math.max(0,(Date.now()-new Date(ts).getTime())/DAY);}

export function buildVisionTriage(tank:Tank,input:VisionTriageInput):VisionTriageResult{
 const subject=tank.livestock.find(x=>x.id===input.livestockId);
 const latest=tank.chemistry[0];
 const old=ageDays(latest?.timestamp)>7;
 const s=new Set(input.symptoms);
 const possibilitiesAr:string[]=[];const possibilitiesEn:string[]=[];
 const nextAr:string[]=[];const nextEn:string[]=[];
 let level:VisionTriageResult["level"]="monitor";

 if(s.has("whiteSpots")){
  possibilitiesAr.push("بقع سطحية/مخاط أو طفيليات خارجية محتملة؛ الصورة وحدها لا تكفي لتأكيد السبب.");
  possibilitiesEn.push("Surface spots/mucus or an external parasite are possible; an image alone cannot confirm the cause.");
  nextAr.push("راقب التنفس والشهية وانتشار البقع، ويفضل العزل قبل أي علاج دوائي.");
  nextEn.push("Watch breathing, appetite and spread of spots; isolate before medication when possible.");
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
  nextAr.push("قارن KH والملوحة والحرارة مع القراءات السابقة، وافحص التدفق المباشر حول المرجان.");
  nextEn.push("Compare KH, salinity and temperature with prior readings and inspect direct flow around the coral.");
  level="urgent";
 }
 if(s.has("closedPolyps")||s.has("paleColor")||s.has("darkColor")){
  possibilitiesAr.push("تغير اللون أو الانغلاق قد يكون استجابة للإضاءة، المغذيات، التدفق أو الإجهاد العام.");
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
 if(!possibilitiesAr.length){
  possibilitiesAr.push("لا توجد علامة نوعية كافية من المدخلات الحالية لبناء احتمال محدد.");
  possibilitiesEn.push("The current inputs do not contain a specific enough sign to build a focused possibility list.");
  nextAr.push("التقط صورة واضحة بنفس الزاوية وسجل أي تغير في السلوك أو اللون أو النسيج.");
  nextEn.push("Capture a clear image from the same angle and log any behavior, color or tissue change.");
 }
 if(old){nextAr.push("آخر فحص كيميائي قديم؛ سجل فحصاً جديداً قبل استنتاج سبب من الصورة.");nextEn.push("The latest chemistry test is stale; log a fresh test before drawing conclusions from the image.");}
 if(input.metrics.captureScore<55){nextAr.push("جودة اللقطة محدودة؛ أعد الصورة بإضاءة ثابتة ومن دون انعكاس لتحسين المقارنة.");nextEn.push("Capture quality is limited; retake under stable lighting and minimal glare for better comparison.");}

 const contextAr=[`حالة الحوض الحالية ${tankStateScore(tank)}%.`,subject?`الكائن: ${subject.name} • حالته المسجلة ${subject.health}.`:"الصورة غير مربوطة بكائن مسجل.",latest?`آخر فحص منذ ${Math.floor(ageDays(latest.timestamp))} يوم.`:"لا توجد قراءة كيمياء مسجلة."];
 const contextEn=[`Current tank state ${tankStateScore(tank)}%.`,subject?`Organism: ${subject.nameEn||subject.name} • logged status ${subject.health}.`:"Image is not linked to a registered organism.",latest?`Latest chemistry test is ${Math.floor(ageDays(latest.timestamp))} day(s) old.`:"No chemistry reading is logged."];
 const confidence:VisionTriageResult["confidence"]=(input.symptoms.length>=2&&input.metrics.captureScore>=60&&latest&&!old)?"medium":"low";
 const summaryAr=level==="urgent"?"في إشارات تستحق متابعة سريعة، لكن ما في تشخيص مؤكد من الصورة المحلية.":level==="attention"?"في علامة تحتاج مراقبة وربطها بسياق الحوض قبل العلاج.":"ما في إشارة طارئة واضحة من المدخلات الحالية.";
 const summaryEn=level==="urgent"?"There are signs that deserve prompt follow-up, but this local image workflow does not provide a confirmed diagnosis.":level==="attention"?"A sign needs monitoring and tank-context review before treatment.":"No clear emergency signal is present in the current inputs.";
 return {level,confidence,summaryAr,summaryEn,possibilitiesAr,possibilitiesEn,nextAr:nextAr.slice(0,4),nextEn:nextEn.slice(0,4),contextAr,contextEn};
}

export function captureConsistency(current:VisionMetrics,previous?:VisionMetrics){
 if(!previous)return {score:current.captureScore,noteAr:"هاي أول لقطة معيارية؛ اللقطة التالية رح تسمح بمقارنة أفضل.",noteEn:"This is the first standardized capture; the next one will allow a stronger comparison."};
 const brightnessPenalty=Math.min(40,Math.abs(current.brightnessIndex-previous.brightnessIndex)*2);
 const score=Math.max(0,Math.round((current.captureScore+previous.captureScore)/2-brightnessPenalty));
 return {score,noteAr:score>=70?"ظروف التصوير متقاربة ومناسبة للمقارنة الزمنية.":"ظروف التصوير مختلفة نسبياً؛ اعتبر تغير اللون مؤشر تقريبي فقط.",noteEn:score>=70?"Capture conditions are similar enough for time-series comparison.":"Capture conditions differ; treat color change as an approximate signal only."};
}
