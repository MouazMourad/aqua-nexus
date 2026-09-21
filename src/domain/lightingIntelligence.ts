import type { Equipment,LightingProgram,LightingProgramPoint,Tank } from "./types";

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const minute=(h:number,m=0)=>h*60+m;

export const LIGHTING_SPECTRA=[
  {id:"uv",ar:"UV",en:"UV",weight:.88},
  {id:"violet",ar:"بنفسجي",en:"Violet",weight:.96},
  {id:"royalBlue",ar:"أزرق ملكي",en:"Royal Blue",weight:1},
  {id:"blue",ar:"أزرق",en:"Blue",weight:.98},
  {id:"cyan",ar:"سماوي",en:"Cyan",weight:.78},
  {id:"green",ar:"أخضر",en:"Green",weight:.48},
  {id:"red",ar:"أحمر",en:"Red",weight:.58},
  {id:"coolWhite",ar:"أبيض بارد",en:"Cool White",weight:.72},
  {id:"warmWhite",ar:"أبيض دافئ",en:"Warm White",weight:.64}
] as const;

export function defaultLightingProgram(tank:Tank):LightingProgram{
  const marine=tank.type==="marine";
  const channels=marine
    ?[
      {id:"uv",name:"UV",nameEn:"UV",spectrum:"uv" as const,parWeight:.88,enabled:true},
      {id:"violet",name:"Violet",nameEn:"Violet",spectrum:"violet" as const,parWeight:.96,enabled:true},
      {id:"royalBlue",name:"Royal Blue",nameEn:"Royal Blue",spectrum:"royalBlue" as const,parWeight:1,enabled:true},
      {id:"blue",name:"Blue",nameEn:"Blue",spectrum:"blue" as const,parWeight:.98,enabled:true},
      {id:"white",name:"White",nameEn:"White",spectrum:"coolWhite" as const,parWeight:.72,enabled:true}
    ]
    :[
      {id:"white",name:"White",nameEn:"White",spectrum:"coolWhite" as const,parWeight:.78,enabled:true},
      {id:"red",name:"Red",nameEn:"Red",spectrum:"red" as const,parWeight:.66,enabled:true},
      {id:"green",name:"Green",nameEn:"Green",spectrum:"green" as const,parWeight:.54,enabled:true},
      {id:"blue",name:"Blue",nameEn:"Blue",spectrum:"blue" as const,parWeight:.84,enabled:true}
    ];
  const values=(v:number)=>Object.fromEntries(channels.map(ch=>[ch.id,v]));
  const now=new Date().toISOString();
  const points:LightingProgramPoint[]=marine
    ?[
      {id:"p1",minute:minute(9),values:values(0)},
      {id:"p2",minute:minute(11),values:{uv:28,violet:42,royalBlue:58,blue:52,white:12}},
      {id:"p3",minute:minute(15),values:{uv:42,violet:58,royalBlue:72,blue:66,white:20}},
      {id:"p4",minute:minute(21),values:{uv:34,violet:48,royalBlue:62,blue:58,white:14}},
      {id:"p5",minute:minute(23),values:values(0)}
    ]
    :[
      {id:"p1",minute:minute(8),values:values(0)},
      {id:"p2",minute:minute(9),values:{white:55,red:30,green:22,blue:30}},
      {id:"p3",minute:minute(13),values:{white:72,red:38,green:28,blue:38}},
      {id:"p4",minute:minute(18),values:{white:60,red:32,green:24,blue:34}},
      {id:"p5",minute:minute(19),values:values(0)}
    ];
  return{id:"program-default",name:marine?"Balanced Reef":"Balanced Freshwater",createdAt:now,updatedAt:now,channels,points};
}

export function sortedLightingPoints(program:LightingProgram){
  return [...program.points].sort((a,b)=>a.minute-b.minute);
}

