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
  coralDip:{category:"coral_treatment",subcategory:"coral_dip",tankCompatibility:"marine",consumedBy:["acclimation"],stockBehavior:"consumable"},
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
  if(/phosphate\s*(remover|removal)|po4\s*(remover|media)|gfo|فوسفات.*(مزيل|ميديا)/.test(text))return{category:"filter_media",subcategory:"phosphate_media",tankCompatibility:"marine",consumedBy:["sump"],stockBehavior:"consumable"};
  if(/medication|medicine|treatment|دواء|علاج|cupramine|copper|prazipro|praziquantel|metronidazole|metroplex|kanaplex|formalin|antibiotic/.test(text))return{category:"medication",subcategory:"aquatic_medication",tankCompatibility:"both",consumedBy:["quarantine"],stockBehavior:"consumable"};
  if(/food|feeding|طعام|غذاء|mysis|pellet|nori/.test(text))return{category:"feeding",subcategory:"general_food",tankCompatibility:"both",consumedBy:["feeding"],stockBehavior:"consumable"};
  if(/fertili|سماد|nitrogen|potassium|phosphate|iron|micronutrient|root tab/.test(text))return{category:"fertilizer",subcategory:"general_fertilizer",tankCompatibility:"freshwater",consumedBy:["fertilizer"],stockBehavior:"consumable"};
  if(/\bco2\b|carbon dioxide/.test(text))return{category:"co2",subcategory:"co2",tankCompatibility:"freshwater",consumedBy:["co2"],stockBehavior:"consumable"};
  if(/dip/.test(text))return{category:"coral_treatment",subcategory:"treatment",tankCompatibility:"marine",consumedBy:["acclimation"],stockBehavior:"consumable"};
  if(/conditioner|dechlor|مزيل كلور/.test(text))return{category:"water_prep",subcategory:"conditioner",tankCompatibility:"freshwater",consumedBy:["waterChange"],stockBehavior:"consumable"};
  if(/marine\s*salt|reef\s*salt|ملح بحري/.test(text))return{category:"water_prep",subcategory:"marine_salt",tankCompatibility:"marine",consumedBy:["waterChange"],stockBehavior:"consumable"};
  if(/aquarium\s*salt|freshwater\s*salt|ملح نهري/.test(text))return{category:"water_prep",subcategory:"freshwater_salt",tankCompatibility:"freshwater",consumedBy:["waterChange"],stockBehavior:"consumable"};
  if(/sediment|رواسب/.test(text))return{category:"rodi",subcategory:"sediment_filter",tankCompatibility:"both",consumedBy:["rodi"],stockBehavior:"consumable"};
  if(/di\s*resin|deion|راتنج.*di/.test(text))return{category:"rodi",subcategory:"di_resin",tankCompatibility:"both",consumedBy:["rodi"],stockBehavior:"consumable"};
  if(/ro\s*carbon|carbon\s*block|كربون.*ro/.test(text))return{category:"rodi",subcategory:"carbon_filter",tankCompatibility:"both",consumedBy:["rodi"],stockBehavior:"consumable"};
  if(/salt|ملح/.test(text))return{category:"water_prep",subcategory:"water_prep",tankCompatibility:"both",consumedBy:["waterChange"],stockBehavior:"consumable"};
  if(/carbon|gfo|phosphate media|filter floss|media|فلتر|فلترة|ميديا/.test(text))return{category:"filter_media",subcategory:"filter_media",tankCompatibility:"both",consumedBy:["sump"],stockBehavior:"consumable"};
  if(/kh|alkalinity|calcium|magnesium|buffer|جرعة|dosing/.test(text))return{category:"dosing",subcategory:"single_parameter",tankCompatibility:"marine",consumedBy:["dosing"],stockBehavior:"consumable"};
  if(/trace|iodine|amino|bacteria|supplement|متمم|عناصر|بكتيريا/.test(text))return{category:"supplement",subcategory:"supplement",tankCompatibility:"both",consumedBy:["dosing"],stockBehavior:"consumable"};
  if(/test|reagent|فحص|كاشف/.test(text))return{category:"testing",subcategory:"testing",tankCompatibility:"both",consumedBy:["testing"],stockBehavior:"consumable"};
  if(/ro\/di/.test(text))return{category:"rodi",subcategory:"rodi",tankCompatibility:"both",consumedBy:["rodi"],stockBehavior:"consumable"};
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

