"use client";

import { useMemo,useState } from "react";
import type { JournalPhoto,Tank } from "@/domain/types";
import { healthTimeline,tankForecast,tankStateView } from "@/domain/tankIntelligence";
import { useAquaStore } from "@/store/useAquaStore";

const W=1120,H=380,L=64,R=126,T=42,B=58;
const ACTUAL_RIGHT=W-R;
const FORECAST_X=W-38;
const DAY=86400000;

type RangeKey="all"|"365"|"90"|"30"|"7";

type JourneyPoint={
 id:string;
 timestamp:string;
 score:number;
 chemistry:number|null;
 maintenance:number;
 delta:number;
 reasonAr:string;
 reasonEn:string;
 source:"snapshot"|"estimated"|"current";
 event?:{textAr:string;textEn:string;timestamp:string};
 recoveryEvent?:{textAr:string;textEn:string;timestamp:string};
};

function clamp(n:number){return Math.max(0,Math.min(100,n));}
function scoreColor(score:number){
 if(score<50)return "#ff5264";
 if(score<65)return "#ff8155";
 if(score<80)return "#ffc956";
 if(score<90)return "#77df8d";
 return "#43e7ba";
}
function scoreBand(score:number){
 if(score<50)return "critical";
 if(score<65)return "stressed";
 if(score<80)return "watch";
 if(score<90)return "stable";
 return "excellent";
}