export function lightingAtMinute(program:LightingProgram,atMinute:number){
  const pts=sortedLightingPoints(program);
  if(!pts.length)return{values:{} as Record<string,number>,weightedPercent:0};
  const m=clamp(atMinute,0,1439);
  let a=pts[0],b=pts.at(-1)!;
  if(m<=a.minute)b=a;
  else if(m>=b.minute)a=b;
  else{
    for(let i=0;i<pts.length-1;i++)if(m>=pts[i].minute&&m<=pts[i+1].minute){a=pts[i];b=pts[i+1];break}
  }
  const span=Math.max(1,b.minute-a.minute),t=a===b?0:(m-a.minute)/span;
  const values:Record<string,number>={};
  let weighted=0,totalWeight=0;
  for(const ch of program.channels){
    const av=clamp(Number(a.values[ch.id]??0),0,100),bv=clamp(Number(b.values[ch.id]??0),0,100);
    const v=av+(bv-av)*t;values[ch.id]=v;
    if(ch.enabled){weighted+=v*clamp(ch.parWeight,0,2);totalWeight+=clamp(ch.parWeight,0,2)}
  }
  return{values,weightedPercent:totalWeight?weighted/totalWeight:0};
}

export function lightingSchedule(program:LightingProgram){
  let first:number|null=null,last:number|null=null,peak=0,peakMinute=0,dose=0;
  for(let m=0;m<1440;m+=5){
    const p=lightingAtMinute(program,m).weightedPercent;
    if(p>=1&&first===null)first=m;
    if(p>=1)last=m;
    if(p>peak){peak=p;peakMinute=m}
    dose+=(p/100)*(5/60);
  }
  return{
    firstMinute:first,lastMinute:last,
    photoperiodMinutes:first===null||last===null?0:Math.max(0,last-first+5),
    peakPercent:peak,peakMinute,
    relativeDoseHours:dose
  };
}

function fixturePosition(f:Equipment,index:number,total:number){
  const p=f.displayPosition;
  return{
    xPct:clamp(p?.xPct??((index+1)/(total+1))*100,0,100),
    zPct:clamp(p?.zPct??50,0,100),
    yPct:clamp(p?.yPct??116,100,155),
    scale:clamp(p?.scale??1,.5,1.8)
  };
}

function defaultPeakPar(tank:Tank){
  if(tank.type==="marine"){
    if(tank.ecosystemProfile==="reef"||tank.livestock.some(x=>x.category==="coral"))return 300;
    return 105;
  }
  if(tank.ecosystemProfile==="planted"||tank.plantedMode)return tank.plantedMode==="highTech"?210:120;
  return 85;
}

function wattDerivedReferencePar(tank:Tank,f:Equipment){
  if(typeof f.powerWatts!=="number"||!Number.isFinite(f.powerWatts)||f.powerWatts<=0)return defaultPeakPar(tank);
  const coverageM2=Math.max(.08,((f.coverageLengthCm??tank.display.length*.62)/100)*((f.coverageWidthCm??tank.display.width*.78)/100));
  const efficacy=tank.type==="marine"?1.75:1.55;
  const usableFraction=tank.type==="marine"?.78:.72;
  const photonFlux=f.powerWatts*efficacy*usableFraction;
  return clamp(photonFlux/coverageM2,20,900);
}

function rawEstimatedPar(tank:Tank,xPct:number,zPct:number,depthPct:number,atMinute:number){
  const fixtures=tank.equipment.filter(x=>x.kind==="lighting"&&x.location==="display"&&x.status!=="off");
  const program=tank.lighting?.activeProgram;
  if(!fixtures.length||!program)return 0;
  const intensity=lightingAtMinute(program,atMinute).weightedPercent/100;
  if(intensity<=0)return 0;
  let total=0;
  fixtures.forEach((f,i)=>{
    const pos=fixturePosition(f,i,fixtures.length);
    const base=Math.max(10,f.parAtTargetDepth??wattDerivedReferencePar(tank,f))*pos.scale;
    const covX=clamp((f.coverageLengthCm??tank.display.length*.62)/Math.max(1,tank.display.length)*100,18,130);
    const covZ=clamp((f.coverageWidthCm??tank.display.width*.78)/Math.max(1,tank.display.width)*100,20,150);
    const dx=(xPct-pos.xPct)/(covX*.52),dz=(zPct-pos.zPct)/(covZ*.52);
    const spread=Math.exp(-1.55*(dx*dx+dz*dz));
    const depthCm=(depthPct/100)*tank.display.height;
    const refDepthCm=typeof f.parReferenceDepthCm==="number"?clamp(f.parReferenceDepthCm,0,tank.display.height):tank.display.height*.5;
    const waterAttenuation=Math.exp(-.018*(depthCm-refDepthCm));
    const mountCm=typeof f.mountingHeightCm==="number"?clamp(f.mountingHeightCm,1,150):Math.max(5,(pos.yPct-100)/100*tank.display.height+10);
    const mountFactor=Math.pow((mountCm+refDepthCm)/(mountCm+depthCm+.1),1.15);
    total+=base*intensity*spread*waterAttenuation*mountFactor;
  });
  return Math.max(0,total);
}

