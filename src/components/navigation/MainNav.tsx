"use client";

import { useEffect,useMemo,useRef,useState } from "react";
import { createPortal } from "react-dom";
import { tr,bi } from "@/i18n";
import type { Language,Tank } from "@/domain/types";
import { GlobalHelpButton,PageHelpButton } from "@/components/help/HelpCenter";
import { markFeatureLearned } from "@/lib/featureDiscovery";

export type AppPage =
  | "dashboard" | "tanks" | "equipment" | "lighting" | "sump" | "livestock" | "acclimation" | "library"
  | "chemistry" | "maintenance" | "inventory" | "diseases" | "lifejourney" | "consumption" | "timeline"
  | "journal" | "waterchange" | "feeding" | "dosing" | "quarantine"
  | "emergency" | "rodi" | "expenses" | "alerts" | "reports" | "settings" | "academy";

type NavItem={key:AppPage;label:string;icon:string;color:string;glyph:string;group:"core"|"care"|"operations"|"history"|"system"};
type SearchEntry={
  id:string;
  page:AppPage;
  title:string;
  subtitle:string;
  keywords:string;
  icon:string;
  color:string;
  kind:"module"|"livestock"|"equipment"|"maintenance"|"inventory"|"chemistry"|"action";
};

const items:NavItem[]=[
  {key:"dashboard",label:"dashboard",icon:"💧",color:"#55e8ff",glyph:"dropPulse",group:"core"},
  {key:"tanks",label:"tanks",icon:"▣",color:"#55b8ff",glyph:"tanks",group:"system"},
  {key:"equipment",label:"equipment",icon:"⚙",color:"#8b8cff",glyph:"pump",group:"core"},
  {key:"lighting",label:"lighting",icon:"◉",color:"#7bb8ff",glyph:"light",group:"core"},
  {key:"sump",label:"sump",icon:"▤",color:"#3ed2c0",glyph:"sump",group:"system"},
  {key:"livestock",label:"livestock",icon:"🐟",color:"#55dfff",glyph:"fish",group:"core"},
  {key:"lifejourney",label:"lifeJourney",icon:"◉",color:"#72e5b5",glyph:"coral",group:"care"},
  {key:"consumption",label:"tankConsumption",icon:"↘",color:"#62d9ff",glyph:"chart",group:"operations"},
  {key:"acclimation",label:"acclimation",icon:"⇢",color:"#66e0ff",glyph:"acclimation",group:"core"},
  {key:"library",label:"library",icon:"◇",color:"#b68cff",glyph:"coral",group:"care"},
  {key:"chemistry",label:"chemistry",icon:"⚗",color:"#54e5d4",glyph:"flask",group:"core"},
  {key:"maintenance",label:"maintenance",icon:"🔧",color:"#77da68",glyph:"tools",group:"core"},
  {key:"inventory",label:"inventory",icon:"▦",color:"#7edcf3",glyph:"box",group:"operations"},
  {key:"diseases",label:"diseases",icon:"⊕",color:"#ff7777",glyph:"disease",group:"care"},
  {key:"timeline",label:"timeline",icon:"↺",color:"#76b8ff",glyph:"chart",group:"history"},
  {key:"journal",label:"journal",icon:"▧",color:"#8ecfff",glyph:"journal",group:"history"},
  {key:"waterchange",label:"waterChange",icon:"≋",color:"#4ddaf3",glyph:"waves",group:"operations"},
  {key:"feeding",label:"feeding",icon:"•••",color:"#ffb35f",glyph:"feed",group:"operations"},
  {key:"dosing",label:"dosing",icon:"💧",color:"#56d7ff",glyph:"dose",group:"operations"},
  {key:"quarantine",label:"quarantine",icon:"⊞",color:"#f0cf5b",glyph:"quarantine",group:"care"},
  {key:"emergency",label:"emergency",icon:"!",color:"#ff5f6d",glyph:"warning",group:"care"},
  {key:"rodi",label:"rodi",icon:"◫",color:"#75f2e0",glyph:"filter",group:"operations"},
  {key:"expenses",label:"expenses",icon:"$",color:"#8ee56d",glyph:"money",group:"history"},
  {key:"alerts",label:"alerts",icon:"△",color:"#ff8c57",glyph:"warning",group:"core"},
  {key:"reports",label:"reports",icon:"▥",color:"#76cfff",glyph:"chart",group:"history"},
  {key:"settings",label:"settings",icon:"⚙",color:"#c0d5df",glyph:"gear",group:"system"}
];

