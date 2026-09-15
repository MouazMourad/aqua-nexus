import type { Tank } from "./types";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";

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

export function chemistryHealth(tank: Tank) {
  const latest = tank.chemistry[0]?.values ?? {};
  const ranges: any = CHEMISTRY_CATALOG[tank.type];
  let weighted = 0, totalWeight = 0;
  Object.entries(ranges).forEach(([key, meta]: [string, any]) => {
    const s = parameterScore(latest[key], meta);
    if (s !== null) {
      weighted += s * Number(meta.weight || 1);
      totalWeight += Number(meta.weight || 1);
    }
  });
  if (!totalWeight) return 50;
  let result = Math.round(weighted / totalWeight);
  if (tank.chemistry[0]?.usingDefaults) result = Math.min(75, result);

  const age = chemistryAgeDays(tank);
  // Weekly chemistry measurement is mandatory:
  // after day 7 reduce 3 points/day, capped at -30.
  if (age > 7) result -= Math.min(30, Math.round((age - 7) * 3));
  return Math.max(0, result);
}

export function maintenanceHealth(tank: Tank) {
  if (!tank.maintenance.length) return 70;
  const today = new Date().toISOString().slice(0,10);
  let points = 0;
  tank.maintenance.forEach(t => {
    if (t.done) points += 1;
    else if (t.nextDue && t.nextDue < today) points += .15;
    else points += .65;
  });
  return Math.round(points / tank.maintenance.length * 100);
}

export function tankHealth(tank: Tank) {
  return Math.round(chemistryHealth(tank) * .7 + maintenanceHealth(tank) * .3);
}

export function chemistryHistoryScore(tank: Tank, readingIndex = 0) {
  const reading = tank.chemistry[readingIndex];
  if (!reading) return null;
  const ranges:any = CHEMISTRY_CATALOG[tank.type];
  let sum=0,count=0;
  Object.entries(ranges).forEach(([k,m]:[string,any])=>{
    const s=parameterScore(reading.values[k],m);
    if(s!==null){sum+=s;count++}
  });
  return count?Math.round(sum/count):null;
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
