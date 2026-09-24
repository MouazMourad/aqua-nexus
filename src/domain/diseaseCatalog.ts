import { DISEASE_LIBRARY } from "@/data/legacyCatalogs";
import type { LivestockItem,TankType } from "./types";

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


function normalizedDiseaseText(value:string){
  return (value||"").toLowerCase().normalize("NFKD").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[^a-z0-9\u0600-\u06ff]+/g," ").replace(/\s+/g," ").trim();
}

export function diseaseEntryFromText(type:TankType,text:string){
  const q=normalizedDiseaseText(text);
  if(!q)return undefined;
  return DISEASE_LIBRARY.find(x=>{
    if(x.type!==type)return false;
    const names=[x.en,x.ar].map(normalizedDiseaseText).filter(Boolean);
    return names.some(name=>{
      if(q===name||q.includes(name)||name.includes(q))return true;
      const generic=new Set(["disease","syndrome","infection","condition","مرض","متلازمه"]);
      const qt=q.split(" ").filter(x=>x.length>2&&!generic.has(x));
      const nt=name.split(" ").filter(x=>x.length>2&&!generic.has(x));
      return qt.length>0&&nt.length>0&&qt.every(token=>nt.includes(token));
    });
  });
}

export function diseaseGroupForLivestockCategory(category:LivestockItem["category"]){
  if(category==="fish")return "fish";
  if(category==="coral")return "coral";
  if(category==="plant")return "plant";
  if(category==="invert")return "crustacean";
  return "other";
}

export function diseaseMatchesLivestock(entry:DiseaseEntry,category:LivestockItem["category"]){
  const group=diseaseGroupForLivestockCategory(category);
  if(entry.group==="fish"||entry.group==="coral"||entry.group==="plant")return entry.group===group;
  if(entry.group==="crustacean")return category==="invert";
  return true;
}