const PRIMARY:AppPage[]=["dashboard","chemistry","livestock","maintenance","equipment","lighting","acclimation","alerts"];
const PAGE_SET=new Set<AppPage>(items.map(x=>x.key));
const PAGE_ALIAS:Record<string,AppPage>={"water-change":"waterchange","waterChange":"waterchange"};

function AquaModuleGlyph({kind}:{kind:string}){
 const common={viewBox:"0 0 48 48",fill:"none",stroke:"currentColor",strokeWidth:2.6,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 const map:Record<string,React.ReactNode>={
  dropPulse:<><path d="M24 5C17 15 12 21 12 29a12 12 0 0 0 24 0C36 21 31 15 24 5Z"/><path d="m16 29 5-1 3-6 4 12 3-6 3 1"/></>,
  flask:<><path d="M19 6h10M21 6v11L12 34a5 5 0 0 0 4 8h16a5 5 0 0 0 4-8l-9-17V6"/><path d="M16 31h16"/></>,
  fish:<><path d="M9 24c7-10 20-10 28 0-8 10-21 10-28 0Z"/><path d="m9 24-6-6v12l6-6Z"/><circle cx="31" cy="21" r="1"/></>,
  coral:<><path d="M24 41V17m0 8-8-8m8 3 8-8m-8 17 10-7M16 41V28m0 5-6-5m22 13V31m0 4 6-5"/></>,
  pump:<><rect x="9" y="14" width="27" height="22" rx="7"/><circle cx="22" cy="25" r="7"/><path d="M36 20h6v10h-6M22 18v14m-7-7h14"/></>,
  sump:<><rect x="5" y="12" width="38" height="27" rx="3"/><path d="M17 12v27m14-27v27M7 27c5-4 7 4 12 0s7 4 12 0 7 4 10 0"/></>,
  light:<><path d="M10 15h28l-5-8H15l-5 8Z"/><path d="M16 19 12 36m12-17v19m8-19 4 17"/><path d="M9 41c7-5 13 5 20 0s10 1 12 0"/></>,
  acclimation:<><path d="M8 9h14l-2 17H10L8 9Z"/><path d="M15 26v7m0 0h24m-6-6 6 6-6 6"/><path d="M12 17c3-3 5 3 8 0"/></>,
  tools:<><path d="m8 39 17-17m-9-9 6 6M11 8l8 8-5 5-8-8 5-5Z"/><path d="M27 27 40 40M34 9a8 8 0 0 0-7 11l5-5 4 4-5 5A8 8 0 0 0 42 17"/></>,
  box:<><path d="m8 15 16-7 16 7-16 7-16-7Zm0 0v20l16 7 16-7V15M24 22v20"/></>,
  disease:<><path d="M8 25c7-9 20-9 28 0-8 9-21 9-28 0Z"/><circle cx="24" cy="25" r="5"/><path d="m37 36 6 6"/></>,
  chart:<><path d="M8 39V10m0 29h34"/><path d="m12 33 8-9 7 4 12-15"/></>,
  journal:<><rect x="10" y="7" width="28" height="34" rx="3"/><path d="M16 15h16M16 22h16M16 29h10"/></>,
  waves:<><path d="M5 18c6-5 9 5 15 0s9 5 15 0 7 1 8 1M5 30c6-5 9 5 15 0s9 5 15 0 7 1 8 1"/></>,
  feed:<><path d="M7 30c7-8 17-8 24 0-7 8-17 8-24 0Z"/><path d="m7 30-5-5v10l5-5Z"/><circle cx="34" cy="11" r="2"/><circle cx="40" cy="17" r="2"/><circle cx="34" cy="21" r="1.5"/></>,
  dose:<><path d="M24 5C17 15 13 21 13 29a11 11 0 0 0 22 0C35 21 31 15 24 5Z"/><path d="M20 27h8m-8 5h8"/></>,
  quarantine:<><rect x="7" y="8" width="34" height="32" rx="4"/><path d="M14 24h20M24 14v20"/></>,
  warning:<><path d="M24 6 44 41H4L24 6Z"/><path d="M24 18v11m0 6h.01"/></>,
  filter:<><path d="M10 8h28l-10 15v14l-8 4V23L10 8Z"/><path d="M16 14h16"/></>,
  money:<><circle cx="24" cy="24" r="17"/><path d="M29 17c-2-2-10-2-10 3 0 6 11 2 11 8 0 5-8 6-12 3M24 12v24"/></>,
  gear:<><circle cx="24" cy="24" r="7"/><path d="M24 5v6m0 26v6M5 24h6m26 0h6M10.5 10.5l4.5 4.5m18 18 4.5 4.5m0-27-4.5 4.5m-18 18-4.5 4.5"/></>,
  tanks:<><rect x="6" y="10" width="16" height="28" rx="3"/><rect x="26" y="10" width="16" height="28" rx="3"/><path d="M8 26c4-3 7 3 12 0m8 0c4-3 7 3 12 0"/></>
 };
 return <svg className="aqua-glyph" {...common}>{map[kind]??map.dropPulse}</svg>;
}

function asPage(raw:string):AppPage{
  const mapped=PAGE_ALIAS[raw]??raw;
  if(mapped==="academy")return "academy";
  return PAGE_SET.has(mapped as AppPage)?mapped as AppPage:"dashboard";
}
function dockScale(index:number,hoverIndex:number|null){
  if(hoverIndex===null)return 1;
  const distance=Math.abs(index-hoverIndex);
  if(distance===0)return 1.42;
  if(distance===1)return 1.20;
  return 1;
}
function norm(s:string){
  return s.toLowerCase().normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g,"")
    .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه")
    .replace(/\s+/g," ").trim();
}
function itemFor(page:AppPage){return items.find(x=>x.key===page)??items[0]}