function inferredDosingParameter(item:InventoryItem):"KH"|"Ca"|"Mg"|null{
  if(item.dosingParameter)return item.dosingParameter;
  const profile=inventoryProfile(item);
  const text=`${profile.subcategory} ${item.name} ${item.nameEn||""}`.toLowerCase();
  if(/alkalinity|\bkh\b|bicarbonate|carbonate|nahco3|na2co3|بيكربونات|كربونات/.test(text))return "KH";
  if(/calcium|cacl2|كالسيوم/.test(text))return "Ca";
  if(/magnesium|mgcl2|mgso4|epsom|مغنيسيوم|انكليزي/.test(text))return "Mg";
  return null;
}
function inferredDosingCompound(item:InventoryItem):string|null{
  if(item.dosingCompoundId)return item.dosingCompoundId;
  const text=`${item.name} ${item.nameEn||""}`.toLowerCase();
  if(/nahco3|sodium bicarbonate|بيكربونات الصوديوم/.test(text))return "nahco3";
  if(/na2co3|sodium carbonate|كربونات الصوديوم/.test(text))return "na2co3";
  if(/cacl2.*2h2o|calcium chloride dihydrate|كلوريد الكالسيوم ثنائي/.test(text))return "cacl2-2h2o";
  if(/anhydrous calcium chloride|كلوريد الكالسيوم اللامائي/.test(text))return "cacl2";
  if(/mgcl2|magnesium chloride|كلوريد المغنيسيوم/.test(text))return "mgcl2-6h2o";
  if(/mgso4|magnesium sulfate|epsom|ملح انكليزي|ملح إنكليزي/.test(text))return "mgso4-7h2o";
  return null;
}
export function correctiveDosingInventory(tank:Tank,param:"KH"|"Ca"|"Mg",form:"dry"|"stock"|"product",compoundId?:string){
  return inventoryForConsumer(tank,"dosing").filter(item=>{
    const profile=inventoryProfile(item);
    if(profile.category!=="dosing"||profile.subcategory==="balanced_reef")return false;
    if(inferredDosingParameter(item)!==param)return false;
    if(form==="product")return true;
    return Boolean(compoundId)&&inferredDosingCompound(item)===compoundId;
  });
}
export function routineDosingInventory(tank:Tank){
  return inventoryForConsumer(tank,"dosing").filter(item=>{
    const profile=inventoryProfile(item);
    return profile.category==="supplement"||profile.subcategory==="balanced_reef";
  });
}

export interface InventorySubcategoryOption{value:string;ar:string;en:string}

