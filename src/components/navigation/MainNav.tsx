"use client";

import { useEffect,useMemo,useRef,useState } from "react";
import { tr } from "@/i18n";
import type { Language } from "@/domain/types";
import { GlobalHelpButton,PageHelpButton } from "@/components/help/HelpCenter";

export type AppPage =
  | "dashboard" | "tanks" | "equipment" | "sump" | "livestock" | "acclimation" | "library"
  | "chemistry" | "maintenance" | "inventory" | "diseases" | "timeline"
  | "journal" | "waterchange" | "feeding" | "dosing" | "quarantine"
  | "emergency" | "rodi" | "expenses" | "alerts" | "reports" | "settings";

const items: { key: AppPage; label: string; icon: string; color:string; group:"core"|"care"|"operations"|"history"|"system" }[] = [
  {key:"dashboard",label:"dashboard",icon:"⌂",color:"#55e8ff",group:"core"},
  {key:"tanks",label:"tanks",icon:"▣",color:"#55b8ff",group:"system"},
  {key:"equipment",label:"equipment",icon:"⚙",color:"#8b8cff",group:"core"},
  {key:"sump",label:"sump",icon:"▤",color:"#3ed2c0",group:"system"},
  {key:"livestock",label:"livestock",icon:"◉",color:"#ffb44d",group:"core"},
  {key:"acclimation",label:"acclimation",icon:"⇄",color:"#ff7fc5",group:"core"},
  {key:"library",label:"library",icon:"◇",color:"#b68cff",group:"care"},
  {key:"chemistry",label:"chemistry",icon:"◌",color:"#54e5a9",group:"core"},
  {key:"maintenance",label:"maintenance",icon:"✓",color:"#77da68",group:"core"},
  {key:"inventory",label:"inventory",icon:"▦",color:"#dfc857",group:"operations"},
  {key:"diseases",label:"diseases",icon:"✚",color:"#ff7777",group:"care"},
  {key:"timeline",label:"timeline",icon:"↺",color:"#76b8ff",group:"history"},
  {key:"journal",label:"journal",icon:"▧",color:"#ec8cff",group:"history"},
  {key:"waterchange",label:"waterChange",icon:"≈",color:"#4ddaf3",group:"operations"},
  {key:"feeding",label:"feeding",icon:"⋯",color:"#ffac6e",group:"operations"},
  {key:"dosing",label:"dosing",icon:"滴",color:"#56d7ff",group:"operations"},
  {key:"quarantine",label:"quarantine",icon:"⊞",color:"#f0cf5b",group:"care"},
  {key:"emergency",label:"emergency",icon:"!",color:"#ff5f6d",group:"care"},
  {key:"rodi",label:"rodi",icon:"◫",color:"#75f2e0",group:"operations"},
  {key:"expenses",label:"expenses",icon:"$",color:"#8ee56d",group:"history"},
  {key:"alerts",label:"alerts",icon:"△",color:"#ff8c57",group:"core"},
  {key:"reports",label:"reports",icon:"▥",color:"#9da6ff",group:"history"},
  {key:"settings",label:"settings",icon:"⚙",color:"#c0d5df",group:"system"}
];

const PRIMARY:AppPage[]=["dashboard","chemistry","livestock","maintenance","equipment","acclimation","alerts"];

function dockScale(index:number,hoverIndex:number|null){
  if(hoverIndex===null)return 1;
  const distance=Math.abs(index-hoverIndex);
  if(distance===0)return 1.42;
  if(distance===1)return 1.20;
  return 1;
}
function norm(s:string){return s.toLowerCase().normalize("NFKD").replace(/[ً-ٰٟ]/g,"").replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/\s+/g," ").trim();}

