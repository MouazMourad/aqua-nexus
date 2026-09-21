import type { Tank } from "./types";
import { bioload,chemistryHealthAssessment } from "./health";
import { compatibilityCheck,type CompatibilityResult } from "./compatibility";
import { equipmentAdequacy } from "./equipmentAdequacy";
import { latestParameterSample,parameterFreshnessDays,requiredWeeklyChemistryKeys } from "./chemistryDataQuality";
import { biologicalCycleStatus } from "./biologicalCycle";
import { interventionGate } from "./interventionSafety";

export type StockingReadinessState="ready"|"not_now"|"insufficient_evidence";

export interface StockingReadinessResult{
 state:StockingReadinessState;
 canProceed:boolean;
 requiresConfirmation:boolean;
 chemistryScore:number|null;
 chemistryConfidence:number;
 compatibility?:CompatibilityResult;
 missingEvidenceAr:string[];
 missingEvidenceEn:string[];
 blockersAr:string[];
 blockersEn:string[];
 cautionsAr:string[];
 cautionsEn:string[];
 factsAr:string[];
 factsEn:string[];
}

export interface StockingCandidateOptions{
 candidate?:any;
 quantity?:number;
 /** false means the user supplied a species that Aqua Nexus cannot verify in its library. */
 candidateKnown?:boolean;
 candidateLabelAr?:string;
 candidateLabelEn?:string;
}