export function MainNav({active,onChange,lang,tank,lockedPages=[]}:{active:AppPage;onChange:(p:AppPage)=>void;lang:Language;tank:Tank;lockedPages?:AppPage[]}) {
  const viewport=useRef<HTMLDivElement>(null);
  const searchRef=useRef<HTMLInputElement>(null);
  const [hoverIndex,setHoverIndex]=useState<number|null>(null);
  const [allOpen,setAllOpen]=useState(false);
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [query,setQuery]=useState("");
  const move=(dir:-1|1)=>viewport.current?.scrollBy({left:dir*360,behavior:"smooth"});
  const visiblePrimary=useMemo(()=>items.filter(x=>PRIMARY.includes(x.key)||x.key===active),[active]);
  const secondary=useMemo(()=>items.filter(x=>!visiblePrimary.some(p=>p.key===x.key)),[visiblePrimary]);

  const quickActions=useMemo(()=>[
    {page:"chemistry" as AppPage,icon:"＋",ar:"فحص كيمياء",en:"Log chemistry"},
    {page:"feeding" as AppPage,icon:"＋",ar:"تغذية",en:"Log feeding"},
    {page:"waterchange" as AppPage,icon:"＋",ar:"تغيير ماء",en:"Water change"},
    {page:"maintenance" as AppPage,icon:"＋",ar:"صيانة",en:"Maintenance"},
    {page:"dosing" as AppPage,icon:"＋",ar:"جرعة",en:"Dosing"},
    {page:"journal" as AppPage,icon:"＋",ar:"ملاحظة / صورة",en:"Observation / photo"}
  ],[]);

  const searchEntries=useMemo<SearchEntry[]>(()=>{
    const entries:SearchEntry[]=items.map(item=>({
      id:`module:${item.key}`,page:item.key,title:item.key==="lifejourney"?bi(lang,"حياة الكائنات","Life Journey"):item.key==="consumption"?bi(lang,"استهلاك الحوض","Tank Consumption"):tr(lang,item.label),subtitle:item.group,
      keywords:`${item.key} ${item.group} ${tr(lang,item.label)}`,icon:item.icon,color:item.color,kind:"module"
    }));
    entries.push({id:"module:academy",page:"academy",title:lang==="ar"?"Aqua Nexus Academy • تعلم الحوض":"Aqua Nexus Academy",subtitle:lang==="ar"?"دورة + قاموس مصطلحات":"Course + glossary",keywords:"academy learn تعليم دورة قاموس glossary chemistry cycling tank brain",icon:"🎓",color:"#aa88ff",kind:"module"});
    const push=(entry:SearchEntry)=>entries.push(entry);
    for(const x of tank.livestock){
      const p=itemFor("livestock");
      push({id:`livestock:${x.id}`,page:"livestock",title:lang==="ar"?x.name:(x.nameEn||x.name),subtitle:lang==="ar"?`كائن • ${x.category} • ${x.health}`:`Livestock • ${x.category} • ${x.health}`,keywords:`${x.name} ${x.nameEn||""} ${x.category} ${x.subtype||""} ${x.health}`,icon:"◉",color:p.color,kind:"livestock"});
    }
    for(const x of tank.equipment){
      const p=itemFor("equipment");
      push({id:`equipment:${x.id}`,page:"equipment",title:x.name,subtitle:lang==="ar"?`جهاز • ${x.kind} • ${x.status}`:`Equipment • ${x.kind} • ${x.status}`,keywords:`${x.name} ${x.brand||""} ${x.model||""} ${x.kind} ${x.status}`,icon:"⚙",color:p.color,kind:"equipment"});
    }
    for(const x of tank.maintenance){
      const p=itemFor("maintenance");
      push({id:`maintenance:${x.id}`,page:"maintenance",title:lang==="ar"?x.title:(x.titleEn||x.title),subtitle:lang==="ar"?`مهمة صيانة • ${x.cadence}`:`Maintenance task • ${x.cadence}`,keywords:`${x.title} ${x.titleEn||""} ${x.cadence} ${x.sourceEquipmentName||""}`,icon:"✓",color:p.color,kind:"maintenance"});
    }
    for(const x of tank.inventory){
      const p=itemFor("inventory");
      push({id:`inventory:${x.id}`,page:"inventory",title:lang==="ar"?x.name:(x.nameEn||x.name),subtitle:lang==="ar"?`مخزون • ${x.quantity} ${x.unit}`:`Inventory • ${x.quantity} ${x.unit}`,keywords:`${x.name} ${x.nameEn||""} ${x.inventoryCategory||""} ${x.inventorySubcategory||""} ${x.category||""}`,icon:"▦",color:p.color,kind:"inventory"});
    }
    const params=new Set<string>();
    for(const reading of tank.chemistry.slice(0,10))for(const key of Object.keys(reading.values))params.add(key);
    for(const key of params){
      const p=itemFor("chemistry");
      push({id:`chemistry:${key}`,page:"chemistry",title:key,subtitle:lang==="ar"?"بارامتر كيميائي":"Chemistry parameter",keywords:`${key} chemistry كيمياء قراءة فحص`,icon:"◌",color:p.color,kind:"chemistry"});
    }
    for(const x of (tank.guidanceActions??[]).filter(g=>!["resolved","verified"].includes(g.status)).slice(0,30)){
      const page=asPage(x.page),p=itemFor(page);
      push({id:`action:${x.id}`,page,title:lang==="ar"?x.titleAr:x.titleEn,subtitle:lang==="ar"?`إجراء ذكي • ${x.level}`:`Smart action • ${x.level}`,keywords:`${x.titleAr} ${x.titleEn} ${x.reasonAr} ${x.reasonEn} ${x.domain} ${x.parameter||""}`,icon:"→",color:p.color,kind:"action"});
    }
    return entries;
  },[tank,lang]);

  const results=useMemo(()=>{
    const q=norm(query);
    if(!q)return searchEntries.filter(x=>x.kind==="module");
    const tokens=q.split(" ").filter(Boolean);
    return searchEntries
      .map(entry=>{
        const hay=norm(`${entry.title} ${entry.subtitle} ${entry.keywords}`);
        const score=tokens.reduce((sum,t)=>sum+(hay.includes(t)?1:0),0)+(norm(entry.title).startsWith(q)?2:0);
        return{entry,score};
      })
      .filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score)
      .slice(0,30)
      .map(x=>x.entry);
  },[query,searchEntries]);

  const go=(page:AppPage)=>{
    if(lockedPages.includes(page))return;
    setAllOpen(false);setPaletteOpen(false);setQuery("");onChange(page);
  };
  const openPalette=(preset="")=>{
    markFeatureLearned("global-search");
    setQuery(preset);setPaletteOpen(true);setAllOpen(false);
    window.setTimeout(()=>searchRef.current?.focus(),0);
  };

  useEffect(()=>{
    if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("aqua:page",{detail:active}));
  },[active]);

  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      const typing=target?.tagName==="INPUT"||target?.tagName==="TEXTAREA"||target?.tagName==="SELECT"||target?.isContentEditable;
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){
        event.preventDefault();openPalette();
      }else if(event.key==="Escape"){
        setPaletteOpen(false);setAllOpen(false);setQuery("");
      }else if(event.key==="/"&&!typing){
        event.preventDefault();openPalette();
      }
    };
    window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  },[]);

  const button=(item:NavItem,index:number,compact=false)=>{
    const scale=dockScale(index,hoverIndex),locked=lockedPages.includes(item.key);
    return <button type="button" data-aqua-page={item.key} key={item.key} disabled={locked} aria-disabled={locked}
      title={locked?(lang==="ar"?"مقفل خلال الدورة البيولوجية":"Locked during biological cycling"):undefined}
      className={`nav-item dock-item ${compact?"nav-compact":""} ${active===item.key?"active":""} ${locked?"cycle-locked":""}`}
      style={{"--dock-scale":scale,"--dock-color":item.color} as React.CSSProperties}
      onMouseEnter={()=>!locked&&setHoverIndex(index)} onFocus={()=>!locked&&setHoverIndex(index)} onBlur={()=>setHoverIndex(null)}
      onClick={(e)=>{e.preventDefault();e.stopPropagation();go(item.key)}}>
      <span className={`nav-icon aqua-module-icon icon-${item.key}`}>{locked?"🔒":<AquaModuleGlyph kind={item.glyph}/>}</span>
      <span className="dock-label" dir={lang==="ar"?"rtl":"ltr"}>{tr(lang,item.label)}</span>
    </button>;
  };

  return <div className="nav-zone">
    <div className="nav-help-row">
      <PageHelpButton page={active}/>
      <GlobalHelpButton lang={lang}/>
      <button type="button" className="nav-quick-trigger" onClick={()=>openPalette()} aria-label={lang==="ar"?"إجراءات سريعة":"Quick actions"}>＋ <span>{lang==="ar"?"تسجيل سريع":"Quick log"}</span></button>
      <button type="button" className="nav-search-trigger" onClick={()=>openPalette()} aria-label={lang==="ar"?"بحث في Aqua Nexus":"Search Aqua Nexus"}>⌕ <span>{lang==="ar"?"بحث":"Search"}</span></button>
    </div>

    <div className="dock-shell nav-primary-shell">
      <button type="button" className="dock-arrow dock-arrow-left" aria-label="Previous modules" onClick={()=>move(-1)}>‹</button>
      <div className="dock-viewport" ref={viewport} dir="ltr">
        <nav className="main-nav mac-dock primary-modules-nav" onMouseLeave={()=>setHoverIndex(null)}>
          {visiblePrimary.map((item,index)=>button(item,index))}
          <button type="button" className={`nav-item dock-item nav-more ${allOpen?"active":""}`} aria-expanded={allOpen} onClick={()=>{setAllOpen(v=>!v);setPaletteOpen(false)}}>
            <span className="nav-icon">＋</span><span className="dock-label">{lang==="ar"?"كل الوحدات":"All modules"}</span>
          </button>
        </nav>
      </div>
      <button type="button" className="dock-arrow dock-arrow-right" aria-label="Next modules" onClick={()=>move(1)}>›</button>
    </div>

    {allOpen&&<div className="all-modules-sheet" role="region" aria-label={lang==="ar"?"كل وحدات Aqua Nexus":"All Aqua Nexus modules"}>
      <div className="all-modules-head"><div><b>{lang==="ar"?"كل الوحدات":"All modules"}</b><small>{lang==="ar"?"الوحدات الأساسية فوق دائماً؛ هون بتوصل لباقي الأدوات بدون ما نغرق الواجهة.":"Core modules stay visible above; the rest remain one tap away."}</small></div><button className="icon-btn" onClick={()=>setAllOpen(false)} aria-label="Close">×</button></div>
      <div className="all-modules-grid">{secondary.map((item,index)=>button(item,index,true))}</div>
    </div>}

    {paletteOpen&&typeof document!=="undefined"&&createPortal(<div className="command-palette-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target){setPaletteOpen(false);setQuery("")}}}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label={lang==="ar"?"بحث وأدوات Aqua Nexus":"Aqua Nexus search and tools"}>
        <div className="command-search"><span>⌕</span><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder={lang==="ar"?"ابحث: KH، Naso، Skimmer، صيانة، RO/DI…":"Search: KH, livestock, skimmer, maintenance, RO/DI…"} /><kbd>Esc</kbd></div>
        <div className="command-quick">
          <small>{lang==="ar"?"تسجيل سريع من أي صفحة":"QUICK ACTIONS"}</small>
          <div>{quickActions.map(x=>{const locked=lockedPages.includes(x.page);return <button type="button" key={x.page} disabled={locked} data-quick-action={x.page} onClick={()=>go(x.page)}><span>{locked?"🔒":x.icon}</span>{lang==="ar"?x.ar:x.en}</button>})}</div>
        </div>
        <div className="command-results">
          {results.map(entry=>{
            const locked=lockedPages.includes(entry.page);
            return <button type="button" key={entry.id} disabled={locked} onClick={()=>go(entry.page)} data-command-page={entry.page} data-command-kind={entry.kind}>
              <span style={{"--command-color":entry.color} as React.CSSProperties}>{locked?"🔒":entry.icon}</span>
              <div><b>{entry.title}</b><small>{locked?(lang==="ar"?"مقفل خلال Cycling":"Locked during cycling"):entry.subtitle}</small></div>
              <em>↵</em>
            </button>;
          })}
          {!results.length&&<div className="command-empty">{lang==="ar"?"ما لقيت نتيجة. جرّب اسم كائن، جهاز، مهمة، بارامتر أو اسم صفحة.":"No match. Try a livestock name, device, task, parameter or module."}</div>}
        </div>
      </section>
    </div>,document.body)}

    <style jsx>{`
      .nav-help-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      .nav-search-trigger,.nav-quick-trigger{min-height:34px;border:1px solid rgba(92,205,230,.22);border-radius:11px;background:rgba(8,38,52,.72);color:#c9edf4;padding:6px 9px;display:flex;align-items:center;gap:6px;font-size:10px}
      .nav-quick-trigger{margin-inline-start:auto;border-color:rgba(92,230,180,.2);background:rgba(22,75,62,.42)}
      .command-search kbd{font:inherit;font-size:8px;padding:2px 5px;border:1px solid rgba(255,255,255,.13);border-radius:6px;opacity:.7}
      .aqua-glyph{width:27px;height:27px;display:block;color:var(--dock-color);filter:drop-shadow(0 0 5px color-mix(in srgb,var(--dock-color) 55%,transparent))}
      .aqua-module-icon{position:relative;overflow:hidden;border:1px solid color-mix(in srgb,var(--dock-color) 38%,transparent);background:radial-gradient(circle at 50% 25%,color-mix(in srgb,var(--dock-color) 25%,transparent),rgba(4,25,38,.72) 70%);box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 0 16px color-mix(in srgb,var(--dock-color) 13%,transparent);text-shadow:0 0 12px var(--dock-color)}\n      .icon-livestock{filter:saturate(.75) hue-rotate(155deg)}\n      .primary-modules-nav{min-width:0!important;justify-content:flex-start!important;padding:3px 0}
      .primary-modules-nav .nav-item{min-width:78px;flex:0 0 auto}
      .nav-more{border-inline-start:1px solid rgba(255,255,255,.08)!important}
      .all-modules-sheet{margin-top:7px;border:1px solid rgba(74,190,218,.2);border-radius:17px;padding:12px;background:linear-gradient(180deg,rgba(8,34,47,.98),rgba(5,25,36,.98));box-shadow:0 18px 44px rgba(0,0,0,.28)}
      .all-modules-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:9px}.all-modules-head>div{display:grid;gap:3px}.all-modules-head small{font-size:9px;opacity:.65;line-height:1.45}
      .all-modules-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:6px}.all-modules-grid .nav-item{min-width:0!important;min-height:60px}
      .command-palette-backdrop{position:fixed;inset:0;z-index:9200;background:rgba(0,8,13,.66);backdrop-filter:blur(5px);display:grid;place-items:start center;padding:10vh 12px 24px}
      .command-palette{width:min(680px,100%);max-height:80dvh;overflow:hidden;border:1px solid rgba(78,210,237,.28);border-radius:20px;background:#071e2b;box-shadow:0 35px 100px rgba(0,0,0,.58)}
      .command-search{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:13px;border-bottom:1px solid rgba(255,255,255,.08)}.command-search>span{font-size:22px}.command-search input{border:0;background:transparent;color:#effcff;font-size:16px;outline:0;min-width:0}
      .command-quick{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.07);display:grid;gap:7px}.command-quick>small{font-size:8px;letter-spacing:.08em;opacity:.55;font-weight:850}.command-quick>div{display:flex;gap:6px;flex-wrap:wrap}.command-quick button{border:1px solid rgba(100,224,185,.15);border-radius:9px;background:rgba(72,195,156,.055);color:inherit;padding:7px 9px;font-size:9px;display:flex;gap:5px;align-items:center}.command-quick button:disabled{opacity:.35}
      .command-results{padding:7px;overflow:auto;max-height:calc(80dvh - 126px);display:grid;gap:3px}.command-results>button{border:0;background:transparent;color:inherit;display:grid;grid-template-columns:36px 1fr auto;gap:9px;align-items:center;text-align:inherit;padding:9px;border-radius:11px}.command-results>button:hover,.command-results>button:focus-visible{background:rgba(72,199,227,.1);outline:1px solid rgba(72,199,227,.2)}.command-results>button:disabled{opacity:.38}.command-results>button>span{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,var(--command-color) 16%,transparent);color:var(--command-color);font-size:17px}.command-results>button>div{display:grid;gap:2px}.command-results b{font-size:12px}.command-results small{font-size:8px;opacity:.55}.command-results em{font-style:normal;opacity:.35}.command-empty{padding:22px;text-align:center;opacity:.65}
      @media(max-width:760px){.nav-search-trigger span,.nav-quick-trigger span{display:none}.nav-search-trigger,.nav-quick-trigger{margin-inline-start:0;width:36px;justify-content:center;padding:0}.primary-modules-nav .nav-item{min-width:72px}.all-modules-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.command-palette-backdrop{padding-top:max(12px,env(safe-area-inset-top))}.command-palette{max-height:90dvh}.command-results{max-height:calc(90dvh - 138px)}}
      @media(max-width:430px){.all-modules-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.command-quick>div{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.command-quick button{justify-content:center}}
    `}</style>
  </div>;
}
