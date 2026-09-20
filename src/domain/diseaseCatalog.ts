import { DISEASE_LIBRARY } from "@/data/legacyCatalogs";
import type { TankType } from "./types";

export type DiseaseEntry=(typeof DISEASE_LIBRARY)[number];

export function diseaseEntriesFor(type:TankType,group="all",search=""){
  const q=search.trim().toLowerCase();
  return DISEASE_LIBRARY.filter(x=>{
    const typeMatch=x.type===type;
    const groupMatch=group==="all"||x.group===group;
    const searchMatch=!q||(`${x.ar} ${x.en} ${x.symAr} ${x.symEn} ${x.txAr} ${x.txEn}`).toLowerCase().includes(q);
    return typeMatch&&groupMatch&&searchMatch;
  });
}

export function diseaseGroupCounts(type:TankType){
  const entries=diseaseEntriesFor(type);
  const groups=[...new Set(entries.map(x=>x.group))];
  return Object.fromEntries(groups.map(group=>[group,entries.filter(x=>x.group===group).length])) as Record<string,number>;
}
