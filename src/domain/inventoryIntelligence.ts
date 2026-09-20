import type { InventoryCategory,InventoryConsumer,InventoryItem,Tank } from "./types";

export interface InventoryProfile{
  category:InventoryCategory;
  subcategory:string;
  tankCompatibility:"marine"|"freshwater"|"both";
  consumedBy:InventoryConsumer[];
  stockBehavior:"consumable"|"asset";
}

const PRESET_PROFILES:Record<string,InventoryProfile>={
  fishFood:{category:"feeding",subcategory:"dry_food",tankCompatibility:"both",consumedBy:["feeding"],stockBehavior:"consumable"},
  frozenFood:{category:"feeding",subcategory:"frozen_food",tankCompatibility:"both",consumedBy:["feeding"],stockBehavior:"consumable"},
  coralFood:{category:"feeding",subcategory:"coral_food",tankCompatibility:"marine",consumedBy:["feeding"],stockBehavior:"consumable"},
  nori:{category:"feeding",subcategory:"seaweed_food",tankCompatibility:"marine",consumedBy:["feeding"],stockBehavior:"consumable"},
  marineSalt:{category:"water_prep",subcategory:"marine_salt",tankCompatibility:"marine",consumedBy:["waterChange"],stockBehavior:"consumable"},
  khBuffer:{category:"dosing",subcategory:"alkalinity",tankCompatibility:"marine",consumedBy:["dosing"],stockBehavior:"consumable"},
  calcium:{category:"dosing",subcategory:"calcium",tankCompatibility:"marine",consumedBy:["dosing"],stockBehavior:"consumable"},
  magnesium:{category:"dosing",subcategory:"magnesium",tankCompatibility:"marine",consumedBy:["dosing"],stockBehavior:"consumable"},
  allForReef:{category:"dosing",subcategory:"balanced_reef",tankCompatibility:"marine",consumedBy:["dosing"],stockBehavior:"consumable"},
  trace:{category:"supplement",subcategory:"trace_elements",tankCompatibility:"marine",consumedBy:["dosing"],stockBehavior:"consumable"},
  bacteria:{category:"supplement",subcategory:"bacteria",tankCompatibility:"both",consumedBy:["dosing"],stockBehavior:"consumable"},
  carbon:{category:"filter_media",subcategory:"activated_carbon",tankCompatibility:"both",consumedBy:["sump"],stockBehavior:"consumable"},
  phosphateMedia:{category:"filter_media",subcategory:"phosphate_media",tankCompatibility:"marine",consumedBy:["sump"],stockBehavior:"consumable"},
  filterFloss:{category:"filter_media",subcategory:"mechanical_media",tankCompatibility:"both",consumedBy:["sump","equipment"],stockBehavior:"consumable"},
  plantFertilizer:{category:"fertilizer",subcategory:"complete",tankCompatibility:"freshwater",consumedBy:["fertilizer"],stockBehavior:"consumable"},
  plantNitrogen:{category:"fertilizer",subcategory:"nitrogen",tankCompatibility:"freshwater",consumedBy:["fertilizer"],stockBehavior:"consumable"},
  plantPhosphate:{category:"fertilizer",subcategory:"phosphate",tankCompatibility:"freshwater",consumedBy:["fertilizer"],stockBehavior:"consumable"},
  plantPotassium:{category:"fertilizer",subcategory:"potassium",tankCompatibility:"freshwater",consumedBy:["fertilizer"],stockBehavior:"consumable"},
  plantMicros:{category:"fertilizer",subcategory:"micros",tankCompatibility:"freshwater",consumedBy:["fertilizer"],stockBehavior:"consumable"},
  plantIron:{category:"fertilizer",subcategory:"iron",tankCompatibility:"freshwater",consumedBy:["fertilizer"],stockBehavior:"consumable"},
  rootTabs:{category:"fertilizer",subcategory:"root_tabs",tankCompatibility:"freshwater",consumedBy:["fertilizer"],stockBehavior:"consumable"},
  co2:{category:"co2",subcategory:"gas_refill",tankCompatibility:"freshwater",consumedBy:["co2"],stockBehavior:"consumable"},
  conditioner:{category:"water_prep",subcategory:"conditioner",tankCompatibility:"freshwater",consumedBy:["waterChange"],stockBehavior:"consumable"},
  aquariumSalt:{category:"water_prep",subcategory:"freshwater_salt",tankCompatibility:"freshwater",consumedBy:["waterChange"],stockBehavior:"consumable"},
  testReagent:{category:"testing",subcategory:"reagent",tankCompatibility:"both",consumedBy:["testing"],stockBehavior:"consumable"},
  roSediment:{category:"rodi",subcategory:"sediment_filter",tankCompatibility:"both",consumedBy:["rodi"],stockBehavior:"consumable"},
  roCarbon:{category:"rodi",subcategory:"carbon_filter",tankCompatibility:"both",consumedBy:["rodi"],stockBehavior:"consumable"},
  diResin:{category:"rodi",subcategory:"di_resin",tankCompatibility:"both",consumedBy:["rodi"],stockBehavior:"consumable"},
  bioMedia:{category:"filter_media",subcategory:"biological_media",tankCompatibility:"freshwater",consumedBy:["sump","equipment"],stockBehavior:"consumable"},
  reefGlue:{category:"equipment",subcategory:"aquascape_consumable",tankCompatibility:"marine",consumedBy:["equipment"],stockBehavior:"consumable"},
};

