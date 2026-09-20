"use client";
import { useEffect,useRef,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { downloadText,today } from "@/lib/appUtils";
import { syncPushReminders } from "@/lib/pushNotifications";
import { CURRENT_BACKUP_SCHEMA,validateBackupPayload } from "@/domain/backupValidation";

export function SettingsPage({tank}:{tank:Tank}) {
 const state=useAquaStore(),patch=useAquaStore(s=>s.patchTank),del=useAquaStore(s=>s.deleteTank),replace=useAquaStore(s=>s.replaceData),[name,setName]=useState(tank.name),file=useRef<HTMLInputElement>(null),lang=state.language;
 const [notificationState,setNotificationState]=useState<"unknown"|"enabled"|"disabled"|"unsupported"|"busy">("unknown");
 const [notificationNote,setNotificationNote]=useState("");
 const [backupNote,setBackupNote]=useState<{kind:"good"|"danger";text:string}|null>(null);
 const profile=tank.ecosystemProfile??"auto";
 const energy=tank.energySettings??{pricePerKwh:0,currency:"USD"};
 const exportBackup=()=>downloadText(`Aqua_Nexus_Backup_${today()}.json`,JSON.stringify({app:"Aqua Nexus",schemaVersion:CURRENT_BACKUP_SCHEMA,exportedAt:new Date().toISOString(),language:state.language,selectedTankId:state.selectedTankId,tanks:state.tanks},null,2));

 useEffect(()=>{
  if(typeof window==="undefined")return;
  if(!("Notification" in window)||!("serviceWorker" in navigator)){setNotificationState("unsupported");return;}
  setNotificationState(Notification.permission==="granted"?"enabled":"disabled");
 },[]);

 function importFile(f?:File){
  if(!f)return;
  setBackupNote(null);
  if(f.size>10*1024*1024){setBackupNote({kind:"danger",text:lang==="ar"?"ملف النسخة الاحتياطية أكبر من 10 MB. أوقف الاستيراد للتحقق من الملف.":"Backup file is larger than 10 MB. Import was stopped so the file can be reviewed."});return}
  const r=new FileReader();
  r.onload=()=>{
   try{
    const parsed=JSON.parse(String(r.result));
    const validated=validateBackupPayload(parsed);
    if(!validated.ok){setBackupNote({kind:"danger",text:(lang==="ar"?"النسخة الاحتياطية غير صالحة: ":"Invalid backup: ")+validated.error});return}
    replace(validated.data);
    setBackupNote({kind:"good",text:lang==="ar"?`تم التحقق من النسخة واستيراد ${validated.data.tanks.length} حوض بأمان.`:`Backup validated and ${validated.data.tanks.length} tank(s) imported safely.`});
   }catch{
    setBackupNote({kind:"danger",text:lang==="ar"?"ملف JSON غير صالح أو تالف. لم يتم تغيير بياناتك.":"The JSON file is invalid or corrupted. Your current data was not changed."});
   }
  };
  r.onerror=()=>setBackupNote({kind:"danger",text:lang==="ar"?"تعذر قراءة الملف. لم يتم تغيير بياناتك.":"The file could not be read. Your current data was not changed."});
  r.readAsText(f);
 }

 async function enableNotifications(){
  if(typeof window==="undefined")return;
  const isiOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone=(window.matchMedia?.("(display-mode: standalone)").matches)||(navigator as Navigator & {standalone?:boolean}).standalone===true;
  if(isiOS&&!standalone){
   setNotificationNote(lang==="ar"?"على الآيفون: أضف Aqua Nexus إلى الشاشة الرئيسية أولاً، ثم ارجع إلى الإعدادات وفعّل التنبيهات.":"On iPhone, add Aqua Nexus to the Home Screen first, then return to Settings and enable notifications.");
   return;
  }
  if(!("Notification" in window)||!("serviceWorker" in navigator)){
   setNotificationState("unsupported");
   setNotificationNote(lang==="ar"?"التنبيهات غير مدعومة على هذا المتصفح.":"Notifications are not supported in this browser.");
   return;
  }
  setNotificationState("busy");
  const permission=await Notification.requestPermission();
  if(permission!=="granted"){
   setNotificationState("disabled");
   setNotificationNote(lang==="ar"?"لم يتم السماح بالتنبيهات من النظام.":"Notification permission was not granted by the system.");
   return;
  }
  localStorage.setItem("aqua-nexus-notification-prompt-v1","seen");
  try{
   const result=await syncPushReminders(state.tanks,lang,true);
   setNotificationState("enabled");
   setNotificationNote(result.ok
    ?(lang==="ar"?"تم تفعيل تنبيهات متابعة الأحواض وعدم الاستقرار.":"Tank follow-up and instability alerts are enabled.")
    :(lang==="ar"?"تم منح إذن التنبيهات. إذا تعذر Web Push حالياً سيبقى الإذن محفوظاً ويمكن إعادة المحاولة من هنا.":"Notification permission is granted. If Web Push is temporarily unavailable, you can retry here later."));
  }catch{
   setNotificationState("enabled");
   setNotificationNote(lang==="ar"?"تم منح إذن التنبيهات، لكن تعذر تسجيل Web Push حالياً. أعد المحاولة لاحقاً من هذه الصفحة.":"Notification permission is granted, but Web Push registration failed. Retry later from this page.");
  }
 }

 const notificationsEnabled=notificationState==="enabled";
 const notificationStatus=notificationState==="unsupported"
  ?(lang==="ar"?"غير مدعومة":"Unsupported")
  :notificationsEnabled
   ?(lang==="ar"?"مفعّلة":"Enabled")
   :(lang==="ar"?"غير مفعّلة":"Disabled");

 return <section className="page-grid"><PageHeader eyebrow="SETTINGS" title={tr(lang,"settings")}/>
 <div className="card panel"><label className="field"><span>{tr(lang,"language")}</span><select value={lang} onChange={e=>state.setLanguage(e.target.value as any)}><option value="ar">{tr(lang,"arabic")}</option><option value="en">{tr(lang,"english")}</option></select></label><label className="field"><span>{tr(lang,"name")}</span><input value={name} onChange={e=>setName(e.target.value)}/></label><button className="btn primary" onClick={()=>patch(tank.id,{name})}>{tr(lang,"save")}</button><div className="inline-alert good">{tr(lang,"actualTranslationNote")}</div></div>

 <div className="card panel">
  <h3>{bi(lang,"بروفايل الحوض والحسابات","Tank profile & calculations")}</h3>
  <p className="note">{bi(lang,"البروفايل يؤثر على أهداف الكيمياء ومتطلبات الإنارة/الحركة وتقييم التجهيزات. Auto يستنتج من الكائنات.","The profile affects chemistry targets, lighting/flow requirements and equipment adequacy. Auto infers from livestock.")}</p>
  <label className="field"><span>{bi(lang,"بروفايل النظام","System profile")}</span><select value={profile} onChange={e=>patch(tank.id,t=>({...t,ecosystemProfile:e.target.value==="auto"?undefined:e.target.value as any}))}><option value="auto">Auto</option>{tank.type==="marine"?<><option value="reef">Reef</option><option value="fishOnly">Fish-only</option></>:<><option value="planted">Planted</option><option value="fishOnly">Fish-only</option></>}</select></label>
  <div className="form-grid"><label className="field"><span>{bi(lang,"سعر الكهرباء / kWh","Electricity price / kWh")}</span><input type="number" min="0" step="any" value={energy.pricePerKwh} onChange={e=>patch(tank.id,t=>({...t,energySettings:{pricePerKwh:Number(e.target.value),currency:t.energySettings?.currency||"USD"}}))}/></label><label className="field"><span>{tr(lang,"currency")}</span><input value={energy.currency} onChange={e=>patch(tank.id,t=>({...t,energySettings:{pricePerKwh:t.energySettings?.pricePerKwh??0,currency:e.target.value}}))}/></label></div>
 </div>

 <div className="card panel">
  <h3>🔔 {lang==="ar"?"تنبيهات الهاتف":"Phone notifications"}</h3>
  <p className="note">{lang==="ar"?"تنبيهات عند مرور أكثر من أسبوع بدون متابعة الحوض، أو عندما تصبح حالة الحوض غير مستقرة.":"Alerts when a tank has not been checked for over a week, or when its condition becomes unstable."}</p>
  <div className={`inline-alert ${notificationsEnabled?"good":"warn"}`}>{lang==="ar"?"الحالة":"Status"}: <b>{notificationStatus}</b></div>
  {notificationNote&&<div className="note" style={{marginTop:10}}>{notificationNote}</div>}
  {notificationState!=="unsupported"&&<button className="btn primary" style={{marginTop:10}} onClick={enableNotifications} disabled={notificationState==="busy"||notificationsEnabled}>{notificationState==="busy"?(lang==="ar"?"جاري التفعيل...":"Enabling..."):notificationsEnabled?(lang==="ar"?"التنبيهات مفعّلة":"Notifications enabled"):(lang==="ar"?"تفعيل التنبيهات":"Enable notifications")}</button>}
 </div>

 <div className="card panel"><h3>{tr(lang,"dataSync")}</h3><p className="note">{tr(lang,"localStorageNote")}</p><div className="inline-alert info">{bi(lang,"النسخة الحالية Local-first. ملف JSON هو نسخة الاستعادة الكاملة؛ Cloud account/sync يبقى مرحلة SaaS منفصلة ولا يتم ادعاء وجوده قبل بنائه فعلياً.","The current build is local-first. JSON is the full recovery backup; cloud account/sync remains a separate SaaS phase and is not presented as active until actually implemented.")}</div><button className="btn" onClick={exportBackup}>{tr(lang,"export")} JSON</button> <button className="btn" onClick={()=>file.current?.click()}>{tr(lang,"import")}</button><input ref={file} type="file" accept=".json,application/json" hidden onChange={e=>{importFile(e.target.files?.[0]);e.currentTarget.value=""}}/>{backupNote&&<div className={`inline-alert ${backupNote.kind}`} style={{marginTop:10}}>{backupNote.text}</div>}<hr/><button className="btn danger" onClick={()=>{if(confirm(tr(lang,"confirmDeleteTank")))del(tank.id)}}>{tr(lang,"deleteTank")}</button></div>
 </section>;
}