export function lightingCalibrationFactor(tank:Tank){
  const program=tank.lighting?.activeProgram,points=tank.lighting?.calibrationPoints??[];
  const manual=tank.lighting?.manualCalibrationFactor;
  if(typeof manual==="number"&&Number.isFinite(manual)&&manual>0)return clamp(manual,.25,4);
  if(!program||!points.length)return 1;
  const peak=lightingSchedule(program).peakMinute;
  const ratios=points.map(p=>{
    const raw=rawEstimatedPar(tank,p.xPct,p.zPct,p.depthPct,p.minute??peak);
    return raw>5?p.measuredPar/raw:null;
  }).filter((x):x is number=>typeof x==="number"&&Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
  if(!ratios.length)return 1;
  const mid=Math.floor(ratios.length/2),median=ratios.length%2?ratios[mid]:(ratios[mid-1]+ratios[mid])/2;
  return clamp(median,.25,4);
}

export function estimatedParAt(tank:Tank,xPct:number,zPct:number,depthPct:number,atMinute:number){
  return rawEstimatedPar(tank,xPct,zPct,depthPct,atMinute)*lightingCalibrationFactor(tank);
}

export function lightingGrid(tank:Tank,opts:{minute:number;depthPct:number;cols?:number;rows?:number}){
  const cols=opts.cols??13,rows=opts.rows??7,out:Array<{xPct:number;zPct:number;par:number}>=[];
  for(let z=0;z<rows;z++)for(let x=0;x<cols;x++){
    const xPct=cols===1?50:x/(cols-1)*100,zPct=rows===1?50:z/(rows-1)*100;
    out.push({xPct,zPct,par:estimatedParAt(tank,xPct,zPct,opts.depthPct,opts.minute)});
  }
  return{cols,rows,cells:out,max:Math.max(1,...out.map(x=>x.par)),min:Math.min(...out.map(x=>x.par))};
}

export function lightingFrontGrid(tank:Tank,opts:{minute:number;zPct?:number;cols?:number;rows?:number}){
  const cols=opts.cols??13,rows=opts.rows??7,zPct=opts.zPct??50,out:Array<{xPct:number;depthPct:number;par:number}>=[];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const xPct=cols===1?50:x/(cols-1)*100,depthPct=rows===1?50:y/(rows-1)*100;
    out.push({xPct,depthPct,par:estimatedParAt(tank,xPct,zPct,depthPct,opts.minute)});
  }
  return{cols,rows,cells:out,max:Math.max(1,...out.map(x=>x.par)),min:Math.min(...out.map(x=>x.par))};
}


export interface LightingPlacementRecommendation{
  livestockId:string;
  name:string;
  category:"coral"|"plant";
  zone:"top"|"mid"|"bottom"|"shade";
  parMin:number;
  parMax:number;
  recommendedDepthMinCm:number;
  recommendedDepthMaxCm:number;
  actualDepthCm?:number;
  actualZone?:"top"|"mid"|"bottom";
  placementStatus:"unset"|"within"|"outside";
  estimatedPeakParAtActualDepth?:number;
  ar:string;
  en:string;
}

