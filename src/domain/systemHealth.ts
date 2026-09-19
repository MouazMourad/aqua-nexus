import type { Tank } from "./types";
import { bioload,chemistryHealthAssessment,maintenanceHealth } from "./health";
import { auditTankCompatibility } from "./compatibility";
import { equipmentAdequacy } from "./equipmentAdequacy";

export interface SystemHealthComponent{
  key:"chemistry"|"maintenance"|"bioload"|"equipment"|"compatibility"|"livestock";
  score:number;
  weight:number;
  ar:string;
  en:string;
}

export interface SystemHealthResult{
  score:number;
  components:SystemHealthComponent[];
  chemistry:number;
  chemistryKnown:boolean;
  chemistryCritical:boolean;
  chemistryDataConfidence:number;
  maintenance:number;
  bioload:number;
  equipment:number;
  compatibility:number;
  livestock:number;
  equipmentAudit:ReturnType<typeof equipmentAdequacy>;
  compatibilityAudit:ReturnType<typeof auditTankCompatibility>;
}

function clamp(n:number){return Math.max(0,Math.min(100,Math.round(n)));}

export function bioloadHealthScore(tank:Tank){
  const ratio=bioload(tank).ratio;
  if(ratio<=.55)return 100;
  if(ratio<=.85)return clamp(100-((ratio-.55)/.30)*15);
  if(ratio<=1.15)return clamp(85-((ratio-.85)/.30)*45);
  return clamp(40-Math.min(40,(ratio-1.15)*80));
}

export function livestockHealthScore(tank:Tank){
  if(!tank.livestock.length)return 100;
  const total=tank.livestock.reduce((s,x)=>s+x.quantity,0)||1;
  const penalty=tank.livestock.reduce((s,x)=>{
    const p=x.health==="treatment"?35:x.health==="watch"?15:0;
    return s+p*x.quantity;
  },0)/total;
  const activeQuarantine=tank.quarantine.filter(x=>x.status==="active").length;
  return clamp(100-penalty-Math.min(20,activeQuarantine*5));
}

export function systemHealth(tank:Tank):SystemHealthResult{
  const chemistryAssessment=chemistryHealthAssessment(tank);
  const chemistry=chemistryAssessment.score??0;
  const maintenance=maintenanceHealth(tank);
  const bio=bioloadHealthScore(tank);
  const equipmentAudit=equipmentAdequacy(tank);
  const compatibilityAudit=auditTankCompatibility(tank);
  const livestock=livestockHealthScore(tank);

  const components:SystemHealthComponent[]=[
    {key:"chemistry",score:chemistry,weight:.30,ar:"الكيمياء",en:"Chemistry"},
    {key:"maintenance",score:maintenance,weight:.15,ar:"الصيانة",en:"Maintenance"},
    {key:"bioload",score:bio,weight:.15,ar:"الحمل الحيوي",en:"Bioload"},
    {key:"equipment",score:equipmentAudit.score,weight:.20,ar:"كفاية التجهيزات",en:"Equipment adequacy"},
    {key:"compatibility",score:compatibilityAudit.score,weight:.15,ar:"توافق الكائنات",en:"Livestock compatibility"},
    {key:"livestock",score:livestock,weight:.05,ar:"حالة الكائنات",en:"Livestock condition"}
  ];
  const activeComponents=components.filter(x=>x.key!=="chemistry"||chemistryAssessment.score!==null);
  const activeWeight=activeComponents.reduce((s,x)=>s+x.weight,0)||1;
  const score=clamp(activeComponents.reduce((s,x)=>s+x.score*x.weight,0)/activeWeight);
  return {
    score,components,
    chemistry,chemistryKnown:chemistryAssessment.score!==null,chemistryCritical:chemistryAssessment.critical,chemistryDataConfidence:chemistryAssessment.dataConfidence,maintenance,bioload:bio,equipment:equipmentAudit.score,
    compatibility:compatibilityAudit.score,livestock,
    equipmentAudit,compatibilityAudit
  };
}

export function systemHealthTrend(tank:Tank):"improving"|"stable"|"declining"{
  const snapshots=(tank.healthSnapshots??[]).filter(x=>Number.isFinite(x.score));
  if(snapshots.length<2)return "stable";
  const latest=snapshots[0].score,previous=snapshots[1].score;
  const delta=latest-previous;
  return delta>=5?"improving":delta<=-5?"declining":"stable";
}
