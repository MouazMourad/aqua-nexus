"use client";

import { useMemo,useState } from "react";
import type { Tank } from "@/domain/types";
import { healthTimeline,tankForecast } from "@/domain/tankIntelligence";
import { useAquaStore } from "@/store/useAquaStore";

const W=1000,H=300,PX=58,PY=32;
const clamp=(n:number)=>Math.max(0,Math.min(100,n));

function pointColor(score:number){
  if(score<50)return "#ff5f6d";
  if(score<65)return "#ff8a5b";
  if(score<80)return "#ffc85a";
  if(score<90)return "#73d889";
  return "#48e0b5";
}

export function HealthTimelineChart({tank}:{tank:Tank}){
  const lang=useAquaStore(s=>s.language);
  const points=useMemo(()=>healthTimeline(tank),[tank]);
  const forecast=useMemo(()=>tankForecast(tank),[tank]);
  const significant=points.filter(x=>Math.abs(x.delta)>=5);
  const defaultId=(significant[significant.length-1]||points[points.length-1])?.id||"";
  const [selectedId,setSelectedId]=useState(defaultId);
  const selected=points.find(x=>x.id===selectedId)||points[points.length-1];
  const n=Math.max(1,points.length);
  const slot=(W-PX*2)/Math.max(1,n);
  const xAt=(i:number)=>PX+(n===1?0:i*slot);
  const forecastX=PX+n*slot;
  const yAt=(score:number)=>PY+(100-clamp(score))*(H-PY*2)/100;
  const polyline=points.map((p,i)=>`${xAt(i)},${yAt(p.score)}`).join(" ");
  const last=points[points.length-1];
  const date=(ts:string)=>new Date(ts).toLocaleDateString(lang==="ar"?"ar-SY":"en-US",{month:"short",day:"numeric"});

  if(!points.length)return <section className="card panel health-timeline-card">
    <div className="module-head"><h3>{lang==="ar"?"تاريخ حالة الحوض":"Tank state history"}</h3></div>
    <div className="inline-alert info">{lang==="ar"?"ابدأ بتسجيل قياسات الكيمياء والصيانة ليبني Aqua Nexus خط حالة الحوض عبر الزمن.":"Start logging chemistry and maintenance so Aqua Nexus can build the tank-state timeline."}</div>
  </section>;

  return <section className="card panel health-timeline-card">
    <div className="module-head health-chart-head">
      <div>
        <h3>{lang==="ar"?"مخطط حالة الحوض عبر الزمن":"Tank state over time"}</h3>
        <p className="note">{lang==="ar"?"اضغط على أي نقطة لتعرف ماذا حدث ولماذا تحركت الحالة.":"Tap any point to see what happened and why the state moved."}</p>
      </div>
      <div className={`forecast-chip ${forecast.direction}`}>
        <small>{lang==="ar"?"توقع 7 أيام":"7-day forecast"}</small>
        <b>{forecast.projected7d}%</b>
      </div>
    </div>

    <div className="health-chart-scroll">
      <svg className="health-history-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={lang==="ar"?"مخطط تاريخ صحة الحوض":"Tank health history chart"}>
        {[100,80,60,40,20,0].map(v=><g key={v}>
          <line x1={PX} x2={W-PX} y1={yAt(v)} y2={yAt(v)} className="health-grid-line"/>
          <text x={PX-12} y={yAt(v)+4} textAnchor="end" className="health-axis-label">{v}</text>
        </g>)}
        <polyline points={polyline} className="health-history-line"/>
        {last&&<line x1={xAt(points.length-1)} y1={yAt(last.score)} x2={forecastX} y2={yAt(forecast.projected7d)} className="health-forecast-line"/>}
        {points.map((p,i)=>{
          const big=Math.abs(p.delta)>=5;
          const active=selected?.id===p.id;
          return <g key={p.id} className="health-point-group" onClick={()=>setSelectedId(p.id)}>
            {big&&<circle cx={xAt(i)} cy={yAt(p.score)} r={13} className={`health-event-halo ${p.delta<0?"down":"up"}`}/>}            
            <circle cx={xAt(i)} cy={yAt(p.score)} r={active?8:big?6:4.5} fill={pointColor(p.score)} className="health-history-point"/>
            {(i===0||i===points.length-1||big)&&<text x={xAt(i)} y={H-7} textAnchor="middle" className="health-date-label">{date(p.timestamp)}</text>}
          </g>;
        })}
        <g className="forecast-point">
          <circle cx={forecastX} cy={yAt(forecast.projected7d)} r={7} className="health-forecast-point"/>
          <text x={forecastX} y={Math.max(16,yAt(forecast.projected7d)-13)} textAnchor="middle" className="health-forecast-label">{lang==="ar"?"توقع":"Forecast"} {forecast.projected7d}%</text>
        </g>
      </svg>
    </div>

    {selected&&<div className="health-event-detail">
      <div className="health-event-score">
        <small>{date(selected.timestamp)}</small>
        <b>{selected.score}%</b>
        <span className={selected.delta>0?"delta-up":selected.delta<0?"delta-down":""}>{selected.delta>0?`+${selected.delta}`:selected.delta||"—"}</span>
      </div>
      <div className="health-event-copy">
        <b>{lang==="ar"?selected.reasonAr:selected.reasonEn}</b>
        <p>{lang==="ar"?`الكيمياء ${selected.chemistry}% • الصيانة ${selected.maintenance}%`:`Chemistry ${selected.chemistry}% • Maintenance ${selected.maintenance}%`}</p>
        {selected.event&&<p className="event-link-note">◆ {lang==="ar"?selected.event.textAr:selected.event.textEn}</p>}
        {selected.delta<=-5&&selected.recoveryEvent&&<p className="recovery-note">↗ {lang==="ar"?`الإجراء المرتبط بالتعافي لاحقاً: ${selected.recoveryEvent.textAr}`:`Later recovery was associated with: ${selected.recoveryEvent.textEn}`}</p>}
        {selected.source==="estimated"&&<small className="note">{lang==="ar"?"هذه نقطة تاريخية تقديرية مبنية على قراءة الكيمياء؛ النقاط الجديدة تُحفظ كلقطات حالة فعلية.":"This historical point is estimated from the chemistry record; new points are stored as real state snapshots."}</small>}
      </div>
    </div>}
  </section>;
}
