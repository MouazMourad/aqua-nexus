import type { Tank } from "./types";
import { buildTankBrainSnapshot } from "./tankBrainSnapshot";
import { bioload,chemistryHealth,maintenanceHealth } from "./health";
import { tankForecast,tankStateView } from "./tankIntelligence";
import { biologicalMemory,eventChemistryLinks,proactivePredictions,tankMood } from "./tankLearning";
import { learnedTankSignals,repeatedResponsePatterns,tankBaselines,tankLearningMaturity } from "./tankPatterns";
import { analyzeNutrients } from "./nutrientEngine";
import { mediaPredictions } from "./mediaPredictor";
import { tankEnergy } from "./equipmentIntelligence";
import { chemistryGuidance } from "./chemistryGuidance";
import { systemHealth } from "./systemHealth";
import { unifiedInventory } from "./inventoryIntelligence";
import { feedingIntelligence } from "./feedingIntelligence";
import { rodiIntelligence } from "./rodiIntelligence";
import { sumpIntelligence } from "./sumpIntelligence";
import { systemAlerts } from "./alertEngine";
import { maintenanceEffectiveState } from "./maintenanceSchedule";
import { biologicalCycleStatus } from "./biologicalCycle";
import { biologicalCycleKnowledgeSnapshot } from "./biologicalCycleKnowledge";
import { equipmentImportIntelligence } from "./equipmentImport";
import { currentChemistryValues } from "./chemistryDataQuality";
import { AQUA_MODEL_VERSIONS,AQUA_NEXUS_VERSION } from "./version";

export interface TankAIContext {
  schema:"aqua-nexus-ai-context/v2";
  productVersion:string;
  modelVersions:typeof AQUA_MODEL_VERSIONS;
  generatedAt:string;
  brain:ReturnType<typeof buildTankBrainSnapshot>;
  tank:{id:string;name:string;type:string;status:string;ageMonths?:number;systemVolumeLiters:number};
  biologicalCycle:ReturnType<typeof biologicalCycleStatus>;
  biologicalCycleKnowledge:ReturnType<typeof biologicalCycleKnowledgeSnapshot>;
  state:{health:number;chemistry:number;maintenance:number;bioloadPercent:number;stateScore:number;stateBand:string;mood:string;forecast7d:number|null;forecastDirection:string;forecastConfidence:string};
  chemistry:{latest:Record<string,number|null>;readingCount:number;recent:Array<{timestamp:string;values:Record<string,number|null>}>;referenceDefaults:Array<{timestamp:string;values:Record<string,number|null>}>;guidance:ReturnType<typeof chemistryGuidance>};
  systemHealth:ReturnType<typeof systemHealth>;
  learning:{maturity:ReturnType<typeof tankLearningMaturity>;baselines:ReturnType<typeof tankBaselines>;signals:ReturnType<typeof learnedTankSignals>;predictions:ReturnType<typeof proactivePredictions>;repeatedPatterns:ReturnType<typeof repeatedResponsePatterns>;memory:ReturnType<typeof biologicalMemory>;eventLinks:ReturnType<typeof eventChemistryLinks>};
  nutrients:ReturnType<typeof analyzeNutrients>;
  maintenance:{due:Array<{id:string;title:string;titleEn?:string;nextDue?:string}>;total:number};
  equipment:{warnings:Array<{id:string;name:string;kind:string;status:string}>;energy:{dailyKwh:number;monthlyKwh:number;monthlyCost:number;configured:number;currency:string};media:ReturnType<typeof mediaPredictions>;deviceData:ReturnType<typeof equipmentImportIntelligence>};
  livestock:{total:number;watch:number;treatment:number};
  care:{activeQuarantine:number;activeEmergency:number;recentFeedings:number;recentWaterChanges:number;recentDoses:number};
  recentEvents:Array<{timestamp:string;type:string;textAr:string;textEn:string}>;
  operations:{alerts:ReturnType<typeof systemAlerts>;inventory:ReturnType<typeof unifiedInventory>;feeding:ReturnType<typeof feedingIntelligence>;rodi:ReturnType<typeof rodiIntelligence>;sump:ReturnType<typeof sumpIntelligence>;expenses:Array<{date:string;description:string;amount:number;currency:string}>};
}

