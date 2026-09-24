"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { MainNav,type AppPage } from "@/components/navigation/MainNav";
import { PageRouter } from "@/components/pages/PageRouter";
import { Modal } from "@/components/ui/Modal";
import { AquaAIAssistant } from "@/components/AquaAIAssistant";
import { TrainingCoach } from "@/components/dashboard/TrainingCoach";
import type { EquipmentKind,Tank,TankStatus,TankType } from "@/domain/types";
import { CHEMISTRY_CATALOG } from "@/data/legacyCatalogs";
import { tr,bi } from "@/i18n";
import { daysFrom,uid,nowISO,today } from "@/lib/appUtils";
import { systemHealth } from "@/domain/systemHealth";
import { biologicalCycleStatus,isCyclePageAllowed } from "@/domain/biologicalCycle";
import { BiologicalCyclePanel } from "@/components/cycle/BiologicalCyclePanel";
import { syncPushReminders } from "@/lib/pushNotifications";
import { validateTankSetupEntry } from "@/domain/inputSanity";
import { validateChemistryValues } from "@/domain/chemistryDataQuality";
import { archivedPageAllowed,isTankArchived } from "@/domain/tankLifecycle";
import { AcademyWizardHelp } from "@/components/academy/AcademyWizardHelp";
import type { AcademyLessonId } from "@/data/academy";

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
 const state=useAquaStore(),{tanks,selectedTankId,selectTank,language,setLanguage,addTank}=state,[page,setPage]=useState<AppPage>("dashboard"),[open,setOpen]=useState(false),[attention,setAttention]=useState<string[]>([]),[reminderNote,setReminderNote]=useState(""),[trainingPreviewId,setTrainingPreviewId]=useState<string|null>(null);
 const reminderChecked=useRef(false);
 const [storeHydrated,setStoreHydrated]=useState(()=>useAquaStore.persist.hasHydrated());
 const [introDone,setIntroDone]=useState(false);

 useEffect(()=>{
  if(useAquaStore.persist.hasHydrated())setStoreHydrated(true);
  const unsub=useAquaStore.persist.onFinishHydration(()=>setStoreHydrated(true));
  const timer=window.setTimeout(()=>setIntroDone(true),1600);
  return()=>{unsub();window.clearTimeout(timer);};
 },[]);
 const trainingTanks=tanks.filter(t=>t.isTraining);
 const realTanks=tanks.filter(t=>!t.isTraining);
 const selectedTank=tanks.find(t=>t.id===selectedTankId)??realTanks[0]??trainingTanks[0];
 const tank=(trainingPreviewId?trainingTanks.find(t=>t.id===trainingPreviewId):undefined)??selectedTank;
 const system=tank?systemHealth(tank):null;
 const showOnboarding=realTanks.length===0&&!trainingPreviewId;
 const cycle=tank?biologicalCycleStatus(tank):null;
 const archived=Boolean(tank&&isTankArchived(tank));
 const allPages:AppPage[]=["dashboard","tanks","equipment","lighting","sump","livestock","lifejourney","consumption","acclimation","library","chemistry","maintenance","inventory","diseases","timeline","journal","waterchange","feeding","dosing","quarantine","emergency","rodi","expenses","alerts","reports","settings","academy"];
 const lockedPages:AppPage[]=archived
  ?allPages.filter(p=>p!=="academy"&&!archivedPageAllowed(p))
  :(cycle?.active?allPages.filter(p=>p!=="academy"&&!isCyclePageAllowed(p)):[]);
 const navigatePage=(next:AppPage)=>{
  if(next==="academy"){setPage("academy");return;}
  if(archived&&!archivedPageAllowed(next)){setPage("dashboard");return;}
  if(cycle?.active&&!isCyclePageAllowed(next)){setPage("dashboard");return;}
  setPage(next);
 };

 useEffect(()=>{
  if(page==="academy")return;
  if(archived&&!archivedPageAllowed(page)){setPage("dashboard");return;}
  if(cycle?.active&&!isCyclePageAllowed(page))setPage("dashboard");
 },[archived,cycle?.active,page,tank?.id]);

 useEffect(()=>{
  const handler=(event:Event)=>{const next=(event as CustomEvent<AppPage>).detail;if(next)navigatePage(next)};
  window.addEventListener("aqua:navigate",handler);
  return()=>window.removeEventListener("aqua:navigate",handler);
 },[archived,cycle?.active]);

 useEffect(()=>{
  if(typeof window==="undefined"||!("Notification" in window)||Notification.permission!=="granted")return;
  const timer=window.setTimeout(()=>{void syncPushReminders(tanks,language,false).catch(()=>{})},1800);
  return()=>window.clearTimeout(timer);
 },[tanks,language]);

 useEffect(()=>{
  if(reminderChecked.current||!tank||typeof window==="undefined")return;
  reminderChecked.current=true;
  const now=Date.now(),week=7*86400000;
  const stale=tanks.filter(t=>!t.isTraining).filter(t=>{
   const raw=localStorage.getItem(`aqua-nexus-last-visit:${t.id}`);
   if(!raw){localStorage.setItem(`aqua-nexus-last-visit:${t.id}`,String(now));return false;}
   const last=Number(raw);
   return Number.isFinite(last)&&now-last>=week;
  });
  setAttention(stale.map(t=>t.name));
  if(stale.length&&"Notification" in window&&Notification.permission==="granted"){
   const key=`${today()}:${stale.map(x=>x.id).join(",")}`;
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
  const next=tanks.find(t=>t.id===id);
  if(typeof window!=="undefined"&&!next?.isTraining) localStorage.setItem(`aqua-nexus-last-visit:${id}`,String(Date.now()));
  setTrainingPreviewId(next?.isTraining?id:null);
  selectTank(id);
 }

 // Full wizard state
 const [step,setStep]=useState(1),[name,setName]=useState(""),[type,setType]=useState<TankType>("marine"),[profile,setProfile]=useState<"auto"|"fishOnly"|"reef"|"planted">("auto"),[status,setStatus]=useState<TankStatus>("new"),[ageMonths,setAgeMonths]=useState(0);
 const [l,setL]=useState(120),[w,setW]=useState(60),[h,setH]=useState(60),[loss,setLoss]=useState(15);
 const [hasSump,setHasSump]=useState(true),[sl,setSl]=useState(100),[sw,setSw]=useState(40),[sh,setSh]=useState(35),[fill,setFill]=useState(75),[count,setCount]=useState(3);
 const [equipment,setEquipment]=useState<EquipmentKind[]>(["lighting","waveMaker","overflow","returnPump","heater"]);
 const [maintenanceDone,setMaintenanceDone]=useState(true);
 const chemCfg:any=CHEMISTRY_CATALOG[type];
 const [chem,setChem]=useState<Record<string,number>>({});

 const wizardSteps=[
  tr(language,"tankIdentity"),tr(language,"dimensions"),tr(language,"sumpSetup"),
  tr(language,"coreEquipment"),tr(language,"routineMaintenance"),tr(language,"initialChemistry"),tr(language,"review")
 ];
 const wizardAcademyLesson:AcademyLessonId=([
  "aquarium-system","aquarium-system","filtration-sump","filtration-sump","maintenance-waterchanges","chemistry","tank-brain-ai"
 ] as AcademyLessonId[])[step-1]??"aquarium-system";

 const preview=useMemo(()=>{
   const gross=l*w*h/1000,net=gross*(1-loss/100),sumpNet=hasSump?sl*sw*sh/1000*fill/100:0;
   return {gross,net,system:net+sumpNet};
 },[l,w,h,loss,hasSump,sl,sw,sh,fill]);

 const setupCheck=useMemo(()=>validateTankSetupEntry({
  length:l,width:w,height:h,displacementPercent:loss,ageMonths,
  sumpEnabled:hasSump,sumpLength:sl,sumpWidth:sw,sumpHeight:sh,sumpFillPercent:fill
 }),[l,w,h,loss,ageMonths,hasSump,sl,sw,sh,fill]);
 const wizardValues=useMemo(()=>{
  const values:Record<string,number|null>={};
  // Only values explicitly typed by the user are measurements. Catalog defaults
  // stay visual references and never enter Tank chemistry/history as evidence.
  Object.keys(chemCfg).forEach(k=>values[k]=typeof chem[k]==="number"&&Number.isFinite(chem[k])?chem[k]:null);
  return values;
 },[chemCfg,chem]);
 const hasMeasuredWizardChemistry=useMemo(()=>Object.values(wizardValues).some(v=>typeof v==="number"&&Number.isFinite(v)),[wizardValues]);
 const wizardValidationTank=useMemo(()=>({
  id:"wizard-validation",name:name||"Wizard",type,ecosystemProfile:profile==="auto"?undefined:profile,status:status==="new"?"cycling":status,ageMonths,
  display:{length:l,width:w,height:h,displacementPercent:loss,grossLiters:preview.gross,netLiters:preview.net},
  sump:{enabled:hasSump,dimensions:{length:sl,width:sw,height:sh},operatingFillPercent:fill,chambers:[]},
  systemVolumeLiters:preview.system,equipment:[],chemistry:[],maintenance:[],livestock:[],inventory:[],timeline:[],photos:[],feeding:[],dosing:[],doserChannels:[],quarantine:[],expenses:[],waterChanges:[],rodi:[],createdAt:nowISO()
 } as Tank),[name,type,profile,status,ageMonths,l,w,h,loss,preview.gross,preview.net,preview.system,hasSump,sl,sw,sh,fill]);
 const wizardChemIssues=useMemo(()=>validateChemistryValues(wizardValidationTank,wizardValues),[wizardValidationTank,wizardValues]);
 const wizardStepIssue=step<=3?setupCheck.issues[0]:step===6?wizardChemIssues[0]:undefined;

 function resetWizard(){
  setStep(1);setName("");setType("marine");setProfile("auto");setStatus("new");setAgeMonths(0);
  setL(120);setW(60);setH(60);setLoss(15);setHasSump(true);setSl(100);setSw(40);setSh(35);setFill(75);setCount(3);
  setEquipment(["lighting","waveMaker","overflow","returnPump","heater"]);setMaintenanceDone(true);setChem({});
 }

 function create(){
  if(!setupCheck.ok){const issue=setupCheck.issues[0];window.alert(language==="ar"?issue.ar:issue.en);return;}
  if(!Number.isFinite(count)||count<1||count>12){window.alert(language==="ar"?"عدد حجرات السامب يجب أن يكون بين 1 و12.":"Sump chamber count must be between 1 and 12.");return;}
  if(wizardChemIssues.length){const issue=wizardChemIssues[0];window.alert(language==="ar"?issue.ar:issue.en);return;}
  const id=uid("tank"),each=sl/Math.max(1,count),createdAt=nowISO();
  const cycleMode=status==="new"||status==="cycling";
  const chamberRows=hasSump?Array.from({length:count},(_,i)=>({id:uid("ch"),name:`حجرة ${i+1}`,nameEn:`Chamber ${i+1}`,x:i*each,y:0,length:each,width:sw,height:sh,waterHeight:sh*fill/100,media:[]})):[];
  const returnChamberId=chamberRows[chamberRows.length-1]?.id;
  const values:Record<string,number|null>={...wizardValues};
  const weeklyTask = {id:uid("task"),title:cycleMode?"فحص كيمياء الدورة البيولوجية":"قياس النسب الكيميائية الأسبوعي",titleEn:cycleMode?"Biological cycle chemistry test":"Weekly chemistry measurement",cadence:"weekly" as const,done:false,nextDue:daysFrom(today(),cycleMode?1:7),manual:false,sourceDomain:cycleMode?"system" as const:undefined,sourceId:cycleMode?"cycle:chemistry":undefined};
  const inspectTask = {id:uid("task"),title:cycleMode?"فحص تشغيل الفلترة والمضخات أثناء الدورة":"تنظيف وفحص النظام",titleEn:cycleMode?"Check filtration and pumps during cycling":"Inspect and clean system",cadence:"weekly" as const,done:false,nextDue:new Date(Date.now()+(cycleMode?1:7)*86400000).toISOString().slice(0,10),manual:false,sourceDomain:cycleMode?"system" as const:undefined,sourceId:cycleMode?"cycle:equipment":undefined};
  const newTank:Tank={
   id,name:name||tr(language,"addTank"),type,ecosystemProfile:profile==="auto"?undefined:profile,status:cycleMode?"cycling":status,ageMonths,
   display:{length:l,width:w,height:h,displacementPercent:loss,grossLiters:preview.gross,netLiters:preview.net},
   sump:{enabled:hasSump,dimensions:{length:sl,width:sw,height:sh},operatingFillPercent:fill,chambers:chamberRows},
   systemVolumeLiters:preview.system,
   equipment:equipment.map((kind)=>({id:uid("eq"),name:equipOptions.find(x=>x.kind===kind)?.en||kind,kind,location:kind==="lighting"||kind==="waveMaker"||kind==="overflow"?"display":hasSump&&kind==="returnPump"&&returnChamberId?`sump:${returnChamberId}`:"external",status:"on",displayPosition:undefined} as any)),
   chemistry:hasMeasuredWizardChemistry?[{timestamp:nowISO(),values,usingDefaults:false,source:"manual",confidence:"medium"}]:[],
   maintenance:maintenanceDone?[weeklyTask,inspectTask]:[weeklyTask],
   livestock:[],inventory:[],timeline:[{id:uid("ev"),timestamp:createdAt,type:"setup",textAr:cycleMode?"تم إنشاء الحوض وبدأت الدورة البيولوجية تلقائياً — اليوم 1.":"تم إنشاء الحوض عبر معالج الإعداد الذكي.",textEn:cycleMode?"Tank created and Biological Cycling Mode started automatically — day 1.":"Tank created using the Smart Setup Wizard."}],photos:[],feeding:[],dosing:[],doserChannels:[],quarantine:[],expenses:[],waterChanges:[],rodi:[],biologicalCycle:cycleMode?{startedAt:createdAt,method:"fishless"}:undefined,createdAt
  };
  addTank(newTank);setTrainingPreviewId(null);setOpen(false);resetWizard();setPage("dashboard");
 }

 const wizardModal=(
  <Modal open={open} title={tr(language,"smartSetup")} onClose={()=>setOpen(false)}>
   <div className="wizard-step-label"><b>{step}. {wizardSteps[step-1]}</b><span>{step}/7</span></div>
   <div className="wizard-progress"><i style={{width:`${step/7*100}%`}}/></div>
   <AcademyWizardHelp lessonId={wizardAcademyLesson} lang={language}/>

   {step===1&&<div className="form-grid">
    <label className="field"><span>{tr(language,"name")}</span><input value={name} onChange={e=>setName(e.target.value)}/></label>
    <label className="field"><span>{tr(language,"type")}</span><select value={type} onChange={e=>{setType(e.target.value as TankType);setProfile("auto")}}><option value="marine">{tr(language,"marine")}</option><option value="freshwater">{tr(language,"freshwater")}</option></select></label><label className="field"><span>{bi(language,"بروفايل الحوض","Tank profile")}</span><select value={profile} onChange={e=>setProfile(e.target.value as any)}><option value="auto">Auto</option>{type==="marine"?<><option value="reef">Reef</option><option value="fishOnly">Fish-only</option></>:<><option value="planted">Planted</option><option value="fishOnly">Fish-only</option></>}</select></label>
    <label className="field"><span>{tr(language,"status")}</span><select value={status} onChange={e=>setStatus(e.target.value as TankStatus)}><option value="new">{tr(language,"new")}</option><option value="cycling">{tr(language,"cycling")}</option><option value="established">{tr(language,"established")}</option></select></label>
    <label className="field"><span>{tr(language,"ageMonths")}</span><input type="number" min="0" value={ageMonths} onChange={e=>setAgeMonths(Number(e.target.value))}/></label>
   </div>}

   {step===2&&<div className="form-grid">
    <label className="field"><span>L cm</span><input type="number" value={l} onChange={e=>setL(Number(e.target.value))}/></label>
    <label className="field"><span>W cm</span><input type="number" value={w} onChange={e=>setW(Number(e.target.value))}/></label>
    <label className="field"><span>H cm</span><input type="number" value={h} onChange={e=>setH(Number(e.target.value))}/></label>
    <label className="field"><span>{tr(language,"displacement")} %</span><input type="number" value={loss} onChange={e=>setLoss(Number(e.target.value))}/><small>{bi(language,"إذا ما بتعرفها، 15% تقدير بداية فقط ويمكن تعديله لاحقاً.","If unknown, 15% is only a starting estimate and can be changed later.")}</small></label>
    <div className="wizard-summary full-field">{preview.net.toFixed(1)} L net</div>
   </div>}

   {step===3&&<div><div className="choice-row"><button className={`btn ${hasSump?"primary":""}`} onClick={()=>setHasSump(true)}>Sump</button><button className={`btn ${!hasSump?"primary":""}`} onClick={()=>setHasSump(false)}>No Sump</button></div>
    {hasSump&&<><div className="form-grid"><label className="field"><span>Sump L</span><input type="number" value={sl} onChange={e=>setSl(Number(e.target.value))}/></label><label className="field"><span>Sump W</span><input type="number" value={sw} onChange={e=>setSw(Number(e.target.value))}/></label><label className="field"><span>Sump H</span><input type="number" value={sh} onChange={e=>setSh(Number(e.target.value))}/></label><label className="field"><span>Fill %</span><input type="number" value={fill} onChange={e=>setFill(Number(e.target.value))}/></label><label className="field"><span>{tr(language,"sumpChambers")}</span><input type="number" min="1" max="12" value={count} onChange={e=>setCount(Number(e.target.value))}/></label></div><div className="inline-alert info" style={{marginTop:10}}>{bi(language,"إذا ما بتعرف منسوب التشغيل أو عدد الحجر بدقة، استخدم تقديراً مبدئياً وعدّله لاحقاً من صفحة السامب؛ هالقيم ليست قياسات كيميائية ولا تؤثر على سجل الفحوص.","If the operating level or chamber count is not known exactly, use a starting estimate and refine it later on the Sump page; these are setup estimates, not chemistry measurements.")}</div></>}
   </div>}

   {step===4&&<div className="wizard-options">{equipOptions.map(x=><label className={`select-tile ${equipment.includes(x.kind)?"selected":""}`} key={x.kind}><input type="checkbox" checked={equipment.includes(x.kind)} onChange={e=>setEquipment(v=>e.target.checked?[...v,x.kind]:v.filter(k=>k!==x.kind))}/><span>{language==="ar"?x.ar:x.en}</span></label>)}</div>}

   {step===5&&<div className="choice-row"><button className={`btn ${maintenanceDone?"primary":""}`} onClick={()=>setMaintenanceDone(true)}>{bi(language,"نعم، مطبقة","Yes, established")}</button><button className={`btn ${!maintenanceDone?"primary":""}`} onClick={()=>setMaintenanceDone(false)}>{bi(language,"لا، سأبدأ الآن","No, start now")}</button></div>}

   {step===6&&<div><div className="inline-alert info" style={{marginBottom:10}}><b>{bi(language,"سجّل فقط قياسات فعلية","Enter measured values only")}</b><p>{bi(language,"إذا ما عندك فحوص الآن اترك الحقول فارغة وكمل. الأرقام الرمادية هي قيم مرجعية للمقارنة فقط ولن تُحفظ كقياسات ولن تدخل Health أو Tank Brain أو إكمال الفحص الأسبوعي.","If you have no tests now, leave the fields blank and continue. Gray numbers are reference values only; they are never saved as measurements and never count toward Health, Tank Brain, or weekly test completion.")}</p></div><div className="form-grid">{Object.entries(chemCfg).map(([k,m]:[string,any])=><label className="field" key={k}><span>{m.label}</span><input type="number" step="any" placeholder={bi(language,"مرجع "+m.def,"Reference "+m.def)} value={chem[k]??""} onChange={e=>{const raw=e.target.value;setChem(v=>{const next={...v};if(raw==="")delete next[k];else next[k]=Number(raw);return next;})}}/><small>{bi(language,"اتركه فارغاً إذا لم تقسه.","Leave blank unless you measured it.")}</small></label>)}</div><button type="button" className="btn" style={{marginTop:10}} onClick={()=>setChem({})}>{bi(language,"ما عندي قياسات الآن — متابعة بدون فحوص","I have no measurements now — continue without tests")}</button></div>}

   {step===7&&<div className="wizard-review">
     <div><small>{tr(language,"name")}</small><b>{name||"—"}</b></div>
     <div><small>{tr(language,"type")}</small><b>{type==="marine"?tr(language,"marine"):tr(language,"freshwater")}</b></div>
     <div><small>{tr(language,"dimensions")}</small><b>{l}×{w}×{h} cm</b></div>
     <div><small>{tr(language,"displayVolume")}</small><b>{preview.net.toFixed(1)} L</b></div>
     <div><small>{tr(language,"systemVolume")}</small><b>{preview.system.toFixed(1)} L</b></div>
     <div><small>{tr(language,"equipment")}</small><b>{equipment.length}</b></div>
     <div><small>{bi(language,"الكيمياء","Chemistry")}</small><b>{hasMeasuredWizardChemistry?bi(language,"قياسات فعلية مدخلة","Measured values entered"):bi(language,"بدون قياسات حالياً","No measurements yet")}</b></div>
     {(status==="new"||status==="cycling")&&<div className="full-field inline-alert warn"><b>{bi(language,"الدورة البيولوجية ستبدأ تلقائياً من اليوم 1.","Biological Cycling Mode will start automatically on day 1.")}</b><br/>{bi(language,"خلالها Aqua Nexus يوقف العمليات غير المرتبطة بالدورة حتى تثبت الجاهزية من القياسات.","During cycling, Aqua Nexus locks non-cycle workflows until readiness is proven by measured tests.")}</div>}
   </div>}

   {wizardStepIssue&&<div className="inline-alert danger" role="alert">{language==="ar"?wizardStepIssue.ar:wizardStepIssue.en}</div>}
   {step===3&&(!Number.isFinite(count)||count<1||count>12)&&<div className="inline-alert danger" role="alert">{bi(language,"عدد حجرات السامب يجب أن يكون بين 1 و12.","Sump chamber count must be between 1 and 12.")}</div>}
   <div className="modal-actions">{step>1&&<button className="btn" onClick={()=>setStep(step-1)}>{tr(language,"back")}</button>}{step<7?<button className="btn primary" disabled={Boolean(wizardStepIssue)||(step===3&&(!Number.isFinite(count)||count<1||count>12))} onClick={()=>setStep(step+1)}>{tr(language,"next")}</button>:<button className="btn primary" disabled={!setupCheck.ok||wizardChemIssues.length>0||!Number.isFinite(count)||count<1||count>12} onClick={create}>{tr(language,"finish")}</button>}</div>
  </Modal>
 );

 if(!storeHydrated||!introDone) return <main className="aqua-local-boot" aria-label="Aqua Nexus loading">
  <div className="aqua-local-boot-glow" aria-hidden="true"/>
  <div className="aqua-local-boot-card">
   <img src="/aqua-nexus-icon-192.png" alt="" width="116" height="116"/>
   <strong>AQUA NEXUS</strong>
   <small className="aqua-loading-label">LOADING<span className="aqua-loading-dots" aria-hidden="true">...</span></small>
  </div>
  <style>{`
   .aqua-local-boot{position:relative;overflow:hidden;min-height:100dvh;display:grid;place-items:center;background:radial-gradient(circle at 50% 45%,#0a3b52 0,#052432 28%,#03121c 62%);color:#ecfbff;padding:24px}
   .aqua-local-boot-glow{position:absolute;width:210px;height:210px;border-radius:50%;background:rgba(45,215,244,.16);filter:blur(32px);animation:aquaBootGlow 1.35s ease-in-out infinite alternate}
   .aqua-local-boot-card{position:relative;z-index:1;display:grid;justify-items:center;gap:12px;text-align:center;animation:aquaBootCard .72s cubic-bezier(.2,.8,.2,1) both}
   .aqua-local-boot-card img{border-radius:27px;box-shadow:0 18px 55px rgba(0,0,0,.34),0 0 32px rgba(62,219,255,.22);animation:aquaBootIcon 1.15s cubic-bezier(.18,.82,.22,1) both}
   .aqua-local-boot-card strong{font-size:22px;letter-spacing:.16em;opacity:0;animation:aquaBootText .45s ease .38s forwards}
   .aqua-local-boot-card small{color:#9cc7d5;font-size:12px;letter-spacing:.16em;opacity:0;animation:aquaBootText .4s ease .55s forwards}\n   .aqua-loading-dots{display:inline-block;width:1.55em;text-align:left;overflow:hidden;vertical-align:bottom;animation:aquaLoadingDots 1.15s steps(4,end) infinite}\n   @keyframes aquaLoadingDots{0%{width:0}100%{width:1.55em}}
   @keyframes aquaBootIcon{0%{opacity:0;transform:translateY(22px) scale(.42)}55%{opacity:1;transform:translateY(-3px) scale(1.08)}100%{opacity:1;transform:translateY(0) scale(1)}}
   @keyframes aquaBootCard{0%{opacity:.3;transform:scale(.94)}100%{opacity:1;transform:scale(1)}}
   @keyframes aquaBootText{to{opacity:1;transform:translateY(0)}from{opacity:0;transform:translateY(7px)}}
   @keyframes aquaBootGlow{from{transform:scale(.82);opacity:.55}to{transform:scale(1.12);opacity:1}}
   @media (prefers-reduced-motion:reduce){.aqua-local-boot-card,.aqua-local-boot-card img,.aqua-local-boot-card strong,.aqua-local-boot-card small,.aqua-local-boot-glow{animation:none;opacity:1}}
  `}</style>
 </main>;

 if(showOnboarding||!tank) return <main className="app-shell empty-tank-shell" dir={language==="ar"?"rtl":"ltr"}>
  <header className="empty-tank-topbar">
   <div className="brand"><div className="brand-mark">AN</div><div><strong>Aqua Nexus 3D</strong><small>{tr(language,"brand")}</small></div></div>
   <button className="btn empty-language-btn" onClick={()=>setLanguage(language==="ar"?"en":"ar")}>{language==="ar"?"EN":"AR"}</button>
  </header>

  <section className="empty-tank-state" aria-labelledby="empty-tank-title">
   <div className="empty-tank-visual" aria-hidden="true">
    <div className="empty-tank-glass">
     <span className="empty-bubble bubble-one"/>
     <span className="empty-bubble bubble-two"/>
     <span className="empty-bubble bubble-three"/>
     <span className="empty-water-line"/>
     <span className="empty-fish">◇</span>
    </div>
   </div>
   <small className="eyebrow-mini">AQUA NEXUS • SMART SETUP</small>
   <h1 id="empty-tank-title">{language==="ar"?"ابدأ أول حوض لديك":"Create your first aquarium"}</h1>
   <p>{language==="ar"?"ما عندك حوض شخصي مضاف حالياً. أنشئ حوضك الأول لتبدأ المتابعة، الفحوصات، الصيانة والذاكرة الذكية.":"You do not have a personal aquarium yet. Create your first tank to start tracking tests, maintenance, history and smart insights."}</p>
   <button className="btn primary empty-tank-cta" onClick={()=>{resetWizard();setOpen(true)}}>+ {tr(language,"addTank")}</button>
   <span className="empty-tank-note">{language==="ar"?"سيتم فتح معالج الإعداد الذكي خطوة بخطوة.":"The Smart Setup Wizard will guide you step by step."}</span>

   <div className="training-entry">
    <div className="training-entry-title"><span/><b>{language==="ar"?"أو استكشف المنصة بحوض تدريبي":"Or explore with a training aquarium"}</b><span/></div>
    <div className="training-entry-grid">
     {trainingTanks.map(t=><button key={t.id} className="training-entry-card" onClick={()=>{handleSelectTank(t.id);setPage("dashboard")}}>
      <span className="training-entry-icon">{t.type==="marine"?"🌊":"🌿"}</span>
      <span><b>{language==="ar"?(t.type==="marine"?"حوض تدريب بحري":"حوض تدريب نهري"):(t.type==="marine"?"Marine Training Tank":"Freshwater Training Tank")}</b><small>{language==="ar"?`صحة ${systemHealth(t).score}% • بيانات تدريبية محمية`:`${systemHealth(t).score}% health • protected training data`}</small></span>
      <strong>→</strong>
     </button>)}
    </div>
   </div>
  </section>

  {wizardModal}

  <style jsx>{`
   .empty-tank-shell{min-height:100dvh;display:flex;flex-direction:column;position:relative;overflow:hidden;background:
    radial-gradient(circle at 50% 18%,rgba(31,211,205,.14),transparent 34%),
    radial-gradient(circle at 22% 82%,rgba(0,119,182,.12),transparent 30%),
    linear-gradient(180deg,#062533 0%,#031c28 52%,#041b25 100%)}
   .empty-tank-shell:before{content:"";position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 15%,rgba(255,255,255,.025) 48%,transparent 70%)}
   .empty-tank-topbar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:18px clamp(18px,4vw,42px);border-bottom:1px solid rgba(255,255,255,.06)}
   .empty-language-btn{min-width:56px}
   .empty-tank-state{position:relative;z-index:1;flex:1;width:min(680px,calc(100% - 34px));margin:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:48px 0 72px}
   .empty-tank-visual{width:150px;height:150px;display:grid;place-items:center;margin-bottom:24px;border-radius:42px;background:radial-gradient(circle,rgba(42,222,210,.14),rgba(42,222,210,.03) 58%,transparent 70%);filter:drop-shadow(0 22px 40px rgba(0,0,0,.22))}
   .empty-tank-glass{position:relative;width:112px;height:82px;border:2px solid rgba(109,237,228,.56);border-radius:16px 16px 22px 22px;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(13,100,120,.08));box-shadow:inset 0 0 28px rgba(54,219,213,.06),0 0 28px rgba(35,214,207,.08)}
   .empty-water-line{position:absolute;left:7px;right:7px;top:28px;height:1px;background:linear-gradient(90deg,transparent,rgba(102,235,225,.75),transparent);box-shadow:0 0 12px rgba(102,235,225,.45)}
   .empty-fish{position:absolute;left:46px;top:43px;font-size:25px;line-height:1;color:#73eadf;transform:rotate(-8deg);text-shadow:0 0 14px rgba(115,234,223,.5)}
   .empty-bubble{position:absolute;border:1px solid rgba(126,236,229,.7);border-radius:50%}
   .bubble-one{width:7px;height:7px;left:29px;top:17px}.bubble-two{width:5px;height:5px;left:38px;top:10px}.bubble-three{width:4px;height:4px;right:24px;top:20px}
   .empty-tank-state h1{margin:8px 0 10px;font-size:clamp(30px,6vw,46px);letter-spacing:-.025em}
   .empty-tank-state p{max-width:590px;margin:0 0 24px;font-size:clamp(14px,2.4vw,17px);line-height:1.8;opacity:.72}
   .empty-tank-cta{min-width:210px;min-height:52px;padding-inline:26px;font-size:16px;font-weight:850;border-radius:16px;box-shadow:0 14px 34px rgba(0,207,193,.2)}
   .empty-tank-note{margin-top:12px;font-size:12px;opacity:.48}
   .training-entry{width:min(620px,100%);margin-top:30px}.training-entry-title{display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:12px;opacity:.64}.training-entry-title span{height:1px;flex:1;background:rgba(255,255,255,.1)}
   .training-entry-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.training-entry-card{border:1px solid rgba(94,225,216,.16);background:rgba(255,255,255,.035);color:inherit;border-radius:16px;padding:13px 14px;display:grid;grid-template-columns:38px 1fr 18px;align-items:center;gap:10px;text-align:start;cursor:pointer;transition:.18s ease}.training-entry-card:hover{transform:translateY(-1px);border-color:rgba(94,225,216,.36);background:rgba(77,220,211,.07)}.training-entry-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:rgba(63,210,202,.09)}.training-entry-card b,.training-entry-card small{display:block}.training-entry-card small{margin-top:3px;font-size:10px;opacity:.55}.training-entry-card strong{opacity:.5}
   @media(max-width:620px){
    .empty-tank-topbar{padding:14px 16px}.empty-tank-topbar .brand small{display:none}
    .empty-tank-state{width:calc(100% - 28px);padding:28px 0 58px}
    .empty-tank-visual{width:132px;height:132px;margin-bottom:18px}
    .empty-tank-state h1{font-size:30px}.empty-tank-state p{font-size:14px;line-height:1.7;margin-bottom:20px}
    .empty-tank-cta{width:min(290px,100%)}.training-entry{margin-top:24px}.training-entry-grid{grid-template-columns:1fr}.training-entry-card{width:100%}
   }
  `}</style>
 </main>;

 const themeClass=tank.type==="marine"?"theme-marine":"theme-freshwater";
 return <main className={`app-shell ${themeClass}`} dir={language==="ar"?"rtl":"ltr"}>
  {!cycle?.active&&attention.length>0&&<div className="tank-attention-banner"><div><b>🔔 {language==="ar"?"متابعة مطلوبة":"Follow-up needed"}</b><span>{language==="ar"?`مرّ أكثر من أسبوع بدون متابعة: ${attention.join("، ")}`:`More than a week without a check-in: ${attention.join(", ")}`}</span></div><div className="attention-actions"><button className="btn primary" onClick={enablePhoneReminders}>{language==="ar"?"تفعيل تنبيهات الهاتف":"Enable phone alerts"}</button><button className="icon-btn" onClick={()=>setAttention([])}>×</button></div></div>}
  {reminderNote&&<div className="toast-note">{reminderNote}</div>}
  <header className="topbar topbar-v12 interactive-header"><div className="brand"><div className="brand-mark">AN</div><div><strong>Aqua Nexus 3D</strong><small>{tr(language,"brand")}</small></div></div>
   <div className="top-actions"><select className="select" value={tank.id} onChange={e=>handleSelectTank(e.target.value)}>{tanks.map(t=><option key={t.id} value={t.id}>{t.isTraining?(language==="ar"?(t.type==="marine"?"🎓 حوض التدريب البحري":"🎓 حوض التدريب النهري"):(t.type==="marine"?"🎓 Marine Training Tank":"🎓 Freshwater Training Tank")):t.name}</option>)}</select><button className="btn" onClick={()=>setLanguage(language==="ar"?"en":"ar")}>{language==="ar"?"EN":"AR"}</button><button className="btn primary" onClick={()=>setOpen(true)}>+ {tr(language,"addTank")}</button></div>
   <MainNav active={page} onChange={navigatePage} lang={language} tank={tank} lockedPages={lockedPages}/>
  </header>
  {page==="dashboard"&&tank.isTraining&&<TrainingCoach tank={tank} onNavigate={navigatePage}/>}
  {page==="dashboard"&&cycle?.active&&<BiologicalCyclePanel tank={tank} onNavigate={navigatePage}/>}
  {cycle?.active&&page!=="dashboard"&&<div className="tank-attention-banner cycle-global-banner"><div><b>🧪 {language==="ar"?`الدورة البيولوجية — اليوم ${cycle.day}`:`Biological cycle — day ${cycle.day}`}</b><span>{language==="ar"?cycle.nextAr:cycle.nextEn}</span></div><span className="status warn">{cycle.progress}%</span></div>}
  {!cycle?.active&&system&&system.compatibilityAudit.issues.length>0&&<div className={`tank-attention-banner compatibility-global-banner ${system.compatibilityAudit.level==="danger"?"danger":"warn"}`}><div><b>⚠ {language==="ar"?"تعارض مستمر بين كائنات الحوض":"Persistent livestock compatibility conflict"}</b><span>{language==="ar"?system.compatibilityAudit.issues[0].ar:system.compatibilityAudit.issues[0].en}{system.compatibilityAudit.issues.length>1?(language==="ar"?` • +${system.compatibilityAudit.issues.length-1} ملاحظة أخرى`:` • +${system.compatibilityAudit.issues.length-1} more`):""}</span></div><button className="btn" onClick={()=>navigatePage("livestock")}>{language==="ar"?"مراجعة التوافق":"Review compatibility"}</button></div>}
  {!(cycle?.active&&page==="dashboard")&&<PageRouter page={page} tank={tank} tanks={tanks} selectedTankId={selectedTankId} onSelectTank={id=>{handleSelectTank(id);setPage("dashboard")}} onNavigate={navigatePage}/>} 

  <AquaAIAssistant tank={tank} page={page} onNavigate={navigatePage}/>

  {wizardModal}
 </main>;
}
