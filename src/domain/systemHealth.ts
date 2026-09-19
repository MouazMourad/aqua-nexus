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
  known:boolean;
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
    {key:"chemistry",score:chemistry,weight:.30,ar:"الكيمياء",en:"Chemistry",known:chemistryAssessment.score!==null},
    {key:"maintenance",score:maintenance,weight:.15,ar:"الصيانة",en:"Maintenance",known:true},
    {key:"bioload",score:bio,weight:.15,ar:"الحمل الحيوي",en:"Bioload",known:true},
    {key:"equipment",score:equipmentAudit.score,weight:.20,ar:"كفاية التجهيزات",en:"Equipment adequacy",known:tank.equipment.length>0},
    {key:"compatibility",score:compatibilityAudit.score,weight:.15,ar:"توافق الكائنات",en:"Livestock compatibility",known:tank.livestock.length>0},
    {key:"livestock",score:livestock,weight:.05,ar:"حالة الكائنات",en:"Livestock condition",known:tank.livestock.length>0}
  ];
  const activeComponents=components.filter(x=>x.known);
  const activeWeight=activeComponents.reduce((s,x)=>s+x.weight,0)||1;
  const score=clamp(activeComponents.reduce((s,x)=>s+x.score*x.weight,0)/activeWeight);
  return {
    score,components,
    chemistry,chemistryKnown:chemistryAssessment.score!==null,chemistryCritical:chemistryAssessment.critical,chemistryDataConfidence:chemistryAssessment.dataConfidence,maintenance,bioload:bio,equipment:equipmentAudit.score,
    compatibility:compatibilityAudit.score,livestock,
    equipmentAudit,compatibilityAudit
  };
}

export function systemHealthTrend(tank:Tank):"improving"|"stable"|"declining"|"unknown"{
  const snapshots=(tank.healthSnapshots??[])
   .filter(x=>Number.isFinite(x.score)&&Number.isFinite(new Date(x.timestamp).getTime()))
   .slice()
   .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());
  if(snapshots.length<2)return "unknown";
  const latest=snapshots[0],latestTs=new Date(latest.timestamp).getTime();
  // Ignore bursts of edits that create several snapshots within minutes.
  // A trend needs a meaningful time separation and stays focused on the last week.
  const baseline=snapshots.slice(1).find(x=>{
    const age=latestTs-new Date(x.timestamp).getTime();
    return age>=12*3600000&&age<=7*86400000;
  });
  if(!baseline)return "unknown";
  const delta=latest.score-baseline.score;
  return delta>=5?"improving":delta<=-5?"declining":"stable";
}