const DAY=86400000;
export function buildTankAIContext(tank:Tank):TankAIContext{
  const today=new Date().toISOString().slice(0,10),now=Date.now();
  const state=tankStateView(tank),forecast=tankForecast(tank),mood=tankMood(tank),energy=tankEnergy(tank);
  const deviceData=equipmentImportIntelligence(tank);
  const system=systemHealth(tank),cycle=biologicalCycleStatus(tank),cycleKnowledge=biologicalCycleKnowledgeSnapshot(tank);
  const due=tank.maintenance.filter(x=>maintenanceEffectiveState(x,today).due).slice(0,12).map(x=>({id:x.id,title:x.title,titleEn:x.titleEn,nextDue:x.nextDue}));
  const within=(timestamp:string,days:number)=>{const t=new Date(timestamp).getTime();return Number.isFinite(t)&&now-t<=days*DAY;};
  const bio=bioload(tank);
  const measuredChemistry=tank.chemistry.filter(x=>!x.usingDefaults);
  const referenceChemistry=tank.chemistry.filter(x=>x.usingDefaults);
  return {
    schema:"aqua-nexus-ai-context/v2",
    generatedAt:new Date().toISOString(),
    productVersion:AQUA_NEXUS_VERSION,
    modelVersions:AQUA_MODEL_VERSIONS,
    brain:buildTankBrainSnapshot(tank),
    tank:{id:tank.id,name:tank.name,type:tank.type,status:tank.status,ageMonths:tank.ageMonths,systemVolumeLiters:tank.systemVolumeLiters},
    biologicalCycle:cycle,
    biologicalCycleKnowledge:cycleKnowledge,
    state:{health:system.score,chemistry:chemistryHealth(tank),maintenance:maintenanceHealth(tank),bioloadPercent:Math.round(bio.ratio*100),stateScore:state.score,stateBand:state.band,mood:mood.key,forecast7d:forecast.projected7d,forecastDirection:forecast.direction,forecastConfidence:forecast.confidence},
    chemistry:{latest:currentChemistryValues(tank),readingCount:measuredChemistry.length,recent:measuredChemistry.slice(0,12).map(x=>({timestamp:x.timestamp,values:x.values})),referenceDefaults:referenceChemistry.slice(0,3).map(x=>({timestamp:x.timestamp,values:x.values})),guidance:chemistryGuidance(tank)},
    systemHealth:system,
    learning:{maturity:tankLearningMaturity(tank),baselines:tankBaselines(tank),signals:learnedTankSignals(tank),predictions:proactivePredictions(tank),repeatedPatterns:repeatedResponsePatterns(tank),memory:biologicalMemory(tank),eventLinks:eventChemistryLinks(tank)},
    nutrients:analyzeNutrients(tank),
    maintenance:{due,total:tank.maintenance.length},
    equipment:{warnings:tank.equipment.filter(x=>x.status==="warning"||x.status==="service").map(x=>({id:x.id,name:x.name,kind:x.kind,status:x.status})),energy:{dailyKwh:energy.dailyKwh,monthlyKwh:energy.monthlyKwh,monthlyCost:energy.monthlyCost,configured:energy.configured,currency:tank.energySettings?.currency||""},media:mediaPredictions(tank),deviceData},
    livestock:{total:tank.livestock.reduce((s,x)=>s+x.quantity,0),watch:tank.livestock.filter(x=>x.health==="watch").length,treatment:tank.livestock.filter(x=>x.health==="treatment").length},
    care:{activeQuarantine:tank.quarantine.filter(x=>x.status==="active").length,activeEmergency:(tank.emergencySessions??[]).filter(x=>x.status==="active").length,recentFeedings:tank.feeding.filter(x=>within(x.timestamp,7)).length,recentWaterChanges:tank.waterChanges.filter(x=>within(x.timestamp,30)).length,recentDoses:tank.dosing.filter(x=>within(x.timestamp,7)).length},
    recentEvents:tank.timeline.slice(0,20).map(x=>({timestamp:x.timestamp,type:x.type,textAr:x.textAr,textEn:x.textEn})),
    operations:{alerts:systemAlerts(tank),inventory:unifiedInventory(tank),feeding:feedingIntelligence(tank),rodi:rodiIntelligence(tank),sump:sumpIntelligence(tank),expenses:tank.expenses.slice(0,30).map(x=>({date:x.date,description:x.description,amount:x.amount,currency:x.currency}))}
  };
}

export function aquaAISystemPrompt(language:"ar"|"en"){
  const shared=[
    "You are Aqua AI, an aquarium specialist assistant embedded inside Aqua Nexus.",
    "Use the supplied tank context as the primary source. Never invent readings, events, livestock, equipment, diagnoses, or trends.",
    "Separate observed facts, temporal associations, forecasts, and hypotheses. Never present correlation as proven causation.",
    "When data is stale or insufficient, say so and prefer a retest or observation over confident advice.",
    "Prioritize aquarium stability and gradual changes. Respect configured dosing safety limits and product-label instructions.",
    "For image-based disease analysis, present possible causes and confidence, not a definitive veterinary diagnosis.",
    "Prefer tank-specific learned baselines over generic assumptions, while still flagging when a tank-specific baseline itself appears unsafe.",
    "Explain why an action is suggested and what result should be rechecked afterward.",
    "Treat suspected data-format errors as data-quality problems first. Do not recommend physical tank corrections until the recorded value is validated.",
    "When chemistry health is reduced, identify the specific parameters lowering the score and give prioritized, gradual next actions.",
    "Treat the aquarium as one interconnected system: chemistry, maintenance, bioload, equipment adequacy, livestock compatibility and livestock condition all contribute to overall health.",
    "Always surface active livestock compatibility conflicts and equipment-sizing gaps when they materially affect the answer or overall system health.",
    "If biologicalCycle.active is true, treat Cycling Mode as a hard operational gate: do not recommend stocking, acclimation, feeding, routine dosing, treatment, travel routines, or other non-cycle workflows. Keep actions focused on cycling, measured chemistry, filtration/equipment, source water and emergencies until biologicalCycle.ready is confirmed and the cycle is completed.",
    "Use biologicalCycleKnowledge when answering cycle questions. Treat its tank-specific issues as current diagnostic clues, its principles as guardrails, and its commonProblems as a troubleshooting map. Never use elapsed days alone as proof of readiness.",
    "For cycling problems, distinguish normal stage progression from a stalled cycle. Check test quality, ammonia source, pH, temperature, oxygenation/flow, chlorine or chloramine exposure, filter-media handling and power outages before recommending more ammonia or declaring the cycle failed.",
    "A normal water change does not reset a healthy biofilter because most nitrifying bacteria live on wet surfaces and media, not in the water column. Bottled bacteria or mature media can shorten cycling but never replace measured confirmation."
  ];
  if(language==="ar")shared.push("Respond in clear Modern Arabic with familiar aquarium terminology; keep technical parameter names such as KH, Ca, Mg, NO3 and PO4 as written.");
  else shared.push("Respond in clear concise English using standard aquarium terminology.");
  return shared.join("\n");
}