function fallbackProfile(item:InventoryItem):InventoryProfile{
  const text=`${item.name} ${item.nameEn||""} ${item.category||""} ${item.categoryEn||""}`.toLowerCase();
  if(/coral\s*dip|reef\s*dip|مرجان.*ديب|ديب.*مرجان/.test(text))return{category:"coral_treatment",subcategory:"coral_dip",tankCompatibility:"marine",consumedBy:["acclimation"],stockBehavior:"consumable"};
  if(/all\s*for\s*reef/.test(text))return PRESET_PROFILES.allForReef;
  if(/food|feeding|طعام|غذاء|mysis|pellet|nori/.test(text))return{category:"feeding",subcategory:"general_food",tankCompatibility:"both",consumedBy:["feeding"],stockBehavior:"consumable"};
  if(/fertili|سماد|nitrogen|potassium|phosphate|iron|micronutrient|root tab/.test(text))return{category:"fertilizer",subcategory:"general_fertilizer",tankCompatibility:"freshwater",consumedBy:["fertilizer"],stockBehavior:"consumable"};
  if(/\bco2\b|carbon dioxide/.test(text))return{category:"co2",subcategory:"co2",tankCompatibility:"freshwater",consumedBy:["co2"],stockBehavior:"consumable"};
  if(/dip/.test(text))return{category:"coral_treatment",subcategory:"treatment",tankCompatibility:"marine",consumedBy:["acclimation"],stockBehavior:"consumable"};
  if(/salt|ملح|conditioner|مزيل كلور/.test(text))return{category:"water_prep",subcategory:"water_prep",tankCompatibility:"both",consumedBy:["waterChange"],stockBehavior:"consumable"};
  if(/carbon|gfo|phosphate media|filter floss|media|فلتر|فلترة|ميديا/.test(text))return{category:"filter_media",subcategory:"filter_media",tankCompatibility:"both",consumedBy:["sump"],stockBehavior:"consumable"};
  if(/kh|alkalinity|calcium|magnesium|buffer|جرعة|dosing/.test(text))return{category:"dosing",subcategory:"single_parameter",tankCompatibility:"marine",consumedBy:["dosing"],stockBehavior:"consumable"};
  if(/trace|iodine|amino|bacteria|supplement|متمم|عناصر|بكتيريا/.test(text))return{category:"supplement",subcategory:"supplement",tankCompatibility:"both",consumedBy:["dosing"],stockBehavior:"consumable"};
  if(/test|reagent|فحص|كاشف/.test(text))return{category:"testing",subcategory:"testing",tankCompatibility:"both",consumedBy:["testing"],stockBehavior:"consumable"};
  if(/ro\/di|di resin|sediment/.test(text))return{category:"rodi",subcategory:"rodi",tankCompatibility:"both",consumedBy:["rodi"],stockBehavior:"consumable"};
  return{category:"other",subcategory:"other",tankCompatibility:"both",consumedBy:[],stockBehavior:"consumable"};
}

