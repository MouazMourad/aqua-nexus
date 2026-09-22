"use client";
import { useEffect,useRef,useState } from "react";
import type { Tank } from "@/domain/types";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdvancedSection } from "@/components/ui/AdvancedSection";
import { ContextHint } from "@/components/ui/ContextHint";
import { downloadText,today,uid,nowISO } from "@/lib/appUtils";
import { syncPushReminders } from "@/lib/pushNotifications";
import { validateBackupPayload,type ValidBackupPayload } from "@/domain/backupValidation";
import { externalizeAllTankPhotos } from "@/lib/photoStorage";
import { activeRelocation,activeVacation,isTankArchived } from "@/domain/tankLifecycle";
import { sanitizeBounded,validateEnergySettings } from "@/domain/inputSanity";
import { buildVacationTaskDrafts,vacationDays } from "@/domain/vacationPlan";
import { clearTankHistoryArchive } from "@/lib/historyArchiveStorage";
import { buildCompleteRecoveryBackup } from "@/lib/recoveryBackup";
import { readDataSafetyStatus,subscribeDataSafety,type DataSafetyStatus } from "@/lib/dataSafetyStatus";
import { deviceBackupEnabled,setDeviceBackupEnabled as persistDeviceBackup,subscribeDeviceBackupSetting } from "@/lib/deviceBackupSettings";
import { clearLongTermHistory,longTermHistoryStats } from "@/lib/longTermHistory";
import { FEATURE_DISCOVERY_TOTAL,readFeatureDiscovery,resetFeatureDiscovery,setFeatureDiscoveryMode,subscribeFeatureDiscovery,type FeatureDiscoveryState } from "@/lib/featureDiscovery";
import { resetContextHints } from "@/lib/contextHints";
import { AQUA_MODEL_VERSIONS,AQUA_NEXUS_VERSION } from "@/domain/version";
import { clearRecoveryCheckpoint,readRecoveryCheckpoint,saveRecoveryCheckpoint } from "@/lib/recoveryCheckpoint";

type RestorePreview={fileName:string;tankCount:number;exportedAt?:string;olderThanCurrent:boolean;names:string[]};

function latestActivityMs(tanks:Tank[]){
 let latest=0;
 const take=(value?:string)=>{if(!value)return;const ms=new Date(value).getTime();if(Number.isFinite(ms))latest=Math.max(latest,ms)};
 for(const t of tanks){
  take(t.createdAt);
  for(const rows of [t.chemistry,t.timeline,t.feeding,t.dosing,t.waterChanges,t.rodi,t.rodiServiceEvents??[],t.plantCare??[],t.livestockExits??[],t.deviceTelemetry??[],t.topOff??[],t.deviceAlerts??[]] as Array<Array<{timestamp:string}>>)for(const row of rows)take(row.timestamp);
  for(const m of t.maintenance){take(m.lastDone);take(m.nextDue)}
  for(const q of t.quarantine){take(q.lastDoseAt);take(q.responseObservedAt)}
 }
 return latest;
}