function normalizedName(value:string){
  return value.toLowerCase()
    .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
    .replace(/[^a-z0-9\u0600-\u06ff]+/g," ");
}

export function lightingPlacementRecommendations(tank:Tank):LightingPlacementRecommendation[]{
  const rows:LightingPlacementRecommendation[]=[];
  const height=Math.max(1,tank.display.height);
  const zoneDepth=(zone:LightingPlacementRecommendation["zone"])=>{
    if(zone==="top")return{min:Math.max(2,height*.08),max:height*.35};
    if(zone==="mid")return{min:height*.28,max:height*.68};
    if(zone==="bottom")return{min:height*.60,max:height*.95};
    return{min:height*.55,max:height*.95};
  };
  const actualZone=(depth:number):"top"|"mid"|"bottom"=>depth<=height*.35?"top":depth<=height*.68?"mid":"bottom";
  const program=tank.lighting?.activeProgram;
  const peakMinute=program?lightingSchedule(program).peakMinute:720;

  for(const item of tank.livestock){
    let row:{zone:LightingPlacementRecommendation["zone"];min:number;max:number;kindAr:string;kindEn:string}|null=null;
    if(tank.type==="marine"&&item.category==="coral"){
      const n=normalizedName([item.name,item.nameEn,item.libraryId,item.notes].filter(Boolean).join(" "));
      row={zone:"mid",min:75,max:180,kindAr:"مرجان متوسط الإضاءة",kindEn:"moderate-light coral"};
      if(/acropora|acro|montipora|pocillopora|stylophora|sps|اكروبورا|مونتيبورا/.test(n))row={zone:"top",min:200,max:350,kindAr:"SPS عالي الإضاءة",kindEn:"high-light SPS"};
      else if(/mushroom|ricordea|rhodactis|discosoma|leather|zoa|zoanthid|مشروم|ريكورديا|روداكتس|ليذر|زوا/.test(n))row={zone:"bottom",min:40,max:110,kindAr:"Soft/مشروم منخفض إلى متوسط",kindEn:"low-to-moderate soft coral"};
      else if(/torch|hammer|frogspawn|euphyllia|candy|acan|blasto|chalice|lps|تورش|هامر|فروغ|كاندي|اكان|بلاستو|شالس/.test(n))row={zone:"mid",min:70,max:170,kindAr:"LPS متوسط الإضاءة",kindEn:"moderate-light LPS"};
    }
    if(tank.type==="freshwater"&&item.category==="plant"){
      const n=normalizedName([item.name,item.nameEn,item.libraryId,item.notes].filter(Boolean).join(" "));
      row={zone:"mid",min:40,max:100,kindAr:"نبات متوسط الإضاءة",kindEn:"moderate-light plant"};
      if(/anubias|java fern|microsorum|buce|bucephalandra|moss|انوبيا|جافا|بوس|موس/.test(n))row={zone:"shade",min:20,max:55,kindAr:"نبات ظل/منخفض الإضاءة",kindEn:"shade/low-light plant"};
      else if(/cryptocoryne|crypt|كريبت/.test(n))row={zone:"bottom",min:30,max:75,kindAr:"Crypt منخفض إلى متوسط",kindEn:"low-to-moderate Crypt"};
      else if(/monte carlo|glossostigma|hemianthus|hc cuba|rotala|ludwigia|alternanthera|carpet|مونتي|روتالا|لودويجيا/.test(n))row={zone:"top",min:80,max:180,kindAr:"نبات قوي/كاربت يحتاج إضاءة أعلى",kindEn:"higher-light stem/carpet plant"};
    }
    if(!row)continue;
    const depth=zoneDepth(row.zone);
    const actual=typeof item.lightingDepthCm==="number"&&Number.isFinite(item.lightingDepthCm)?clamp(item.lightingDepthCm,0,height):undefined;
    const status:LightingPlacementRecommendation["placementStatus"]=actual===undefined?"unset":(actual>=depth.min&&actual<=depth.max?"within":"outside");
    const peakPar=actual!==undefined&&program?estimatedParAt(tank,50,50,actual/height*100,peakMinute):undefined;
    rows.push({
      livestockId:item.id,name:item.name,category:item.category as "coral"|"plant",zone:row.zone,parMin:row.min,parMax:row.max,
      recommendedDepthMinCm:depth.min,recommendedDepthMaxCm:depth.max,actualDepthCm:actual,actualZone:actual===undefined?undefined:actualZone(actual),
      placementStatus:status,estimatedPeakParAtActualDepth:peakPar,
      ar:`${row.kindAr}: نطاق بداية ${row.min}–${row.max} PAR، وعمق مقترح ${Math.round(depth.min)}–${Math.round(depth.max)} سم تحت سطح الماء.`,
      en:`${row.kindEn}: starting range ${row.min}–${row.max} PAR, suggested depth ${Math.round(depth.min)}–${Math.round(depth.max)} cm below the surface.`
    });
  }
  return rows;
}

