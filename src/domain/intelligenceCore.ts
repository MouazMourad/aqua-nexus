import type { Tank } from "./types";
import { chemistryHealthAssessment,maintenanceHealth,bioload } from "./health";
import { systemHealth } from "./systemHealth";
import { systemAlerts } from "./alertEngine";
import { smartInsights } from "./smartInsights";
import { healthTimeline,tankForecast,tankStateView } from "./tankIntelligence";
import { proactivePredictions,biologicalMemory } from "./tankLearning";
import { chemistryGuidance } from "./chemistryGuidance";
import { unifiedInventory } from "./inventoryIntelligence";

export type IntelligenceDomain =
 "chemistry"|"maintenance"|"equipment"|"livestock"|"inventory"|
 "quarantine"|"emergency"|"acclimation"|"system";

export interface IntelligenceAction{
 id:string;
 domain:IntelligenceDomain;
 level:"info"|"warn"|"danger";
 page:string;
 ar:string;
 en:string;
 priority:number;
}

export interface CrossPageImpact{
 id:string;
 source:"chemistry"|"equipment"|"livestock"|"inventory"|"quarantine"|"emergency"|"acclimation"|"system";
 domains:IntelligenceDomain[];
 level:"info"|"warn"|"danger";
 weight:number;
 confidence:number;
 ar:string;
 en:string;
 resourcePresetId?:string;
 resourceAvailable?:boolean;
 suggestedPage:string;
}

export interface TankIntelligenceCore{
 generatedAt:string;
 health:ReturnType<typeof systemHealth>;
 state:ReturnType<typeof tankStateView>;
 chemistry:ReturnType<typeof chemistryHealthAssessment>;
 maintenance:number;
 bioload:ReturnType<typeof bioload>;
 alerts:ReturnType<typeof systemAlerts>;
 insights:ReturnType<typeof smartInsights>;
 forecast:ReturnType<typeof tankForecast>;
 history:ReturnType<typeof healthTimeline>;
 predictions:ReturnType<typeof proactivePredictions>;
 memory:ReturnType<typeof biologicalMemory>;
 actions:IntelligenceAction[];
 impacts:CrossPageImpact[];
 dataConfidence:number;
 critical:boolean;
}

/**
 * Aqua Nexus decision core.
 *
 * Pages own data entry/workflows. They do not own a separate version of tank truth.
 * Dashboard, alerts and AI should consume this shared assessment so one tank state
 * produces one set of priorities, confidence and next actions.
 */
export function tankIntelligenceCore(tank:Tank):TankIntelligenceCore{
 const health=systemHealth(tank);
 const state=tankStateView(tank);
 const chemistry=chemistryHealthAssessment(tank);
 const alerts=systemAlerts(tank);
 const insights=smartInsights(tank);
 const forecast=tankForecast(tank);
 const history=healthTimeline(tank);
 const predictions=proactivePredictions(tank);
 const memory=biologicalMemory(tank);
 const maint=maintenanceHealth(tank);
 const bio=bioload(tank);
 const stock=unifiedInventory(tank);
 const chemistryGuide=chemistryGuidance(tank);

 const pageByDomain:Record<IntelligenceDomain,string>={
  chemistry:"chemistry",maintenance:"maintenance",
  equipment:"equipment",livestock:"livestock",inventory:"inventory",
  quarantine:"quarantine",emergency:"emergency",acclimation:"acclimation",system:"dashboard"
 };
 const chemistryResource:Record<string,string|undefined>={KH:"khBuffer",Ca:"calcium",Mg:"magnesium",PO4:"phosphateMedia",salinity:"marineSalt"};
 const impacts:CrossPageImpact[]=chemistryGuide.problems.map(problem=>{
  const resourcePresetId=chemistryResource[problem.key];
  const resource=resourcePresetId?stock.general.find(x=>tank.inventory.find(i=>i.id===x.id)?.presetId===resourcePresetId):undefined;
  const resourceAvailable=resourcePresetId?Boolean(resource&&resource.quantity>0):undefined;
  const sampleConfidence=problem.confidence==="high"?100:problem.confidence==="medium"?70:problem.confidence==="low"?40:55;
  const scorePenalty=problem.score===null?20:Math.max(0,100-problem.score);
  const weight=Math.max(1,Math.min(100,Math.round(scorePenalty*(problem.level==="danger"?1.15:.85))));
  const domains:IntelligenceDomain[]=["chemistry","maintenance"];
  if(resourcePresetId)domains.push("inventory");
  return {
   id:`impact-chem-${problem.key}`,source:"chemistry" as const,domains,
   level:problem.level==="danger"?"danger" as const:"warn" as const,weight,confidence:sampleConfidence,
   ar:resourcePresetId&&!resourceAvailable?`${problem.reasonAr} المادة المطلوبة للتصحيح غير متوفرة بالمخزون؛ يلزم تأمينها قبل التنفيذ.`:problem.reasonAr,
   en:resourcePresetId&&!resourceAvailable?`${problem.reasonEn} The corrective material is not available in inventory; restock it before execution.`:problem.reasonEn,
   resourcePresetId,resourceAvailable,suggestedPage:resourcePresetId&&!resourceAvailable?"inventory":"maintenance"
  };
 });
 const rank={danger:0,warn:1,info:2};
 const actions:IntelligenceAction[]=alerts.map(a=>({
  id:a.id,domain:a.domain,level:a.level,page:a.actionPage??pageByDomain[a.domain],
  ar:a.ar,en:a.en,priority:rank[a.level]
 })).sort((a,b)=>a.priority-b.priority);

 // Confidence means confidence in the whole decision, not merely a pretty score.
 // Chemistry quality is the strongest measured-data signal; snapshots and domain
 // coverage prevent a sparse new tank from looking fully certain.
 const knownDomains=health.components.filter(x=>x.known).length;
 const coverage=Math.round((knownDomains/health.components.length)*100);
 const snapshotEvidence=Math.min(100,(tank.healthSnapshots?.length??0)*25);
 const dataConfidence=Math.max(0,Math.min(100,Math.round(
  chemistry.score===null
   ? coverage*.55+snapshotEvidence*.45
   : chemistry.dataConfidence*.65+coverage*.20+snapshotEvidence*.15
 )));

 return {
  generatedAt:new Date().toISOString(),health,state,chemistry,maintenance:maint,bioload:bio,
  alerts,insights,forecast,history,predictions,memory,actions,impacts,dataConfidence,
  critical:alerts.some(x=>x.level==="danger")||health.chemistryCritical
 };
}
