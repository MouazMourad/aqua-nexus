import type { Tank } from "./types";
import type { AquaActionPlan } from "./actionPlanEngine";

export interface DomainOutcomeSignal{
  id:string;
  domain:string;
  samples:number;
  improved:number;
  stable:number;
  worse:number;
  confidence:"low"|"medium"|"high";
  level:"good"|"info"|"warn";
  ar:string;
  en:string;
}

function plans(tank:Tank){
  return ((tank.aiActionPlans??[]) as AquaActionPlan[]).filter(p=>p.status==="completed"&&Boolean(p.focus?.domain)&&Boolean(p.outcome));
}

export function domainOutcomeLearning(tank:Tank):DomainOutcomeSignal[]{
  const groups=new Map<string,AquaActionPlan[]>();
  for(const plan of plans(tank)){
    const domain=plan.focus!.domain;
    groups.set(domain,[...(groups.get(domain)??[]),plan]);
  }
  const out:DomainOutcomeSignal[]=[];
  for(const [domain,rows] of groups){
    if(rows.length<2)continue;
    const improved=rows.filter(x=>x.outcome==="improved").length;
    const stable=rows.filter(x=>x.outcome==="stable").length;
    const worse=rows.filter(x=>x.outcome==="worse").length;
    const samples=rows.length,dominant=Math.max(improved,stable,worse),ratio=dominant/samples;
    const confidence=samples>=5&&ratio>=.7?"high":samples>=3?"medium":"low";
    const level=worse>=Math.max(2,Math.ceil(samples*.5))?"warn":improved>=Math.max(2,Math.ceil(samples*.6))?"good":"info";
    const ar=level==="good"
      ?`من ${samples} خطط سابقة بمجال ${domain}، تحسنت النتيجة ${improved} مرة. هذا نمط خاص بالحوض وليس ضماناً للنتيجة القادمة، وقواعد الأمان تبقى أعلى أولوية.`
      :level==="warn"
        ?`من ${samples} خطط سابقة بمجال ${domain}، سُجل تراجع ${worse} مرة. Aqua Nexus لازم يتعامل مع أي تدخل جديد بهذا المجال بحذر ويطلب تحققاً أقوى.`
        :`لدى الحوض ${samples} نتائج موثقة بمجال ${domain}: تحسن ${improved} • استقرار ${stable} • تراجع ${worse}. الثقة ما زالت مبنية على تاريخ هذا الحوض فقط.`;
    const en=level==="good"
      ?`Across ${samples} prior ${domain} plans, the outcome improved ${improved} time(s). This is a tank-specific pattern, not a guarantee; safety rules remain authoritative.`
      :level==="warn"
        ?`Across ${samples} prior ${domain} plans, the outcome worsened ${worse} time(s). Aqua Nexus should require stronger verification before another intervention in this domain.`
        :`This tank has ${samples} documented ${domain} outcomes: ${improved} improved • ${stable} stable • ${worse} worse. Confidence is limited to this tank's own history.`;
    out.push({id:`outcome-${domain}`,domain,samples,improved,stable,worse,confidence,level,ar,en});
  }
  return out.sort((a,b)=>b.samples-a.samples).slice(0,8);
}

export function domainOutcomeSignal(tank:Tank,domain:string){
  return domainOutcomeLearning(tank).find(x=>x.domain===domain);
}
