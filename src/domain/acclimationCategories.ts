import type { AcclimationCategory,LivestockItem,TankType } from "./types";

const aliases:Record<string,AcclimationCategory>={
  fish:"fish",fishes:"fish",
  coral:"coral",corals:"coral",
  invert:"invert",invertebrate:"invert",invertebrates:"invert",shrimp:"invert",crustacean:"invert",crustaceans:"invert",snail:"invert",snails:"invert",echinoderm:"invert",echinoderms:"invert",urchin:"invert",urchins:"invert",starfish:"invert",worm:"invert",worms:"invert","tube worm":"invert","tube worms":"invert",
  plant:"plant",plants:"plant",
  macroalgae:"macroalgae","macro algae":"macroalgae",macro_algae:"macroalgae",algae:"macroalgae",
  other:"other"
};

export function allowedAcclimationCategories(tankType:TankType):AcclimationCategory[]{
  return tankType==="marine"?["fish","invert","coral","macroalgae"]:["fish","invert","plant"];
}

export function normalizeAcclimationCategory(tankType:TankType,raw:string,catalogCategory?:string):AcclimationCategory|null{
  const rawValue=(raw||"").trim().toLowerCase();
  const catalogValue=(catalogCategory||"").trim().toLowerCase();
  const rawCategory=aliases[rawValue];
  const catalog=aliases[catalogValue];

  if(tankType==="marine"){
    if(rawCategory==="coral"||rawCategory==="fish"||rawCategory==="invert"||rawCategory==="other")return rawCategory;
    if(rawCategory==="macroalgae")return "macroalgae";
    if(rawCategory==="plant"){
      // "plant" is accepted only when it came from a known marine library item.
      return catalog==="plant"?"macroalgae":null;
    }
    if(!rawCategory&&catalog==="plant")return "macroalgae";
    if(!rawCategory&&(catalog==="fish"||catalog==="coral"||catalog==="invert"||catalog==="other"))return catalog;
    return null;
  }

  if(rawCategory==="coral"||rawCategory==="macroalgae")return null;
  if(rawCategory==="fish"||rawCategory==="invert"||rawCategory==="plant"||rawCategory==="other")return rawCategory;
  if(!rawCategory&&(catalog==="fish"||catalog==="invert"||catalog==="plant"||catalog==="other"))return catalog;
  return null;
}

export function livestockCategoryFromAcclimation(category:AcclimationCategory,subtype?:string):Pick<LivestockItem,"category"|"subtype">{
  if(category==="macroalgae")return {category:"plant",subtype:"macroalgae"};
  return {category,subtype:subtype||undefined};
}
