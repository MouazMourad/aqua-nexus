"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { MainNav,type AppPage } from "@/components/navigation/MainNav";
import { PageRouter } from "@/components/pages/PageRouter";
import { Modal } from "@/components/ui/Modal";
import { AquaAIAssistant } from "@/components/AquaAIAssistant";
import type { EquipmentKind,Tank,TankStatus,TankType } from "@/domain/types";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";
import { tr,bi } from "@/i18n";
import { uid,nowISO } from "@/lib/appUtils";

const equipOptions: {kind:EquipmentKind;ar:string;en:string}[] = [
 {kind:"lighting",ar:"إضاءة",en:"Lighting"},
 {kind:"waveMaker",ar:"مضخة أمواج",en:"Wave Maker"},
 {kind:"overflow",ar:"أوفر فلو",en:"Overflow"},
 {kind:"skimmer",ar:"سكيمر",en:"Skimmer"},
 {kind:"returnPump",ar:"مضخة رجوع",en:"Return Pump"},
 {kind:"heater",ar:"سخان",en:"Heater"},
 {kind:"ato",ar:"تعويض تلقائي",en:"ATO"}
];

export function AquaDashboard() {
 const state=useAquaStore(),{tanks,selectedTankId,selectTank,language,setLanguage,addTank}=state,[page,setPage]=useState<AppPage>("dashboard"),[open,setOpen]=useState(false),[attention,setAttention]=useState<string[]>([]),[reminderNote,setReminderNote]=useState("");
 const reminderChecked=useRef(false);
 const tank=tanks.find(t=>t.id===selectedTankId)??tanks[0];

 useEffect(()=>{
  if(reminderChecked.current||!tank||typeof window==="undefined")return;
  reminderChecked.current=true;
  const now=Date.now(),week=7*86400000;
  const stale=tanks.filter(t=>{
   const raw=localStorage.getItem(`aqua-nexus-last-visit:${t.id}`);
   if(!raw){localStorage.setItem(`aqua-nexus-last-visit:${t.id}`,String(now));return false;}
   const last=Number(raw);
   return Number.isFinite(last)&&now-last>=week;
  });
  setAttention(stale.map(t=>t.name));
  if(stale.length&&"Notification" in window&&Notification.permission==="granted"){
   const key=`${new Date().toISOString().slice(0,10)}:${stale.map(x=>x.id).join(",")}`;
   if(localStorage.getItem("aqua-nexus-last-reminder")!==key){
    navigator.serviceWorker?.ready.then(reg=>reg.active?.postMessage({type:"SHOW_NOTIFICATION",title:language==="ar"?"Aqua Nexus • متابعة الحوض":"Aqua Nexus • Tank follow-up",body:language==="ar"?`الحوض ${stale.map(x=>x.name).join("، ")} بحاجة متابعة بعد أكثر من أسبوع.`:`${stale.map(x=>x.name).join(", ")} needs attention after more than a week.`,tag:"aqua-weekly-followup",url:"/"})).catch(()=>{});
    localStorage.setItem("aqua-nexus-last-reminder",key);
   }
  }
  localStorage.setItem(`aqua-nexus-last-visit:${tank.id}`,String(now));
 },[tank,tanks,language]);

 async function enablePhoneReminders(){
  if(typeof window==="undefined"||!("Notification" in window)){setReminderNote(language==="ar"?"هذا المتصفح لا يدعم تنبيهات النظام.":"System notifications are not supported here.");return;}
  const permission=await Notification.requestPermission();
  setReminderNote(permission==="granted"?(language==="ar"?"تم تفعيل تنبيهات الهاتف.":"Phone notifications enabled."):(language==="ar"?"لم يتم السماح بالتنبيهات.":"Notification permission was not granted."));
  if(permission==="granted") navigator.serviceWorker?.ready.then(reg=>reg.active?.postMessage({type:"SHOW_NOTIFICATION",title:"Aqua Nexus",body:language==="ar"?"تم تفعيل تنبيهات متابعة الأحواض.":"Aquarium follow-up notifications are enabled.",tag:"aqua-notification-enabled",url:"/"})).catch(()=>{});
 }

 function handleSelectTank(id:string){
  if(typeof window!=="undefined") localStorage.setItem(`aqua-nexus-last-visit:${id}`,String(Date.now()));
  selectTank(id);
 }

 // Full wizard state
 const [step,setStep]=useState(1),[name,setName]=useState(""),[type,setType]=useState<TankType>("marine"),[status,setStatus]=useState<TankStatus>("new"),[ageMonths,setAgeMonths]=useState(0);
 const [l,setL]=useState(120),[w,setW]=useState(60),[h,setH]=useState(60),[loss,setLoss]=useState(15);
 const [hasSump,setHasSump]=useState(true),[sl,setSl]=useState(100),[sw,setSw]=useState(40),[sh,setSh]=useState(35),[fill,setFill]=useState(75),[count,setCount]=useState(3);
 const [equipment,setEquipment]=useState<EquipmentKind[]>(["lighting","waveMaker","overflow","returnPump","heater"]);
 const [maintenanceDone,setMaintenanceDone]=useState(true);
 const chemCfg:any=CHEMISTRY_CATALOG[type];
 const [chem,setChem]=useState<Record<string,number>>({});
 const [useDefaults,setUseDefaults]=useState(true);

 const wizardSteps=[
  tr(language,"tankIdentity"),tr(language,"dimensions"),tr(language,"sumpSetup"),
  tr(language,"coreEquipment"),tr(language,"routineMaintenance"),tr(language,"initialChemistry"),tr(language,"review")
 ];

 const preview=useMemo(()=>{
   const gross=l*w*h/1000,net=gross*(1-loss/100),sumpNet=hasSump?sl*sw*sh/1000*fill/100:0;
   return {gross,net,system:net+sumpNet};
 },[l,w,h,loss,hasSump,sl,sw,sh,fill]);

 function resetWizard(){
  setStep(1);setName("");setType("marine");setStatus("new");setAgeMonths(0);
  setL(120);setW(60);setH(60);setLoss(15);setHasSump(true);setSl(100);setSw(40);setSh(35);setFill(75);setCount(3);
  setEquipment(["lighting","waveMaker","overflow","returnPump","heater"]);setMaintenanceDone(true);setChem({});setUseDefaults(true);
 }

 function create(){
  const id=uid("tank"),each=sl/Math.max(1,count);
  const values:Record<string,number|null>={};
  Object.entries(chemCfg).forEach(([k,m]:[string,any])=>values[k]=chem[k] ?? (useDefaults ? m.def : null));
  const weeklyTask = {id:uid("task"),title:"قياس النسب الكيميائية الأسبوعي",titleEn:"Weekly chemistry measurement",cadence:"weekly" as const,done:false,nextDue:new Date(Date.now()+7*86400000).toISOString().slice(0,10),manual:false};
  const newTank:Tank={
   id,name:name||tr(language,"addTank"),type,status,ageMonths,
   display:{length:l,width:w,height:h,displacementPercent:loss,grossLiters:preview.gross,netLiters:preview.net},
   sump:{enabled:hasSump,dimensions:{length:sl,width:sw,height:sh},operatingFillPercent:fill,chambers:hasSump?Array.from({length:count},(_,i)=>({id:uid("ch"),name:`حجرة ${i+1}`,nameEn:`Chamber ${i+1}`,x:i*each,y:0,length:each,width:sw,height:sh,waterHeight:sh*fill/100,media:[]})):[]},
   systemVolumeLiters:preview.system,
   equipment:equipment.map((kind)=>({id:uid("eq"),name:equipOptions.find(x=>x.kind===kind)?.en||kind,kind,location:kind==="lighting"||kind==="waveMaker"||kind==="overflow"?"display":hasSump&&kind==="returnPump"?`sump:${count?`ch-${count}`:""}`:"external",status:"on",displayPosition:undefined} as any)),
   chemistry:[{timestamp:nowISO(),values,usingDefaults:useDefaults}],
   maintenance:maintenanceDone?[weeklyTask,{id:uid("task"),title:"تنظيف وفحص النظام",titleEn:"Inspect and clean system",cadence:"weekly",done:false,nextDue:new Date(Date.now()+7*86400000).toISOString().slice(0,10)}]:[weeklyTask],
   livestock:[],inventory:[],timeline:[{id:uid("ev"),timestamp:nowISO(),type:"setup",textAr:"تم إنشاء الحوض عبر معالج الإعداد الذكي.",textEn:"Tank created using the Smart Setup Wizard."}],photos:[],feeding:[],dosing:[],doserChannels:[],quarantine:[],expenses:[],waterChanges:[],rodi:[],createdAt:nowISO()
  };
  addTank(newTank);setOpen(false);resetWizard();setPage("dashboard");
 }

 if(!tank) return <main className="app-shell"><button className="btn primary" onClick={()=>setOpen(true)}>{tr(language,"addTank")}</button></main>;

 const themeClass=tank.type==="marine"?"theme-marine":"theme-freshwater";
 return <main className={`app-shell ${themeClass}`} dir={language==="ar"?"rtl":"ltr"}>
  {attention.length>0&&<div className="tank-attention-banner"><div><b>🔔 {language==="ar"?"متابعة مطلوبة":"Follow-up needed"}</b><span>{language==="ar"?`مرّ أكثر من أسبوع بدون متابعة: ${attention.join("، ")}`:`More than a week without a check-in: ${attention.join(", ")}`}</span></div><div className="attention-actions"><button className="btn primary" onClick={enablePhoneReminders}>{language==="ar"?"تفعيل تنبيهات الهاتف":"Enable phone alerts"}</button><button className="icon-btn" onClick={()=>setAttention([])}>×</button></div></div>}
  {reminderNote&&<div className="toast-note">{reminderNote}</div>}
  <header className="topbar topbar-v12 interactive-header"><div className="brand"><div className="brand-mark">AN</div><div><strong>Aqua Nexus 3D</strong><small>{tr(language,"brand")}</small></div></div>
   <div className="top-actions"><select className="select" value={selectedTankId} onChange={e=>handleSelectTank(e.target.value)}>{tanks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button className="btn" onClick={()=>setLanguage(language==="ar"?"en":"ar")}>{language==="ar"?"EN":"AR"}</button><button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(language,"addTank")}</button></div>
   <MainNav active={page} onChange={setPage} lang={language}/>
  </header>
  <PageRouter page={page} tank={tank} tanks={tanks} selectedTankId={selectedTankId} onSelectTank={id=>{handleSelectTank(id);setPage("dashboard")}} onNavigate={setPage}/>

  <AquaAIAssistant tank={tank} page={page} onNavigate={setPage}/>

  <Modal open={open} title={tr(language,"smartSetup")} onClose={()=>setOpen(false)}>
   <div className="wizard-step-label"><b>{step}. {wizardSteps[step-1]}</b><span>{step}/7</span></div>
   <div className="wizard-progress"><i style={{width:`${step/7*100}%`}}/></div>

   {step===1&&<div className="form-grid">
    <label className="field"><span>{tr(language,"name")}</span><input value={name} onChange={e=>setName(e.target.value)}/></label>
    <label className="field"><span>{tr(language,"type")}</span><select value={type} onChange={e=>setType(e.target.value as TankType)}><option value="marine">{tr(language,"marine")}</option><option value="freshwater">{tr(language,"freshwater")}</option></select></label>
    <label className="field"><span>{tr(language,"status")}</span><select value={status} onChange={e=>setStatus(e.target.value as TankStatus)}><option value="new">{tr(language,"new")}</option><option value="cycling">{tr(language,"cycling")}</option><option value="established">{tr(language,"established")}</option></select></label>
    <label className="field"><span>{tr(language,"ageMonths")}</span><input type="number" min="0" value={ageMonths} onChange={e=>setAgeMonths(Number(e.target.value))}/></label>
   </div>}

   {step===2&&<div className="form-grid">
    <label className="field"><span>L cm</span><input type="number" value={l} onChange={e=>setL(Number(e.target.value))}/></label>
    <label className="field"><span>W cm</span><input type="number" value={w} onChange={e=>setW(Number(e.target.value))}/></label>
    <label className="field"><span>H cm</span><input type="number" value={h} onChange={e=>setH(Number(e.target.value))}/></label>
    <label className="field"><span>{tr(language,"displacement")} %</span><input type="number" value={loss} onChange={e=>setLoss(Number(e.target.value))}/></label>
    <div className="wizard-summary full-field">{preview.net.toFixed(1)} L net</div>
   </div>}

   {step===3&&<div><div className="choice-row"><button className={`btn ${hasSump?"primary":""}`} onClick={()=>setHasSump(true)}>Sump</button><button className={`btn ${!hasSump?"primary":""}`} onClick={()=>setHasSump(false)}>No Sump</button></div>
    {hasSump&&<div className="form-grid"><label className="field"><span>Sump L</span><input type="number" value={sl} onChange={e=>setSl(Number(e.target.value))}/></label><label className="field"><span>Sump W</span><input type="number" value={sw} onChange={e=>setSw(Number(e.target.value))}/></label><label className="field"><span>Sump H</span><input type="number" value={sh} onChange={e=>setSh(Number(e.target.value))}/></label><label className="field"><span>Fill %</span><input type="number" value={fill} onChange={e=>setFill(Number(e.target.value))}/></label><label className="field"><span>{tr(language,"sumpChambers")}</span><input type="number" min="1" max="12" value={count} onChange={e=>setCount(Number(e.target.value))}/></label></div>}
   </div>}

   {step===4&&<div className="wizard-options">{equipOptions.map(x=><label className={`select-tile ${equipment.includes(x.kind)?"selected":""}`} key={x.kind}><input type="checkbox" checked={equipment.includes(x.kind)} onChange={e=>setEquipment(v=>e.target.checked?[...v,x.kind]:v.filter(k=>k!==x.kind))}/><span>{language==="ar"?x.ar:x.en}</span></label>)}</div>}

   {step===5&&<div className="choice-row"><button className={`btn ${maintenanceDone?"primary":""}`} onClick={()=>setMaintenanceDone(true)}>{bi(language,"نعم، مطبقة","Yes, established")}</button><button className={`btn ${!maintenanceDone?"primary":""}`} onClick={()=>setMaintenanceDone(false)}>{bi(language,"لا، سأبدأ الآن","No, start now")}</button></div>}

   {step===6&&<div><div className="form-grid">{Object.entries(chemCfg).map(([k,m]:[string,any])=><label className="field" key={k}><span>{m.label}</span><input type="number" step="any" placeholder={String(m.def)} value={chem[k]??""} onChange={e=>setChem(v=>({...v,[k]:Number(e.target.value)}))}/></label>)}</div><label className="checkbox-row"><input type="checkbox" checked={useDefaults} onChange={e=>setUseDefaults(e.target.checked)}/><span>{tr(language,"useDefaults")}</span></label></div>}

   {step===7&&<div className="wizard-review">
     <div><small>{tr(language,"name")}</small><b>{name||"—"}</b></div>
     <div><small>{tr(language,"type")}</small><b>{type==="marine"?tr(language,"marine"):tr(language,"freshwater")}</b></div>
     <div><small>{tr(language,"dimensions")}</small><b>{l}×{w}×{h} cm</b></div>
     <div><small>{tr(language,"displayVolume")}</small><b>{preview.net.toFixed(1)} L</b></div>
     <div><small>{tr(language,"systemVolume")}</small><b>{preview.system.toFixed(1)} L</b></div>
     <div><small>{tr(language,"equipment")}</small><b>{equipment.length}</b></div>
   </div>}

   <div className="modal-actions">{step>1&&<button className="btn" onClick={()=>setStep(step-1)}>{tr(language,"back")}</button>}{step<7?<button className="btn primary" onClick={()=>setStep(step+1)}>{tr(language,"next")}</button>:<button className="btn primary" onClick={create}>{tr(language,"finish")}</button>}</div>
  </Modal>
 </main>;
}