export function MainNav({active,onChange,lang,lockedPages=[]}:{active:AppPage;onChange:(p:AppPage)=>void;lang:Language;lockedPages?:AppPage[]}) {
  const viewport=useRef<HTMLDivElement>(null);
  const searchRef=useRef<HTMLInputElement>(null);
  const [hoverIndex,setHoverIndex]=useState<number|null>(null);
  const [allOpen,setAllOpen]=useState(false);
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [query,setQuery]=useState("");
  const move=(dir:-1|1)=>viewport.current?.scrollBy({left:dir*360,behavior:"smooth"});
  const visiblePrimary=useMemo(()=>items.filter(x=>PRIMARY.includes(x.key)||x.key===active),[active]);
  const secondary=useMemo(()=>items.filter(x=>!visiblePrimary.some(p=>p.key===x.key)),[visiblePrimary]);
  const results=useMemo(()=>{
    const q=norm(query);
    if(!q)return items;
    return items.filter(x=>norm(`${tr(lang,x.label)} ${x.key} ${x.group}`).includes(q));
  },[query,lang]);

  const go=(page:AppPage)=>{
    if(lockedPages.includes(page))return;
    setAllOpen(false);setPaletteOpen(false);setQuery("");onChange(page);
  };

  useEffect(()=>{
    if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("aqua:page",{detail:active}));
  },[active]);

  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      const typing=target?.tagName==="INPUT"||target?.tagName==="TEXTAREA"||target?.tagName==="SELECT"||target?.isContentEditable;
      if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){
        event.preventDefault();setPaletteOpen(true);setAllOpen(false);
        window.setTimeout(()=>searchRef.current?.focus(),0);
      }else if(event.key==="Escape"){
        setPaletteOpen(false);setAllOpen(false);setQuery("");
      }else if(event.key==="/"&&!typing){
        event.preventDefault();setPaletteOpen(true);setAllOpen(false);
        window.setTimeout(()=>searchRef.current?.focus(),0);
      }
    };
    window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  },[]);

  const button=(item:(typeof items)[number],index:number,compact=false)=>{
    const scale=dockScale(index,hoverIndex),locked=lockedPages.includes(item.key);
    return <button type="button" data-aqua-page={item.key} key={item.key} disabled={locked} aria-disabled={locked}
      title={locked?(lang==="ar"?"مقفل خلال الدورة البيولوجية":"Locked during biological cycling"):undefined}
      className={`nav-item dock-item ${compact?"nav-compact":""} ${active===item.key?"active":""} ${locked?"cycle-locked":""}`}
      style={{"--dock-scale":scale,"--dock-color":item.color} as React.CSSProperties}
      onMouseEnter={()=>!locked&&setHoverIndex(index)} onFocus={()=>!locked&&setHoverIndex(index)} onBlur={()=>setHoverIndex(null)}
      onClick={(e)=>{e.preventDefault();e.stopPropagation();go(item.key)}}>
      <span className="nav-icon">{locked?"🔒":item.icon}</span>
      <span className="dock-label" dir={lang==="ar"?"rtl":"ltr"}>{tr(lang,item.label)}</span>
    </button>;
  };

  return <div className="nav-zone">
    <div className="nav-help-row">
      <PageHelpButton page={active}/>
      <GlobalHelpButton lang={lang}/>
      <button type="button" className="nav-search-trigger" onClick={()=>{setPaletteOpen(true);setAllOpen(false);setTimeout(()=>searchRef.current?.focus(),0)}} aria-label={lang==="ar"?"بحث بالأوامر والوحدات":"Search commands and modules"}>⌕ <span>{lang==="ar"?"بحث":"Search"}</span><kbd>⌘K</kbd></button>
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

    {paletteOpen&&<div className="command-palette-backdrop" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target){setPaletteOpen(false);setQuery("")}}}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-label={lang==="ar"?"بحث Aqua Nexus":"Aqua Nexus search"}>
        <div className="command-search"><span>⌕</span><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder={lang==="ar"?"اكتب: KH، جرعات، سمك، RO/DI، تقارير…":"Type: KH, dosing, livestock, RO/DI, reports…"} /><kbd>Esc</kbd></div>
        <div className="command-results">
          {results.map((item,index)=>{
            const locked=lockedPages.includes(item.key);
            return <button type="button" key={item.key} disabled={locked} onClick={()=>go(item.key)} data-command-page={item.key}>
              <span style={{"--command-color":item.color} as React.CSSProperties}>{locked?"🔒":item.icon}</span>
              <div><b>{tr(lang,item.label)}</b><small>{locked?(lang==="ar"?"مقفل خلال Cycling":"Locked during cycling"):item.group}</small></div>
              <em>↵</em>
            </button>;
          })}
          {!results.length&&<div className="command-empty">{lang==="ar"?"ما لقيت وحدة بهالاسم. جرب كلمة أبسط.":"No module matched. Try a simpler term."}</div>}
        </div>
      </section>
    </div>}

    <style jsx>{`
      .nav-help-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      .nav-search-trigger{margin-inline-start:auto;min-height:34px;border:1px solid rgba(92,205,230,.22);border-radius:11px;background:rgba(8,38,52,.72);color:#c9edf4;padding:6px 9px;display:flex;align-items:center;gap:6px;font-size:10px}
      .nav-search-trigger kbd,.command-search kbd{font:inherit;font-size:8px;padding:2px 5px;border:1px solid rgba(255,255,255,.13);border-radius:6px;opacity:.7}
      .primary-modules-nav{min-width:0!important;justify-content:flex-start!important;padding:3px 0}
      .primary-modules-nav .nav-item{min-width:78px;flex:0 0 auto}
      .nav-more{border-inline-start:1px solid rgba(255,255,255,.08)!important}
      .all-modules-sheet{margin-top:7px;border:1px solid rgba(74,190,218,.2);border-radius:17px;padding:12px;background:linear-gradient(180deg,rgba(8,34,47,.98),rgba(5,25,36,.98));box-shadow:0 18px 44px rgba(0,0,0,.28)}
      .all-modules-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:9px}.all-modules-head>div{display:grid;gap:3px}.all-modules-head small{font-size:9px;opacity:.65;line-height:1.45}
      .all-modules-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:6px}.all-modules-grid .nav-item{min-width:0!important;min-height:60px}
      .command-palette-backdrop{position:fixed;inset:0;z-index:9200;background:rgba(0,8,13,.66);backdrop-filter:blur(5px);display:grid;place-items:start center;padding:10vh 12px 24px}
      .command-palette{width:min(640px,100%);max-height:76dvh;overflow:hidden;border:1px solid rgba(78,210,237,.28);border-radius:20px;background:#071e2b;box-shadow:0 35px 100px rgba(0,0,0,.58)}
      .command-search{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:13px;border-bottom:1px solid rgba(255,255,255,.08)}.command-search>span{font-size:22px}.command-search input{border:0;background:transparent;color:#effcff;font-size:16px;outline:0;min-width:0}
      .command-results{padding:7px;overflow:auto;max-height:calc(76dvh - 58px);display:grid;gap:3px}.command-results>button{border:0;background:transparent;color:inherit;display:grid;grid-template-columns:36px 1fr auto;gap:9px;align-items:center;text-align:inherit;padding:9px;border-radius:11px}.command-results>button:hover,.command-results>button:focus-visible{background:rgba(72,199,227,.1);outline:1px solid rgba(72,199,227,.2)}.command-results>button:disabled{opacity:.38}.command-results>button>span{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;background:color-mix(in srgb,var(--command-color) 16%,transparent);color:var(--command-color);font-size:17px}.command-results>button>div{display:grid;gap:2px}.command-results b{font-size:12px}.command-results small{font-size:8px;opacity:.55}.command-results em{font-style:normal;opacity:.35}.command-empty{padding:22px;text-align:center;opacity:.65}
      @media(max-width:760px){.nav-search-trigger span,.nav-search-trigger kbd{display:none}.nav-search-trigger{margin-inline-start:0;width:36px;justify-content:center;padding:0}.primary-modules-nav .nav-item{min-width:72px}.all-modules-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.command-palette-backdrop{padding-top:max(12px,env(safe-area-inset-top))}.command-palette{max-height:88dvh}.command-results{max-height:calc(88dvh - 58px)}}
      @media(max-width:430px){.all-modules-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
  </div>;
}
