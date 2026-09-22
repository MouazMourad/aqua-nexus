"use client";

import { useEffect,useMemo,useState } from "react";
import { measuredChemistryReadings } from "@/domain/chemistryDataQuality";
import { createPortal } from "react-dom";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";
import { bioload,chemistryAgeDays,chemistryHealth,maintenanceHealth,parameterScore,tankHealthTrend } from "@/domain/health";
import { systemHealth } from "@/domain/systemHealth";
import { tankStateView } from "@/domain/tankIntelligence";
import { chemistryGuidance } from "@/domain/chemistryGuidance";
import { useAquaStore } from "@/store/useAquaStore";
import { today } from "@/lib/appUtils";

type HealthTone="excellent"|"stable"|"watch"|"stressed"|"critical";
type FocusKind="chemistry"|"maintenance"|"equipment"|"bioload";
type ActionItem={ar:string;en:string;focus?:FocusKind;urgent?:boolean};
type PortalTargets={hero:HTMLElement|null;chemistryCopy:HTMLElement|null};

function toneFor(score:number):HealthTone{
  if(score>=90)return "excellent";
  if(score>=80)return "stable";
  if(score>=65)return "watch";
  if(score>=50)return "stressed";
  return "critical";
}

function compactNumber(value:number){
  const abs=Math.abs(value);
  const digits=abs<0.1?3:abs<10?2:1;
  return Number(value.toFixed(digits)).toString();
}

function validTime(value?:string){
  if(!value)return 0;
  const time=new Date(value).getTime();
  return Number.isFinite(time)?time:0;
}

/**
 * Progressive health layer for the dashboard. It keeps the existing dashboard
 * layout intact while binding Tank Health, Chemistry and Maintenance to live
 * state colors and adding concise decision support inside the hero.
 */