export function SettingsPage({tank}:{tank:Tank}) {
 const state=useAquaStore(),patch=useAquaStore(s=>s.patchTank),del=useAquaStore(s=>s.deleteTank),replace=useAquaStore(s=>s.replaceData),[name,setName]=useState(tank.name),file=useRef<HTMLInputElement>(null),lang=state.language;
 const [notificationState,setNotificationState]=useState<"unknown"|"enabled"|"disabled"|"unsupported"|"busy">("unknown");
 const [notificationNote,setNotificationNote]=useState("");
 const [backupNote,setBackupNote]=useState<{kind:"good"|"danger";text:string}|null>(null);
 const pendingRestore=useRef<ValidBackupPayload|null>(null);
 const [restorePreview,setRestorePreview]=useState<RestorePreview|null>(null),[checkpointAvailable,setCheckpointAvailable]=useState(false);
 const [dataSafety,setDataSafety]=useState<DataSafetyStatus>({persistence:"ok"});
 const [deviceBackup,setDeviceBackup]=useState(false);
 const [archiveCount,setArchiveCount]=useState(0);
 const [featureDiscovery,setFeatureDiscovery]=useState<FeatureDiscoveryState>({mode:"smart",learned:[]});
 const [vacationEnd,setVacationEnd]=useState(""),[vacationNotes,setVacationNotes]=useState("");
 const [moveFrom,setMoveFrom]=useState(""),[moveTo,setMoveTo]=useState(""),[moveNotes,setMoveNotes]=useState("");
 const [restartReason,setRestartReason]=useState(""),[archiveReason,setArchiveReason]=useState("");
 const vacation=activeVacation(tank),relocation=activeRelocation(tank),archived=isTankArchived(tank);
 const profile=tank.ecosystemProfile??"auto";
 const energy=tank.energySettings??{pricePerKwh:0,currency:"USD"};
 const exportBackup=async()=>{
  setBackupNote(null);
  try{
   const backup=await buildCompleteRecoveryBackup({tanks:state.tanks,language:state.language,aquariumExperience:state.aquariumExperience,selectedTankId:state.selectedTankId});
   downloadText(`Aqua_Nexus_Backup_${today()}.json`,JSON.stringify(backup,null,2));
   setBackupNote({kind:"good",text:lang==="ar"?`نسخة الاستعادة مكتملة: ${backup.tanks.length} حوض و ${backup.recovery.photoAssets} صورة، مع كل التاريخ المؤرشف.`:`Complete recovery backup created: ${backup.tanks.length} tank(s), ${backup.recovery.photoAssets} photo(s), including archived history.`});
  }catch(e){
   setBackupNote({kind:"danger",text:(lang==="ar"?"لم يتم إنشاء Backup ناقص. السبب: ":"Incomplete backup was blocked. Reason: ")+(e instanceof Error?e.message:String(e))});
  }
 };

 useEffect(()=>{
  setFeatureDiscovery(readFeatureDiscovery());
  void readRecoveryCheckpoint().then(x=>setCheckpointAvailable(Boolean(x))).catch(()=>setCheckpointAvailable(false));
  const offFeature=subscribeFeatureDiscovery(setFeatureDiscovery);
  return offFeature;
 },[]);

 useEffect(()=>{
  setDataSafety(readDataSafetyStatus());
  setDeviceBackup(deviceBackupEnabled());
  void longTermHistoryStats(tank.id).then(x=>setArchiveCount(x.total)).catch(()=>setArchiveCount(0));
  const offSafety=subscribeDataSafety(setDataSafety),offBackup=subscribeDeviceBackupSetting(setDeviceBackup);
  return()=>{offSafety();offBackup()};
 },[tank.id]);

 useEffect(()=>{
  if(typeof window==="undefined")return;
  if(!("Notification" in window)||!("serviceWorker" in navigator)){setNotificationState("unsupported");return;}
  setNotificationState(Notification.permission==="granted"?"enabled":"disabled");
 },[]);

 async function checkpointCurrent(reason:"restore"|"delete-tank",detail?:string){
  const backup=await buildCompleteRecoveryBackup({tanks:state.tanks,language:state.language,aquariumExperience:state.aquariumExperience,selectedTankId:state.selectedTankId});
  await saveRecoveryCheckpoint({createdAt:nowISO(),reason,detail,backup});
  setCheckpointAvailable(true);
  return backup;
 }

 function importFile(f?:File){
  if(!f)return;
  setBackupNote(null);setRestorePreview(null);pendingRestore.current=null;
  if(f.size>100*1024*1024){setBackupNote({kind:"danger",text:lang==="ar"?"ملف النسخة الاحتياطية أكبر من 100 MB. أوقف الاستيراد للتحقق من الملف.":"Backup file is larger than 100 MB. Import was stopped so the file can be reviewed."});return}
  const r=new FileReader();
  r.onload=()=>{
   try{
    const parsed=JSON.parse(String(r.result));
    const validated=validateBackupPayload(parsed);
    if(!validated.ok){setBackupNote({kind:"danger",text:(lang==="ar"?"النسخة الاحتياطية غير صالحة: ":"Invalid backup: ")+validated.error});return}
    pendingRestore.current=validated.data;
    const exportedAt=typeof parsed.exportedAt==="string"&&Number.isFinite(new Date(parsed.exportedAt).getTime())?parsed.exportedAt:undefined;
    const currentLatest=latestActivityMs(state.tanks.filter(t=>!t.isTraining));
    const olderThanCurrent=Boolean(exportedAt&&currentLatest&&new Date(exportedAt).getTime()<currentLatest);
    setRestorePreview({fileName:f.name,tankCount:validated.data.tanks.filter(t=>!t.isTraining).length,exportedAt,olderThanCurrent,names:validated.data.tanks.filter(t=>!t.isTraining).slice(0,5).map(t=>t.name)});
   }catch{
    setBackupNote({kind:"danger",text:lang==="ar"?"ملف JSON غير صالح أو تالف. لم يتم تغيير بياناتك.":"The JSON file is invalid or corrupted. Your current data was not changed."});
   }
  };
  r.onerror=()=>setBackupNote({kind:"danger",text:lang==="ar"?"تعذر قراءة الملف. لم يتم تغيير بياناتك.":"The file could not be read. Your current data was not changed."});
  r.readAsText(f);
 }

 async function confirmRestore(){
  const data=pendingRestore.current;if(!data)return;
  setBackupNote(null);
  try{
   await checkpointCurrent("restore",restorePreview?.fileName);
   const tanks=await externalizeAllTankPhotos(data.tanks);
   const ids=new Set([...state.tanks.map(t=>t.id),...tanks.map(t=>t.id)]);
   for(const id of ids){await clearTankHistoryArchive(id);await clearLongTermHistory(id);}
   replace({...data,tanks});
   pendingRestore.current=null;setRestorePreview(null);
   setBackupNote({kind:"good",text:lang==="ar"?`تمت الاستعادة بعد إنشاء Checkpoint تلقائي. يمكنك التراجع من زر Undo Restore.`:`Restore completed after an automatic checkpoint. You can revert with Undo Restore.`});
  }catch(e){
   setBackupNote({kind:"danger",text:(lang==="ar"?"تم إيقاف الاستعادة لأن Aqua Nexus لم يستطع ضمان نقطة رجوع آمنة: ":"Restore was blocked because Aqua Nexus could not guarantee a safe rollback point: ")+(e instanceof Error?e.message:String(e))});
  }
 }

 async function undoLastDestructiveAction(){
  setBackupNote(null);
  try{
   const checkpoint=await readRecoveryCheckpoint();
   if(!checkpoint){setCheckpointAvailable(false);setBackupNote({kind:"danger",text:lang==="ar"?"ما في Checkpoint متاح للتراجع.":"No recovery checkpoint is available."});return}
   const validated=validateBackupPayload(checkpoint.backup);
   if(!validated.ok)throw new Error(validated.error);
   const tanks=await externalizeAllTankPhotos(validated.data.tanks);
   const ids=new Set([...state.tanks.map(t=>t.id),...tanks.map(t=>t.id)]);
   for(const id of ids){await clearTankHistoryArchive(id);await clearLongTermHistory(id);}
   replace({...validated.data,tanks});
   await clearRecoveryCheckpoint();setCheckpointAvailable(false);pendingRestore.current=null;setRestorePreview(null);
   setBackupNote({kind:"good",text:lang==="ar"?"تم التراجع واستعادة الحالة السابقة من الـCheckpoint.":"Previous state restored from the recovery checkpoint."});
  }catch(e){
   setBackupNote({kind:"danger",text:(lang==="ar"?"تعذر التراجع بأمان: ":"Safe rollback failed: ")+(e instanceof Error?e.message:String(e))});
  }
 }

 async function deleteCurrentTank(){
  if(!confirm(tr(lang,"confirmDeleteTank")))return;
  try{
   await checkpointCurrent("delete-tank",tank.name);
   del(tank.id);
  }catch(e){
   window.alert((lang==="ar"?"تم إيقاف الحذف لأن إنشاء Checkpoint آمن فشل: ":"Delete was blocked because a safe checkpoint could not be created: ")+(e instanceof Error?e.message:String(e)));
  }
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

 function startVacation(){
  if(vacation)return;
  const ts=nowISO(),start=today(),days=vacationDays(start,vacationEnd||undefined);
  if(vacationEnd&&!days){window.alert(lang==="ar"?"تاريخ العودة يجب أن يكون اليوم أو بعده.":"Planned return must be today or later.");return}
  const row={id:uid("vac"),startedAt:ts,plannedEndAt:vacationEnd||undefined,notes:vacationNotes.trim()||undefined};
  patch(tank.id,t=>{
    const generated=days?buildVacationTaskDrafts({departure:start,daysAway:days,tankType:t.type}).map(x=>({...x,id:uid("travel")})):[];
    const keep=t.maintenance.filter(x=>!x.title.startsWith("[TRAVEL]")&&!(x.titleEn||"").startsWith("[TRAVEL]"));
    return {...t,lifecycle:{...(t.lifecycle??{}),vacations:[...(t.lifecycle?.vacations??[]),row]},maintenance:generated.length?[...generated,...keep]:t.maintenance,timeline:[{id:uid("ev"),timestamp:ts,type:"lifecycle-vacation",textAr:generated.length?"بدأ وضع السفر/الغياب وتم إنشاء خطة متابعة تلقائياً.":"بدأ وضع السفر/الغياب للحوض.",textEn:generated.length?"Tank vacation/away mode started and an automatic care plan was created.":"Tank vacation/away mode started."},...t.timeline]};
  });
 }
 function endVacation(){
  if(!vacation)return; const ts=nowISO(),due=today();
  patch(tank.id,t=>{
    const hasReturn=t.maintenance.some(x=>!x.done&&(/بعد العودة/.test(x.title)||/After return/i.test(x.titleEn||"")));
    const returnTask=hasReturn?[]:[{id:uid("travel-return"),title:"[TRAVEL] بعد العودة: فحص كيمياء كامل ومقارنة الحالة مع ما قبل السفر",titleEn:"[TRAVEL] After return: run a full chemistry test and compare with the pre-travel baseline",cadence:"once" as const,done:false,nextDue:due,manual:true}];
    return {...t,lifecycle:{...(t.lifecycle??{}),vacations:(t.lifecycle?.vacations??[]).map(x=>x.id===vacation.id?{...x,endedAt:ts}:x)},maintenance:[...returnTask,...t.maintenance],timeline:[{id:uid("ev"),timestamp:ts,type:"lifecycle-vacation",textAr:"انتهى وضع السفر/الغياب؛ أضيفت متابعة ما بعد العودة عند الحاجة.",textEn:"Tank vacation/away mode ended; a post-return follow-up was added when needed."},...t.timeline]};
  });
 }
 function startMove(){
  if(relocation)return; const ts=nowISO(),row={id:uid("move"),startedAt:ts,status:"in_progress" as const,from:moveFrom.trim()||undefined,to:moveTo.trim()||undefined,notes:moveNotes.trim()||undefined};
  patch(tank.id,t=>({...t,lifecycle:{...(t.lifecycle??{}),relocations:[...(t.lifecycle?.relocations??[]),row]},timeline:[{id:uid("ev"),timestamp:ts,type:"lifecycle-relocation",textAr:"بدأ نقل/ترحيل الحوض.",textEn:"Tank relocation started."},...t.timeline]}));
 }
 function completeMove(){
  if(!relocation)return; const ts=nowISO();
  patch(tank.id,t=>({...t,lifecycle:{...(t.lifecycle??{}),relocations:(t.lifecycle?.relocations??[]).map(x=>x.id===relocation.id?{...x,status:"completed" as const,completedAt:ts}:x)},timeline:[{id:uid("ev"),timestamp:ts,type:"lifecycle-relocation",textAr:"اكتمل نقل الحوض؛ تبدأ الآن مرحلة مراقبة الاستقرار.",textEn:"Tank relocation completed; post-move stabilization monitoring begins."},...t.timeline]}));
 }
 function majorRestart(){
  if(tank.livestock.length>0){window.alert(lang==="ar"?"إعادة التشغيل الكبرى مقفلة بوجود كائنات مسجلة داخل الحوض. سجّل نقل/خروج الكائنات أولاً حتى ما يتحول الإجراء الإداري إلى مخاطرة فعلية.":"Major restart is locked while livestock are still recorded in the tank. Transfer/exit livestock first so this administrative action cannot create a real safety risk.");return}
  if(!window.confirm(lang==="ar"?"سيبدأ Aqua Nexus دورة بيولوجية جديدة من اليوم، مع الاحتفاظ بكل التاريخ السابق. هل هذا Restart فعلي للحوض؟":"Aqua Nexus will start a new biological cycle today while preserving all prior history. Is this a real tank restart?"))return;
  const ts=nowISO(),row={id:uid("restart"),timestamp:ts,reason:restartReason.trim()||undefined};
  patch(tank.id,t=>({...t,status:"cycling",biologicalCycle:{startedAt:ts,method:"fishless"},lifecycle:{...(t.lifecycle??{}),restarts:[...(t.lifecycle?.restarts??[]),row]},timeline:[{id:uid("ev"),timestamp:ts,type:"lifecycle-restart",textAr:"تم تسجيل إعادة تشغيل كبرى وبدء دورة بيولوجية جديدة مع حفظ التاريخ السابق.",textEn:"Major restart recorded; a new biological cycle started while prior history was preserved."},...t.timeline]}));
 }
 function archiveTank(){
  if((tank.acclimationSessions??[]).some(x=>x.status!=="completed")||(tank.emergencySessions??[]).some(x=>x.status==="active")){window.alert(lang==="ar"?"لا يمكن أرشفة الحوض أثناء إقلمة أو طوارئ نشطة. أغلق الحالة الحرجة أولاً.":"The tank cannot be archived during active acclimation or emergency work. Close the critical workflow first.");return}
  if(!window.confirm(lang==="ar"?"الأرشفة ستقفل العمليات التشغيلية وتبقي التاريخ والتقارير. متابعة؟":"Archiving will lock operational workflows while preserving history and reports. Continue?"))return;
  const ts=nowISO();patch(tank.id,t=>({...t,lifecycle:{...(t.lifecycle??{}),archivedAt:ts,archiveReason:archiveReason.trim()||undefined},timeline:[{id:uid("ev"),timestamp:ts,type:"lifecycle-archive",textAr:"تمت أرشفة الحوض.",textEn:"Tank archived."},...t.timeline]}));
 }
 function restoreArchivedTank(){
  const ts=nowISO();patch(tank.id,t=>({...t,lifecycle:{...(t.lifecycle??{}),archivedAt:undefined,archiveReason:undefined},timeline:[{id:uid("ev"),timestamp:ts,type:"lifecycle-restore",textAr:"تمت إعادة الحوض من الأرشيف.",textEn:"Tank restored from archive."},...t.timeline]}));
 }

 const notificationStatus=notificationState==="unsupported"
  ?(lang==="ar"?"غير مدعومة":"Unsupported")
  :notificationsEnabled
   ?(lang==="ar"?"مفعّلة":"Enabled")
   :(lang==="ar"?"غير مفعّلة":"Disabled");

 return <section className="page-grid"><PageHeader eyebrow="SETTINGS" title={tr(lang,"settings")}/>
 <div className="card panel full-span"><div className="module-head"><div><small className="eyebrow-mini">RELEASE & DECISION MODELS</small><h3>{bi(lang,"إصدار Aqua Nexus","Aqua Nexus version")}</h3><p className="note">{bi(lang,"كل قرار تاريخي جديد يُحفظ مع نسخة محركات القرار المستخدمة حتى تبقى النتائج قابلة للتدقيق بعد أي تحديث مستقبلي.","New historical decisions are stamped with the model versions used so results remain auditable after future updates.")}</p></div><span className="scene-badge">{AQUA_NEXUS_VERSION}</span></div><div className="summary-strip"><div className="summary"><small>Tank Brain</small><b>{AQUA_MODEL_VERSIONS.tankBrain}</b></div><div className="summary"><small>Health Model</small><b>{AQUA_MODEL_VERSIONS.health}</b></div><div className="summary"><small>Chemistry Evidence</small><b>{AQUA_MODEL_VERSIONS.chemistryEvidence}</b></div></div></div>
 <div className="card panel"><label className="field"><span>{tr(lang,"language")}</span><select value={lang} onChange={e=>state.setLanguage(e.target.value as any)}><option value="ar">{tr(lang,"arabic")}</option><option value="en">{tr(lang,"english")}</option></select></label><label className="field"><span>{tr(lang,"name")}</span><input value={name} onChange={e=>setName(e.target.value)}/></label><button className="btn primary" onClick={()=>patch(tank.id,{name})}>{tr(lang,"save")}</button><div className="inline-alert good">{tr(lang,"actualTranslationNote")}</div></div>

 <div className="card panel full-span aquarium-experience-card">
  <div className="module-head"><div><small className="eyebrow-mini">AQUARIUM EXPERIENCE</small><h3>{bi(lang,"خبرتك في الأحواض","Your aquarium experience")}</h3><p className="note">{bi(lang,"هذا الإعداد يغيّر عمق المعلومات والتحكم في الأحواض فقط. طريقة استخدام Aqua Nexus تبقى بسيطة وواضحة للجميع، وما في أي ميزة تختفي نهائياً.","This changes aquarium depth and control only. Aqua Nexus stays simple to use for everyone, and no feature becomes permanently inaccessible.")}</p></div><span className="scene-badge">{state.aquariumExperience==="beginner"?bi(lang,"مبتدئ","Beginner"):state.aquariumExperience==="intermediate"?bi(lang,"متوسط","Intermediate"):bi(lang,"متقدم","Advanced")}</span></div>
  <div className="experience-choice-grid">
   {[
    {id:"beginner",ar:"مبتدئ",en:"Beginner",arText:"قرار واضح، معنى الأرقام، وتحذيرات وخطوة تالية. التفاصيل المتقدمة تبقى بزر متقدم.",enText:"Clear decisions, what numbers mean, warnings and next action. Advanced detail stays one tap away."},
    {id:"intermediate",ar:"متوسط",en:"Intermediate",arText:"يظهر اتجاهات أكثر، أسباب محتملة، وربط بين الكيمياء والصيانة والمعدات.",enText:"Shows more trends, possible causes and links across chemistry, maintenance and equipment."},
    {id:"advanced",ar:"متقدم",en:"Advanced",arText:"يفتح عمق أكبر افتراضياً: Baselines، Correlations، أدلة القرار، وحسابات وتحكم أدق.",enText:"Opens deeper aquarium detail by default: baselines, correlations, evidence and finer controls."}
   ].map(x=><button type="button" key={x.id} className={`experience-choice ${state.aquariumExperience===x.id?"active":""}`} onClick={()=>state.setAquariumExperience(x.id as any)}><b>{lang==="ar"?x.ar:x.en}</b><span>{lang==="ar"?x.arText:x.enText}</span></button>)}
  </div>
  <div className="inline-alert info" style={{marginTop:10}}>{bi(lang,"مهم: «مبتدئ/متوسط/متقدم» يعني خبرة في تربية الأحياء المائية، وليس خبرة بالكمبيوتر أو الواجهات.","Important: Beginner / Intermediate / Advanced refers to aquarium-keeping experience, not computer or UI skill.")}</div>
 </div>

 <div className="card panel full-span feature-discovery-settings">
  <div className="module-head"><div><small className="eyebrow-mini">FEATURE DISCOVERY</small><h3>{bi(lang,"فقاعات تعليم الميزات","Feature discovery bubbles")}</h3><p className="note">{bi(lang,"Aqua Nexus يتذكر الميزات التي فتحتها، وما يعيد شرحها بالفقاعة. هذا الإعداد خاص بالبرنامج على هذا الجهاز، وليس بحوض واحد.","Aqua Nexus remembers features you have opened and stops repeating those tips. This preference applies to the app on this device, not one tank.")}</p></div><span className="scene-badge">{featureDiscovery.learned.length}/{FEATURE_DISCOVERY_TOTAL} {bi(lang,"تعلّمت","learned")}</span></div>
  <div className="experience-choice-grid">
   <button type="button" className={`experience-choice ${featureDiscovery.mode==="smart"?"active":""}`} onClick={()=>setFeatureDiscoveryMode("smart")}><b>{bi(lang,"ذكية حسب يلي تعلمته","Smart based on what I learned")}</b><span>{bi(lang,"تظهر فقط الميزات التي ما فتحتها أو ما تعرّفت عليها بعد.","Only shows features you have not opened or learned yet.")}</span></button>
   <button type="button" className={`experience-choice ${featureDiscovery.mode==="off"?"active":""}`} onClick={()=>setFeatureDiscoveryMode("off")}><b>{bi(lang,"إخفاء الفقاعات نهائياً","Hide bubbles")}</b><span>{bi(lang,"توقف كل فقاعات التعليم، ويمكن تشغيلها لاحقاً من هون.","Stops all discovery bubbles until you enable them again here.")}</span></button>
   <button type="button" className="experience-choice" onClick={()=>{if(window.confirm(bi(lang,"رح يرجّع Aqua Nexus فقاعات الميزات وهينات المصطلحات من البداية. متابعة؟","Aqua Nexus will restore feature bubbles and contextual hints from the beginning. Continue?"))){resetFeatureDiscovery();resetContextHints();}}}><b>{bi(lang,"استعادة كل التعليمات","Restore all guidance")}</b><span>{bi(lang,"يرجع فقاعات الميزات وهينات المصطلحات من البداية، بدون لمس أي بيانات بالحوض.","Restores feature bubbles and contextual hints from the beginning without changing tank data.")}</span></button>
  </div>
 </div>

 <div className="card panel full-span"><AdvancedSection titleAr="بروفايل الحوض والحسابات" titleEn="Tank profile & calculations" summaryAr="إعدادات تؤثر على أهداف الكيمياء وتقييم المعدات والطاقة؛ Auto مناسب لمعظم المستخدمين." summaryEn="Settings that affect chemistry targets, equipment assessment and energy; Auto is suitable for most users.">
  <div style={{display:"grid",gap:10,paddingTop:10}}>
   <ContextHint id="settings-system-profile" lang={lang} ar="اترك البروفايل Auto إذا ما عندك سبب واضح لتثبيته. التحديد اليدوي يفيد لما طبيعة الحوض معروفة وبدك أهدافاً أدق." en="Leave the profile on Auto unless you have a clear reason to pin it. Manual selection helps when the aquarium type is known and you want more specific targets."/>
  <p className="note">{bi(lang,"البروفايل يؤثر على أهداف الكيمياء ومتطلبات الإنارة/الحركة وتقييم التجهيزات. Auto يستنتج من الكائنات.","The profile affects chemistry targets, lighting/flow requirements and equipment adequacy. Auto infers from livestock.")}</p>
  <label className="field"><span>{bi(lang,"بروفايل النظام","System profile")}</span><select value={profile} onChange={e=>patch(tank.id,t=>({...t,ecosystemProfile:e.target.value==="auto"?undefined:e.target.value as any}))}><option value="auto">Auto</option>{tank.type==="marine"?<><option value="reef">Reef</option><option value="fishOnly">Fish-only</option></>:<><option value="planted">Planted</option><option value="fishOnly">Fish-only</option></>}</select></label>
  <div className="form-grid"><label className="field"><span>{bi(lang,"سعر الكهرباء / kWh","Electricity price / kWh")}</span><input type="number" min="0" step="any" value={energy.pricePerKwh} onChange={e=>patch(tank.id,t=>{const next={pricePerKwh:sanitizeBounded(Number(e.target.value),0,1000000,t.energySettings?.pricePerKwh??0),currency:t.energySettings?.currency||"USD"};return validateEnergySettings(next).ok?{...t,energySettings:next}:t})}/></label><label className="field"><span>{tr(lang,"currency")}</span><input value={energy.currency} onChange={e=>patch(tank.id,t=>{const next={pricePerKwh:t.energySettings?.pricePerKwh??0,currency:e.target.value};return validateEnergySettings(next).ok?{...t,energySettings:next}:t})}/></label></div>
 
  </div>
 </AdvancedSection></div>

 <div className="card panel full-span">
  <div className="module-head"><div><small className="eyebrow-mini">TANK LIFECYCLE</small><h3>{bi(lang,"دورة حياة الحوض","Tank lifecycle")}</h3><p className="note">{bi(lang,"السفر، نقل الحوض، إعادة التشغيل الكبرى والأرشفة تنحفظ كأحداث فعلية ويعرفها Tank Brain.","Vacation, relocation, major restart and archive are first-class events visible to Tank Brain.")}</p></div><span className={`status ${archived?"warn":relocation?"warn":"good"}`}>{archived?bi(lang,"مؤرشف","ARCHIVED"):relocation?bi(lang,"قيد النقل","MOVING"):vacation?bi(lang,"سفر","AWAY"):bi(lang,"نشط","ACTIVE")}</span></div>
  {(vacation||relocation||archived)&&<div className={`inline-alert ${archived||relocation?"warn":"info"}`} style={{marginTop:10}}><b>{archived?bi(lang,"الحوض مؤرشف","Tank archived"):relocation?bi(lang,"نقل الحوض قيد التنفيذ","Tank relocation in progress"):bi(lang,"وضع السفر نشط","Vacation mode active")}</b><p>{archived?(tank.lifecycle?.archiveReason||bi(lang,"العمليات التشغيلية مقفلة والتاريخ محفوظ.","Operations are locked and history is preserved.")):relocation?([relocation.from,relocation.to].filter(Boolean).join(" → ")||bi(lang,"الموقع غير محدد","Location not specified")):(vacation?.plannedEndAt?`${bi(lang,"العودة المخططة","Planned return")}: ${vacation.plannedEndAt}`:vacation?.notes||"")}</p></div>}
  <AdvancedSection titleAr="إدارة دورة حياة الحوض" titleEn="Manage tank lifecycle" summaryAr="السفر والنقل وRestart والأرشفة تغييرات كبيرة؛ افتحها فقط وقت تنفيذ حالة فعلية." summaryEn="Vacation, relocation, restart and archive are major lifecycle actions; open only for a real event." defaultOpen={false}>
   <div style={{display:"grid",gap:10,paddingTop:10}}>
    <ContextHint id="settings-lifecycle" lang={lang} tone="important" ar="هاي الإجراءات تدخل بتاريخ الحوض ويقرأها Tank Brain. استخدمها لتسجيل حدث فعلي، مو لتجربة الواجهة." en="These actions enter tank history and are read by Tank Brain. Use them for real lifecycle events, not interface experimentation."/>

  {vacation?<div className="inline-alert info"><b>{bi(lang,"وضع السفر نشط","Vacation mode active")}</b><p>{vacation.plannedEndAt?`${bi(lang,"العودة المخططة","Planned return")}: ${vacation.plannedEndAt}`:""} {vacation.notes||""}</p><button className="btn" onClick={endVacation}>{bi(lang,"إنهاء وضع السفر","End vacation mode")}</button></div>:<div className="form-grid"><label className="field"><span>{bi(lang,"عودة متوقعة (اختياري)","Planned return (optional)")}</span><input type="date" value={vacationEnd} onChange={e=>setVacationEnd(e.target.value)}/></label><label className="field"><span>{tr(lang,"notes")}</span><input value={vacationNotes} onChange={e=>setVacationNotes(e.target.value)}/></label><div className="field"><span>&nbsp;</span><button className="btn" onClick={startVacation}>{bi(lang,"بدء وضع السفر","Start vacation mode")}</button></div></div>}
  <hr/>
  {relocation?<div className="inline-alert warn"><b>{bi(lang,"نقل الحوض قيد التنفيذ","Tank relocation in progress")}</b><p>{[relocation.from,relocation.to].filter(Boolean).join(" → ")||bi(lang,"الموقع غير محدد","Location not specified")}</p><button className="btn primary" onClick={completeMove}>{bi(lang,"تأكيد اكتمال النقل","Mark relocation complete")}</button></div>:<div className="form-grid"><label className="field"><span>{bi(lang,"من","From")}</span><input value={moveFrom} onChange={e=>setMoveFrom(e.target.value)}/></label><label className="field"><span>{bi(lang,"إلى","To")}</span><input value={moveTo} onChange={e=>setMoveTo(e.target.value)}/></label><label className="field full-field"><span>{tr(lang,"notes")}</span><input value={moveNotes} onChange={e=>setMoveNotes(e.target.value)}/></label><div className="field"><span>&nbsp;</span><button className="btn" onClick={startMove}>{bi(lang,"بدء نقل الحوض","Start relocation")}</button></div></div>}
  <hr/>
  <div className="form-grid"><label className="field"><span>{bi(lang,"سبب إعادة التشغيل الكبرى","Major restart reason")}</span><input value={restartReason} onChange={e=>setRestartReason(e.target.value)}/></label><div className="field"><span>&nbsp;</span><button className="btn danger" onClick={majorRestart}>{bi(lang,"بدء دورة جديدة بعد Restart فعلي","Start new cycle after real restart")}</button></div></div>
  <hr/>
  {archived?<div className="inline-alert info"><b>{bi(lang,"الحوض مؤرشف","Tank archived")}</b><p>{tank.lifecycle?.archiveReason||bi(lang,"التاريخ محفوظ والعمليات التشغيلية مقفلة.","History is preserved and operational workflows are locked.")}</p><button className="btn primary" onClick={restoreArchivedTank}>{bi(lang,"إعادة الحوض للعمل","Restore tank")}</button></div>:<div className="form-grid"><label className="field"><span>{bi(lang,"سبب الأرشفة (اختياري)","Archive reason (optional)")}</span><input value={archiveReason} onChange={e=>setArchiveReason(e.target.value)}/></label><div className="field"><span>&nbsp;</span><button className="btn danger" onClick={archiveTank}>{bi(lang,"أرشفة الحوض","Archive tank")}</button></div></div>}
   </div>
  </AdvancedSection>
 </div>

 <div className="card panel">
  <h3>🔔 {lang==="ar"?"تنبيهات الهاتف":"Phone notifications"}</h3>
  <p className="note">{lang==="ar"?"تنبيهات عند مرور أكثر من أسبوع بدون متابعة الحوض، أو عندما تصبح حالة الحوض غير مستقرة.":"Alerts when a tank has not been checked for over a week, or when its condition becomes unstable."}</p>
  <div className={`inline-alert ${notificationsEnabled?"good":"warn"}`}>{lang==="ar"?"الحالة":"Status"}: <b>{notificationStatus}</b></div>
  {notificationNote&&<div className="note" style={{marginTop:10}}>{notificationNote}</div>}
  {notificationState!=="unsupported"&&<button className="btn primary" style={{marginTop:10}} onClick={enableNotifications} disabled={notificationState==="busy"||notificationsEnabled}>{notificationState==="busy"?(lang==="ar"?"جاري التفعيل...":"Enabling..."):notificationsEnabled?(lang==="ar"?"التنبيهات مفعّلة":"Notifications enabled"):(lang==="ar"?"تفعيل التنبيهات":"Enable notifications")}</button>}
 </div>

 <div className="card panel full-span"><div className="module-head"><div><small className="eyebrow-mini">DATA SAFETY</small><h3>{bi(lang,"سلامة البيانات والاستعادة","Data safety & recovery")}</h3></div><span className={`status ${dataSafety.persistence==="failed"?"danger":dataSafety.persistence==="degraded"?"warn":"good"}`}>{dataSafety.persistence.toUpperCase()}</span></div>
  <div className="summary-strip"><div className="summary"><small>{bi(lang,"الحفظ المحلي","Local persistence")}</small><b>{dataSafety.persistence==="ok"?"✓":dataSafety.persistence==="degraded"?"⚠":"✕"}</b></div><div className="summary"><small>{bi(lang,"سجلات مؤرشفة طويلة الأمد","Long-term archived records")}</small><b>{archiveCount}</b></div><div className="summary"><small>{bi(lang,"Device Backup","Device Backup")}</small><b>{deviceBackup?bi(lang,"مفعّل","ON"):bi(lang,"مغلق","OFF")}</b></div></div>
  {dataSafety.lastFailure&&<div className={`inline-alert ${dataSafety.persistence==="failed"?"danger":"warn"}`}>{dataSafety.lastFailure}</div>}
  <div className="inline-alert info">{bi(lang,"Aqua Nexus يعمل Local-first. لا يتم رفع بيانات الحوض إلى الـbackend إلا إذا فعّلت Device Backup بنفسك. هذا ليس حساباً سحابياً ولا مزامنة متعددة الأجهزة.","Aqua Nexus is local-first. Tank data is not sent to the backend unless you explicitly enable Device Backup. This is not a cloud account or multi-device sync.")}</div>
  <label className="checkbox-row"><input type="checkbox" checked={deviceBackup} onChange={e=>{persistDeviceBackup(e.target.checked);setDeviceBackup(e.target.checked)}}/><span>{bi(lang,"تفعيل Device Backup التجريبي لهذا المتصفح","Enable experimental Device Backup for this browser")}</span></label>
  <div className="actions"><button className="btn primary" onClick={()=>void exportBackup()}>{bi(lang,"إنشاء Full Recovery Backup","Create Full Recovery Backup")} JSON</button><button className="btn" onClick={()=>file.current?.click()}>{tr(lang,"import")}</button>{checkpointAvailable&&<button className="btn" onClick={()=>void undoLastDestructiveAction()}>↶ {bi(lang,"Undo آخر Restore/Delete","Undo last Restore/Delete")}</button>}</div>
  <input ref={file} type="file" accept=".json,application/json" hidden onChange={e=>{importFile(e.target.files?.[0]);e.currentTarget.value=""}}/>
  {restorePreview&&<div className={`inline-alert ${restorePreview.olderThanCurrent?"warn":"info"}`} style={{marginTop:10}}><b>{bi(lang,"معاينة الاستعادة — لم يتم تغيير أي بيانات بعد","Restore preview — no data has changed yet")}</b><p>{restorePreview.fileName} • {restorePreview.tankCount} {bi(lang,"حوض","tank(s)")}{restorePreview.exportedAt?` • ${new Date(restorePreview.exportedAt).toLocaleString()}`:""}</p>{restorePreview.names.length>0&&<p>{restorePreview.names.join(" • ")}</p>}{restorePreview.olderThanCurrent&&<p><b>⚠ {bi(lang,"هذه النسخة أقدم من نشاط موجود حالياً. الاستعادة سترجع البيانات للخلف، لكن Aqua Nexus سينشئ Checkpoint تلقائياً قبل التنفيذ.","This backup is older than current activity. Restore will roll data back, but Aqua Nexus will create an automatic checkpoint first.")}</b></p>}<div className="actions"><button className="btn danger" onClick={()=>void confirmRestore()}>{bi(lang,"تأكيد الاستعادة","Confirm restore")}</button><button className="btn" onClick={()=>{pendingRestore.current=null;setRestorePreview(null)}}>{bi(lang,"إلغاء","Cancel")}</button></div></div>}
  {backupNote&&<div className={`inline-alert ${backupNote.kind}`} style={{marginTop:10}}>{backupNote.text}</div>}
  <hr/><button className="btn danger" onClick={()=>void deleteCurrentTank()}>{tr(lang,"deleteTank")}</button>
 </div>
 <style jsx>{`\n  .experience-choice-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.experience-choice{border:1px solid rgba(86,181,205,.18);background:rgba(255,255,255,.025);color:inherit;border-radius:14px;padding:12px;text-align:inherit;display:grid;gap:5px}.experience-choice b{font-size:13px}.experience-choice span{font-size:10px;line-height:1.55;opacity:.7}.experience-choice.active{border-color:rgba(82,218,173,.5);background:rgba(43,151,118,.12);box-shadow:0 0 0 1px rgba(82,218,173,.08)}@media(max-width:680px){.experience-choice-grid{grid-template-columns:1fr}}\n `}</style>\n </section>;
}
