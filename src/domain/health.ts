import type { ChemistryReading, Tank } from "./types";
import { chemistryCatalogForTank } from "./chemistryProfile";
import { chemistryDataConfidence,latestParameterSample } from "./chemistryDataQuality";
import { recurringMaintenanceHealth } from "./maintenanceSchedule";

export function parameterScore(value: number | null | undefined, meta: any) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  const [idealMin, idealMax] = meta.ideal;
  const [safeMin, safeMax] = meta.safe;
  if (value >= idealMin && value <= idealMax) return 100;
  if (value < safeMin || value > safeMax) return 25;
  if (value < idealMin) {
    const t = (value - safeMin) / Math.max(.0001, idealMin - safeMin);
    return Math.round(25 + t * 75);
  }
  const t = (safeMax - value) / Math.max(.0001, safeMax - idealMax);
  return Math.round(25 + t * 75);
}

export function chemistryAgeDays(tank: Tank) {
  const measured=tank.chemistry.filter(x=>!x.usingDefaults);
  if (!measured.length) return 999;
  const latest = new Date(measured[0].timestamp).getTime();
  return Math.max(0, (Date.now() - latest) / 86400000);
}

export function chemistryReadingScore(tank:Tank, reading?:ChemistryReading) {
  if(!reading)return null;
  const ranges:any=chemistryCatalogForTank(tank);
  let weighted=0,totalWeight=0;
  Object.entries(ranges).forEach(([key,meta]:[string,any])=>{
    const s=parameterScore(reading.values[key],meta);
    if(s!==null){
      const weight=Number(meta.weight||1);
      weighted+=s*weight;
      totalWeight+=weight;
    }
  });
  if(!totalWeight)return null;
  let result=Math.round(weighted/totalWeight);
  if(reading.usingDefaults)result=Math.min(75,result);
  return result;
}

export function chemistryHealthAssessment(tank:Tank){
  const measuredTank:Tank={...tank,chemistry:tank.chemistry.filter(x=>!x.usingDefaults)};
  const cfg:any=chemistryCatalogForTank(tank);let weighted=0,totalWeight=0;const criticalKeys:string[]=[],measuredKeys:string[]=[];
  for(const [key,meta] of Object.entries(cfg) as [string,any][]){const sample=latestParameterSample(measuredTank,key);if(!sample)continue;measuredKeys.push(key);const s=parameterScore(sample.value,meta);if(s===null)continue;const weight=Number(meta.weight||1);weighted+=s*weight;totalWeight+=weight;if(sample.value<meta.safe[0]||sample.value>meta.safe[1])criticalKeys.push(key);}
  const score=totalWeight?Math.round(weighted/totalWeight):null,data=chemistryDataConfidence(measuredTank);
  const level=score===null?"unknown":criticalKeys.length?"critical":score<60?"danger":score<80?"warn":"good";
  return {score,level,critical:criticalKeys.length>0,criticalKeys,measuredKeys,dataConfidence:data.score,coverage:data.coverage,freshness:data.freshness,staleKeys:data.staleKeys,missingKeys:data.missingKeys,lowConfidenceKeys:data.lowConfidenceKeys,reliable:score!==null&&data.score>=70&&criticalKeys.length===0} as const;
}

/** Legacy numeric accessor. Prefer chemistryHealthAssessment() for UI and safety decisions. */
export function chemistryHealth(tank: Tank) {return chemistryHealthAssessment(tank).score ?? 0;}


export function maintenanceHealth(tank: Tank) {
  return recurringMaintenanceHealth(tank.maintenance);
}

export function tankHealth(tank: Tank) {
  const chemistry=chemistryHealthAssessment(tank);
  if(chemistry.score===null)return maintenanceHealth(tank);
  return Math.round(chemistry.score*.7+maintenanceHealth(tank)*.3);
}


export function chemistryHistoryScore(tank: Tank, readingIndex = 0) {
  return chemistryReadingScore(tank,tank.chemistry[readingIndex]);
}

export function tankHealthTrend(tank: Tank): "improving"|"stable"|"declining"|"unknown" {
  if (tank.chemistry.length < 2) return "unknown";
  const now = chemistryHistoryScore(tank,0) ?? 0;
  const prev = chemistryHistoryScore(tank,1) ?? now;
  const delta = now-prev;
  return delta >= 5 ? "improving" : delta <= -5 ? "declining" : "stable";
}

export function bioload(tank: Tank) {
  const load = tank.livestock.reduce((s,x)=>s+(x.load ?? 1)*x.quantity,0);
  const capacity = Math.max(1, tank.systemVolumeLiters / 35);
  const ratio = load / capacity;
  return {
    load,
    ratio,
    status: ratio < .55 ? "low" : ratio < .85 ? "good" : ratio < 1.15 ? "high" : "danger"
  };
}