export function DashboardHealthPulse(){
  const language=useAquaStore(s=>s.language);
  const tanks=useAquaStore(s=>s.tanks);
  const selectedTankId=useAquaStore(s=>s.selectedTankId);
  const tank=tanks.find(t=>t.id===selectedTankId)??tanks[0];
  const [detailsOpen,setDetailsOpen]=useState(false);
  const [breakdownOpen,setBreakdownOpen]=useState(false);
  const [targets,setTargets]=useState<PortalTargets>({hero:null,chemistryCopy:null});

  const system=tank?systemHealth(tank):null;
  const health=system?.score??0;
  const chemistry=tank?chemistryHealth(tank):0;
  const maintenance=tank?maintenanceHealth(tank):0;
  const trend=tank?tankHealthTrend(tank):"stable";
  const state=tank?tankStateView(tank):null;
  const criticalForced=state?.band==="critical";
  const showDetails=Boolean(criticalForced||detailsOpen);

  useEffect(()=>{
    setBreakdownOpen(false);
    setDetailsOpen(Boolean(state?.band==="critical"));
  },[tank?.id]);

  useEffect(()=>{
    if(state?.band==="critical")setDetailsOpen(true);
  },[state?.band]);

  const intelligence=useMemo(()=>{
    if(!tank||!state)return null;

    const catalog=CHEMISTRY_CATALOG[tank.type] as Record<string,{label:string;ideal:readonly [number,number];safe:readonly [number,number];weight:number}>;
    const latest=tank.chemistry[0];
    const previous=tank.chemistry[1];
    const age=chemistryAgeDays(tank);
    const bio=bioload(tank);
    const todayKey=today();
    const overdue=tank.maintenance.filter(item=>!item.done&&item.nextDue&&item.nextDue<=todayKey);
    const equipmentWarnings=tank.equipment.filter(item=>item.status==="warning"||item.status==="service");
    const livestockWarnings=tank.livestock.filter(item=>item.health==="watch"||item.health==="treatment");
    const activeAcclimation=(tank.acclimationSessions??[]).some(session=>session.status!=="completed");
    const chemistryAdvice=chemistryGuidance(tank);

    const chemistryIssues=latest?Object.entries(catalog).flatMap(([key,meta])=>{
      const value=latest.values[key];
      if(typeof value!=="number")return [];
      const score=parameterScore(value,meta);
      if(score===null||score>=100)return [];
      return [{key,label:meta.label,value,score,weight:meta.weight,ideal:meta.ideal}];
    }).sort((a,b)=>a.score-b.score||b.weight-a.weight):[];

    const chemistryTrends=latest&&previous?Object.entries(catalog).flatMap(([key,meta])=>{
      const current=latest.values[key],before=previous.values[key];
      if(typeof current!=="number"||typeof before!=="number")return [];
      const currentScore=parameterScore(current,meta)??0;
      const previousScore=parameterScore(before,meta)??currentScore;
      return [{key,current,delta:current-before,scoreDelta:currentScore-previousScore,weight:meta.weight}];
    }).sort((a,b)=>Math.abs(b.scoreDelta)-Math.abs(a.scoreDelta)||b.weight-a.weight).slice(0,3):[];

    const latestActivity=Math.max(
      validTime(latest?.timestamp),
      ...tank.maintenance.map(item=>validTime(item.lastDone)),
      ...tank.timeline.map(item=>validTime(item.timestamp)),
      ...tank.feeding.map(item=>validTime(item.timestamp)),
      ...tank.dosing.map(item=>validTime(item.timestamp)),
      ...tank.waterChanges.map(item=>validTime(item.timestamp)),
      ...tank.photos.map(item=>validTime(item.timestamp))
    );

    const actions:ActionItem[]=[];
    const criticalEquipment=equipmentWarnings.find(item=>item.kind==="returnPump"||item.kind==="heater"||item.kind==="overflow");

    if(state.band==="critical"){
      if(criticalEquipment)actions.push({ar:`تدخل فوري: افحص ${criticalEquipment.name} واستمرارية دوران الماء/الحرارة قبل أي خطوة ثانية.`,en:`Immediate action: check ${criticalEquipment.name} and water circulation/temperature before anything else.`,focus:"equipment",urgent:true});
      else if(chemistryAdvice.dataIssues.length){
        const issue=chemistryAdvice.dataIssues[0];
        actions.push({ar:`تدخل فوري: ${issue.actionAr}`,en:`Immediate action: ${issue.actionEn}`,focus:"chemistry",urgent:true});
      }
      else if(!latest||chemistryIssues.length)actions.push({ar:"تدخل فوري: أعد قياس القيم غير الطبيعية الآن وتأكد من النتيجة قبل أي تصحيح كبير أو جرعة إضافية.",en:"Immediate action: retest abnormal values now and confirm them before any large correction or extra dosing.",focus:"chemistry",urgent:true});
    }

    if(!latest)actions.push({ar:"سجّل فحص كيمياء كامل الآن؛ ما في قراءة حديثة يمكن الاعتماد عليها.",en:"Log a complete chemistry test now; there is no current reading to rely on.",focus:"chemistry",urgent:state.band==="critical"});
    else if(age>7)actions.push({ar:`أعد فحص الكيمياء اليوم؛ آخر قراءة عمرها ${Math.floor(age)} يوم.`,en:`Retest chemistry todayKey; the latest reading is ${Math.floor(age)} days old.`,focus:"chemistry",urgent:state.band==="critical"});

    if(chemistryAdvice.dataIssues.length){
      const issue=chemistryAdvice.dataIssues[0];
      if(!actions.some(action=>action.ar.includes(issue.actionAr))){
        actions.push({ar:issue.actionAr,en:issue.actionEn,focus:"chemistry",urgent:true});
      }
    }

    chemistryAdvice.problems
      .filter(issue=>!issue.suspectedFormat)
      .slice(0,2)
      .forEach(issue=>actions.push({
        ar:`${issue.titleAr}: ${issue.actionAr}`,
        en:`${issue.titleEn}: ${issue.actionEn}`,
        focus:"chemistry",
        urgent:state.band==="critical"&&issue.level==="danger"
      }));

    if(overdue.length)actions.push({ar:`أنجز مهمة الصيانة الأقرب: ${overdue[0].title} ثم حدّث سجلها.`,en:`Complete the nearest maintenance task: ${overdue[0].titleEn||overdue[0].title}, then update its log.`,focus:"maintenance"});
    if(equipmentWarnings.length&&!criticalEquipment)actions.push({ar:`افحص ${equipmentWarnings[0].name} لأنه مسجّل كجهاز يحتاج انتباهاً/صيانة.`,en:`Check ${equipmentWarnings[0].name}; it is marked for attention/service.`,focus:"equipment"});
    if(system?.equipmentAudit.issues.length){const x=system.equipmentAudit.issues[0];actions.push({ar:x.recommendationAr||x.ar,en:x.recommendationEn||x.en,focus:"equipment",urgent:x.level==="danger"});}
    if(system?.compatibilityAudit.issues.length){const x=system.compatibilityAudit.issues[0];actions.push({ar:`راجع تعارض الكائنات: ${x.ar}`,en:`Review livestock compatibility: ${x.en}`,focus:"bioload",urgent:x.level==="danger"});}
    if(bio.status==="high"||bio.status==="danger")actions.push({ar:"أوقف إضافة كائنات جديدة مؤقتاً وراجع الحمل الحيوي وكفاءة الترشيح.",en:"Pause new livestock additions and review bioload and filtration capacity.",focus:"bioload"});
    if(livestockWarnings.length)actions.push({ar:`راقب ${livestockWarnings[0].name} بشكل قريب وسجّل أي تغير قبل تعديل أكثر من عامل بالحوض.`,en:`Watch ${livestockWarnings[0].nameEn||livestockWarnings[0].name} closely and log any change before adjusting multiple tank factors.`,focus:"bioload"});
    if(activeAcclimation)actions.push({ar:"هناك أقلمة نشطة؛ تجنّب تغييرات كبيرة بالحوض إلى أن تكتمل وتستقر الكائنات.",en:"An acclimation session is active; avoid major tank changes until it is complete and livestock settles."});

    if(!actions.length)actions.push({ar:state.band==="excellent"?"ما في إجراء تصحيحي الآن؛ حافظ على نفس الروتين ولا تغيّر شيئاً لمجرد رفع الرقم.":"الحالة مستقرة؛ حافظ على الروتين الحالي وراقب القراءة القادمة بدل إجراء تعديل غير ضروري.",en:state.band==="excellent"?"No corrective action is needed now; keep the routine and do not change things just to raise the score.":"The tank is stable; keep the current routine and watch the next reading instead of making an unnecessary adjustment."});

    const attentionCount=state.drivers.filter(driver=>driver.level==="warn"||driver.level==="danger").length;
    const primaryReason=state.drivers.find(driver=>driver.level==="danger"||driver.level==="warn")??state.drivers[0];
    return {age,chemistryIssues,chemistryAdvice,chemistryTrends,latestActivity,actions:actions.slice(0,4),attentionCount,primaryReason};
  },[tank,state]);

  useEffect(()=>{
    if(!tank||!state||typeof document==="undefined")return;

    const healthTone=toneFor(health);
    const chemistryTone=toneFor(chemistry);
    const maintenanceTone=toneFor(maintenance);
    const stateTone=toneFor(state.score);
    let boundHealthScore:HTMLElement|null=null;

    const toggleDetails=()=>{
      if(state.band==="critical"){setDetailsOpen(true);return;}
      setDetailsOpen(value=>!value);
    };
    const onHealthKey=(event:KeyboardEvent)=>{
      if(event.key!=="Enter"&&event.key!==" ")return;
      event.preventDefault();
      toggleDetails();
    };
    const bindHealthTrigger=(element:HTMLElement|null)=>{
      if(boundHealthScore===element)return;
      if(boundHealthScore){
        boundHealthScore.removeEventListener("click",toggleDetails);
        boundHealthScore.removeEventListener("keydown",onHealthKey);
        boundHealthScore.classList.remove("aqua-health-trigger");
        boundHealthScore.removeAttribute("role");
        boundHealthScore.removeAttribute("tabindex");
        boundHealthScore.removeAttribute("aria-expanded");
        boundHealthScore.removeAttribute("aria-controls");
        boundHealthScore.removeAttribute("data-aqua-health-hint");
        boundHealthScore.removeAttribute("data-aqua-health-open");
      }
      boundHealthScore=element;
      if(!element)return;
      element.classList.add("aqua-health-trigger");
      element.setAttribute("role","button");
      element.setAttribute("tabindex","0");
      element.setAttribute("aria-controls","aqua-now-panel");
      element.addEventListener("click",toggleDetails);
      element.addEventListener("keydown",onHealthKey);
    };

    const applyTone=(element:Element|null,tone:HealthTone,score:number)=>{
      if(!(element instanceof HTMLElement))return;
      element.dataset.aquaHealthTone=tone;
      element.dataset.aquaHealthScore=String(score);
    };

    const findModule=(icon:string)=>Array.from(document.querySelectorAll<HTMLElement>(".pd-module")).find(card=>card.querySelector<HTMLElement>(".pd-module-icon")?.textContent?.trim()===icon)??null;

    const sync=()=>{
      const hero=document.querySelector<HTMLElement>(".pd-hero");
      const healthScore=document.querySelector<HTMLElement>(".pd-health-score");
      const chemistryCard=findModule("⚗");
      const maintenanceCard=findModule("✓");

      applyTone(hero,stateTone,state.score);
      document.querySelectorAll(".pd-health-score,.system-health-card").forEach(el=>applyTone(el,healthTone,health));
      applyTone(chemistryCard,chemistryTone,chemistry);
      applyTone(maintenanceCard,maintenanceTone,maintenance);

      bindHealthTrigger(healthScore);
      if(healthScore){
        healthScore.setAttribute("aria-expanded",String(showDetails));
        healthScore.dataset.aquaHealthOpen=showDetails?"1":"0";
        healthScore.dataset.aquaHealthHint=criticalForced
          ?(language==="ar"?"تفاصيل حرجة ظاهرة":"Critical details shown")
          :(language==="ar"?(showDetails?"إخفاء التفاصيل":"اضغط لعرض التفاصيل"):(showDetails?"Hide details":"Tap for details"));
      }

      const chemistryCopy=chemistryCard?.querySelector<HTMLElement>(".pd-module-copy")??null;
      setTargets(previous=>previous.hero===hero&&previous.chemistryCopy===chemistryCopy?previous:{hero,chemistryCopy});
    };

    sync();
    const root=document.querySelector(".progressive-dashboard")??document.body;
    const observer=new MutationObserver(sync);
    observer.observe(root,{childList:true,subtree:true});
    return()=>{
      observer.disconnect();
      if(boundHealthScore){
        boundHealthScore.removeEventListener("click",toggleDetails);
        boundHealthScore.removeEventListener("keydown",onHealthKey);
      }
    };
  },[tank?.id,health,chemistry,maintenance,state?.score,state?.band,showDetails,criticalForced,language]);

  if(!tank||!state||!intelligence)return null;

  const stateLabel:Record<HealthTone,{ar:string;en:string}>={excellent:{ar:"ممتاز",en:"Excellent"},stable:{ar:"مستقر",en:"Stable"},watch:{ar:"يحتاج متابعة",en:"Needs attention"},stressed:{ar:"متوتر",en:"Stressed"},critical:{ar:"حرج",en:"Critical"}};
  const trendLabel=trend==="improving"?(language==="ar"?"المسار يتحسن":"Improving"):(trend==="declining"?(language==="ar"?"المسار يتراجع":"Declining"):(language==="ar"?"المسار ثابت":"Stable trend"));
  const currentTone=toneFor(state.score);

  const lastUpdate=(()=>{
    if(!intelligence.latestActivity)return language==="ar"?"لا يوجد تحديث مسجل":"No logged update";
    const date=new Date(intelligence.latestActivity);
    const diffMinutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));
    const relative=diffMinutes<1?(language==="ar"?"الآن":"now"):diffMinutes<60?(language==="ar"?`منذ ${diffMinutes} دقيقة`:`${diffMinutes}m ago`):diffMinutes<1440?(language==="ar"?`منذ ${Math.floor(diffMinutes/60)} ساعة`:`${Math.floor(diffMinutes/60)}h ago`):(language==="ar"?`منذ ${Math.floor(diffMinutes/1440)} يوم`:`${Math.floor(diffMinutes/1440)}d ago`);
    const absolute=date.toLocaleString(language==="ar"?"ar-SY":"en-US",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
    return `${relative} • ${absolute}`;
  })();

  const focusModule=(kind?:FocusKind)=>{
    if(!kind||typeof document==="undefined")return;
    const icons:Record<FocusKind,string>={chemistry:"⚗",maintenance:"✓",equipment:"⚙",bioload:"◌"};
    const card=Array.from(document.querySelectorAll<HTMLElement>(".pd-module")).find(item=>item.querySelector<HTMLElement>(".pd-module-icon")?.textContent?.trim()===icons[kind]);
    if(!card)return;
    card.scrollIntoView({behavior:"smooth",block:"center"});
    if(!card.classList.contains("is-open"))card.querySelector<HTMLButtonElement>(".pd-module-button")?.click();
  };

  const heroPortal=targets.hero&&showDetails?createPortal(
    <section id="aqua-now-panel" className={`aqua-now-panel ${criticalForced?"is-forced-critical":""}`} aria-label={language==="ar"?"حالة الحوض وما يجب فعله الآن":"Tank status and what to do now"}>
      <div className="aqua-now-head"><div className="aqua-now-title"><span className="aqua-now-status-dot" aria-hidden="true"/><div><small>{language==="ar"?"حالة اليوم":"TODAY"}</small><b>{language==="ar"?stateLabel[currentTone].ar:stateLabel[currentTone].en} • {state.score}%</b></div></div><span className={`aqua-now-signal ${intelligence.attentionCount?"has-alert":"clear"}`}>{intelligence.attentionCount?`⚠ ${intelligence.attentionCount} ${language==="ar"?"نقطة متابعة":"to review"}`:`✓ ${language==="ar"?"لا تنبيه فعّال":"No active alert"}`}</span></div>
      <div className="aqua-daily-status"><b>{language==="ar"?"ملخص اليوم":"Daily status"}</b><span>{language==="ar"?state.ar:state.en} • {trendLabel}</span></div>
      {intelligence.primaryReason&&<div className="aqua-health-reason"><small>{language==="ar"?"السبب الأهم":"Main driver"}</small><span>{language==="ar"?intelligence.primaryReason.ar:intelligence.primaryReason.en}</span></div>}
      <div className="aqua-now-actions-wrap"><div className="aqua-now-section-title"><b>{language==="ar"?"شو أعمل الآن؟":"What should I do now?"}</b>{currentTone==="critical"&&<span className="aqua-urgent-label">{language==="ar"?"تدخل فوري":"Immediate"}</span>}</div><div className="aqua-now-actions">{intelligence.actions.map((action,index)=><button key={`${action.ar}-${index}`} type="button" className={`aqua-action ${action.urgent?"urgent":""} ${action.focus?"clickable":""}`} onClick={()=>focusModule(action.focus)} disabled={!action.focus}><span>{action.urgent?"!":index+1}</span><b>{language==="ar"?action.ar:action.en}</b></button>)}</div></div>
      <div className="aqua-now-meta"><span>◷ {language==="ar"?"آخر تحديث":"Last updated"}: <b>{lastUpdate}</b></span><button type="button" className="aqua-breakdown-toggle" aria-expanded={breakdownOpen} onClick={()=>setBreakdownOpen(value=>!value)}>{language==="ar"?"تفاصيل الصحة":"Health breakdown"} {breakdownOpen?"−":"+"}</button></div>
      {breakdownOpen&&system&&<div className="aqua-health-breakdown">{system.components.map(x=><div key={x.key}><span><small>{language==="ar"?x.ar:x.en} • {Math.round(x.weight*100)}%</small><b>{x.score}%</b></span><i><u style={{width:`${x.score}%`}}/></i></div>)}<p>{language==="ar"?"الصحة العامة صارت تقييم نظام كامل: الكيمياء، الصيانة، الحمل الحيوي، كفاية التجهيزات، توافق الكائنات وحالة الكائنات. أي خلل مهم بأحدها ينعكس على النتيجة وعلى توصيات Local Best AI.":"Overall health now evaluates the aquarium as one system: chemistry, maintenance, bioload, equipment adequacy, livestock compatibility and livestock condition. Important issues in any component affect the score and Local Best AI recommendations."}</p></div>}
    </section>,targets.hero):null;

  const chemistryPortal=targets.chemistryCopy?createPortal(<span className="aqua-chem-trends" aria-label={language==="ar"?"اتجاه آخر قياسين":"Trend across the latest two readings"}>{intelligence.chemistryTrends.length?intelligence.chemistryTrends.map(item=>{const direction=Math.abs(item.delta)<0.0001?"flat":item.delta>0?"up":"down";const quality=item.scoreDelta>4?"better":item.scoreDelta<-4?"worse":"flat";return <span key={item.key} className={`aqua-chem-trend ${quality}`} title={`${item.key}: ${compactNumber(item.current)} (${item.delta>=0?"+":""}${compactNumber(item.delta)})`}><small>{item.key}</small><b>{direction==="up"?"↗":direction==="down"?"↘":"→"} {item.delta===0?"0":`${item.delta>0?"+":""}${compactNumber(item.delta)}`}</b></span>}):<span className="aqua-chem-trend flat"><small>{language==="ar"?"الترند":"Trend"}</small><b>{language==="ar"?"بعد القراءة الثانية":"after 2nd reading"}</b></span>}</span>,targets.chemistryCopy):null;

  return <>{heroPortal}{chemistryPortal}<style jsx global>{`
      [data-aqua-health-tone="excellent"]{--health-rgb:72,224,181;--health-color:#48e0b5;--health-pulse-speed:3.7s}
      [data-aqua-health-tone="stable"]{--health-rgb:115,216,137;--health-color:#73d889;--health-pulse-speed:3.5s}
      [data-aqua-health-tone="watch"]{--health-rgb:255,200,90;--health-color:#ffc85a;--health-pulse-speed:3.1s}
      [data-aqua-health-tone="stressed"]{--health-rgb:255,138,91;--health-color:#ff8a5b;--health-pulse-speed:2.7s}
      [data-aqua-health-tone="critical"]{--health-rgb:255,95,109;--health-color:#ff5f6d;--health-pulse-speed:2.35s}
      .pd-hero[data-aqua-health-tone]{display:flex;flex-direction:column;border-color:rgba(var(--health-rgb),.28)!important;background:radial-gradient(circle at 88% 0%,rgba(var(--health-rgb),.16),transparent 34%),linear-gradient(135deg,rgba(13,44,61,.94),rgba(4,20,31,.97))!important;box-shadow:inset 0 1px 0 rgba(var(--health-rgb),.08),0 16px 42px rgba(var(--health-rgb),.055)}
      .pd-hero[data-aqua-health-tone] .pd-hero-main{order:1}.pd-hero[data-aqua-health-tone] .aqua-now-panel{order:2}.pd-hero[data-aqua-health-tone] .pd-hero-footer{order:3;justify-content:flex-end!important}.pd-hero[data-aqua-health-tone] .pd-hero-footer>span{display:none!important}
      .pd-health-score[data-aqua-health-tone],.pd-module[data-aqua-health-tone]{position:relative;isolation:isolate;border-color:rgba(var(--health-rgb),.40)!important;background:radial-gradient(circle at 82% 14%,rgba(var(--health-rgb),.19),transparent 36%),linear-gradient(145deg,rgba(var(--health-rgb),.105),rgba(255,255,255,.024) 54%,rgba(3,17,26,.10))!important;animation:healthHeartbeat var(--health-pulse-speed) ease-in-out infinite}
      .pd-health-score[data-aqua-health-tone]::after,.pd-module[data-aqua-health-tone]::after{content:"";position:absolute;z-index:-1;width:118px;height:118px;inset-inline-end:-38px;top:-42px;border-radius:50%;background:rgba(var(--health-rgb),.17);filter:blur(28px);pointer-events:none}
      .pd-health-score[data-aqua-health-tone] b,.pd-module[data-aqua-health-tone] .pd-module-copy>b{color:var(--health-color);text-shadow:0 0 18px rgba(var(--health-rgb),.16)}
      .pd-module[data-aqua-health-tone] .pd-module-icon{color:var(--health-color)!important;background:rgba(var(--health-rgb),.105)!important;border-color:rgba(var(--health-rgb),.25)!important;box-shadow:0 0 18px rgba(var(--health-rgb),.10)}.pd-module[data-aqua-health-tone] .pd-module-state{color:var(--health-color)!important;background:rgba(var(--health-rgb),.085)!important}
      .pd-health-score.aqua-health-trigger{cursor:pointer;transition:border-color .18s ease,transform .18s ease,box-shadow .18s ease;padding-bottom:29px!important}.pd-health-score.aqua-health-trigger:hover{border-color:rgba(var(--health-rgb),.62)!important;box-shadow:0 0 0 1px rgba(var(--health-rgb),.10),0 8px 24px rgba(var(--health-rgb),.09)}.pd-health-score.aqua-health-trigger:active{transform:scale(.985)}.pd-health-score.aqua-health-trigger:focus-visible{outline:2px solid rgba(var(--health-rgb),.7);outline-offset:3px}.pd-health-score.aqua-health-trigger::before{content:attr(data-aqua-health-hint) "  ⌄";position:absolute;z-index:2;left:8px;right:8px;bottom:7px;font-size:9px;line-height:1.2;font-weight:850;letter-spacing:0;color:var(--health-color);opacity:.88;pointer-events:none;text-align:center}.pd-health-score.aqua-health-trigger[data-aqua-health-open="1"]::before{content:attr(data-aqua-health-hint) "  ⌃"}.pd-health-score.aqua-health-trigger[data-aqua-health-tone="critical"]::before{font-weight:950;opacity:1}
      .aqua-now-panel{margin-top:14px;padding:13px 14px;border:1px solid rgba(var(--health-rgb),.24);border-radius:16px;background:linear-gradient(145deg,rgba(var(--health-rgb),.075),rgba(255,255,255,.025));box-shadow:inset 0 1px 0 rgba(255,255,255,.035);display:grid;gap:10px;animation:aquaHealthReveal .18s ease-out}.aqua-now-panel.is-forced-critical{border-color:rgba(var(--health-rgb),.48);box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 24px rgba(var(--health-rgb),.08)}
      @keyframes aquaHealthReveal{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
      .aqua-now-head,.aqua-now-title,.aqua-now-meta,.aqua-now-section-title{display:flex;align-items:center;gap:9px}.aqua-now-head,.aqua-now-meta,.aqua-now-section-title{justify-content:space-between}.aqua-now-title>div{display:flex;flex-direction:column;gap:1px}.aqua-now-title small{font-size:9px;letter-spacing:.14em;opacity:.58}.aqua-now-title b{font-size:14px}.aqua-now-status-dot{width:10px;height:10px;border-radius:50%;background:var(--health-color);box-shadow:0 0 16px rgba(var(--health-rgb),.5);animation:healthHeartbeat var(--health-pulse-speed) ease-in-out infinite}.aqua-now-signal{font-size:11px;font-weight:850;padding:6px 8px;border-radius:999px;border:1px solid rgba(var(--health-rgb),.22);background:rgba(var(--health-rgb),.07);color:var(--health-color)}
      .aqua-daily-status{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:12px}.aqua-daily-status b{color:var(--health-color)}.aqua-daily-status span{opacity:.8}.aqua-health-reason{display:grid;grid-template-columns:auto 1fr;gap:9px;align-items:start;padding:9px 10px;border-radius:12px;background:rgba(0,0,0,.12);border:1px solid rgba(255,255,255,.05);font-size:12px}.aqua-health-reason small{font-weight:850;color:var(--health-color)}.aqua-health-reason span{opacity:.85;line-height:1.45}
      .aqua-now-actions-wrap{display:grid;gap:7px}.aqua-now-section-title b{font-size:13px}.aqua-urgent-label{font-size:10px;font-weight:900;color:#fff;background:rgba(var(--health-rgb),.72);padding:4px 7px;border-radius:999px;box-shadow:0 0 16px rgba(var(--health-rgb),.2)}.aqua-now-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.aqua-action{min-width:0;border:1px solid rgba(255,255,255,.07);border-radius:12px;background:rgba(255,255,255,.025);color:inherit;padding:8px 9px;display:grid;grid-template-columns:22px 1fr;gap:7px;align-items:start;text-align:start}.aqua-action>span{width:22px;height:22px;display:grid;place-items:center;border-radius:7px;background:rgba(var(--health-rgb),.11);color:var(--health-color);font-weight:900}.aqua-action b{font-size:11px;line-height:1.42;font-weight:730}.aqua-action.clickable{cursor:pointer}.aqua-action.clickable:hover{border-color:rgba(var(--health-rgb),.32);background:rgba(var(--health-rgb),.065)}.aqua-action.urgent{border-color:rgba(var(--health-rgb),.36);background:rgba(var(--health-rgb),.09)}.aqua-action:disabled{opacity:1;cursor:default}
      .aqua-now-meta{padding-top:2px;font-size:10px;opacity:.72;flex-wrap:wrap}.aqua-breakdown-toggle{border:0;background:transparent;color:var(--health-color);font:inherit;font-weight:850;cursor:pointer;padding:3px 0}.aqua-health-breakdown{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding-top:2px}.aqua-health-breakdown>div{display:grid;gap:5px;padding:8px;border-radius:11px;background:rgba(0,0,0,.1);border:1px solid rgba(255,255,255,.05)}.aqua-health-breakdown span{display:flex;justify-content:space-between;gap:6px;align-items:center}.aqua-health-breakdown small{font-size:9px;opacity:.67}.aqua-health-breakdown b{font-size:12px;color:var(--health-color)}.aqua-health-breakdown i{display:block;height:5px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.06)}.aqua-health-breakdown u{display:block;height:100%;border-radius:inherit;background:var(--health-color);text-decoration:none;transition:width .3s ease}.aqua-health-breakdown p{grid-column:1/-1;margin:0;font-size:10px;line-height:1.45;opacity:.62}
      .aqua-chem-trends{display:flex;gap:4px;flex-wrap:wrap;margin-top:3px}.aqua-chem-trend{display:inline-flex;align-items:center;gap:4px;width:max-content;max-width:100%;padding:2px 5px;border-radius:7px;background:rgba(255,255,255,.035);font-style:normal}.aqua-chem-trend small{font-size:8px!important;opacity:.58!important}.aqua-chem-trend b{font-size:9px!important;color:inherit!important;text-shadow:none!important;white-space:nowrap}.aqua-chem-trend.better b{color:#75e6b0!important}.aqua-chem-trend.worse b{color:#ff9d78!important}.aqua-chem-trend.flat b{opacity:.72}
      @media(max-width:720px){.aqua-now-actions{grid-template-columns:1fr}.aqua-health-breakdown{grid-template-columns:1fr}.aqua-health-breakdown p{grid-column:auto}.aqua-health-reason{grid-template-columns:1fr;gap:3px}}
      @media(max-width:620px){.pd-health-score.aqua-health-trigger{padding-bottom:27px!important}.pd-health-score.aqua-health-trigger::before{font-size:8px;bottom:6px}.aqua-now-panel{padding:11px;margin-top:11px}.aqua-now-head{align-items:flex-start}.aqua-now-signal{max-width:46%;text-align:center}.aqua-now-meta{align-items:flex-start}.aqua-chem-trends{gap:3px}.aqua-chem-trend{padding:2px 4px}}
      @media(prefers-reduced-motion:reduce){.pd-health-score[data-aqua-health-tone],.pd-module[data-aqua-health-tone],.aqua-now-status-dot,.aqua-now-panel{animation:none!important}}
    `}</style></>;
}