export function stockingReadiness(tank:Tank,options:StockingCandidateOptions={}):StockingReadinessResult{
 const quantity=Math.max(1,options.quantity??1);
 const assessment=chemistryHealthAssessment(tank);
 const bio=bioload(tank);
 const equipment=equipmentAdequacy(tank);
 const compatibility=options.candidate?compatibilityCheck(tank,options.candidate,quantity):undefined;
 const measuredTank:Tank={...tank,chemistry:tank.chemistry.filter(x=>!x.usingDefaults)};
 const required=requiredWeeklyChemistryKeys(tank);
 const missing:string[]=[],stale:string[]=[],lowConfidence:string[]=[];

 for(const key of required){
  const sample=latestParameterSample(measuredTank,key);
  if(!sample){missing.push(key);continue;}
  if(sample.ageDays>parameterFreshnessDays(tank,key))stale.push(key);
  if(sample.confidence==="low")lowConfidence.push(key);
 }

 const missingEvidenceAr:string[]=[],missingEvidenceEn:string[]=[];
 if(assessment.score===null||missing.length){
  const keys=missing.length?missing.join("، "):required.join("، ");
  missingEvidenceAr.push(`قراءات كيمياء مقاسة وحديثة: ${keys}`);
  missingEvidenceEn.push(`Measured current chemistry: ${missing.length?missing.join(", "):required.join(", ")}`);
 }
 if(stale.length){
  missingEvidenceAr.push(`إعادة فحص القراءات القديمة: ${stale.join("، ")}`);
  missingEvidenceEn.push(`Refresh stale readings: ${stale.join(", ")}`);
 }
 if(lowConfidence.length){
  missingEvidenceAr.push(`إعادة قياس القراءات منخفضة الثقة: ${lowConfidence.join("، ")}`);
  missingEvidenceEn.push(`Retest low-confidence readings: ${lowConfidence.join(", ")}`);
 }
 if(options.candidateKnown===false){
  missingEvidenceAr.push(`بيانات توافق موثقة للنوع ${options.candidateLabelAr||"المدخل يدوياً"}`);
  missingEvidenceEn.push(`Verified compatibility data for ${options.candidateLabelEn||"the manually entered species"}`);
 }

 const blockersAr:string[]=[],blockersEn:string[]=[];
 const intervention=interventionGate(tank,"livestockAddition");
 const cycle=biologicalCycleStatus(tank);
 if(cycle.active){
  blockersAr.push(`الحوض ضمن الدورة البيولوجية (اليوم ${cycle.day})؛ إضافة الكائنات مقفلة حتى اكتمال شروط الدورة.`);
  blockersEn.push(`The tank is in biological cycling mode (day ${cycle.day}); livestock addition is locked until cycle criteria are complete.`);
 }
 if(assessment.critical){
  blockersAr.push(`الكيمياء فيها عامل حرج خارج المجال الآمن: ${assessment.criticalKeys.join("، ")}.`);
  blockersEn.push(`Chemistry has a critical parameter outside its safe range: ${assessment.criticalKeys.join(", ")}.`);
 }
 if(bio.status==="danger"){
  blockersAr.push("الحمل الحيوي الحالي بمستوى خطر؛ لا تضف حملاً جديداً الآن.");
  blockersEn.push("Current bioload is at a dangerous level; do not add more load now.");
 }
 if(equipment.level==="danger"){
  blockersAr.push("كفاية تجهيزات دعم الحياة فيها مانع خطر قبل زيادة الحمل.");
  blockersEn.push("Life-support equipment adequacy has a dangerous blocker before increasing load.");
 }
 if(compatibility?.blocked){
  blockersAr.push(...compatibility.issues.filter(x=>x.level==="danger").map(x=>x.ar));
  blockersEn.push(...compatibility.issues.filter(x=>x.level==="danger").map(x=>x.en));
 }
 if((tank.emergencySessions??[]).some(x=>x.status==="active")){
  blockersAr.push("هناك بروتوكول طوارئ نشط؛ ثبّت الحوض قبل إضافة كائنات.");
  blockersEn.push("An emergency protocol is active; stabilize the tank before adding livestock.");
 }
 if((tank.acclimationSessions??[]).some(x=>x.status!=="completed")){
  blockersAr.push("هناك جلسة أقلمة نشطة؛ أكملها وراقب الاستقرار قبل إضافة دفعة جديدة.");
  blockersEn.push("An acclimation session is active; complete it and observe stability before another addition.");
 }
 if(intervention.level==="danger"){
  blockersAr.push(intervention.ar);
  blockersEn.push(intervention.en);
 }

 const cautionsAr:string[]=[],cautionsEn:string[]=[];
 if(intervention.level==="warn"){
  cautionsAr.push(intervention.ar);
  cautionsEn.push(intervention.en);
 }
 if(compatibility?.requiresConfirmation){
  cautionsAr.push(...compatibility.issues.filter(x=>x.level==="warn").map(x=>x.ar));
  cautionsEn.push(...compatibility.issues.filter(x=>x.level==="warn").map(x=>x.en));
 }
 if(equipment.level==="warn"){
  cautionsAr.push("التجهيزات تحتاج مراجعة أو استكمال بيانات القدرة قبل زيادة الحمل.");
  cautionsEn.push("Equipment needs review or better capacity data before increasing load.");
 }
 if(bio.status==="high"){
  cautionsAr.push("الحمل الحيوي مرتفع؛ أي إضافة لازم تكون محافظة ومراقبة.");
  cautionsEn.push("Bioload is high; any addition should be conservative and monitored.");
 }

 const hasMissing=missingEvidenceAr.length>0;
 const state:StockingReadinessState=blockersAr.length?"not_now":hasMissing?"insufficient_evidence":"ready";
 const factsAr=[
  `Chemistry Health: ${assessment.score===null?"غير معروف":assessment.score+"%"} — ثقة البيانات ${assessment.dataConfidence}%.`,
  `الحمل الحيوي الحالي: ${Math.round(bio.ratio*100)}%.`,
  `كفاية التجهيزات: ${equipment.score}%.`
 ];
 const factsEn=[
  `Chemistry Health: ${assessment.score===null?"unknown":assessment.score+"%"} — data confidence ${assessment.dataConfidence}%.`,
  `Current bioload: ${Math.round(bio.ratio*100)}%.`,
  `Equipment adequacy: ${equipment.score}%.`
 ];

 return{
  state,
  canProceed:state==="ready",
  requiresConfirmation:state==="ready"&&cautionsAr.length>0,
  chemistryScore:assessment.score,
  chemistryConfidence:assessment.dataConfidence,
  compatibility,
  missingEvidenceAr,missingEvidenceEn,blockersAr,blockersEn,cautionsAr,cautionsEn,factsAr,factsEn
 };
}
