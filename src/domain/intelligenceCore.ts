import type { GuidanceAction,Tank } from "./types";
import { deriveGuidanceActions } from "./impactEngine";
import { chemistryHealthAssessment,maintenanceHealth,bioload } from "./health";
import { systemHealth } from "./systemHealth";
import { systemAlerts } from "./alertEngine";
import { smartInsights } from "./smartInsights";
import { healthTimeline,tankForecast,tankStateView } from "./tankIntelligence";
import { proactivePredictions,biologicalMemory } from "./tankLearning";

export type IntelligenceDomain =
 "chemistry"|"dosing"|"maintenance"|"equipment"|"livestock"|"inventory"|"feeding"|
 "waterChange"|"rodi"|"quarantine"|"emergency"|"acclimation"|"sump"|"journal"|"expense"|"system";

export interface IntelligenceAction{
 id:string;
 domain:IntelligenceDomain;
 level:"info"|"warn"|"danger";
 page:string;
 ar:string;
 en:string;
 priority:number;
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
 guidanceActions:GuidanceAction[];
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
 const guidanceActions:GuidanceAction[]=deriveGuidanceActions(tank);
 const rank={danger:0,warn:1,info:2};
 const openGuidance=guidanceActions.filter(g=>!["resolved","verified"].includes(g.status));
 const actionMap=new Map<string,IntelligenceAction>();
 for(const g of openGuidance){
  const domain=g.domain as IntelligenceDomain;
  actionMap.set(g.dedupeKey||g.id,{id:g.id,domain,level:g.level,page:g.page||pageByDomain[domain],ar:g.titleAr,en:g.titleEn,priority:rank[g.level]});
 }
 for(const a of alerts){
  const key=a.id.startsWith("core-")?a.id.slice(5):a.id;
  if(!actionMap.has(key))actionMap.set(key,{id:a.id,domain:a.domain,level:a.level,page:a.actionPage??pageByDomain[a.domain],ar:a.ar,en:a.en,priority:rank[a.level]});
 }
 const actions:IntelligenceAction[]=[...actionMap.values()].sort((a,b)=>a.priority-b.priority);

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
  alerts,insights,forecast,history,predictions,memory,actions,guidanceActions,dataConfidence,
  critical:alerts.some(x=>x.level==="danger")||health.chemistryCritical
 };
}
