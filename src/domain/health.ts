import type { ChemistryReading, Tank } from "./types";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";
import { chemistryCatalogForTank } from "./chemistryProfile";
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
  if (!tank.chemistry.length) return 999;
  const latest = new Date(tank.chemistry[0].timestamp).getTime();
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

export function chemistryHealth(tank: Tank) {
  let result=chemistryReadingScore(tank,tank.chemistry[0]);
  if(result===null)return 50;

  const age = chemistryAgeDays(tank);
  // Weekly chemistry measurement is mandatory:
  // after day 7 reduce 3 points/day, capped at -30.
  if (age > 7) result -= Math.min(30, Math.round((age - 7) * 3));
  return Math.max(0, result);
}

export function maintenanceHealth(tank: Tank) {
  return recurringMaintenanceHealth(tank.maintenance);
}

export function tankHealth(tank: Tank) {
  return Math.round(chemistryHealth(tank) * .7 + maintenanceHealth(tank) * .3);
}

export function chemistryHistoryScore(tank: Tank, readingIndex = 0) {
  return chemistryReadingScore(tank,tank.chemistry[readingIndex]);
}

export function tankHealthTrend(tank: Tank): "improving"|"stable"|"declining" {
  if (tank.chemistry.length < 2) return "stable";
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