export function inventoryProfile(item:InventoryItem):InventoryProfile{
  const legacy=PRESET_PROFILES[item.presetId||""]??fallbackProfile(item);
  return{
    category:item.inventoryCategory??legacy.category,
    subcategory:item.inventorySubcategory??legacy.subcategory,
    tankCompatibility:item.tankCompatibility??legacy.tankCompatibility,
    consumedBy:item.consumedBy?.length?item.consumedBy:legacy.consumedBy,
    stockBehavior:item.stockBehavior??legacy.stockBehavior,
  };
}

export function inventoryForConsumer(tank:Tank,consumer:InventoryConsumer){
  return tank.inventory.filter(item=>{
    const profile=inventoryProfile(item);
    const tankOk=profile.tankCompatibility==="both"||profile.tankCompatibility===tank.type;
    return tankOk&&profile.consumedBy.includes(consumer);
  });
}

export function inventoryCategoryLabel(category:InventoryCategory,lang:"ar"|"en"){
  const ar:Record<InventoryCategory,string>={
    feeding:"تغذية",fertilizer:"أسمدة",co2:"CO₂",dosing:"جرعات كيميائية",supplement:"متممات",
    filter_media:"ميديا فلترة",coral_treatment:"علاج المرجان",water_prep:"تحضير الماء",equipment:"تجهيزات",
    testing:"فحوص",rodi:"RO/DI",other:"أخرى"
  };
  const en:Record<InventoryCategory,string>={
    feeding:"Feeding",fertilizer:"Fertilizer",co2:"CO₂",dosing:"Dosing",supplement:"Supplements",
    filter_media:"Filter Media",coral_treatment:"Coral Treatment",water_prep:"Water Prep",equipment:"Equipment",
    testing:"Testing",rodi:"RO/DI",other:"Other"
  };
  return (lang==="ar"?ar:en)[category];
}

export interface UnifiedStockRow{
  id:string;
  source:"inventory"|"equipment-consumable";
  name:string;
  nameEn?:string;
  category:string;
  inventoryCategory?:InventoryCategory;
  subcategory?:string;
  quantity:number;
  minimum:number;
  unit:string;
  equipmentId?:string;
  consumableId?:string;
}

export function unifiedInventory(tank:Tank){
  const general:UnifiedStockRow[]=tank.inventory.map(x=>{
    const profile=inventoryProfile(x);
    return{
      id:x.id,source:"inventory",name:x.name,nameEn:x.nameEn,category:x.category||inventoryCategoryLabel(profile.category,"en"),
      inventoryCategory:profile.category,subcategory:profile.subcategory,
      quantity:x.quantity,minimum:x.minimum,unit:x.unit
    };
  });
  const consumables:UnifiedStockRow[]=tank.equipment.flatMap(e=>(e.consumables??[]).map(c=>({
    id:`${e.id}:${c.id}`,source:"equipment-consumable" as const,name:c.name,nameEn:c.nameEn,
    category:e.name,inventoryCategory:"equipment" as InventoryCategory,subcategory:"equipment_consumable",
    quantity:c.quantityOnHand??0,minimum:c.minimumOnHand??0,unit:c.unit??"pc",
    equipmentId:e.id,consumableId:c.id
  })));
  const rows=[...general,...consumables];
  const low=rows.filter(x=>x.quantity<=x.minimum);
  return {rows,general,consumables,low,total:rows.length};
}
