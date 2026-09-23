import type { Tank } from "./types";

function liters(l:number,w:number,h:number){return Math.max(0,l*w*h/1000);}
function overlap(a:any,b:any){return a.x<b.x+b.length&&a.x+a.length>b.x&&a.y<b.y+b.width&&a.y+a.width>b.y;}

export function sumpIntelligence(tank:Tank){
  if(!tank.sump.enabled)return {enabled:false,issues:[] as string[],gross:0,operating:0,freeboard:0,drainbackEstimate:0,estimatedDrainback:0,drainbackSource:"estimate" as const,safetyMargin:0,chambers:[] as any[]};
  const s=tank.sump,d=s.dimensions;
  const gross=liters(d.length,d.width,d.height);
  const operating=gross*s.operatingFillPercent/100;
  const freeboard=Math.max(0,gross-operating);
  const estimatedDrainback=liters(tank.display.length,tank.display.width,1.5)+3;
  const measured=Number(tank.sump.measuredDrainbackLiters||0);
  const drainbackEstimate=measured>0?measured:estimatedDrainback;
  const drainbackSource=measured>0?"measured" as const:"estimate" as const;
  const safetyMargin=freeboard-drainbackEstimate;
  const chambers=s.chambers.map(c=>({...c,waterLiters:liters(c.length,c.width,Math.min(c.waterHeight,c.height))}));
  const issues:string[]=[];
  const low=(v?:string)=>String(v||"").toLowerCase();
  const isSeahorse=(x:any)=>/seahorse|sea horse|حصان البحر|فرس البحر/.test(low(x.name)+" "+low(x.nameEn)+" "+low(x.subtype));
  const isPipefish=(x:any)=>/pipefish|pipe fish|سمك الانبوب|سمكة الانبوب|بايب.?فيش/.test(low(x.name)+" "+low(x.nameEn)+" "+low(x.subtype));
  const isMacro=(x:any)=>x.category==="plant"||/macro|algae|chaeto|chaetomorpha|halimeda|caulerpa|طحالب|شيتو|نبات/.test(low(x.subtype)+" "+low(x.name)+" "+low(x.nameEn));
  for(const c of s.chambers){
    if(c.x<0||c.y<0||c.x+c.length>d.length+.01||c.y+c.width>d.width+.01)issues.push(`${c.name}: أبعاد/موضع الحجرة خارج حدود السامب.`);
    if(c.waterHeight>c.height)issues.push(`${c.name}: مستوى الماء أعلى من ارتفاع الحجرة.`);
    if(c.refugium){
      const residents=tank.livestock.filter(x=>x.location===`sump:${c.id}`);
      const equipment=tank.equipment.filter(x=>x.location===`sump:${c.id}`);
      const calmResidents=residents.filter(x=>isSeahorse(x)||isPipefish(x));
      const macro=residents.filter(isMacro);
      const lights=equipment.filter(e=>(e.kind==="lighting"||e.kind==="refugiumLight"));
      const pumps=equipment.filter(e=>e.kind==="returnPump"||e.kind==="waveMaker"||e.kind==="filterSock"||e.kind==="rollerFilter");
      const chamberLiters=liters(c.length,c.width,Math.min(c.waterHeight,c.height));
      const nominalFlow=pumps.reduce((sum,e)=>sum+Math.max(0,Number(e.flowLph||0)),0);
      const turnover=chamberLiters>0&&nominalFlow>0?nominalFlow/chamberLiters:0;
      if(macro.length&&!lights.length)issues.push(`${c.name}: يوجد نبات/طحالب بالريفوجيم لكن لا توجد إنارة مسجلة في Equipment لهذه الحجرة.`);
      if(c.refugium.mode==="display"&&calmResidents.length){
        if(c.refugium.flow!=="low")issues.push(`${c.name}: Display Refugium يحتوي Seahorse/Pipefish؛ الجريان المضبوط ليس هادئاً. راجع التدفق قبل الاعتماد.`);
        if(!c.refugium.hitchingStructures&&calmResidents.some(isSeahorse))issues.push(`${c.name}: يوجد Seahorse بدون Hitching structures مسجلة.`);
        if(c.refugium.pods==="low"||!c.refugium.pods)issues.push(`${c.name}: مخزون الـCopepods منخفض/غير محدد مع كائنات هادئة تعتمد على تغذية متكررة؛ راجع خطة التغذية.`);
        if(turnover>12)issues.push(`${c.name}: معدل المضخات الاسمي يقارب ${turnover.toFixed(1)}× حجم الحجرة/ساعة، مرتفع كإشارة أولية لـDisplay Refugium هادئ؛ تحقق من التدفق الفعلي داخل الحجرة.`);
        if(!lights.length&&macro.length)issues.push(`${c.name}: لا توجد إنارة Refugium مرتبطة رغم وجود Macroalgae.`);
      }
      if(tank.type==="freshwater"&&c.refugium.mode==="display"&&calmResidents.length)issues.push(`${c.name}: Seahorse/Pipefish كائنات بحرية ولا تتوافق مع حوض Freshwater.`);
    }
  }
  for(let i=0;i<s.chambers.length;i++)for(let j=i+1;j<s.chambers.length;j++)if(overlap(s.chambers[i],s.chambers[j]))issues.push(`تداخل هندسي بين ${s.chambers[i].name} و${s.chambers[j].name}.`);
  if(safetyMargin<0)issues.push("الـFreeboard التقديري قد لا يكفي لماء الرجوع عند انقطاع الكهرباء.");
  const returnPump=tank.equipment.find(e=>e.kind==="returnPump"&&e.location.startsWith("sump:"));
  if(!returnPump)issues.push("مضخة الرجوع غير مربوطة بحجرة سامب محددة.");
  return {enabled:true,issues,gross,operating,freeboard,drainbackEstimate,estimatedDrainback,drainbackSource,safetyMargin,chambers};
}