export function TankJourney({tank}:{tank:Tank}){
 const lang=useAquaStore(s=>s.language);
 const [range,setRange]=useState<RangeKey>("all");
 const [selectedId,setSelectedId]=useState<string>("");
 const [selectedPhoto,setSelectedPhoto]=useState<JournalPhoto|null>(null);
 const [selectedEventId,setSelectedEventId]=useState<string>("");
 const forecast=useMemo(()=>tankForecast(tank),[tank]);
 const currentState=useMemo(()=>tankStateView(tank),[tank]);
 const now=Date.now();
 const createdMs=Number.isFinite(new Date(tank.createdAt).getTime())?new Date(tank.createdAt).getTime():now;

 const allPoints=useMemo<JourneyPoint[]>(()=>{
  const base:JourneyPoint[]=healthTimeline(tank).map(p=>({...p,source:p.source}));
  const current:JourneyPoint={
   id:"journey-current",timestamp:new Date().toISOString(),score:currentState.score,
   chemistry:tank.chemistry.some(x=>!x.usingDefaults)?(base[base.length-1]?.chemistry??null):null,
   maintenance:base[base.length-1]?.maintenance??currentState.score,delta:0,
   reasonAr:"الحالة الحالية للحوض",reasonEn:"Current tank state",source:"current"
  };
  const last=base[base.length-1];
  const lastMs=last?new Date(last.timestamp).getTime():0;
  if(!last||Date.now()-lastMs>6*3600000||last.score!==current.score)base.push(current);
  else base[base.length-1]={...last,id:"journey-current",score:current.score,reasonAr:"الحالة الحالية للحوض",reasonEn:"Current tank state",source:"current"};
  base.sort((a,b)=>new Date(a.timestamp).getTime()-new Date(b.timestamp).getTime());
  base.forEach((p,i)=>{p.delta=i?p.score-base[i-1].score:0;});
  return base;
 },[tank,currentState.score]);

 const startMs=range==="all"?createdMs:Math.max(createdMs,now-Number(range)*DAY);
 const points=allPoints.filter(p=>new Date(p.timestamp).getTime()>=startMs&&new Date(p.timestamp).getTime()<=now+60000);
 const visiblePoints=points.length?points:allPoints.slice(-1);
 const span=Math.max(DAY,now-startMs);
 const xAt=(ts:string)=>L+((Math.max(startMs,Math.min(now,new Date(ts).getTime()))-startMs)/span)*(ACTUAL_RIGHT-L);
 const yAt=(score:number)=>T+(100-clamp(score))*(H-T-B)/100;
 const current=visiblePoints[visiblePoints.length-1];
 const best=visiblePoints.reduce((a,b)=>b.score>a.score?b:a,visiblePoints[0]);
 const worst=visiblePoints.reduce((a,b)=>b.score<a.score?b:a,visiblePoints[0]);
 const avg=Math.round(visiblePoints.reduce((s,p)=>s+p.score,0)/Math.max(1,visiblePoints.length));
 const selected=visiblePoints.find(x=>x.id===selectedId)||current;
 const photos=tank.photos.filter(p=>{const t=new Date(p.timestamp).getTime();return t>=startMs&&t<=now;});
 const events=[...tank.timeline,...(tank.intelligenceEvents??[]).map(e=>({id:`core-${e.id}`,timestamp:e.timestamp,type:`core:${e.domain}:${e.verb}`,textAr:e.textAr,textEn:e.textEn}))]
  .filter(e=>{const t=new Date(e.timestamp).getTime();return t>=startMs&&t<=now;})
  .sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime())
  .filter((e,i,all)=>all.findIndex(x=>x.timestamp===e.timestamp&&x.textAr===e.textAr&&x.textEn===e.textEn)===i).slice(0,100);
 const selectedEvent=events.find(e=>e.id===selectedEventId);

 const nearestScore=(timestamp:string)=>{
  const t=new Date(timestamp).getTime();
  return visiblePoints.reduce((bestPoint,p)=>Math.abs(new Date(p.timestamp).getTime()-t)<Math.abs(new Date(bestPoint.timestamp).getTime()-t)?p:bestPoint,visiblePoints[0]).score;
 };
 const date=(ts:string,full=false)=>new Date(ts).toLocaleDateString(lang==="ar"?"ar-SY":"en-US",full?{year:"numeric",month:"short",day:"numeric"}:{month:"short",day:"numeric"});
 const rangeLabel=range==="all"?(lang==="ar"?"منذ إنشاء الحوض":"Since tank creation"):(lang==="ar"?`آخر ${range} يوم`:`Last ${range} days`);
 const filters:[RangeKey,string,string][]=[["7","7 أيام","7d"],["30","30 يوم","30d"],["90","90 يوم","90d"],["365","سنة","1y"],["all","الكل","All"]];
 const lessonAr=worst.recoveryEvent?`أسوأ هبوط كان إلى ${worst.score}%، وبعده ارتبط التعافي لاحقاً بـ: ${worst.recoveryEvent.textAr}`:`أسوأ نقطة كانت ${worst.score}% بتاريخ ${date(worst.timestamp,true)}. راجع الحدث والملاحظات حولها لتجنب تكرار نفس الظروف.`;
 const lessonEn=worst.recoveryEvent?`The lowest point was ${worst.score}%, followed later by recovery associated with: ${worst.recoveryEvent.textEn}`:`The lowest point was ${worst.score}% on ${date(worst.timestamp,true)}. Review the nearby event and notes to avoid repeating the same conditions.`;

 return <section className="tank-journey" dir={lang==="ar"?"rtl":"ltr"}>
  <div className="journey-head">
   <div><small className="eyebrow-mini">TANK JOURNEY</small><h3>{lang==="ar"?"مسار الحوض":"Tank Journey"}</h3><p>{lang==="ar"?"تاريخ الصحة، الصور، الأحداث، وأثر القرارات من أول يوم حتى اليوم.":"Health, photos, events and decision impact from day one until today."}</p></div>
   <div className="journey-range">{filters.map(([key,ar,en])=><button key={key} className={range===key?"active":""} onClick={()=>{setRange(key);setSelectedId("");setSelectedEventId("")}}>{lang==="ar"?ar:en}</button>)}</div>
  </div>

  <div className="journey-stats">
   <div className={`journey-stat ${scoreBand(current.score)}`}><small>{lang==="ar"?"الحالي":"Current"}</small><b>{current.score}%</b><span>{date(current.timestamp,true)}</span></div>
   <div className="journey-stat excellent"><small>★ {lang==="ar"?"أفضل قيمة":"Best"}</small><b>{best.score}%</b><span>{date(best.timestamp,true)}</span></div>
   <div className="journey-stat critical"><small>★ {lang==="ar"?"أسوأ قيمة":"Lowest"}</small><b>{worst.score}%</b><span>{date(worst.timestamp,true)}</span></div>
   <div className={`journey-stat ${scoreBand(avg)}`}><small>{lang==="ar"?"المتوسط":"Average"}</small><b>{avg}%</b><span>{rangeLabel}</span></div>
  </div>

  <div className="journey-chart-shell">
   <svg className="journey-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={lang==="ar"?"المخطط الزمني لصحة الحوض":"Tank health journey chart"}>
    <defs>
     <filter id="journeyGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
     <filter id="journeyStarGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    {[100,80,60,40,20,0].map(v=><g key={v}><line x1={L} x2={ACTUAL_RIGHT} y1={yAt(v)} y2={yAt(v)} className="journey-grid-line"/><text x={L-13} y={yAt(v)+4} textAnchor="end" className="journey-axis">{v}</text></g>)}
    <line x1={L} x2={ACTUAL_RIGHT} y1={yAt(avg)} y2={yAt(avg)} className="journey-average-line"/><text x={ACTUAL_RIGHT-5} y={Math.max(18,yAt(avg)-7)} textAnchor="end" className="journey-average-label">Ø {avg}%</text>

    {visiblePoints.slice(0,-1).map((p,i)=>{const n=visiblePoints[i+1],color=scoreColor((p.score+n.score)/2);return <g key={`${p.id}-${n.id}`}><line x1={xAt(p.timestamp)} y1={yAt(p.score)} x2={xAt(n.timestamp)} y2={yAt(n.score)} stroke={color} className="journey-segment-glow"/><line x1={xAt(p.timestamp)} y1={yAt(p.score)} x2={xAt(n.timestamp)} y2={yAt(n.score)} stroke={color} className="journey-segment"/></g>})}

    {visiblePoints.map((p,i)=>{const active=selected?.id===p.id;return <g key={p.id} className="journey-point" onClick={()=>setSelectedId(p.id)}><circle cx={xAt(p.timestamp)} cy={yAt(p.score)} r={active?8:4.8} fill={scoreColor(p.score)} className="journey-point-dot"/>{(i===0||i===visiblePoints.length-1||Math.abs(p.delta)>=7)&&<text x={xAt(p.timestamp)} y={H-12} textAnchor="middle" className="journey-date">{date(p.timestamp)}</text>}</g>})}

    <g className="journey-best" onClick={()=>setSelectedId(best.id)}><text x={xAt(best.timestamp)} y={yAt(best.score)-13} textAnchor="middle" className="journey-star best" filter="url(#journeyStarGlow)">★</text></g>
    <g className="journey-worst" onClick={()=>setSelectedId(worst.id)}><text x={xAt(worst.timestamp)} y={Math.min(H-B-8,yAt(worst.score)+25)} textAnchor="middle" className="journey-star worst" filter="url(#journeyStarGlow)">★</text></g>

    {photos.map(photo=>{const y=yAt(nearestScore(photo.timestamp));return <g key={photo.id} className="journey-photo-marker" onClick={()=>setSelectedPhoto(photo)}><circle cx={xAt(photo.timestamp)} cy={Math.max(T+12,y-31)} r={13}/><text x={xAt(photo.timestamp)} y={Math.max(T+16,y-27)} textAnchor="middle">📷</text></g>})}

    {events.slice(-30).map((event,i)=>{const x=xAt(event.timestamp),y=H-B+18+(i%2)*10;return <g key={event.id} className="journey-event-marker" onClick={()=>setSelectedEventId(event.id)}><rect x={x-4} y={y-4} width={8} height={8} transform={`rotate(45 ${x} ${y})`}/></g>})}

    {current&&forecast.projected7d!==null&&<g className="journey-forecast"><line x1={xAt(current.timestamp)} y1={yAt(current.score)} x2={FORECAST_X} y2={yAt(forecast.projected7d)} className="journey-forecast-line"/><circle cx={FORECAST_X} cy={yAt(forecast.projected7d)} r={7}/><text x={FORECAST_X} y={Math.max(18,yAt(forecast.projected7d)-14)} textAnchor="middle">{lang==="ar"?"توقع":"Forecast"} {forecast.projected7d}%</text></g>}
   </svg>
  </div>

  <div className="journey-legend"><span><i className="lg excellent"/>90–100</span><span><i className="lg stable"/>80–89</span><span><i className="lg watch"/>65–79</span><span><i className="lg stressed"/>50–64</span><span><i className="lg critical"/>0–49</span><span>📷 {lang==="ar"?"صورة موثقة":"Photo"}</span><span>◆ {lang==="ar"?"حدث":"Event"}</span></div>

  {selected&&<div className={`journey-detail ${scoreBand(selected.score)}`}><div className="journey-detail-score"><small>{date(selected.timestamp,true)}</small><b>{selected.score}%</b><span>{selected.delta>0?`+${selected.delta}`:selected.delta||"—"}</span></div><div><b>{lang==="ar"?selected.reasonAr:selected.reasonEn}</b><p>{lang==="ar"?`الكيمياء ${selected.chemistry}% • الصيانة ${selected.maintenance}%`:`Chemistry ${selected.chemistry}% • Maintenance ${selected.maintenance}%`}</p>{selected.event&&<p className="journey-event-copy">◆ {lang==="ar"?selected.event.textAr:selected.event.textEn}</p>}{selected.recoveryEvent&&selected.delta<0&&<p className="journey-recovery-copy">↗ {lang==="ar"?`التعافي لاحقاً ارتبط بـ: ${selected.recoveryEvent.textAr}`:`Later recovery was associated with: ${selected.recoveryEvent.textEn}`}</p>}<small>{selected.source==="estimated"?(lang==="ar"?"نقطة تاريخية تقديرية مبنية على البيانات المسجلة.":"Historical estimate based on recorded data."):(lang==="ar"?"نقطة حالة محفوظة من الحوض.":"Stored tank-state point.")}</small></div></div>}

  {selectedEvent&&<div className="journey-event-card"><div><small>{date(selectedEvent.timestamp,true)}</small><b>◆ {lang==="ar"?selectedEvent.textAr:selectedEvent.textEn}</b></div><button className="icon-btn" onClick={()=>setSelectedEventId("")}>×</button></div>}

  <div className="journey-learning"><div><small className="eyebrow-mini">LEARN FROM HISTORY</small><b>{lang==="ar"?"شو لازم نتعلم من المسار؟":"What should we learn from the journey?"}</b></div><p>{lang==="ar"?lessonAr:lessonEn}</p><span>{lang==="ar"?`${photos.length} صورة موثقة ضمن الفترة • ${events.length} حدث مسجل`:`${photos.length} photo(s) • ${events.length} logged event(s) in this period`}</span></div>

  {selectedPhoto&&<div className="journey-photo-backdrop" onClick={()=>setSelectedPhoto(null)}><div className="journey-photo-viewer" onClick={e=>e.stopPropagation()}><div className="module-head"><div><small>{date(selectedPhoto.timestamp,true)}</small><h3>{selectedPhoto.caption|| (lang==="ar"?"صورة من تاريخ الحوض":"Tank history photo")}</h3></div><button className="icon-btn" onClick={()=>setSelectedPhoto(null)}>×</button></div><img src={selectedPhoto.dataUrl} alt={selectedPhoto.caption||"Tank history"}/>{selectedPhoto.caption&&<p>{selectedPhoto.caption}</p>}</div></div>}

  <style jsx global>{`
   .tank-journey{display:grid;gap:12px}.journey-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px}.journey-head h3{margin:2px 0 4px;font-size:22px}.journey-head p{margin:0;opacity:.68;font-size:13px}.journey-range{display:flex;gap:5px;flex-wrap:wrap}.journey-range button{border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);color:inherit;border-radius:10px;padding:6px 9px;font-weight:800;cursor:pointer}.journey-range button.active{background:rgba(59,211,255,.14);border-color:rgba(59,211,255,.38);color:#86eaff}.journey-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.journey-stat{border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:11px;background:rgba(255,255,255,.025);box-shadow:inset 0 0 25px rgba(255,255,255,.015)}.journey-stat small,.journey-stat span{display:block}.journey-stat small{font-weight:850;opacity:.78}.journey-stat b{display:block;font-size:25px;margin:3px 0}.journey-stat span{font-size:11px;opacity:.58}.journey-stat.excellent{border-color:rgba(67,231,186,.38);box-shadow:inset 0 0 22px rgba(67,231,186,.08)}.journey-stat.stable{border-color:rgba(119,223,141,.28)}.journey-stat.watch{border-color:rgba(255,201,86,.34)}.journey-stat.stressed{border-color:rgba(255,129,85,.38)}.journey-stat.critical{border-color:rgba(255,82,100,.42);box-shadow:inset 0 0 22px rgba(255,82,100,.07)}.journey-chart-shell{overflow-x:auto;border:1px solid rgba(80,216,255,.1);border-radius:17px;background:radial-gradient(circle at 50% 0%,rgba(50,173,220,.08),transparent 52%),rgba(2,12,20,.44);padding:4px}.journey-svg{display:block;width:100%;min-width:760px;height:auto}.journey-grid-line{stroke:rgba(255,255,255,.055);stroke-width:1}.journey-axis,.journey-date{fill:rgba(220,242,250,.52);font-size:11px}.journey-average-line{stroke:rgba(255,255,255,.2);stroke-dasharray:4 8}.journey-average-label{fill:rgba(255,255,255,.6);font-size:11px;font-weight:800}.journey-segment-glow{stroke-width:11;opacity:.16;filter:url(#journeyGlow);stroke-linecap:round}.journey-segment{stroke-width:3.3;filter:url(#journeyGlow);stroke-linecap:round;animation:journeyPulse 3.2s ease-in-out infinite}.journey-point{cursor:pointer}.journey-point-dot{stroke:#06131d;stroke-width:2;filter:url(#journeyGlow)}.journey-star{font-size:24px;cursor:pointer}.journey-star.best{fill:#52f0b5}.journey-star.worst{fill:#ff5367}.journey-photo-marker{cursor:pointer}.journey-photo-marker circle{fill:rgba(6,22,33,.94);stroke:#66dcff;stroke-width:1.5;filter:url(#journeyGlow)}.journey-photo-marker text{font-size:14px}.journey-event-marker{cursor:pointer}.journey-event-marker rect{fill:#8edff3;opacity:.7}.journey-forecast-line{stroke:#77dfff;stroke-width:2.4;stroke-dasharray:7 8;filter:url(#journeyGlow)}.journey-forecast circle{fill:#77dfff;filter:url(#journeyGlow)}.journey-forecast text{fill:#9de9ff;font-size:11px;font-weight:900}.journey-legend{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;opacity:.7}.journey-legend span{display:flex;align-items:center;gap:5px}.journey-legend .lg{width:9px;height:9px;border-radius:50%;display:inline-block}.lg.excellent{background:#43e7ba}.lg.stable{background:#77df8d}.lg.watch{background:#ffc956}.lg.stressed{background:#ff8155}.lg.critical{background:#ff5264}.journey-detail{display:grid;grid-template-columns:120px 1fr;gap:13px;border:1px solid rgba(255,255,255,.08);border-radius:15px;padding:12px;background:rgba(255,255,255,.025)}.journey-detail.excellent{border-color:rgba(67,231,186,.3)}.journey-detail.watch{border-color:rgba(255,201,86,.3)}.journey-detail.stressed,.journey-detail.critical{border-color:rgba(255,82,100,.32)}.journey-detail-score{text-align:center;border-right:1px solid rgba(255,255,255,.07)}[dir=rtl] .journey-detail-score{border-right:0;border-left:1px solid rgba(255,255,255,.07)}.journey-detail-score small,.journey-detail-score span{display:block}.journey-detail-score b{display:block;font-size:31px;margin:4px 0}.journey-detail p{margin:5px 0;font-size:12px}.journey-detail small{opacity:.58}.journey-event-copy{color:#9ee5f8}.journey-recovery-copy{color:#75e6b0}.journey-event-card{display:flex;justify-content:space-between;align-items:center;gap:10px;border:1px solid rgba(126,225,255,.17);border-radius:13px;padding:10px 12px;background:rgba(56,184,224,.055)}.journey-event-card small,.journey-event-card b{display:block}.journey-learning{display:grid;grid-template-columns:minmax(160px,.42fr) 1fr auto;align-items:center;gap:12px;padding:12px 14px;border-radius:15px;border:1px solid rgba(76,225,157,.14);background:linear-gradient(90deg,rgba(76,225,157,.045),rgba(75,190,255,.035))}.journey-learning b{display:block}.journey-learning p{margin:0;font-size:12px;line-height:1.65}.journey-learning>span{font-size:11px;opacity:.58;white-space:nowrap}.journey-photo-backdrop{position:fixed;inset:0;z-index:3000;background:rgba(0,6,12,.82);display:grid;place-items:center;padding:18px}.journey-photo-viewer{width:min(760px,96vw);max-height:90vh;overflow:auto;border:1px solid rgba(104,222,255,.24);border-radius:18px;background:#07141d;padding:14px;box-shadow:0 30px 80px rgba(0,0,0,.48)}.journey-photo-viewer img{width:100%;max-height:66vh;object-fit:contain;border-radius:13px;background:#02090e}.journey-photo-viewer p{margin:10px 2px 2px}.journey-photo-viewer h3{margin:3px 0}.journey-photo-viewer small{opacity:.62}@keyframes journeyPulse{0%,100%{opacity:.82}50%{opacity:1}}
   @media(max-width:760px){.journey-head{align-items:flex-start;flex-direction:column}.journey-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.journey-learning{grid-template-columns:1fr}.journey-learning>span{white-space:normal}.journey-detail{grid-template-columns:88px 1fr}.journey-stat b{font-size:22px}}
  `}</style>
 </section>;
}
