import type { Tank } from "./types";
import { sumpIntelligence } from "./sumpIntelligence";
import { systemHealth } from "./systemHealth";
import { currentChemistryValues } from "./chemistryDataQuality";

export function emergencyContext(tank:Tank,scenarioId:string){
  const latest=currentChemistryValues(tank);
  const equipmentKinds=scenarioId==="power"?["returnPump","waveMaker","heater","ato"]:
    scenarioId==="pump"?["returnPump","waveMaker"]:
    scenarioId==="highTemp"||scenarioId==="lowTemp"?["heater","waveMaker","returnPump"]:
    scenarioId==="oxygen"?["waveMaker","returnPump"]:
    scenarioId==="leak"?["overflow","returnPump"]:[];
  const equipment=tank.equipment.filter(e=>equipmentKinds.includes(e.kind)).map(e=>({
    name:e.name,kind:e.kind,status:e.status,spare:Boolean(e.spareAvailable||e.backupPlan?.trim())
  }));
  const readings=["temperature","salinity","pH","NH3","NO2"].flatMap(key=>{
    const v=latest[key];return typeof v==="number"?[{key,value:v}]:[];
  });
  const sump=scenarioId==="power"||scenarioId==="leak"?sumpIntelligence(tank):null;
  const health=systemHealth(tank);
  const notes:string[]=[];
  if(equipment.some(e=>e.status==="off"||e.status==="warning"||e.status==="service"))notes.push("يوجد جهاز مرتبط بالسيناريو حالته ليست On.");
  if(equipment.some(e=>!e.spare&&(e.kind==="returnPump"||e.kind==="heater")))notes.push("يوجد جهاز حرج بدون Spare/Backup plan مسجل.");
  if(sump?.enabled&&sump.safetyMargin<0)notes.push("هامش الـFreeboard في السامب سلبي حسب التقدير الحالي.");
  return {readings,equipment,sump,systemScore:health.score,notes};
}
