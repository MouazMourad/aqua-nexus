import type { EquipmentKind,Tank } from "./types";
import type { AquaAIAnswer } from "./aquaAIBrain";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";
import { compatibilityCheck } from "./compatibility";
import { equipmentAdequacy } from "./equipmentAdequacy";
import { waterChangeIntelligence } from "./waterChangeIntelligence";

function norm(s:string){return (s||"").toLowerCase().normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/ؤ/g,"و").replace(/ئ/g,"ي").replace(/[^a-z0-9\u0600-\u06ff.%/+-]+/g," ").replace(/\s+/g," ").trim();}
function candidate(question:string,tank:Tank){
 const q=norm(question);
 const rows=(LIVESTOCK_LIBRARY as readonly any[]).filter(x=>!x.type||x.type===tank.type);
 return rows.map(x=>({x,score:Math.max(0,...[x.ar,x.en,x.id].filter(Boolean).map((n:string)=>{const z=norm(n);return q.includes(z)?z.length:0;}))})).filter(x=>x.score>2).sort((a,b)=>b.score-a.score)[0]?.x;
}
function qty(question:string){const m=(question||"").replace(/[٠١٢٣٤٥٦٧٨٩]/g,d=>"٠١٢٣٤٥٦٧٨٩".indexOf(d).toString()).match(/(?:x|×|عدد)?\s*(\d{1,2})/i);return m?Math.max(1,Math.min(30,Number(m[1]))):1;}
function kindFrom(q:string):EquipmentKind|undefined{
 const s=norm(q);
 if(/سكيمر|skimmer/.test(s))return "skimmer";
 if(/ويف|wave maker|wavemaker|circulation/.test(s))return "waveMaker";
 if(/مضخه رجوع|مضخة رجوع|return pump/.test(s))return "returnPump";
 if(/سخان|heater/.test(s))return "heater";
 if(/اضاء|اناره|light|lighting/.test(s))return "lighting";
 if(/ato|تعويض/.test(s))return "ato";
 return undefined;
}
function numberNear(question:string,unit:RegExp){const m=question.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:${unit.source})`,"i"));return m?Number(m[1]):undefined;}

export function answerWhatIf(tank:Tank,question:string):AquaAIAnswer{
 const c=candidate(question,tank);
 if(c){
  const quantity=qty(question),check=compatibilityCheck(tank,c,quantity);
  const nameAr=c.ar||c.en,nameEn=c.en||c.ar;
  return {
   titleAr:`محاكاة إضافة ${nameAr}`,titleEn:`What-if: add ${nameEn}`,
   summaryAr:check.blocked?`لو أضفت ${nameAr} ×${quantity} حالياً، في مانع خطر واضح قبل الإضافة.`:check.requiresConfirmation?`الإضافة ممكنة نظرياً لكن فيها تحذيرات لازم تنحل/تنفهم أولاً.`:`المحاكاة الحالية ما بتبين مانع واضح لإضافة ${nameAr} ×${quantity}.`,
   summaryEn:check.blocked?`Adding ${nameEn} ×${quantity} now produces a clear blocker.`:check.requiresConfirmation?`The addition is theoretically possible but has cautions that should be resolved or understood first.`:`The current simulation shows no obvious blocker to adding ${nameEn} ×${quantity}.`,
   detailsAr:[`الحمل الحالي: ${Math.round(check.currentRatio*100)}% → المتوقع: ${Math.round(check.projectedRatio*100)}%.`,...check.issues.slice(0,6).map(x=>`${x.level==="danger"?"مانع":"تنبيه"}: ${x.ar}`)],
   detailsEn:[`Current bioload: ${Math.round(check.currentRatio*100)}% → projected: ${Math.round(check.projectedRatio*100)}%.`,...check.issues.slice(0,6).map(x=>`${x.level==="danger"?"Blocker":"Caution"}: ${x.en}`)],
   evidenceAr:[`حجم النظام ${tank.systemVolumeLiters} لتر`,`الحمل المتوقع ${Math.round(check.projectedRatio*100)}%`],evidenceEn:[`System volume ${tank.systemVolumeLiters} L`,`Projected bioload ${Math.round(check.projectedRatio*100)}%`],
   confidence:"high",action:{page:"livestock",ar:"افتح الكائنات وشوف تقرير التوافق الكامل",en:"Open livestock for the full compatibility report"}
  };
 }
 const kind=kindFrom(question);
 if(kind){
  const flow=numberNear(question,/l\/?h|lph|لتر(?:\/| بال)?ساعه|لتر(?:\/| بال)?ساعة/);
  const watts=numberNear(question,/w|watt|واط/);
  const rated=numberNear(question,/l|liter|litre|لتر/);
  const par=numberNear(question,/par/);
  const before=equipmentAdequacy(tank);
  const hypothetical={id:"what-if",name:"What-if device",kind,location:kind==="lighting"||kind==="waveMaker"?"display" as const:"external" as const,status:"on" as const,flowLph:flow,powerWatts:watts,ratedVolumeLiters:kind==="skimmer"?rated:undefined,parAtTargetDepth:kind==="lighting"?par:undefined};
  const after=equipmentAdequacy({...tank,equipment:[...tank.equipment,hypothetical]});
  return {
   titleAr:"محاكاة تجهيز جديد",titleEn:"Equipment what-if simulation",
   summaryAr:`حسب البيانات اللي قدرت أقرأها من سؤالك، تقييم التجهيزات ينتقل تقريباً من ${before.score}% إلى ${after.score}%.`,
   summaryEn:`From the specifications recognized in your question, equipment adequacy changes from about ${before.score}% to ${after.score}%.`,
   detailsAr:[`النوع: ${kind}.`,flow?`Flow: ${flow} L/h.`:"Flow غير مذكور.",watts?`Power: ${watts} W.`:"",par?`PAR: ${par}.`:"",...after.issues.slice(0,4).map(x=>x.ar),...after.headroom.slice(0,3).map(x=>x.ar)].filter(Boolean),
   detailsEn:[`Type: ${kind}.`,flow?`Flow: ${flow} L/h.`:"Flow was not specified.",watts?`Power: ${watts} W.`:"",par?`PAR: ${par}.`:"",...after.issues.slice(0,4).map(x=>x.en),...after.headroom.slice(0,3).map(x=>x.en)].filter(Boolean),
   evidenceAr:[`التجهيزات الحالية ${before.score}%`,`المحاكاة ${after.score}%`],evidenceEn:[`Current equipment ${before.score}%`,`Simulated equipment ${after.score}%`],
   confidence:(flow||watts||par||rated)?"medium":"low",action:{page:"equipment",ar:"افتح المعدات وأدخل المواصفات الفعلية قبل الشراء",en:"Open equipment and enter real specifications before buying"}
  };
 }
 if(/تغيير مي|تغيير ماء|water change/i.test(question)){
  const p=Number(question.match(/(\d{1,2}(?:\.\d+)?)\s*%/)?.[1]||15);
  const intel=waterChangeIntelligence(tank,p);
  return {
   titleAr:"محاكاة تغيير ماء",titleEn:"Water-change what-if",
   summaryAr:`تغيير ${p}% يعطي نظرياً NO3 ${intel.projectedNO3===null?"—":intel.projectedNO3.toFixed(1)} وPO4 ${intel.projectedPO4===null?"—":intel.projectedPO4.toFixed(3)} إذا ما صار إنتاج جديد أثناء الفترة.`,
   summaryEn:`A ${p}% change theoretically gives NO3 ${intel.projectedNO3===null?"—":intel.projectedNO3.toFixed(1)} and PO4 ${intel.projectedPO4===null?"—":intel.projectedPO4.toFixed(3)} if no new production occurs during the period.`,
   detailsAr:[`اقتراح النظام الأولي حالياً: ${intel.suggestedPercent}% عند الحاجة.`,...intel.warnings],detailsEn:[`Current initial system suggestion: ${intel.suggestedPercent}% when needed.`,...intel.warnings],
   evidenceAr:[`حجم النظام ${tank.systemVolumeLiters} لتر`],evidenceEn:[`System volume ${tank.systemVolumeLiters} L`],confidence:"medium",action:{page:"waterchange",ar:"افتح مخطط تغيير الماء",en:"Open water-change planner"}
  };
 }
 return {titleAr:"محاكاة What-if",titleEn:"What-if simulation",summaryAr:"فهمت إنك عم تسأل عن سيناريو افتراضي، بس ناقصني نوع التغيير أو الكائن/الجهاز حتى أعمل محاكاة رقمية مفيدة.",summaryEn:"I recognize a hypothetical scenario, but I need a livestock/device/change target to run a useful numeric simulation.",detailsAr:["مثال: لو ضفت Naso ×1؟","لو ركبت Wave Maker 8000 L/h؟","لو غيرت 20% من الماء؟"],detailsEn:["Example: What if I add 1 Naso Tang?","What if I install an 8000 L/h wave maker?","What if I change 20% of the water?"],evidenceAr:[],evidenceEn:[],confidence:"low"};
}
