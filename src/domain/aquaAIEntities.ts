import type { EquipmentKind,Tank } from "./types";

export interface AquaAIEntities{
 equipmentIds:string[];
 equipmentKinds:EquipmentKind[];
 maintenanceTaskIds:string[];
 livestockIds:string[];
}

function norm(s:string){
 return (s||"").toLowerCase().normalize("NFKD")
  .replace(/[\u064B-\u065F\u0670]/g,"")
  .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
  .replace(/ؤ/g,"و").replace(/ئ/g,"ي")
  .replace(/[^a-z0-9\u0600-\u06ff]+/g," ")
  .replace(/\s+/g," ").trim();
}

const KIND_ALIASES:Partial<Record<EquipmentKind,string[]>>={
 lighting:["اضاءه","اضاءه الحوض","لايت","lighting","light"],
 waveMaker:["ويف","ويف ميكر","مضخه موج","مضخة موج","wave maker","wavemaker","powerhead"],
 skimmer:["سكيمر","بروتين سكيمر","protein skimmer","skimmer"],
 returnPump:["مضخه راجعه","مضخة راجعة","مضخه الريترن","مضخة الريترن","return pump","return"],
 filterSock:["جورب فلتر","جراب فلتر","جرابات","filter sock","sock"],
 rollerFilter:["رولر","roller filter","roller"],
 canisterFilter:["فلتر كانستر","كانستر","canister filter","canister"],
 spongeFilter:["فلتر اسفنجي","فلتر إسفنجي","اسفنجي","إسفنجي","sponge filter","sponge"],
 reactor:["ريأكتور","رياكتور","reactor"],
 heater:["سخان","هيتر","heater"],
 doser:["دوزر","مضخه جرعات","مضخة جرعات","doser","dosing pump"],
 uv:["يوفي","uv","uv sterilizer"],
 ozone:["اوزون","أوزون","ozone"],
 ato:["اتو","تعويض تلقائي","اتو توب اوف","ato","auto top off"],
 refugiumLight:["اضاءه ريفيجيوم","لايت ريفيجيوم","refugium light"],
 turfScrubber:["الجي سكرابر","algae scrubber","turf scrubber"],
 probe:["بروب","مجس","probe","sensor"],
 co2:["co2","ثاني اكسيد الكربون","ثاني أكسيد الكربون","كربون","منظم co2","co2 system"],
 overflow:["اوفر فلو","overflow"]
};

function hasAlias(q:string,aliases:string[]){
 return aliases.some(a=>{
  const n=norm(a);
  return n.length>=2&&(q===n||q.includes(n));
 });
}

export function resolveAquaEntities(tank:Tank,question:string):AquaAIEntities{
 const q=norm(question);
 const equipmentIds=tank.equipment.filter(item=>{
  const fields=[item.name,item.brand||"",item.model||"",item.kind];
  return fields.some(v=>{const n=norm(v);return n.length>=3&&q.includes(n);});
 }).map(x=>x.id);

 const equipmentKinds=(Object.entries(KIND_ALIASES) as Array<[EquipmentKind,string[]]>)
  .filter(([,aliases])=>hasAlias(q,aliases))
  .map(([kind])=>kind);

 for(const item of tank.equipment.filter(x=>equipmentIds.includes(x.id))){
  if(!equipmentKinds.includes(item.kind))equipmentKinds.push(item.kind);
 }

 const maintenanceTaskIds=tank.maintenance.filter(item=>{
  const names=[item.title,item.titleEn||""];
  return names.some(v=>{const n=norm(v);return n.length>=3&&q.includes(n);});
 }).map(x=>x.id);

 const livestockIds=tank.livestock.filter(item=>{
  const names=[item.name,item.nameEn||""];
  return names.some(v=>{const n=norm(v);return n.length>=3&&q.includes(n);});
 }).map(x=>x.id);

 return {equipmentIds,equipmentKinds,maintenanceTaskIds,livestockIds};
}

export function equipmentKindLabel(kind:EquipmentKind,lang:"ar"|"en"){
 const ar:Record<EquipmentKind,string>={
  lighting:"الإضاءة",waveMaker:"مضخة الموج",skimmer:"السكيمر",returnPump:"مضخة الرجوع",
  filterSock:"جورب الفلترة",rollerFilter:"الرولر فلتر",canisterFilter:"فلتر كانستر",spongeFilter:"فلتر إسفنجي",reactor:"الرياكتور",heater:"السخان",
  doser:"الدوزر",uv:"UV",ozone:"الأوزون",ato:"ATO",refugiumLight:"إضاءة الريفيجيوم",
  turfScrubber:"Algae Scrubber",probe:"المجس",co2:"نظام CO₂",overflow:"الأوفر فلو",other:"الجهاز"
 };
 const en:Record<EquipmentKind,string>={
  lighting:"lighting",waveMaker:"wave maker",skimmer:"skimmer",returnPump:"return pump",
  filterSock:"filter sock",rollerFilter:"roller filter",canisterFilter:"canister filter",spongeFilter:"sponge filter",reactor:"reactor",heater:"heater",
  doser:"doser",uv:"UV",ozone:"ozone",ato:"ATO",refugiumLight:"refugium light",
  turfScrubber:"algae scrubber",probe:"probe",co2:"CO₂ system",overflow:"overflow",other:"equipment"
 };
 return (lang==="ar"?ar:en)[kind];
}