export interface LightingIssue{
  id:string;level:"info"|"warn"|"danger";ar:string;en:string;
}

export function lightingIntelligence(tank:Tank){
  const fixtures=tank.equipment.filter(x=>x.kind==="lighting"&&x.location==="display"&&x.status!=="off");
  const program=tank.lighting?.activeProgram;
  const issues:LightingIssue[]=[];
  if(!fixtures.length)issues.push({id:"no-fixture",level:"warn",ar:"لا توجد وحدة إنارة فعالة ومسجلة فوق الحوض.",en:"No active display-light fixture is registered."});
  const missingPower=fixtures.filter(x=>!(typeof x.powerWatts==="number"&&Number.isFinite(x.powerWatts)&&x.powerWatts>0));
  if(missingPower.length)issues.push({id:"fixture-power-missing",level:"warn",ar:`قوة ${missingPower.length} وحدة إنارة غير محددة بالواط. تحديد القدرة شرط أساسي لتحسين تقدير التوزيع الضوئي.`,en:`${missingPower.length} lighting fixture(s) are missing wattage. Rated power is required to improve the light-field estimate.`});
  if(!program)issues.push({id:"no-program",level:"warn",ar:"برنامج الإنارة غير مسجل بعد، لذلك Tank Brain لا يستطيع تقييم الجرعة الضوئية.",en:"No lighting program is registered yet, so Tank Brain cannot evaluate light dose."});
  const schedule=program?lightingSchedule(program):{firstMinute:null,lastMinute:null,photoperiodMinutes:0,peakPercent:0,peakMinute:720,relativeDoseHours:0};
  const photosynthetic=tank.type==="marine"
    ?(tank.ecosystemProfile==="reef"||tank.livestock.some(x=>x.category==="coral"))
    :(tank.ecosystemProfile==="planted"||Boolean(tank.plantedMode)||tank.livestock.some(x=>x.category==="plant"));
  if(program&&photosynthetic){
    if(schedule.photoperiodMinutes>14*60)issues.push({id:"long-photo",level:"danger",ar:"الفترة الضوئية تتجاوز 14 ساعة؛ هذا طويل جداً لمعظم الأحواض المزروعة/الريف.",en:"Photoperiod exceeds 14 hours; this is very long for most planted/reef systems."});
    else if(schedule.photoperiodMinutes>12*60)issues.push({id:"long-photo",level:"warn",ar:"الفترة الضوئية تتجاوز 12 ساعة وتستحق المراجعة قبل رفع الشدة أكثر.",en:"Photoperiod exceeds 12 hours and should be reviewed before increasing intensity."});
    if(schedule.photoperiodMinutes>0&&schedule.photoperiodMinutes<6*60)issues.push({id:"short-photo",level:"warn",ar:"الفترة الضوئية أقل من 6 ساعات؛ تأكد أنها مقصودة ومناسبة للكائنات الضوئية.",en:"Photoperiod is under 6 hours; verify that this is intentional and suitable for photosynthetic livestock."});
  }
  const depth=tank.lighting?.mapDepthPct??50;
  const centerPeak=program?estimatedParAt(tank,50,50,depth,schedule.peakMinute):0;
  if(program&&fixtures.length&&photosynthetic){
    if(tank.type==="marine"){
      if(centerPeak>500)issues.push({id:"par-high",level:"danger",ar:`التقدير الوسطي عند العمق المختار يقارب ${Math.round(centerPeak)} PAR؛ لا ترفع الشدة قبل معايرة القياس ومراجعة الكائنات.`,en:`Estimated center intensity at the selected depth is about ${Math.round(centerPeak)} PAR; do not increase intensity before calibration and livestock review.`});
      else if(centerPeak<60)issues.push({id:"par-low",level:"warn",ar:`التقدير الوسطي عند العمق المختار حوالي ${Math.round(centerPeak)} PAR؛ قد يكون منخفضاً لبعض المرجان.`,en:`Estimated center intensity at the selected depth is about ${Math.round(centerPeak)} PAR; this may be low for some corals.`});
    }else if(centerPeak>320)issues.push({id:"par-high",level:"warn",ar:`التقدير الوسطي يقارب ${Math.round(centerPeak)} PAR؛ راقب الطحالب وCO₂/المغذيات قبل رفع الضوء.`,en:`Estimated center intensity is about ${Math.round(centerPeak)} PAR; watch algae and CO₂/nutrients before raising light.`});
  }
  const history=tank.lighting?.history??[];
  if(program&&history.length){
    const previous=history[0]?.program;
    if(previous){
      const old=lightingSchedule(previous),delta=Math.abs(schedule.relativeDoseHours-old.relativeDoseHours)/Math.max(.25,old.relativeDoseHours);
      const age=Date.now()-new Date(history[0].timestamp).getTime();
      if(delta>.25&&age<7*86400000)issues.push({id:"recent-jump",level:"warn",ar:"جرعة الضوء تغيّرت بأكثر من 25% خلال آخر أسبوع. ثبّت بقية العوامل وراقب الاستجابة قبل تعديل جديد.",en:"Light dose changed by more than 25% within the last week. Keep other variables stable and observe before another change."});
    }
  }
  const latest=tank.chemistry[0],previous=tank.chemistry[1],links:string[]=[];
  const ph=latest?.values?.pH,oldPh=previous?.values?.pH;
  if(typeof ph==="number"&&typeof oldPh==="number"&&Math.abs(ph-oldPh)>=.15)links.push(`pH Δ ${(ph-oldPh).toFixed(2)}`);
  const temp=latest?.values?.temperature,oldTemp=previous?.values?.temperature;
  if(typeof temp==="number"&&typeof oldTemp==="number"&&Math.abs(temp-oldTemp)>=.7)links.push(`Temp Δ ${(temp-oldTemp).toFixed(1)}°C`);
  const calibration=tank.lighting?.calibrationPoints??[];
  const latestImport=tank.lighting?.imports?.[0];
  const confidence=Math.round(clamp(
    (fixtures.length?20:0)+(program?20:0)+(fixtures.length&&fixtures.every(x=>typeof x.powerWatts==="number"&&x.powerWatts>0)?20:0)+(fixtures.some(x=>Boolean(x.parAtTargetDepth||x.coverageLengthCm))?15:0)+Math.min(25,calibration.length*10),
    0,100
  ));
  const level=issues.some(x=>x.level==="danger")?"danger":issues.some(x=>x.level==="warn")?"warn":"good";
  return{
    level,fixtures:fixtures.length,program,schedule,centerPeak,depthPct:depth,
    calibrationFactor:lightingCalibrationFactor(tank),calibrationPoints:calibration.length,
    confidence,issues,chemistrySignals:links,placementRecommendations:lightingPlacementRecommendations(tank),latestImport,
    missingEvidence:[
      ...(calibration.length?[]:["PAR calibration points"]),
      ...((tank.equipment.some(x=>x.kind==="ato"))?["measured top-off volume history"]:[])
    ]
  };
}

export function formatLightMinute(m:number){
  const x=((Math.round(m)%1440)+1440)%1440;
  return `${String(Math.floor(x/60)).padStart(2,"0")}:${String(x%60).padStart(2,"0")}`;
}
