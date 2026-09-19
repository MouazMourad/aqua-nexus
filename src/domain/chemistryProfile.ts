import type { Tank } from "./types";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";

export type ResolvedAquariumProfile="marine-reef"|"marine-fish"|"freshwater-planted"|"freshwater-fish";

export function resolvedAquariumProfile(tank:Tank):ResolvedAquariumProfile{
  if(tank.type==="marine"){
    if(tank.ecosystemProfile==="reef"||tank.ecosystemProfile==="mixed")return "marine-reef";
    if(tank.ecosystemProfile==="fishOnly")return "marine-fish";
    return tank.livestock.some(x=>x.category==="coral")?"marine-reef":"marine-fish";
  }
  if(tank.ecosystemProfile==="planted"||tank.ecosystemProfile==="mixed")return "freshwater-planted";
  if(tank.ecosystemProfile==="fishOnly")return "freshwater-fish";
  return tank.livestock.some(x=>x.category==="plant")?"freshwater-planted":"freshwater-fish";
}

export function chemistryCatalogForTank(tank:Tank){
  const base:any=(CHEMISTRY_CATALOG as any)[tank.type];
  const profile=resolvedAquariumProfile(tank);
  const cfg:any={};
  for(const [key,value] of Object.entries(base))cfg[key]={...(value as any),ideal:[...(value as any).ideal],safe:[...(value as any).safe]};
  if(profile==="marine-fish"){
    if(cfg.Ca)cfg.Ca.weight=.25;
    if(cfg.Mg)cfg.Mg.weight=.25;
    if(cfg.KH)cfg.KH.weight=.8;
    if(cfg.NO3){cfg.NO3.ideal=[2,25];cfg.NO3.safe=[0,50];}
    if(cfg.PO4){cfg.PO4.ideal=[.02,.20];cfg.PO4.safe=[0,.40];}
  }
  if(profile==="freshwater-planted"){
    if(cfg.NO3){cfg.NO3.ideal=[5,30];cfg.NO3.safe=[0,50];cfg.NO3.weight=1.1;}
  }
  return cfg;
}

export function profileLabel(profile:ResolvedAquariumProfile,lang:"ar"|"en"){
  const ar:any={"marine-reef":"بحري Reef","marine-fish":"بحري أسماك فقط","freshwater-planted":"عذب مزروع","freshwater-fish":"عذب أسماك"};
  const en:any={"marine-reef":"Marine Reef","marine-fish":"Marine Fish-only","freshwater-planted":"Freshwater Planted","freshwater-fish":"Freshwater Fish"};
  return (lang==="ar"?ar:en)[profile];
}
