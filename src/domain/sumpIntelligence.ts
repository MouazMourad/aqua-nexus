import type { Tank } from "./types";

function liters(l:number,w:number,h:number){return Math.max(0,l*w*h/1000);}
function overlap(a:any,b:any){return a.x<b.x+b.length&&a.x+a.length>b.x&&a.y<b.y+b.width&&a.y+a.width>b.y;}

export function sumpIntelligence(tank:Tank){
  if(!tank.sump.enabled)return {enabled:false,issues:[] as string[],gross:0,operating:0,freeboard:0,drainbackEstimate:0,safetyMargin:0,chambers:[] as any[]};
  const s=tank.sump,d=s.dimensions;
  const gross=liters(d.length,d.width,d.height);
  const operating=gross*s.operatingFillPercent/100;
  const freeboard=Math.max(0,gross-operating);
  const drainbackEstimate=liters(tank.display.length,tank.display.width,1.5)+3;
  const safetyMargin=freeboard-drainbackEstimate;
  const chambers=s.chambers.map(c=>({...c,waterLiters:liters(c.length,c.width,Math.min(c.waterHeight,c.height))}));
  const issues:string[]=[];
  for(const c of s.chambers){
    if(c.x<0||c.y<0||c.x+c.length>d.length+.01||c.y+c.width>d.width+.01)issues.push(`${c.name}: أبعاد/موضع الحجرة خارج حدود السامب.`);
    if(c.waterHeight>c.height)issues.push(`${c.name}: مستوى الماء أعلى من ارتفاع الحجرة.`);
  }
  for(let i=0;i<s.chambers.length;i++)for(let j=i+1;j<s.chambers.length;j++)if(overlap(s.chambers[i],s.chambers[j]))issues.push(`تداخل هندسي بين ${s.chambers[i].name} و${s.chambers[j].name}.`);
  if(safetyMargin<0)issues.push("الـFreeboard التقديري قد لا يكفي لماء الرجوع عند انقطاع الكهرباء.");
  const returnPump=tank.equipment.find(e=>e.kind==="returnPump"&&e.location.startsWith("sump:"));
  if(!returnPump)issues.push("مضخة الرجوع غير مربوطة بحجرة سامب محددة.");
  return {enabled:true,issues,gross,operating,freeboard,drainbackEstimate,safetyMargin,chambers};
}