const INVENTORY_SUBCATEGORIES:Record<InventoryCategory,InventorySubcategoryOption[]>={
  feeding:[
    {value:"dry_food",ar:"طعام جاف",en:"Dry food"},{value:"frozen_food",ar:"طعام مجمد",en:"Frozen food"},{value:"coral_food",ar:"غذاء مرجان",en:"Coral food"},{value:"seaweed_food",ar:"طحالب / نوري غذائي",en:"Seaweed / Nori food"},{value:"live_food",ar:"غذاء حي",en:"Live food"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  fertilizer:[
    {value:"complete",ar:"سماد متكامل",en:"Complete fertilizer"},{value:"nitrogen",ar:"نيتروجين",en:"Nitrogen"},{value:"phosphate",ar:"فوسفات",en:"Phosphate"},{value:"potassium",ar:"بوتاسيوم",en:"Potassium"},{value:"iron",ar:"حديد",en:"Iron"},{value:"micros",ar:"عناصر صغرى",en:"Micros"},{value:"root_tabs",ar:"Root Tabs",en:"Root tabs"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  co2:[
    {value:"gas_refill",ar:"تعبئة غاز CO₂",en:"CO₂ gas refill"},{value:"cylinder",ar:"أسطوانة CO₂",en:"CO₂ cylinder"},{value:"liquid_carbon",ar:"كربون سائل",en:"Liquid carbon"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  dosing:[
    {value:"alkalinity",ar:"KH / القلوية",en:"Alkalinity / KH"},{value:"calcium",ar:"كالسيوم",en:"Calcium"},{value:"magnesium",ar:"مغنزيوم",en:"Magnesium"},{value:"balanced_reef",ar:"متمم ريف متوازن",en:"Balanced reef"},{value:"commercial",ar:"منتج تجاري",en:"Commercial product"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  supplement:[
    {value:"trace_elements",ar:"عناصر نادرة",en:"Trace elements"},{value:"iodine",ar:"يود",en:"Iodine"},{value:"amino",ar:"أحماض أمينية",en:"Amino acids"},{value:"bacteria",ar:"بكتيريا",en:"Bacteria"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  filter_media:[
    {value:"activated_carbon",ar:"كربون نشط",en:"Activated carbon"},{value:"phosphate_media",ar:"مزيل فوسفات / GFO",en:"Phosphate media / GFO"},{value:"biological_media",ar:"ميديا بيولوجية",en:"Biological media"},{value:"mechanical_media",ar:"ميديا ميكانيكية",en:"Mechanical media"},{value:"zeolite",ar:"زيولايت",en:"Zeolite"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  coral_treatment:[{value:"coral_dip",ar:"Coral Dip",en:"Coral Dip"},{value:"other",ar:"أخرى",en:"Other"}],
  medication:[
    {value:"copper",ar:"نحاس",en:"Copper"},{value:"antiparasitic",ar:"مضاد طفيليات",en:"Antiparasitic"},{value:"antibiotic",ar:"مضاد حيوي",en:"Antibiotic"},{value:"antifungal",ar:"مضاد فطري",en:"Antifungal"},{value:"aquatic_medication",ar:"دواء مائي عام",en:"General aquatic medication"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  water_prep:[
    {value:"marine_salt",ar:"ملح بحري",en:"Marine salt"},{value:"conditioner",ar:"مزيل كلور / Conditioner",en:"Conditioner"},{value:"freshwater_salt",ar:"ملح مياه عذبة",en:"Freshwater salt"},{value:"remineralizer",ar:"إعادة تمعدن",en:"Remineralizer"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  equipment:[
    {value:"spare",ar:"قطعة احتياطية",en:"Spare"},{value:"equipment_consumable",ar:"مستهلك جهاز",en:"Equipment consumable"},{value:"aquascape_consumable",ar:"مستهلك Aquascape",en:"Aquascape consumable"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  testing:[
    {value:"reagent",ar:"كاشف / Reagent",en:"Reagent"},{value:"test_kit",ar:"Test Kit",en:"Test kit"},{value:"calibration",ar:"محلول معايرة",en:"Calibration solution"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  rodi:[
    {value:"sediment_filter",ar:"فلتر رواسب",en:"Sediment filter"},{value:"carbon_filter",ar:"فلتر كربون",en:"Carbon filter"},{value:"di_resin",ar:"DI Resin",en:"DI resin"},{value:"membrane",ar:"غشاء RO",en:"RO membrane"},{value:"other",ar:"أخرى",en:"Other"}
  ],
  other:[{value:"other",ar:"أخرى",en:"Other"}]
};

export function inventorySubcategoryOptions(category:InventoryCategory){
  return INVENTORY_SUBCATEGORIES[category]??INVENTORY_SUBCATEGORIES.other;
}

export function inventorySubcategoryLabel(category:InventoryCategory,value:string,lang:"ar"|"en"){
  const item=inventorySubcategoryOptions(category).find(x=>x.value===value);
  return item?(lang==="ar"?item.ar:item.en):value;
}

export function inventoryCategoryLabel(category:InventoryCategory,lang:"ar"|"en"){
  const ar:Record<InventoryCategory,string>={
    feeding:"تغذية",fertilizer:"أسمدة",co2:"CO₂",dosing:"جرعات كيميائية",supplement:"متممات",
    filter_media:"ميديا فلترة",coral_treatment:"علاج المرجان",medication:"أدوية / علاج",water_prep:"تحضير الماء",equipment:"تجهيزات",
    testing:"فحوص",rodi:"RO/DI",other:"أخرى"
  };
  const en:Record<InventoryCategory,string>={
    feeding:"Feeding",fertilizer:"Fertilizer",co2:"CO₂",dosing:"Dosing",supplement:"Supplements",
    filter_media:"Filter Media",coral_treatment:"Coral Treatment",medication:"Medication / Treatment",water_prep:"Water Prep",equipment:"Equipment",
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
