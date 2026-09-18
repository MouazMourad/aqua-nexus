import type { Tank } from "./types";
import { bioload,chemistryHealth,maintenanceHealth,tankHealth } from "./health";
import { tankForecast,tankStateView } from "./tankIntelligence";
import { biologicalMemory,eventChemistryLinks,proactivePredictions,tankMood } from "./tankLearning";
import { learnedTankSignals,repeatedResponsePatterns,tankBaselines } from "./tankPatterns";
import { analyzeNutrients } from "./nutrientEngine";
import { mediaPredictions } from "./mediaPredictor";
import { tankEnergy } from "./equipmentIntelligence";
import { chemistryGuidance } from "./chemistryGuidance";
import { systemHealth } from "./systemHealth";

export interface TankAIContext {
  schema:"aqua-nexus-ai-context/v1";
  generatedAt:string;
  tank:{id:string;name:string;type:string;status:string;ageMonths?:number;systemVolumeLiters:number};
  state:{health:number;chemistry:number;maintenance:number;bioloadPercent:number;stateScore:number;stateBand:string;mood:string;forecast7d:number;forecastDirection:string;forecastConfidence:string};
  chemistry:{latest:Record<string,number|null>;readingCount:number;recent:Array<{timestamp:string;values:Record<string,number|null>}>;guidance:ReturnType<typeof chemistryGuidance>};
  learning:{baselines:ReturnType<typeof tankBaselines>;signals:ReturnType<typeof learnedTankSignals>;predictions:ReturnType<typeof proactivePredictions>;repeatedPatterns:ReturnType<typeof repeatedResponsePatterns>;memory:ReturnType<typeof biologicalMemory>;eventLinks:ReturnType<typeof eventChemistryLinks>};
  nutrients:ReturnType<typeof analyzeNutrients>;
  maintenance:{due:Array<{id:string;title:string;titleEn?:string;nextDue?:string}>;total:number};
  equipment:{warnings:Array<{id:string;name:string;kind:string;status:string}>;energy:{dailyKwh:number;monthlyKwh:number;monthlyCost:number;configured:number;currency:string};media:ReturnType<typeof mediaPredictions>};
  livestock:{total:number;watch:number;treatment:number};
  care:{activeQuarantine:number;activeEmergency:number;recentFeedings:number;recentWaterChanges:number;recentDoses:number};
  recentEvents:Array<{timestamp:string;type:string;textAr:string;textEn:string}>;
}

const DAY=86400000;
export function buildTankAIContext(tank:Tank):TankAIContext{
  const today=new Date().toISOString().slice(0,10),now=Date.now();
  const state=tankStateView(tank),forecast=tankForecast(tank),mood=tankMood(tank),energy=tankEnergy(tank);
  const due=tank.maintenance.filter(x=>!x.done&&(!x.nextDue||x.nextDue<=today)).slice(0,12).map(x=>({id:x.id,title:x.title,titleEn:x.titleEn,nextDue:x.nextDue}));
  const within=(timestamp:string,days:number)=>{const t=new Date(timestamp).getTime();return Number.isFinite(t)&&now-t<=days*DAY;};
  const bio=bioload(tank);
  return {
    schema:"aqua-nexus-ai-context/v1",
    generatedAt:new Date().toISOString(),
    tank:{id:tank.id,name:tank.name,type:tank.type,status:tank.status,ageMonths:tank.ageMonths,systemVolumeLiters:tank.systemVolumeLiters},
    state:{health:tankHealth(tank),chemistry:chemistryHealth(tank),maintenance:maintenanceHealth(tank),bioloadPercent:Math.round(bio.ratio*100),stateScore:state.score,stateBand:state.band,mood:mood.key,forecast7d:forecast.projected7d,forecastDirection:forecast.direction,forecastConfidence:forecast.confidence},
    chemistry:{latest:tank.chemistry[0]?.values??{},readingCount:tank.chemistry.length,recent:tank.chemistry.slice(0,12).map(x=>({timestamp:x.timestamp,values:x.values})),guidance:chemistryGuidance(tank)},
    systemHealth:systemHealth(tank),
    learning:{baselines:tankBaselines(tank),signals:learnedTankSignals(tank),predictions:proactivePredictions(tank),repeatedPatterns:repeatedResponsePatterns(tank),memory:biologicalMemory(tank),eventLinks:eventChemistryLinks(tank)},
    nutrients:analyzeNutrients(tank),
    maintenance:{due,total:tank.maintenance.length},
    equipment:{warnings:tank.equipment.filter(x=>x.status==="warning"||x.status==="service").map(x=>({id:x.id,name:x.name,kind:x.kind,status:x.status})),energy:{dailyKwh:energy.dailyKwh,monthlyKwh:energy.monthlyKwh,monthlyCost:energy.monthlyCost,configured:energy.configured,currency:tank.energySettings?.currency||""},media:mediaPredictions(tank)},
    livestock:{total:tank.livestock.reduce((s,x)=>s+x.quantity,0),watch:tank.livestock.filter(x=>x.health==="watch").length,treatment:tank.livestock.filter(x=>x.health==="treatment").length},
    care:{activeQuarantine:tank.quarantine.filter(x=>x.status==="active").length,activeEmergency:(tank.emergencySessions??[]).filter(x=>x.status==="active").length,recentFeedings:tank.feeding.filter(x=>within(x.timestamp,7)).length,recentWaterChanges:tank.waterChanges.filter(x=>within(x.timestamp,30)).length,recentDoses:tank.dosing.filter(x=>within(x.timestamp,7)).length},
    recentEvents:tank.timeline.slice(0,20).map(x=>({timestamp:x.timestamp,type:x.type,textAr:x.textAr,textEn:x.textEn}))
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
    "When chemistry health is reduced, identify the specific parameters lowering the score and give prioritized, gradual next actions."
  ];
  if(language==="ar")shared.push("Respond in clear Modern Arabic with familiar aquarium terminology; keep technical parameter names such as KH, Ca, Mg, NO3 and PO4 as written.");
  else shared.push("Respond in clear concise English using standard aquarium terminology.");
  return shared.join("\n");
}
