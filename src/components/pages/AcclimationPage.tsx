"use client";
import { interventionGate } from "@/domain/interventionSafety";
import { showCriticalAquariumNotification } from "@/lib/criticalNotifications";
import { useEffect,useMemo,useRef,useState } from "react";
import type { AcclimationItem,AcclimationSession,CoralDipRun,LivestockItem,Tank } from "@/domain/types";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi,categoryText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { DecisionGuidance } from "@/components/ui/DecisionGuidance";
import { ContextHint } from "@/components/ui/ContextHint";
import { AdvancedSection } from "@/components/ui/AdvancedSection";
import { useSafetyOverrideDialog } from "@/components/ui/SafetyOverrideDialog";
import { stockingReadiness } from "@/domain/stockingReadiness";
import { coralDipBatchRun,coralTransferGate } from "@/domain/acclimationSafety";
import { uid,nowISO,today } from "@/lib/appUtils";
import { buildDelimitedText,downloadDelimitedFile,field,numberField,parseDelimitedText } from "@/lib/tabularImport";
import { inventoryForConsumer } from "@/domain/inventoryIntelligence";
import { allowedAcclimationCategories,livestockCategoryFromAcclimation,normalizeAcclimationCategory } from "@/domain/acclimationCategories";
import { sanitizeBounded,validateAcclimationItemEntry,validateAcclimationWater } from "@/domain/inputSanity";
import { acclimationIcon as icon,healthOptions,temperamentOptions,sensitivityOptions,formatTimer as fmt,acclimationItemDuration as itemDuration,acclimationRemaining as remaining,acclimationScore as score,healthLabel,temperamentLabel,sensitivityLabel,subtypeLabel,acclimationStatusLabel,releasePriority,suggestedBatchSize,emergencyDuration,releaseLaneKey,releaseLaneLabel,releaseLaneIcon,buildAcclimationGuide,type AcclimationCategory as Cat } from "@/components/acclimation/acclimationUi";

export function AcclimationPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const {requestOverride,overrideDialog}=useSafetyOverrideDialog(lang);
 const sessions=tank.acclimationSessions??[],currentSession=sessions.find(s=>s.status!=="completed"),active=currentSession??sessions[0],sessionCompleted=active?.status==="completed";
 const [now,setNow]=useState(Date.now());
 const [category,setCategory]=useState<Cat>("fish"),[selected,setSelected]=useState(""),[custom,setCustom]=useState(""),[qty,setQty]=useState(1),[drip,setDrip]=useState(15),[interval,setIntervalMin]=useState(15),[placement,setPlacement]=useState(""),[notes,setNotes]=useState(""),[health,setHealth]=useState<AcclimationItem["health"]>("unknown"),[temperament,setTemperament]=useState<"peaceful"|"semi"|"aggressive">("peaceful"),[sensitivity,setSensitivity]=useState<"normal"|"sensitive"|"hardy">("normal"),[subtype,setSubtype]=useState(""),[imageData,setImageData]=useState(""),[importNote,setImportNote]=useState("");
 const [expandedLanes,setExpandedLanes]=useState<Record<string,boolean>>({});
 const [expandedBatches,setExpandedBatches]=useState<Record<string,boolean>>({});
 const [timerAlerts,setTimerAlerts]=useState<{id:string;lane:string;batch?:number;message:string}[]>([]);
 const [exceptionPickerOpen,setExceptionPickerOpen]=useState(false);
 const [selectedExceptionIds,setSelectedExceptionIds]=useState<string[]>([]);
 const [exceptionBoxExpanded,setExceptionBoxExpanded]=useState(false);
 const audioCtxRef=useRef<AudioContext|null>(null);
 const notifiedTimersRef=useRef<Set<string>>(new Set());
 const wakeLockRef=useRef<any>(null);
 const lib:any[]=LIVESTOCK_LIBRARY.filter((x:any)=>x.type===tank.type);
 const acclimationStock=useMemo(()=>inventoryForConsumer(tank,"acclimation"),[tank]);
 const allowedCats:Cat[]=allowedAcclimationCategories(tank.type);
 const categoryLabel=(c:Cat):string=>c==="macroalgae"?bi(lang,"ماكرو ألجي","Macroalgae"):categoryText(lang,c as any);
 const choices=useMemo(()=>lib.filter((x:any)=>normalizeAcclimationCategory(tank.type,String(x.cat),String(x.cat))===category),[category,tank.type]);
 const chosen:any=choices.find(x=>x.id===selected);
 const releaseLanes=useMemo(()=>{
  const normal=[...(active?.items??[])];
  const preferred=["fish","crustacean","snail","echinoderm","worm","coral","macroalgae","plant","invert","other"];
  const keys=[...new Set(normal.map(releaseLaneKey))].sort((a,b)=>preferred.indexOf(a)-preferred.indexOf(b));
  return keys.map(key=>{
   const ordered=normal.filter(i=>releaseLaneKey(i)===key).sort((a,b)=>{
    const delta=releasePriority(a)-releasePriority(b);
    if(delta!==0)return delta;
    return (a.nameEn||a.name).localeCompare(b.nameEn||b.name);
   });
   const batchSize=suggestedBatchSize(ordered.length);
   const totalBatches=Math.max(1,Math.ceil(ordered.length/batchSize));
   const entries=ordered.map((item,index)=>({item,order:index+1,batch:Math.floor(index/batchSize)+1,totalBatches,lane:key}));
   const batches=Array.from({length:totalBatches},(_,i)=>{
    const batch=i+1,items=entries.filter(x=>x.batch===batch).map(x=>x.item);
    const sensitive=items.filter(x=>x.sensitivity==="sensitive"||x.health==="stressed"||x.health==="critical"||x.health==="watch").length;
    return {batch,count:items.length,sensitive};
   });
   return {key,entries,batches,total:ordered.length,totalBatches};
  });
 },[active?.items]);
 const releasePlan=useMemo(()=>releaseLanes.flatMap(x=>x.entries),[releaseLanes]);
 const criticalTimerRunning=Boolean(active&&(active.floatStatus==="running"||active.bucketStatus==="running"||(active.items??[]).some(i=>i.status==="acclimating"&&Boolean(i.endAt))||(active.coralDipRuns??[]).some(r=>r.status==="running")));
 useEffect(()=>{
  if(!criticalTimerRunning||typeof navigator==="undefined"||!("wakeLock" in navigator))return;
  let cancelled=false;
  const acquire=async()=>{
   if(cancelled||document.visibilityState!=="visible"||wakeLockRef.current)return;
   try{
    wakeLockRef.current=await (navigator as any).wakeLock.request("screen");
    wakeLockRef.current?.addEventListener?.("release",()=>{wakeLockRef.current=null;});
   }catch{}
  };
  const onVisibility=()=>{if(document.visibilityState==="visible")void acquire();};
  void acquire();
  document.addEventListener("visibilitychange",onVisibility);
  return()=>{cancelled=true;document.removeEventListener("visibilitychange",onVisibility);try{wakeLockRef.current?.release?.();}catch{}wakeLockRef.current=null;};
 },[criticalTimerRunning]);
 const releaseBatches=useMemo(()=>releaseLanes.flatMap(lane=>lane.batches.map(meta=>{
  const entries=lane.entries.filter(x=>x.batch===meta.batch);
  const items=entries.map(x=>x.item);
  const baseMinutes=Math.max(1,...items.map(i=>Math.max(1,i.dripMinutes||1)));
  const releaseGap=Math.max(0,...items.map(i=>Math.max(0,i.intervalMinutes||0)));
  const plannedMinutes=Math.max(1,baseMinutes+Math.max(0,meta.batch-1)*releaseGap);
  return{id:`${lane.key}-${meta.batch}`,lane:lane.key,batch:meta.batch,totalBatches:lane.totalBatches,entries,plannedMinutes};
 })),[releaseLanes]);
 const emergencyItems=useMemo(()=>[...(active?.items??[])].filter(i=>i.emergency&&!["added","deferred"].includes(i.status)),[active?.items]);
 const exceptionAllItems=useMemo(()=>[...(active?.items??[])].filter(i=>i.emergency),[active?.items]);
 const exceptionPendingItems=useMemo(()=>exceptionAllItems.filter(i=>!["added","deferred"].includes(i.status)),[exceptionAllItems]);
 const exceptionCandidates=useMemo(()=>[...(active?.items??[])].filter(i=>!i.emergency&&!["added","deferred"].includes(i.status)),[active?.items]);
 const step=active?.wizardStep??1;
 const acclimationGuide=useMemo(()=>buildAcclimationGuide(active,lang),[active,lang]);
 function ev(ar:string,en:string){return{id:uid("ace"),timestamp:nowISO(),textAr:ar,textEn:en}}
 function unlockAudio(){
  if(typeof window==="undefined")return;
  const AudioCtor=window.AudioContext||(window as any).webkitAudioContext;
  if(!AudioCtor)return;
  if(!audioCtxRef.current)audioCtxRef.current=new AudioCtor();
  if(audioCtxRef.current.state==="suspended")audioCtxRef.current.resume().catch(()=>{});
 }
 function soundFamily(lane:string){
  if(lane==="fish")return "fish";
  if(lane==="coral")return "coral";
  if(lane==="plant"||lane==="macroalgae")return "plant";
  if(lane==="emergency")return "emergency";
  if(lane==="global")return "global";
  return "invert";
 }
 function playTimerSound(lane:string){
  unlockAudio();
  const ctx=audioCtxRef.current;if(!ctx)return;
  const family=soundFamily(lane);
  const patterns:any={
   fish:[[880,0,.11],[1120,.16,.11],[880,.32,.13]],
   invert:[[520,0,.09],[390,.13,.09],[520,.26,.12]],
   coral:[[660,0,.16],[660,.22,.16],[820,.46,.18]],
   plant:[[440,0,.13],[554,.18,.13],[659,.36,.18]],
   emergency:[[980,0,.12],[620,.16,.12],[980,.32,.12],[620,.48,.16]],
   global:[[740,0,.14],[920,.20,.14],[1120,.40,.20]]
  };
  const gain=ctx.createGain();gain.connect(ctx.destination);gain.gain.setValueAtTime(.0001,ctx.currentTime);
  for(const [freq,delay,dur] of patterns[family]){
   const osc=ctx.createOscillator();osc.type=family==="invert"?"square":family==="coral"?"sine":"triangle";osc.frequency.value=freq;osc.connect(gain);
   const t=ctx.currentTime+delay;gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.12,t+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+dur);osc.start(t);osc.stop(t+dur+.02);
  }
 }
 function pushTimerAlert(lane:string,batch?:number,emergencyName?:string){
  const name=emergencyName||(lane==="emergency"?bi(lang,"المسار الاستثنائي","Exception track"):releaseLaneLabel(lang,lane));
  const message=emergencyName
   ?bi(lang,`انتهى عداد الإقلمة الاستثنائية لـ ${emergencyName} — جاهز للفحص النهائي.`,`Rapid exception timer finished for ${emergencyName} — ready for final check.`)
   :bi(lang,`انتهى عداد ${name}${batch?` — الدفعة ${batch}`:""} وأصبحت جاهزة للفحص.`,`${name}${batch?` — Batch ${batch}`:""} timer finished and is ready for inspection.`);
  setTimerAlerts(prev=>[{id:uid("alert"),lane,batch,message},...prev].slice(0,5));
  playTimerSound(lane);
  try{if("vibrate" in navigator)(navigator as any).vibrate(lane==="emergency"?[220,90,220,90,300]:[160,80,160]);}catch{}
  void showCriticalAquariumNotification("Aqua Nexus",message,`acclimation-${active?.id||"session"}-${lane}-${batch??emergencyName??"timer"}`);
 }
 function laneRuntime(lane:any){
  const unfinished=lane.entries.filter((e:any)=>!["added","deferred"].includes(e.item.status));
  if(!unfinished.length)return{completed:true,currentBatch:lane.totalBatches,batchEntries:[],items:[],started:false,timer:0,status:"done"};
  const currentBatch=Math.min(...unfinished.map((e:any)=>e.batch));
  const batchEntries=lane.entries.filter((e:any)=>e.batch===currentBatch);
  const items=batchEntries.map((e:any)=>e.item).filter((i:AcclimationItem)=>!["added","deferred"].includes(i.status));
  const started=items.some((i:AcclimationItem)=>Boolean(i.startedAt)||["acclimating","paused","ready"].includes(i.status));
  const timer=items.length?Math.max(...items.map((i:AcclimationItem)=>started?remaining(i,now):itemDuration(i))):0;
  const status=items.some((i:AcclimationItem)=>i.status==="acclimating")?"running":items.some((i:AcclimationItem)=>i.status==="paused")?"paused":items.length&&items.every((i:AcclimationItem)=>i.status==="ready")?"ready":"waiting";
  return{completed:false,currentBatch,batchEntries,items,started,timer,status};
 }
 function batchRuntime(batch:any){
  const allItems=batch.entries.map((e:any)=>e.item).filter((i:AcclimationItem)=>!i.emergency);
  const remainingItems=allItems.filter((i:AcclimationItem)=>!["added","deferred"].includes(i.status));
  const allAdded=allItems.length>0&&allItems.every((i:AcclimationItem)=>i.status==="added");
  const complete=remainingItems.length===0;
  const started=Boolean(active?.dripStartedAt);
  const timer=remainingItems.length?Math.max(...remainingItems.map((i:AcclimationItem)=>started?remaining(i,now):batch.plannedMinutes*60000)):0;
  const status=allAdded?"done":remainingItems.some((i:AcclimationItem)=>i.status==="acclimating")?"running":remainingItems.some((i:AcclimationItem)=>i.status==="paused")?"paused":remainingItems.length&&remainingItems.every((i:AcclimationItem)=>i.status==="ready")?"ready":"waiting";
  return{allItems,remainingItems,allAdded,complete,started,timer,status};
 }
 function exceptionBoxRuntime(){
  const allItems=exceptionAllItems;
  const remainingItems=exceptionPendingItems;
  const allAdded=allItems.length>0&&allItems.every((i:AcclimationItem)=>i.status==="added");
  const started=allItems.some((i:AcclimationItem)=>Boolean(i.startedAt));
  const timer=remainingItems.length?Math.max(...remainingItems.map((i:AcclimationItem)=>remaining(i,now))):0;
  const status=allAdded?"done":remainingItems.some((i:AcclimationItem)=>i.status==="emergency")?"running":remainingItems.some((i:AcclimationItem)=>i.status==="paused")?"paused":remainingItems.length&&remainingItems.every((i:AcclimationItem)=>i.status==="ready")?"ready":"waiting";
  return{allItems,remainingItems,allAdded,started,timer,status};
 }
 function bucketAction(action:"start"|"pause"|"resume"|"done"){
  if(!active)return;
  let s={...active},r=s.bucketRemainingMs??5*60000;
  if(s.bucketStatus==="running"&&s.bucketEndAt)r=Math.max(0,s.bucketEndAt-Date.now());
  if(action==="start")s={...s,bucketStatus:"running",bucketStartedAt:nowISO(),bucketRemainingMs:r,bucketEndAt:Date.now()+r,events:[ev("بدأ عداد نقل كل الكائنات إلى الأوعية لمدة 5 دقائق.","Started the 5-minute transfer-to-containers timer for the whole shipment."),...s.events]};
  if(action==="pause")s={...s,bucketStatus:"paused",bucketRemainingMs:r,bucketEndAt:null};
  if(action==="resume")s={...s,bucketStatus:"running",bucketEndAt:Date.now()+r,bucketRemainingMs:r};
  if(action==="done")s={...s,bucketStatus:"done",bucketRemainingMs:0,bucketEndAt:null,events:[ev("تم تأكيد نقل كل الكائنات إلى الأوعية. جاهز لبدء التنقيط العام.","Confirmed all livestock moved to containers. Ready to start global drip acclimation."),...s.events]};
  saveSession(s);
 }
 function startAllDripBatches(){
  if(!active||!active.floatConfirmed||active.bucketStatus!=="done")return;
  unlockAudio();
  const started=Date.now();
  const durationByItem=new Map<string,number>();
  releaseBatches.forEach(batch=>batch.entries.forEach((entry:any)=>durationByItem.set(entry.item.id,batch.plannedMinutes*60000)));
  saveSession({...active,status:"drip",dripStartedAt:nowISO(),items:active.items.map(item=>{
   if(item.emergency||["added","deferred"].includes(item.status))return item;
   const duration=durationByItem.get(item.id)??itemDuration(item);
   return{...item,status:"acclimating" as const,startedAt:nowISO(),remainingMs:duration,endAt:started+duration};
  }),events:[ev("بدأ التنقيط لجميع الدفعات بالتوازي، وكل دفعة تعمل بعداد مستقل.","Parallel drip acclimation started for all batches; every batch now has an independent timer."),...active.events]});
 }
 function startLaneBatch(laneKey:string,batch:number){
  if(!active||!active.floatConfirmed)return;
  const lane=releaseLanes.find(x=>x.key===laneKey);if(!lane)return;
  const ids=new Set(lane.entries.filter(x=>x.batch===batch&&x.item.status==="waiting").map(x=>x.item.id));
  if(!ids.size)return;
  unlockAudio();
  const start=Date.now();
  saveSession({...active,items:active.items.map(x=>ids.has(x.id)?{...x,status:"acclimating" as const,startedAt:nowISO(),remainingMs:x.remainingMs??itemDuration(x),endAt:start+(x.remainingMs??itemDuration(x))}:x),events:[ev(`بدأت الدفعة ${batch} من مسار ${releaseLaneLabel("ar",laneKey)}.`,`Started Batch ${batch} of the ${releaseLaneLabel("en",laneKey)} lane.`),...active.events]});
 }
 function saveSession(s:AcclimationSession,withLog=true){patch(tank.id,t=>({...t,acclimationSessions:[s,...(t.acclimationSessions??[]).filter(x=>x.id!==s.id)]}));}
 async function newSession(){if(currentSession){window.alert(bi(lang,"في جلسة إقلمة شغالة حالياً. كمّلها أو عالج العناصر المؤجلة قبل بدء شحنة جديدة.","An acclimation session is already active. Finish it or resolve deferred items before starting another shipment."));return;}const intervention=interventionGate(tank,"livestockAddition");let overrideReason="";if(intervention.level==="danger"){const reason=await requestOverride({title:lang==="ar"?"بدء إقلمة أثناء حالة عالية الخطورة":"Start acclimation during a high-risk tank state",message:(lang==="ar"?intervention.ar:intervention.en)+" "+bi(lang,"إذا الشحنة وصلت فعلياً، أكمل الإقلمة فقط وتجنب أي تدخل كبير إضافي.","If the shipment has arrived, proceed with acclimation only and avoid other major interventions."),requireReason:true});if(!reason)return;overrideReason=reason;}else if(intervention.level==="warn"&&!window.confirm(lang==="ar"?intervention.ar+" إذا الشحنة وصلت فعلياً، كمل الإقلمة فقط وتجنب أي تدخل كبير إضافي. بدء الجلسة؟":intervention.en+" If the shipment has arrived, proceed with acclimation only and avoid other major interventions. Start session?"))return;const ts=nowISO();const s:AcclimationSession={id:uid("acs"),startedAt:ts,status:"setup",wizardStep:1,categories:[],tankSalinity:tank.type==="marine"?1.025:undefined,bagSalinity:tank.type==="marine"?1.020:undefined,temperature:25,existingNotes:"",coralDipEnabled:false,coralDipMinutes:10,coralDipQuantityPerPrep:0,coralDipRuns:[],coralDipSkippedItemIds:[],floatConfirmed:false,floatStatus:"waiting",floatRemainingMs:15*60000,bucketStatus:"waiting",bucketRemainingMs:5*60000,preflight:{},items:[],events:[...(overrideReason?[ev(`تجاوز تحذير بدء الإقلمة. السبب: ${overrideReason}`,`Acclimation-start warning overridden. Reason: ${overrideReason}`)]:[]),ev("بدأت جلسة أقلمة جديدة.","New acclimation session started.")]};saveSession(s);if(overrideReason)patch(tank.id,t=>({...t,timeline:[{id:uid("ev"),timestamp:ts,type:"safety-override",textAr:`تم تجاوز تحذير بدء الإقلمة. السبب: ${overrideReason}`,textEn:`Acclimation-start warning overridden. Reason: ${overrideReason}`},...t.timeline]}));}
 function sessionPatch(p:Partial<AcclimationSession>){if(!active)return;saveSession({...active,...p});}
 function setStep(n:number){sessionPatch({wizardStep:n})}
 function toggleCat(c:Cat){if(!active)return;const cats=active.categories??[];sessionPatch({categories:cats.includes(c)?cats.filter(x=>x!==c):[...cats,c]});}

 function speciesApply(id:string){setSelected(id);const x:any=choices.find(y=>y.id===id);if(!x)return;setCustom(lang==="ar"?x.ar:x.en);setPlacement(x.care||x.placement||"");setDrip(category==="invert"?45:category==="fish"?20:20);setIntervalMin(category==="coral"?5:category==="plant"||category==="macroalgae"?0:15);setTemperament((x.temperament||"peaceful") as any);setSensitivity((x.sensitivity||"normal") as any);}
 function readPhoto(file?:File){if(!file){setImageData("");return}const r=new FileReader();r.onload=()=>setImageData(String(r.result||""));r.readAsDataURL(file)}
 function addItem(){if(!active||(!selected&&!custom.trim()))return;const check=validateAcclimationItemEntry({quantity:qty,dripMinutes:drip,intervalMinutes:interval});const danger=check.issues.find(x=>x.level==="danger");if(danger){window.alert(lang==="ar"?danger.ar:danger.en);return;}const x:any=choices.find(y=>y.id===selected);const ar=x?.ar||custom.trim(),en=x?.en||custom.trim();const item:AcclimationItem={id:uid("aci"),libraryId:x?.id,name:ar,nameEn:en,category,quantity:Math.round(qty),dripMinutes:drip,intervalMinutes:interval,placement:placement||x?.care||"",notes,temperament,sensitivity,subtype:category==="macroalgae"?"macroalgae":subtype,health,status:"waiting",remainingMs:drip*60000,imageDataUrl:imageData||undefined};saveSession({...active,items:[...active.items,item],events:[ev(`تمت إضافة ${ar} إلى الشحنة.`,`Added ${en} to the shipment.`),...active.events]});setSelected("");setCustom("");setQty(1);setNotes("");setPlacement("");setImageData("");}
 function removeItem(id:string){if(!active)return;saveSession({...active,items:active.items.filter(x=>x.id!==id)});}
 function moveItem(id:string,dir:number){if(!active)return;const a=[...active.items],i=a.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];saveSession({...active,items:a});}
 function autoOrder(){if(!active)return;saveSession({...active,items:[...active.items].sort((a,b)=>score(a)-score(b)),events:[ev("تم تطبيق ترتيب التنزيل المقترح.","Suggested release order applied."),...active.events]});}

 const preflight=useMemo(()=>{const base=lang==="ar"?["سطل/وعاء نظيف ومخصص لكل مجموعة","خرطوم تنقيط مع محبس تحكم","شبكة / وعاء نقل منفصل","Refractometer أو جهاز قياس الملوحة","ميزان حرارة","مناشف ومكان عمل جاف","اختبار صوت التنبيهات","أبقِ Aqua Nexus مفتوحاً أثناء العدادات الحرجة؛ التطبيق يحاول إبقاء الشاشة مستيقظة عند دعم الجهاز"]:["Clean dedicated container(s)","Airline / drip line + valve","Net / specimen container","Refractometer or salinity meter","Thermometer","Towels + dry working area","Timer/sound volume checked","Keep Aqua Nexus open during critical timers; the app requests screen wake-lock when supported"];if(active?.items.some(i=>i.category==="coral")&&active.coralDipEnabled)base.push(lang==="ar"?"ماء Coral Dip وماء شطف منفصل جاهزان":"Coral dip + separate rinse water prepared");if(active?.items.some(i=>i.category==="plant"))base.push(lang==="ar"?"وعاء فحص/شطف النباتات جاهز":"Plant rinse/inspection container");
 if(active?.items.some(i=>i.category==="macroalgae"||i.subtype==="macroalgae"))base.push(lang==="ar"?"وعاء فحص/شطف الماكرو ألجي جاهز":"Macroalgae rinse/inspection container");return base},[active?.items,active?.coralDipEnabled,lang]);
 function toggleCheck(i:number){if(!active)return;sessionPatch({preflight:{...(active.preflight??{}),[i]:!(active.preflight??{})[i]}})}
 function startSession(){
  if(!active||!active.items.length)return;
  const waterChecks=[
    ...(tank.type==="marine"?[validateAcclimationWater({salinity:active.tankSalinity}),validateAcclimationWater({salinity:active.bagSalinity})]:[]),
    validateAcclimationWater({temperature:active.temperature}),
    ...(active.coralDipEnabled?[validateAcclimationWater({dipMinutes:Number(active.coralDipMinutes),dipQuantity:Number(active.coralDipQuantityPerPrep)})]:[])
  ];
  const invalid=waterChecks.flatMap(x=>x.issues).find(x=>x.level==="danger");
  if(invalid){window.alert(lang==="ar"?invalid.ar:invalid.en);return;}
  const invalidItem=active.items.map(i=>validateAcclimationItemEntry({quantity:i.quantity,dripMinutes:i.dripMinutes,intervalMinutes:i.intervalMinutes})).flatMap(x=>x.issues).find(x=>x.level==="danger");
  if(invalidItem){window.alert(lang==="ar"?invalidItem.ar:invalidItem.en);return;}
  if(active.coralDipEnabled&&active.items.some(i=>i.category==="coral")){
   const inv=tank.inventory.find(i=>i.id===active.coralDipInventoryItemId);
   const qty=Number(active.coralDipQuantityPerPrep||0),mins=Number(active.coralDipMinutes||0);
   if(!inv||qty<=0||mins<=0){
    window.alert(bi(lang,"قبل بدء الجلسة: اربط Coral Dip بالمخزون وحدد كمية كل تحضير ومدة الـDip من ملصق المنتج.","Before starting: link Coral Dip to inventory and set the quantity per preparation and the label-based dip duration."));
    return;
   }
   if(inv.quantity<qty){
    window.alert(bi(lang,"المخزون الحالي لا يكفي حتى لتحضير أول Coral Dip. حدّث المخزون أو أوقف خيار الـDip قبل بدء الجلسة.","Current inventory is not enough for even the first Coral Dip preparation. Replenish inventory or disable dip before starting."));
    return;
   }
  }
  const start=Date.now(),left=active.floatRemainingMs??15*60000;
  saveSession({...active,status:"floating",wizardStep:5,floatStatus:"running",floatStartedAt:nowISO(),floatEndAt:start+left,events:[ev("بدأت موازنة حرارة الأكياس المغلقة لمدة 15 دقيقة.","Started sealed-bag temperature equalization for 15 minutes."),...active.events]});
 }
 function floatAction(action:"pause"|"resume"|"plus5"|"plus15"|"done"){
  if(!active)return;let s={...active},r=s.floatRemainingMs??15*60000;
  if(s.floatStatus==="running"&&s.floatEndAt)r=Math.max(0,s.floatEndAt-Date.now());
  if(action==="pause")s={...s,floatStatus:"paused",floatRemainingMs:r,floatEndAt:null};
  if(action==="resume")s={...s,floatStatus:"running",floatEndAt:Date.now()+r};
  if(action==="plus5"||action==="plus15"){const add=(action==="plus5"?5:15)*60000;s={...s,floatRemainingMs:r+add,floatEndAt:s.floatStatus==="running"?Date.now()+r+add:null,floatStatus:s.floatStatus==="ready"?"paused":s.floatStatus};}
  if(action==="done"){const bucketMs=5*60000;s={...s,floatConfirmed:true,floatStatus:"done",floatRemainingMs:0,floatEndAt:null,status:"transfer",bucketStatus:"waiting",bucketStartedAt:undefined,bucketRemainingMs:bucketMs,bucketEndAt:null,events:[ev("تم تأكيد موازنة الحرارة. المرحلة التالية: نقل كل الكائنات إلى الأوعية لمدة 5 دقائق.","Temperature equalization confirmed. Next stage: move all livestock to containers for 5 minutes."),...s.events]};}
  saveSession(s);
 }
 function updateItem(id:string,fn:(x:AcclimationItem)=>AcclimationItem){if(!active)return;saveSession({...active,items:active.items.map(x=>x.id===id?fn(x):x)});}
 function startDrip(id:string){unlockAudio();updateItem(id,x=>({...x,status:"acclimating",startedAt:nowISO(),endAt:Date.now()+(x.remainingMs??itemDuration(x)),remainingMs:x.remainingMs??itemDuration(x)}));}
 function itemAction(id:string,action:"pause"|"resume"|"plus5"|"plus15"|"ready"|"defer"){
  updateItem(id,x=>{let r=remaining(x,Date.now()),n={...x};if(action==="pause")n={...n,status:"paused",remainingMs:r,endAt:null};if(action==="resume")n={...n,status:n.emergency?"emergency":"acclimating",endAt:Date.now()+r,remainingMs:r};if(action==="plus5"||action==="plus15"){const add=(action==="plus5"?5:15)*60000;n={...n,remainingMs:r+add,endAt:(n.status==="acclimating"||n.status==="emergency")?Date.now()+r+add:null,status:n.status==="ready"?"paused":n.status};}if(action==="ready")n={...n,status:"ready",remainingMs:0,endAt:null,readyAt:nowISO()};if(action==="defer")n={...n,status:"deferred",endAt:null};return n;});
 }
 function startEmergency(id:string){
  if(!active)return;
  unlockAudio();
  const item=active.items.find(x=>x.id===id);if(!item)return;
  const label=lang==="ar"?item.name:(item.nameEn||item.name);
  if(typeof window!=="undefined"&&!window.confirm(lang==="ar"?`نقل ${label} إلى المسار الاستثنائي السريع؟ سيخرج من خطة الدفعات العامة ويبدأ عداداً مستقلاً بالتوازي معها.`:`Move ${label} to the rapid exception track? It will leave the normal batch plan and run independently in parallel.`))return;
  const rapid=Math.min(remaining(item,Date.now()),emergencyDuration(item));
  saveSession({...active,items:active.items.map(x=>x.id===id?{...x,emergency:true,status:"emergency" as const,startedAt:nowISO(),remainingMs:rapid,endAt:Date.now()+rapid}:x),events:[ev(`تم نقل ${item.name} إلى المسار الاستثنائي السريع.`,`${item.nameEn||item.name} was moved to the rapid exception track.`),...active.events]});
 }
 function cancelEmergency(id:string){
  if(!active)return;
  const item=active.items.find(x=>x.id===id);if(!item)return;
  saveSession({...active,items:active.items.map(x=>x.id===id?{...x,emergency:false,status:"waiting" as const,startedAt:undefined,endAt:null,remainingMs:itemDuration(x),readyAt:undefined}:x),events:[ev(`أعيد ${item.name} إلى خطة الإقلمة العامة.`,`${item.nameEn||item.name} returned to the standard acclimation plan.`),...active.events]});
 }
 function toggleExceptionCandidate(id:string){
  setSelectedExceptionIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
 }
 function selectAllExceptionCandidates(){
  setSelectedExceptionIds(exceptionCandidates.map(x=>x.id));
 }
 function clearExceptionSelection(){setSelectedExceptionIds([]);}
 function startSelectedExceptions(){
  if(!active||!selectedExceptionIds.length)return;
  unlockAudio();
  const ids=new Set(selectedExceptionIds);
  const started=Date.now();
  const selectedItems=active.items.filter(x=>ids.has(x.id));
  const sharedRapid=Math.max(...selectedItems.map(x=>emergencyDuration(x)),5*60000);
  saveSession({...active,items:active.items.map(x=>{
   if(!ids.has(x.id))return x;
   return{...x,emergency:true,status:"emergency" as const,startedAt:nowISO(),remainingMs:sharedRapid,endAt:started+sharedRapid,readyAt:undefined};
  }),events:[ev(`تم نقل ${selectedItems.length} كائن/مجموعة إلى صندوق الاستثناءات وبدأ عداد تنقيط سريع موحد لمدة ${Math.round(sharedRapid/60000)} دقيقة.`,`Moved ${selectedItems.length} item/group(s) to the exception box and started one shared rapid drip timer for ${Math.round(sharedRapid/60000)} minutes.`),...active.events]});
  setSelectedExceptionIds([]);
  setExceptionPickerOpen(false);
  setExceptionBoxExpanded(false);
 }
 function startCoralDipForItems(batchId:string,itemIds:string[],labelAr:string,labelEn:string){
  if(!active||!active.coralDipEnabled||!itemIds.length)return;
  if(coralDipBatchRun(active,batchId)){window.alert(bi(lang,"لهذه الدفعة Coral Dip مسجل مسبقاً.","A Coral Dip is already recorded for this batch."));return;}
  const inv=tank.inventory.find(i=>i.id===active.coralDipInventoryItemId);
  const qty=Number(active.coralDipQuantityPerPrep||0),mins=Math.max(1,Number(active.coralDipMinutes||0));
  if(!inv||qty<=0){window.alert(bi(lang,"اربط منتج Coral Dip بالمخزون وحدد كمية كل تحضير أولاً.","Link the Coral Dip product to inventory and set the quantity per preparation first."));return;}
  if(inv.quantity<qty){window.alert(bi(lang,`المخزون غير كافي. المتوفر ${inv.quantity} ${inv.unit} والمطلوب ${qty} ${inv.unit}.`,`Inventory is insufficient. Available: ${inv.quantity} ${inv.unit}; required: ${qty} ${inv.unit}.`));return;}
  const ts=nowISO();
  const run:CoralDipRun={id:uid("dip"),batchId,itemIds,productName:lang==="ar"?inv.name:(inv.nameEn||inv.name),inventoryItemId:inv.id,quantityUsed:qty,unit:inv.unit,durationMinutes:mins,status:"running",startedAt:ts,remainingMs:mins*60000,endAt:Date.now()+mins*60000};
  unlockAudio();
  patch(tank.id,t=>{
   const session=(t.acclimationSessions??[]).find(s=>s.id===active.id)??active;
   const updated={...session,coralDipRuns:[run,...(session.coralDipRuns??[])],events:[ev(`بدأ Coral Dip لـ ${labelAr}: ${qty} ${inv.unit} من ${inv.name} لمدة ${mins} دقيقة. تم خصم التحضير مرة واحدة من المخزون.`,`Started Coral Dip for ${labelEn}: ${qty} ${inv.unit} of ${inv.nameEn||inv.name} for ${mins} minutes. One prepared bath was deducted from inventory.`),...session.events]};
   return {...t,inventory:t.inventory.map(i=>i.id===inv.id?{...i,quantity:Math.max(0,i.quantity-qty)}:i),acclimationSessions:[updated,...(t.acclimationSessions??[]).filter(s=>s.id!==active.id)],timeline:[{id:uid("ev"),timestamp:ts,type:"coral-dip-start",textAr:`بدأ Coral Dip لـ ${labelAr} باستخدام ${qty} ${inv.unit} من ${inv.name}.`,textEn:`Coral Dip started for ${labelEn} using ${qty} ${inv.unit} of ${inv.nameEn||inv.name}.`},...t.timeline]};
  });
 }
 function startCoralDip(batch:any){
  if(!active||batch.lane!=="coral")return;
  const runtime=batchRuntime(batch);
  const items=runtime.remainingItems.filter((i:AcclimationItem)=>!i.emergency&&i.status==="ready");
  if(!items.length||items.length!==runtime.remainingItems.filter((i:AcclimationItem)=>!i.emergency).length){window.alert(bi(lang,"انتظر حتى تصبح كل قطع هذه الدفعة جاهزة قبل بدء الـCoral Dip.","Wait until every coral in this batch is ready before starting Coral Dip."));return;}
  startCoralDipForItems(batch.id,items.map((i:AcclimationItem)=>i.id),`دفعة المرجان ${batch.batch}`,`Coral Batch ${batch.batch}`);
 }
 function startEmergencyCoralDip(item:AcclimationItem){
  if(!active||item.category!=="coral"||!item.emergency||item.status!=="ready")return;
  startCoralDipForItems(`emergency-${item.id}`,[item.id],item.name,item.nameEn||item.name);
 }
 function confirmCoralRinse(runId:string){
  if(!active)return;
  const run=(active.coralDipRuns??[]).find(r=>r.id===runId);
  if(!run||run.status!=="ready_to_rinse")return;
  const ts=nowISO();
  patch(tank.id,t=>{
   const session=(t.acclimationSessions??[]).find(s=>s.id===active.id)??active;
   const updated={...session,coralDipRuns:(session.coralDipRuns??[]).map(r=>r.id===runId?{...r,status:"rinsed" as const,rinsedAt:ts}:r),events:[ev(`تم تأكيد شطف المرجان بعد Coral Dip لـ ${run.productName} بماء منفصل. أصبح جاهزاً لقرار النقل.`,`Separate-water rinse confirmed after Coral Dip with ${run.productName}. Coral is now ready for the transfer decision.`),...session.events]};
   return {...t,acclimationSessions:[updated,...(t.acclimationSessions??[]).filter(s=>s.id!==active.id)],timeline:[{id:uid("ev"),timestamp:ts,type:"coral-dip-rinse",textAr:`تم تأكيد شطف Coral Dip (${run.productName}).`,textEn:`Coral Dip rinse confirmed (${run.productName}).`},...t.timeline]};
  });
 }
 async function skipCoralDipForStress(item:AcclimationItem){
  if(!active||item.category!=="coral"||!item.emergency)return;
  const overrideReason=await requestOverride({title:bi(lang,"تجاوز Coral Dip بسبب الإجهاد","Skip Coral Dip due to distress"),message:bi(lang,`هذا استثناء للكائن المجهد ${item.name}. اكتب سبب القرار؛ لن يعتبر الـDip مكتملاً.`,`This is a distressed-livestock exception for ${item.nameEn||item.name}. Record the reason; the dip will not be treated as completed.`),requireReason:true});
  if(!overrideReason)return;
  const ts=nowISO();
  patch(tank.id,t=>{
   const session=(t.acclimationSessions??[]).find(s=>s.id===active.id)??active;
   const skipped=[...new Set([...(session.coralDipSkippedItemIds??[]),item.id])];
   const updated={...session,coralDipSkippedItemIds:skipped,events:[ev(`تم تسجيل تجاوز Coral Dip لـ ${item.name} بسبب حالة الإجهاد ضمن المسار الاستثنائي.`,`Coral Dip was explicitly skipped for ${item.nameEn||item.name} because of distress in the exception track.`),...session.events]};
   return {...t,acclimationSessions:[updated,...(t.acclimationSessions??[]).filter(s=>s.id!==active.id)],timeline:[{id:uid("ev"),timestamp:ts,type:"coral-dip-skip",textAr:`تجاوز Coral Dip لـ ${item.name} بسبب الإجهاد. السبب: ${overrideReason}`,textEn:`Coral Dip skipped for ${item.nameEn||item.name} because of distress. Reason: ${overrideReason}`},...t.timeline]};
  });
 }
 async function markAdded(item:AcclimationItem){
  if(!active)return;
  const dipGate=coralTransferGate(active,item);
  if(!dipGate.allowed){window.alert(lang==="ar"?dipGate.reasonAr:dipGate.reasonEn);return;}
  const catalog:any=lib.find((x:any)=>x.id===item.libraryId);
  const readiness=stockingReadiness(tank,{candidate:catalog,quantity:item.quantity,candidateKnown:Boolean(catalog),candidateLabelAr:item.name,candidateLabelEn:item.nameEn||item.name});
  let riskOverride=false,riskOverrideReason="";
  if(readiness.state!=="ready"){
    const reason=lang==="ar"?(readiness.blockersAr[0]||readiness.missingEvidenceAr[0]||"الجاهزية غير مؤكدة."):(readiness.blockersEn[0]||readiness.missingEvidenceEn[0]||"Readiness is not confirmed.");
    const override=await requestOverride({title:bi(lang,"Risk Override استثنائي","Exceptional Risk Override"),message:reason+" "+bi(lang,"استخدم التجاوز فقط إذا إبقاء الكائن في ماء الشحنة أخطر ولا يوجد بديل آمن.","Use this only if keeping the animal in shipping water is riskier and there is no safer alternative."),requireReason:true});
    if(!override)return;
    riskOverride=true;riskOverrideReason=override;
  }else if(readiness.requiresConfirmation){
    const ok=window.confirm(lang==="ar"?"الجاهزية تسمح مبدئياً لكن يوجد تنبيه مهم. هل تريد متابعة التنزيل وتسجيله؟":"Readiness is provisionally acceptable but has an important caution. Continue and log the release?");
    if(!ok)return;
  }
  const mappedCategory=livestockCategoryFromAcclimation(item.category,item.subtype);
  const livestock:LivestockItem={id:uid("live"),libraryId:item.libraryId,name:item.name,nameEn:item.nameEn,category:mappedCategory.category,subtype:mappedCategory.subtype,quantity:item.quantity,health:item.health==="critical"||item.health==="stressed"?"watch":"good",load:catalog?.load??1,addedAt:today()};
  const nextItems=active.items.map(x=>x.id===item.id?{...x,status:"added" as const,addedAt:nowISO()}:x);
  const allDone=nextItems.every(x=>x.status==="added"||x.status==="deferred");
  patch(tank.id,t=>({...t,acclimationSessions:[{...active,status:allDone?"completed":"release",completedAt:allDone?nowISO():undefined,items:nextItems,events:[ev(`تم إدخال ${item.name} إلى الحوض بدون ماء الشحنة.`,`Transferred ${item.nameEn||item.name} to the aquarium without shipping water.`),...active.events]},...(t.acclimationSessions??[]).filter(x=>x.id!==active.id)],livestock:[...t.livestock,livestock],timeline:[{id:uid("ev"),timestamp:nowISO(),type:riskOverride?"acclimation-risk-override":"acclimation",textAr:riskOverride?`تم إدخال ${item.name} مع Risk Override. السبب: ${riskOverrideReason}`:`اكتملت أقلمة ${item.name} وتم إدخاله بعد فحص الجاهزية المركزي.`,textEn:riskOverride?`Transferred ${item.nameEn||item.name} with an exceptional Risk Override. Reason: ${riskOverrideReason}`:`Acclimation completed for ${item.nameEn||item.name} after central readiness screening.`},...t.timeline]}));
}
 function downloadShipmentTemplate(kind:"csv"|"txt"){
  const headers=["libraryId","name","nameEn","category","quantity","health","temperament","sensitivity","subtype","dripMinutes","intervalMinutes","placement","notes"];
  const marine=tank.type==="marine";
  const sample:Record<string,unknown>=marine
   ?{libraryId:"clown",name:"سمكة المهرج",nameEn:"Clownfish",category:"fish",quantity:2,health:"good",temperament:"peaceful",sensitivity:"normal",subtype:"",dripMinutes:20,intervalMinutes:15,placement:"Display tank",notes:""}
   :{libraryId:"neonTetra",name:"نيون تترا",nameEn:"Neon Tetra",category:"fish",quantity:8,health:"good",temperament:"peaceful",sensitivity:"normal",subtype:"",dripMinutes:20,intervalMinutes:10,placement:"Mid water",notes:""};
  const delimiter=kind==="txt"?"\t":",";
  downloadDelimitedFile(`Aqua_Nexus_${tank.type}_Acclimation_Template.${kind}`,buildDelimitedText(headers,[sample],delimiter),kind==="txt"?"text/plain;charset=utf-8":"text/csv;charset=utf-8");
 }

 function importedCategory(raw:string,catalog?:any):Cat|null{
  return normalizeAcclimationCategory(tank.type,raw,String(catalog?.cat||""));
 }

 async function importShipment(file?:File){
  if(!file||!active)return;
  try{
   const {rows}=parseDelimitedText(await file.text());
   const items:AcclimationItem[]=[];
   let rejected=0;
   const categories=new Set<Cat>(active.categories??[]);
   rows.forEach(row=>{
    const libraryId=field(row,"libraryId");
    const catalog:any=libraryId?lib.find((x:any)=>x.id===libraryId):undefined;
    const cat=importedCategory(field(row,"category"),catalog);
    if(!cat)return;
    const ar=field(row,"name")||catalog?.ar||field(row,"nameEn");
    const en=field(row,"nameEn")||catalog?.en||ar;
    if(!ar&&!en)return;
    const rawHealth=field(row,"health").toLowerCase();
    const importedHealth:AcclimationItem["health"]=(["unknown","good","fair","stressed","critical"].includes(rawHealth)?rawHealth:"unknown") as AcclimationItem["health"];
    const rawTemperament=field(row,"temperament").toLowerCase();
    const importedTemperament=(["peaceful","semi","aggressive"].includes(rawTemperament)?rawTemperament:(catalog?.temperament||"peaceful")) as "peaceful"|"semi"|"aggressive";
    const rawSensitivity=field(row,"sensitivity").toLowerCase();
    const importedSensitivity=(["normal","sensitive","hardy"].includes(rawSensitivity)?rawSensitivity:(catalog?.sensitivity||"normal")) as "normal"|"sensitive"|"hardy";
    const defaultDrip=cat==="invert"?45:20;
    const defaultInterval=cat==="coral"?5:cat==="plant"||cat==="macroalgae"?0:15;
    const dripValue=numberField(row,"dripMinutes")??defaultDrip;
    const intervalValue=numberField(row,"intervalMinutes")??defaultInterval;
    const quantity=Math.round(numberField(row,"quantity")??1);
    const entryCheck=validateAcclimationItemEntry({quantity,dripMinutes:dripValue,intervalMinutes:intervalValue});
    if(!entryCheck.ok){rejected++;return;}
    items.push({
     id:uid("aci"),
     libraryId:catalog?.id||libraryId||undefined,
     name:ar||en,
     nameEn:en||ar,
     category:cat,
     quantity,
     health:importedHealth,
     temperament:importedTemperament,
     sensitivity:importedSensitivity,
     subtype:cat==="macroalgae"?"macroalgae":field(row,"subtype"),
     dripMinutes:dripValue,
     intervalMinutes:intervalValue,
     placement:field(row,"placement")||catalog?.care||"",
     notes:field(row,"notes")||undefined,
     status:"waiting",
     remainingMs:dripValue*60000
    });
    categories.add(cat);
   });
   if(!items.length){setImportNote(bi(lang,"لم أجد كائنات صالحة في الملف.","No valid shipment items were found in the file."));return;}
   saveSession({...active,categories:[...categories],wizardStep:2,items:[...active.items,...items],events:[ev(`تم استيراد ${items.length} كائن/مجموعة من ملف الشحنة.`,`Imported ${items.length} shipment item(s) from a file.`),...active.events]});
   setImportNote(bi(lang,`تم استيراد ${items.length} عنصر بنجاح${rejected?` • رُفض ${rejected} صف غير منطقي`:""}.`,`${items.length} item(s) imported successfully${rejected?` • ${rejected} implausible row(s) rejected`:""}.`));
  }catch{
   setImportNote(bi(lang,"تعذر قراءة الملف. استخدم قالب Aqua Nexus بصيغة CSV أو TXT.","Could not read the file. Use the Aqua Nexus CSV or TXT template."));
  }
 }

 function registryText(){if(!active)return"";const L=[bi(lang,"سجل إدخال الكائنات — Aqua Nexus","Livestock Input Register — Aqua Nexus"),`${bi(lang,"الحوض","Tank")}: ${tank.name}`,`${bi(lang,"بداية الجلسة","Session started")}: ${new Date(active.startedAt).toLocaleString()}`,""];active.items.forEach((x,i)=>{L.push(`${i+1}. ${lang==="ar"?x.name:(x.nameEn||x.name)} ×${x.quantity}`);L.push(`   ${categoryLabel(x.category)} • ${healthLabel(lang,x.health)} • ${x.status}`);L.push(`   ${bi(lang,"المكان","Placement")}: ${x.placement||"—"}`);if(x.notes)L.push(`   ${bi(lang,"ملاحظات","Notes")}: ${x.notes}`);L.push("")});return L.join("\n")}
 function exportTxt(){const blob=new Blob([registryText()],{type:"text/plain;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Aqua_Nexus_Acclimation_${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

 if(!active)return <section className="page-grid acclimation-page">{overrideDialog}<PageHeader eyebrow="ACCLIMATION CONTROL" title={tr(lang,"acclimation")} actions={<div className="actions"><button className="btn" onClick={()=>downloadShipmentTemplate("csv")}>↓ Excel / CSV</button><button className="btn" onClick={()=>downloadShipmentTemplate("txt")}>↓ TXT</button><button className="btn primary" onClick={newSession}>+ {tr(lang,"newShipment")}</button></div>}/><div className="card panel full-span"><DecisionGuidance what={bi(lang,"لا توجد جلسة إقلمة نشطة","No acclimation session is active")} why={bi(lang,"الإقلمة تبدأ فقط عند وصول شحنة فعلية حتى لا تُنشأ عدادات أو سجلات وهمية.","Acclimation starts only for a real arrival so Aqua Nexus does not create fake timers or records.")} next={bi(lang,"ابدأ جلسة جديدة عند وصول الكائنات، ثم اتبع المراحل بالترتيب.","Start a new session when livestock arrives, then follow the stages in order.")} safety={bi(lang,"Aqua Nexus سيقفل النقل إذا شروط الجاهزية أو Coral Dip/الشطف المطلوبة غير مكتملة.","Aqua Nexus will block transfer when readiness or required coral dip/rinse steps are incomplete.")}/></div><div className="card panel full-span acclimation-empty"><div className="acclimation-empty-icon">⇄</div><h2>{bi(lang,"ابدأ جلسة أقلمة جديدة","Start a new acclimation session")}</h2><p className="note">{bi(lang,"للشحنات الكبيرة نزّل القالب، عبّيه في Excel أو TXT، وبعد بدء الجلسة ارفعه دفعة واحدة.","For large shipments, download the template, fill it in Excel or TXT, then upload it after starting the session.")}</p><button className="btn primary" onClick={newSession}>{tr(lang,"newShipment")}</button></div></section>;

 const cats=active.categories??[];
 const floatRem=active.floatStatus==="running"&&active.floatEndAt?Math.max(0,active.floatEndAt-now):(active.floatRemainingMs??15*60000);
 const bucketRem=active.bucketStatus==="running"&&active.bucketEndAt?Math.max(0,active.bucketEndAt-now):(active.bucketRemainingMs??5*60000);
 const batchStates=releaseBatches.map(batch=>({batch,runtime:batchRuntime(batch)}));
 const runningBatchTimes=batchStates.filter(x=>!x.runtime.complete&&x.runtime.timer>0).map(x=>x.runtime.timer);
 const nearestBatchRem=runningBatchTimes.length?Math.min(...runningBatchTimes):0;
 const done=active.items.filter(x=>x.status==="added").length,pct=active.items.length?Math.round(done/active.items.length*100):0;
 const runningBatchCount=batchStates.filter(x=>x.runtime.status==="running").length;
 const readyBatchCount=batchStates.filter(x=>x.runtime.status==="ready").length;
 const runningDipCount=(active.coralDipRuns??[]).filter(x=>x.status==="running").length;
 const rinseDipCount=(active.coralDipRuns??[]).filter(x=>x.status==="ready_to_rinse").length;
 const urgentRinseRun=(active.coralDipRuns??[]).find(x=>x.status==="ready_to_rinse");
 const selectedCats=cats.length?cats:allowedCats;
 return <section className="page-grid acclimation-page">{overrideDialog}
  <PageHeader eyebrow="ACCLIMATION CONTROL" title={tr(lang,"acclimation")} actions={<><span className="pill">{tank.type==="marine"?tr(lang,"marine"):tr(lang,"freshwater")} • {lang.toUpperCase()}</span><button className="btn" onClick={newSession} disabled={Boolean(currentSession)}>{currentSession?bi(lang,"جلسة نشطة","Session active"):`+ ${tr(lang,"newShipment")}`}</button></>}/><div className="card panel full-span"><DecisionGuidance what={acclimationGuide.title} why={bi(lang,"الإقلمة مسار مرحلي مقفول: كل انتقال يعتمد على اكتمال المرحلة السابقة، وحالة الكائن، ومتطلبات الـDip/الشطف عند المرجان.","Acclimation is a gated staged workflow: each transition depends on the prior stage, livestock condition, and coral dip/rinse requirements when applicable.")} next={acclimationGuide.detail} safety={bi(lang,"لا يتم نقل ماء الشحنة للحوض، والـRisk Override يبقى استثنائياً وموثقاً.","Shipping water is not transferred to the tank; any Risk Override remains exceptional and explicitly logged.")}/></div>
  {step<5&&<div className="card acclimation-wizard full-span">
    <div className="acclimation-wizard-hero"><span>{tank.type==="marine"?"🌊":"🌿"}</span><div><small>AQUA NEXUS</small><h2>{bi(lang,"مساعد الإقلمة الذكي","Smart Acclimation Wizard")}</h2><p>{bi(lang,"لغة البرنامج ونوع الحوض مطبقان تلقائياً.","App language and selected tank type are applied automatically.")}</p></div></div>
    <div className="acclimation-stepper">{[1,2,3,4].map(n=><i key={n} className={n<step?"done":n===step?"active":""}/>)}</div>
    <div className="acclimation-wizard-body">
      {step===1&&<><h2>{bi(lang,"ما الذي وصل في الشحنة؟","What is arriving?")}</h2><p className="note">{bi(lang,"اختر الفئات يدوياً، أو استورد شحنة كبيرة مباشرة من ملف.","Select groups manually, or bulk-import a large shipment from a file.")}</p><div className="inline-alert info"><div><b>{bi(lang,"إضافة جماعية من ملف","Bulk shipment import")}</b><small>{bi(lang,"القالب يعمل مباشرة مع Excel ويمكن حفظه CSV أو TXT.","The template opens directly in Excel and can be saved as CSV or TXT.")}</small></div><div className="actions"><button className="btn" onClick={()=>downloadShipmentTemplate("csv")}>↓ Excel / CSV</button><button className="btn" onClick={()=>downloadShipmentTemplate("txt")}>↓ TXT</button><label className="btn primary">↑ {bi(lang,"رفع الملف","Upload file")}<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e=>{importShipment(e.target.files?.[0]);e.currentTarget.value="";}}/></label></div></div>{importNote&&<div className="inline-alert good">{importNote}</div>}<div className="acclimation-choice-grid">{allowedCats.map(c=><button className={`acclimation-choice ${cats.includes(c)?"selected":""}`} key={c} onClick={()=>toggleCat(c)}><span>{icon[c]}</span><b>{categoryLabel(c)}</b></button>)}</div><div className="wizard-nav"><span/><button className="btn primary" disabled={!cats.length} onClick={()=>setStep(2)}>{bi(lang,"التالي","Next")} →</button></div></>}
      {step===2&&<><div className="section-title"><div><h2>{bi(lang,"إضافة محتويات الشحنة","Add shipment items")}</h2><p className="note">{bi(lang,"ابدأ بالمعلومات الأساسية. Aqua Nexus يطبّق قيم الإقلمة والعناية المعروفة تلقائياً، والتعديل الدقيق موجود تحت التفاصيل المتقدمة.","Start with the essentials. Aqua Nexus applies known acclimation and care defaults automatically; fine tuning remains under Advanced details.")}</p></div><div className="actions"><button className="btn" onClick={()=>downloadShipmentTemplate("csv")}>↓ Excel / CSV</button><label className="btn">↑ {bi(lang,"استيراد","Import")}<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e=>{importShipment(e.target.files?.[0]);e.currentTarget.value="";}}/></label></div></div>{importNote&&<div className="inline-alert good">{importNote}</div>}
      <div className="acclimation-essential-grid">
       <label className="field"><span>{tr(lang,"category")}</span><select value={category} onChange={e=>{const c=e.target.value as Cat;setCategory(c);setSelected("");setCustom("");setDrip(c==="invert"?45:c==="fish"?20:20);setIntervalMin(c==="coral"?5:c==="plant"||c==="macroalgae"?0:15);setSubtype(c==="macroalgae"?"macroalgae":"")}}>{selectedCats.map(c=><option key={c} value={c}>{categoryLabel(c)}</option>)}</select></label>
       <label className="field"><span>{tr(lang,"selectOrganism")}</span><select value={selected} onChange={e=>speciesApply(e.target.value)}><option value="">— {bi(lang,"نوع مخصص","Custom species")} —</option>{choices.map((x:any)=><option value={x.id} key={x.id}>{lang==="ar"?x.ar:x.en}</option>)}</select></label>
       <label className="field"><span>{tr(lang,"name")}</span><input value={custom} onChange={e=>setCustom(e.target.value)}/></label>
       <label className="field"><span>{tr(lang,"quantity")}</span><input type="number" min="1" max="10000" value={qty} onChange={e=>setQty(Number(e.target.value))}/></label>
       <label className="field"><span>{bi(lang,"الصحة عند الوصول","Arrival health")}</span><select value={health} onChange={e=>setHealth(e.target.value as any)}>{healthOptions.map(h=><option key={h} value={h}>{healthLabel(lang,h)}</option>)}</select><small>{health==="stressed"||health==="critical"?bi(lang,"رح يضل المسار الاستثنائي متاح فور بدء الجلسة.","The exception track will remain immediately available once the session starts."):bi(lang,"سجّل الحالة كما وصلت، مو كما تتوقع تصير بعد الإقلمة.","Record the actual arrival condition, not the expected post-acclimation condition.")}</small></label>
      </div>
      <div className="acclimation-default-summary"><div><small>{bi(lang,"الإعداد المطبق حالياً","CURRENT PROFILE")}</small><b>{categoryLabel(category)} • {drip} {bi(lang,"دقيقة إقلمة","min acclimation")} • {interval} {bi(lang,"دقيقة فاصل","min release interval")}</b><span>{bi(lang,`${temperamentLabel(lang,temperament)} • ${sensitivityLabel(lang,sensitivity)}`,`${temperamentLabel(lang,temperament)} • ${sensitivityLabel(lang,sensitivity)}`)}</span></div></div>
      <AdvancedSection titleAr="تعديل بروفايل الإقلمة" titleEn="Adjust acclimation profile" summaryAr="السلوك والحساسية والأوقات والتموضع؛ افتحها فقط إذا عندك سبب خاص بالكائن أو الشحنة." summaryEn="Temperament, sensitivity, timing and placement; open only for a species- or shipment-specific reason."><div className="acclimation-item-advanced"><ContextHint id="acclimation-manual-profile" lang={lang} tone="important" ar="عدّل أوقات الإقلمة والحساسية فقط إذا عندك سبب خاص بالكائن أو الشحنة؛ القيم الافتراضية هي نقطة البداية الآمنة." en="Adjust acclimation timing and sensitivity only for a species- or shipment-specific reason; the defaults are the safer starting point."/><div className="form-grid">
       <label className="field"><span>{bi(lang,"السلوك","Temperament")}</span><select value={temperament} onChange={e=>setTemperament(e.target.value as any)}>{temperamentOptions.map(v=><option key={v} value={v}>{temperamentLabel(lang,v)}</option>)}</select></label>
       <label className="field"><span>{bi(lang,"الحساسية","Sensitivity")}</span><select value={sensitivity} onChange={e=>setSensitivity(e.target.value as any)}>{sensitivityOptions.map(v=><option key={v} value={v}>{sensitivityLabel(lang,v)}</option>)}</select></label>
       {(category==="coral"||category==="plant")&&<label className="field"><span>{bi(lang,"بروفايل العناية","Care profile")}</span><select value={subtype} onChange={e=>setSubtype(e.target.value)}><option value="">{bi(lang,"تلقائي / يدوي","Auto / Manual")}</option>{category==="coral"?<><option value="soft">Soft</option><option value="lps">LPS</option><option value="sps">SPS</option></>:<><option value="low">Low light</option><option value="medium">Medium light</option><option value="high">High light</option></>}</select></label>}
       <label className="field"><span>{tr(lang,"dripMinutes")}</span><input type="number" min="0" max="360" value={drip} onChange={e=>setDrip(Number(e.target.value))}/></label>
       <label className="field"><span>{tr(lang,"releaseInterval")}</span><input type="number" min="0" max="180" value={interval} onChange={e=>setIntervalMin(Number(e.target.value))}/></label>
       <label className="field full-field"><span>{tr(lang,"placement")}</span><input value={placement} onChange={e=>setPlacement(e.target.value)}/></label>
       <label className="field full-field"><span>{bi(lang,"ملاحظات","Notes")}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label>
       <label className="field full-field"><span>{bi(lang,"صورة اختيارية","Optional photo")}</span><input type="file" accept="image/*" onChange={e=>readPhoto(e.target.files?.[0])}/></label>
      </div></div></AdvancedSection>
      <button className="btn primary acclimation-add-item" onClick={addItem} disabled={!selected&&!custom.trim()}>＋ {bi(lang,"إضافة للشحنة","Add to shipment")}</button>
      <div className="added-list">{active.items.map(i=><div className="acclimation-mini" key={i.id}>{i.imageDataUrl?<img src={i.imageDataUrl} alt=""/>:<span>{icon[i.category]}</span>}<div><b>{lang==="ar"?i.name:(i.nameEn||i.name)} ×{i.quantity}</b><small>{categoryLabel(i.category)}{i.subtype?` • ${subtypeLabel(lang,i.subtype)}`:""} • {healthLabel(lang,i.health)} • {i.dripMinutes} min</small></div><button className="btn danger" onClick={()=>removeItem(i.id)}>×</button></div>)}</div>
      <div className="wizard-nav"><button className="btn" onClick={()=>setStep(1)}>← {bi(lang,"رجوع","Back")}</button><button className="btn primary" disabled={!active.items.length} onClick={()=>setStep(3)}>{bi(lang,"مراجعة الشحنة","Review shipment")} →</button></div></>}
      {step===3&&<><div className="section-title"><div><h2>{bi(lang,"مراجعة ترتيب التنزيل المقترح","Review suggested release order")}</h2><p className="note">{bi(lang,"الترتيب المقترح تنظيمي فقط ويمكنك تغييره.","Suggested order is organizational only and can be overridden.")}</p></div><button className="btn" onClick={autoOrder}>{bi(lang,"تطبيق المقترح","Apply suggestion")}</button></div><div className="acclimation-review">{active.items.map((i,idx)=><div className="acclimation-review-row" key={i.id}><span className="rank">{idx+1}</span><span className="review-icon">{icon[i.category]}</span><div><b>{lang==="ar"?i.name:(i.nameEn||i.name)} ×{i.quantity}</b><small>{temperamentLabel(lang,i.temperament||"peaceful")} • {sensitivityLabel(lang,i.sensitivity||"normal")}{i.subtype?` • ${subtypeLabel(lang,i.subtype)}`:""}<br/>{i.placement||"—"}</small></div><div className="move"><button className="btn" disabled={idx===0} onClick={()=>moveItem(i.id,-1)}>↑</button><button className="btn" disabled={idx===active.items.length-1} onClick={()=>moveItem(i.id,1)}>↓</button></div></div>)}</div><div className="wizard-nav"><button className="btn" onClick={()=>setStep(2)}>← {bi(lang,"رجوع","Back")}</button><button className="btn primary" onClick={()=>setStep(4)}>{bi(lang,"التالي","Next")} →</button></div></>}
      {step===4&&<><h2>{bi(lang,"إعدادات الماء والسلامة","Water & safety setup")}</h2><p className="note">{bi(lang,"القيم مرجعية والقرار النهائي للمستخدم.","Values are for reference; the final decision remains with the user.")}</p><div className="form-grid">{tank.type==="marine"&&<><label className="field"><span>{tr(lang,"tankSalinity")}</span><input type="number" min=".99" max="1.06" step=".001" value={active.tankSalinity??""} onChange={e=>sessionPatch({tankSalinity:Number(e.target.value)})}/></label><label className="field"><span>{tr(lang,"bagSalinity")}</span><input type="number" min=".99" max="1.06" step=".001" value={active.bagSalinity??""} onChange={e=>sessionPatch({bagSalinity:Number(e.target.value)})}/></label></>}<label className="field"><span>{tr(lang,"temperature")}</span><input type="number" min="0" max="45" step=".1" value={active.temperature??""} onChange={e=>sessionPatch({temperature:Number(e.target.value)})}/></label><label className="field"><span>{bi(lang,"ملاحظات سكان الحوض الحاليين","Existing tank notes")}</span><input value={active.existingNotes??""} onChange={e=>sessionPatch({existingNotes:e.target.value})}/></label>{active.items.some(i=>i.category==="coral")&&<><label className="check-field"><input type="checkbox" checked={active.coralDipEnabled??false} onChange={e=>sessionPatch({coralDipEnabled:e.target.checked})}/><span>🪸 {bi(lang,"استخدام Coral Dip ضمن مسار الإقلمة","Use Coral Dip in the acclimation workflow")}</span></label>{active.coralDipEnabled&&<><label className="field"><span>{bi(lang,"منتج Coral Dip من المخزون","Coral Dip product from inventory")}</span><select value={active.coralDipInventoryItemId??""} onChange={e=>sessionPatch({coralDipInventoryItemId:e.target.value})}><option value="">{bi(lang,"اختر المادة","Select product")}</option>{acclimationStock.map(i=><option key={i.id} value={i.id}>{lang==="ar"?i.name:(i.nameEn||i.name)} • {i.quantity} {i.unit}</option>)}</select></label><label className="field"><span>{bi(lang,"كمية كل تحضير Dip","Quantity per prepared dip bath")}</span><input type="number" min=".000001" max="1000000" step="any" value={active.coralDipQuantityPerPrep??0} onChange={e=>sessionPatch({coralDipQuantityPerPrep:Number(e.target.value)})}/>{active.coralDipInventoryItemId&&<small>{bi(lang,"تنخصم مرة واحدة وقت بدء كل تحضير، مو لكل قطعة مرجان.","Deducted once when each bath starts, not once per coral.")} • {tank.inventory.find(i=>i.id===active.coralDipInventoryItemId)?.unit??""}</small>}</label><label className="field"><span>{bi(lang,"مدة الـDip حسب ملصق المنتج","Dip minutes from product label")}</span><input type="number" min=".1" max="120" step=".1" value={active.coralDipMinutes??10} onChange={e=>sessionPatch({coralDipMinutes:Number(e.target.value)})}/></label></>}</>}</div><div className="inline-alert info acclimation-workflow-note">💧 {bi(lang,active.coralDipEnabled?"التسلسل: الأكياس مغلقة → الأوعية → التنقيط المتوازي → فحص المرجان → Coral Dip بعداد مستقل وخصم التحضير من المخزون → شطف بماء منفصل → النقل بدون ماء الشحنة.":"التسلسل: الأكياس مغلقة → الأوعية → التنقيط المتوازي → الفحص → النقل بدون ماء الشحنة.","Workflow: sealed bags → containers → parallel drip → coral inspection → timed inventory-backed Coral Dip → separate rinse → transfer without shipping water.")}</div><h3>{bi(lang,"قائمة التجهيز قبل الوصول","Pre-arrival checklist")}</h3><div className="preflight-grid">{preflight.map((x,i)=><label className="check-field" key={i}><input type="checkbox" checked={Boolean(active.preflight?.[i])} onChange={()=>toggleCheck(i)}/><span>{x}</span></label>)}</div><div className="wizard-nav"><button className="btn" onClick={()=>setStep(3)}>← {bi(lang,"رجوع","Back")}</button><button className="btn primary" onClick={startSession}>▶ {bi(lang,"بدء الجلسة","Start Session")}</button></div></>}
    </div>
  </div>}

  {step>=5&&<>
   {timerAlerts.length>0&&<div className="acclimation-alert-stack full-span">{timerAlerts.map(a=><div className={`acclimation-timer-alert ${soundFamily(a.lane)}`} key={a.id}><span>{a.lane==="fish"?"🐠":a.lane==="coral"?"🪸":a.lane==="plant"||a.lane==="macroalgae"?"🌿":a.lane==="emergency"?"🚨":a.lane==="global"?"⏱":"🦐"}</span><b>{a.message}</b><button onClick={()=>setTimerAlerts(v=>v.filter(x=>x.id!==a.id))}>×</button></div>)}</div>}
   <section className="card panel full-span acclimation-master-stage">
    <div className="acclimation-live-guide-head"><div><small>LIVE ACCLIMATION</small><h2>{bi(lang,"مراحل الإقلمة — شو عم يعد هلق؟","Acclimation stages — what is counting now?")}</h2></div><span>{bi(lang,`المرحلة ${acclimationGuide.stage}/5`,`Stage ${acclimationGuide.stage}/5`)}</span></div>
    <div className="acclimation-phase-rail">
     {[{ar:"موازنة الحرارة",en:"Temperature",ico:"🌡️"},{ar:"النقل للأوعية",en:"Containers",ico:"🪣"},{ar:"التنقيط المتوازي",en:"Parallel drip",ico:"💧"},{ar:"الفحص والنقل",en:"Inspect & transfer",ico:"🔎"},{ar:"التوثيق",en:"Log complete",ico:"✅"}].map((p,i)=>{const n=i+1;return <div key={n} className={`acclimation-phase ${n===acclimationGuide.stage?"active":n<acclimationGuide.stage?"past":""}`}><span>{p.ico}</span><b>{n}. {lang==="ar"?p.ar:p.en}</b></div>})}
    </div>
    <div className={`master-stage-box ${acclimationGuide.tone}`}>
     <div className="master-stage-copy"><small>{bi(lang,"المرحلة الحالية","Current stage")}</small><h3>{acclimationGuide.title}</h3><p>{acclimationGuide.detail}</p>{emergencyItems.length>0&&<em>🚨 {bi(lang,`هناك ${emergencyItems.length} كائن/مجموعة في المسار الاستثنائي السريع بالتوازي.`,`There are ${emergencyItems.length} item/group(s) in the parallel rapid exception track.`)}</em>}</div>
     <div className="master-stage-timer">
      <small>{!active.floatConfirmed?bi(lang,"عداد موازنة الحرارة — لكل الشحنة","Temperature timer — whole shipment"):active.bucketStatus!=="done"?bi(lang,"عداد النقل إلى الأوعية — لكل الشحنة","Container-transfer timer — whole shipment"):!active.dripStartedAt?bi(lang,"جاهز لبدء التنقيط","Ready to start drip"):bi(lang,"أقرب دفعة ستصبح جاهزة","Next batch ready in")}</small>
      <b>{!active.floatConfirmed?fmt(floatRem):active.bucketStatus!=="done"?fmt(bucketRem):!active.dripStartedAt?"05:00":fmt(nearestBatchRem)}</b>
     </div>
     <div className="master-stage-actions">
      {!active.floatConfirmed&&active.floatStatus==="running"&&<button className="btn" onClick={()=>floatAction("pause")}>{bi(lang,"إيقاف مؤقت","Pause")}</button>}
      {!active.floatConfirmed&&active.floatStatus==="paused"&&<button className="btn primary" onClick={()=>floatAction("resume")}>{bi(lang,"استئناف","Resume")}</button>}
      {!active.floatConfirmed&&["running","paused"].includes(active.floatStatus||"")&&<button className="btn" onClick={()=>floatAction("plus5")}>+5</button>}
      {!active.floatConfirmed&&active.floatStatus==="ready"&&<button className="btn good" onClick={()=>floatAction("done")}>✓ {bi(lang,"تأكيد الحرارة — ابدأ 5 دقائق النقل للأوعية","Confirm temperature — start 5-minute container transfer")}</button>}
      {active.floatConfirmed&&active.bucketStatus!=="done"&&<button className="btn danger" onClick={()=>setExceptionPickerOpen(v=>!v)}>🚨 {bi(lang,"استثناءات — للكائنات المتعبة فقط","Exceptions — distressed livestock only")}</button>}
      {active.floatConfirmed&&(!active.bucketStatus||active.bucketStatus==="waiting")&&<button className="btn primary master-transfer-start" onClick={()=>bucketAction("start")}>🪣 {bi(lang,"ابدأ عداد النقل — 5 دقائق","Start transfer timer — 5 min")}</button>}
      {active.floatConfirmed&&active.bucketStatus==="running"&&<button className="btn" onClick={()=>bucketAction("pause")}>{bi(lang,"إيقاف مؤقت","Pause")}</button>}
      {active.floatConfirmed&&active.bucketStatus==="paused"&&<button className="btn primary" onClick={()=>bucketAction("resume")}>{bi(lang,"استئناف","Resume")}</button>}
      {active.floatConfirmed&&active.bucketStatus==="ready"&&<button className="btn good" onClick={()=>bucketAction("done")}>✓ {bi(lang,"تم نقل كل الكائنات إلى الأوعية","All livestock moved to containers")}</button>}
      {active.floatConfirmed&&active.bucketStatus==="done"&&!active.dripStartedAt&&<button className="btn primary master-drip-start" onClick={startAllDripBatches}>💧 {bi(lang,"ابدأ التنقيط لكل الدفعات الآن","Start drip acclimation for all batches now")}</button>}
      {urgentRinseRun&&<button className="btn good" onClick={()=>confirmCoralRinse(urgentRinseRun.id)}>💧 {bi(lang,"تم الشطف بماء منفصل","Confirm separate rinse")}</button>}
     </div>
    </div>
    <div className="acclimation-live-summary"><div><small>{bi(lang,"دفعات شغالة","Running batches")}</small><b>{runningBatchCount}</b></div><div className={readyBatchCount?"attention":""}><small>{bi(lang,"جاهزة للفحص","Ready to inspect")}</small><b>{readyBatchCount}</b></div><div className={exceptionPendingItems.length?"danger":""}><small>{bi(lang,"مسار استثنائي","Exception track")}</small><b>{exceptionPendingItems.length}</b></div><div className={rinseDipCount?"danger":runningDipCount?"attention":""}><small>Coral Dip</small><b>{runningDipCount} {bi(lang,"شغال","running")} • {rinseDipCount} {bi(lang,"شطف","rinse")}</b></div></div>
    {active.floatConfirmed&&active.bucketStatus!=="done"&&exceptionPickerOpen&&<div className="exception-picker">
     <div className="exception-picker-head"><div><small>EMERGENCY SELECTION</small><h3>🚨 {bi(lang,"اختيار الكائنات المتعبة فقط","Select distressed livestock only")}</h3><p>{bi(lang,"استخدم الاستثناء فقط للكائن الذي يظهر عليه تعب أو إجهاد واضح. عند التأكيد نعتبر المحدد نُقل إلى وعائه ويبدأ له فوراً تنقيط سريع مستقل بالتوازي مع نقل بقية الشحنة.","Use this only for livestock showing clear stress or distress. On confirmation, selected items are treated as moved to their containers and immediately start an independent rapid drip timer while the rest of the shipment continues.")}</p></div><button className="btn" onClick={()=>setExceptionPickerOpen(false)}>×</button></div>
     <div className="exception-picker-tools"><span>{selectedExceptionIds.length} / {exceptionCandidates.length} {bi(lang,"محدد","selected")}</span><div className="actions"><button className="btn" onClick={selectAllExceptionCandidates}>{bi(lang,"اختيار الكل","Select all")}</button><button className="btn" onClick={clearExceptionSelection}>{bi(lang,"إلغاء التحديد","Clear")}</button></div></div>
     <div className="exception-picker-list">{exceptionCandidates.map(item=><label className={`exception-choice ${selectedExceptionIds.includes(item.id)?"selected":""}`} key={item.id}><input type="checkbox" checked={selectedExceptionIds.includes(item.id)} onChange={()=>toggleExceptionCandidate(item.id)}/><span className="exception-choice-icon">{releaseLaneIcon(releaseLaneKey(item))}</span><span className="exception-choice-copy"><b>{lang==="ar"?item.name:(item.nameEn||item.name)} ×{item.quantity}</b><small>{releaseLaneLabel(lang,releaseLaneKey(item))} • {healthLabel(lang,item.health)} • {sensitivityLabel(lang,item.sensitivity||"normal")}</small></span><em>{Math.round(emergencyDuration(item)/60000)} {bi(lang,"د","min")}</em></label>)}</div>
     <div className="exception-picker-footer"><span>{bi(lang,"يمكن اختيار كائن واحد أو عدة كائنات أو اختيار الكل. هذا المسار لا يوقف عداد نقل بقية الشحنة.","Choose one, several, or all items. This track does not stop the transfer timer for the rest of the shipment.")}</span><button className="btn danger" disabled={!selectedExceptionIds.length} onClick={startSelectedExceptions}>🚨 {bi(lang,"تأكيد النقل للأوعية وبدء التنقيط السريع","Confirm container transfer & start rapid drip")}</button></div>
    </div>}
   </section>
   {exceptionAllItems.length>0&&(()=>{const runtime=exceptionBoxRuntime();const visible=runtime.remainingItems;const expanded=exceptionBoxExpanded;return <section className="full-span exception-batch-board">
    <article className={`batch-box exception-batch-box ${runtime.allAdded?"success":runtime.status}`}>
     <button className="batch-box-head" onClick={()=>!runtime.allAdded&&setExceptionBoxExpanded(v=>!v)}>
      <span className="batch-box-icon">🚨</span>
      <span className="batch-box-title"><small>FAST TRACK</small><b>{bi(lang,"صندوق الاستثناءات","Exception Box")}</b><em>{runtime.allItems.length} {bi(lang,"مجموعة","groups")} • {bi(lang,"مرحلة سريعة مستقلة","Independent rapid stage")}</em></span>
      <span className={`batch-box-status ${runtime.status}`}>{runtime.allAdded?bi(lang,"تم نقل الاستثناءات للحوض بنجاح","Exceptions transferred successfully"):runtime.status==="ready"?bi(lang,"جاهز للفحص والنقل","Ready for inspection & transfer"):acclimationStatusLabel(lang,runtime.status)}</span>
      <span className="batch-box-timer">{runtime.allAdded?"✓":fmt(runtime.timer)}</span>
      <span className="batch-box-chevron">{runtime.allAdded?"✓":expanded?"⌃":"⌄"}</span>
     </button>
     {!runtime.allAdded&&<div className="exception-batch-note">🚨 {bi(lang,"للكائنات المتعبة فقط. عند انتهاء العداد يصدر صوت الاستثناء، يفتح الصندوق تلقائياً، ثم تنقل الكائنات إلى الحوض واحداً واحداً. بقية خطة الإقلمة تستمر بدون توقف.","For distressed livestock only. When the timer ends, the exception sound plays, the box opens automatically, and livestock can be transferred one by one. The rest of the acclimation plan keeps running.")}</div>}
     {expanded&&!runtime.allAdded&&<div className="batch-box-body">
      {visible.map((item:AcclimationItem)=>{const dipGate=coralTransferGate(active,item),dipRun=dipGate.run;return <div className={`batch-livestock-row ${item.status}`} key={item.id}>
       <span className="batch-live-icon">{releaseLaneIcon(releaseLaneKey(item))}</span>
       <div><b>{lang==="ar"?item.name:(item.nameEn||item.name)} ×{item.quantity}</b><small>{releaseLaneLabel(lang,releaseLaneKey(item))} • {healthLabel(lang,item.health)} • {sensitivityLabel(lang,item.sensitivity||"normal")}</small>{item.category==="coral"&&active.coralDipEnabled&&!dipGate.allowed&&<small>🪸 {lang==="ar"?dipGate.reasonAr:dipGate.reasonEn}</small>}</div>
       <div className="batch-live-actions">
        {item.status!=="ready"?<span className="waiting-chip">⏱ {bi(lang,"التنقيط السريع قيد التشغيل","Rapid drip running")}</span>:dipGate.allowed?<button className="btn primary" onClick={()=>markAdded(item)}>✓ {bi(lang,"تم النقل إلى الحوض","Transferred to tank")}</button>:item.category==="coral"&&!dipRun?<><button className="btn primary" onClick={()=>startEmergencyCoralDip(item)}>🪸 {bi(lang,"ابدأ Coral Dip","Start Coral Dip")}</button><button className="btn warn" onClick={()=>skipCoralDipForStress(item)}>{bi(lang,"تجاوز بسبب الإجهاد","Skip due to distress")}</button></>:dipRun?.status==="running"?<span className="waiting-chip">🪸 {bi(lang,"Dip","Dip")} {fmt(Math.max(0,(dipRun.endAt??Date.now())-now))}</span>:dipRun?.status==="ready_to_rinse"?<button className="btn good" onClick={()=>confirmCoralRinse(dipRun.id)}>💧 {bi(lang,"تم الشطف بماء منفصل","Rinse confirmed")}</button>:<span className="waiting-chip">{lang==="ar"?dipGate.reasonAr:dipGate.reasonEn}</span>}
        {!["added","deferred"].includes(item.status)&&<button className="btn warn" onClick={()=>cancelEmergency(item.id)}>↩ {bi(lang,"إرجاع للخطة العامة","Return to main plan")}</button>}
       </div>
      </div>})}
     </div>}
    </article>
   </section>})()}
   
   {active.dripStartedAt&&<section className="full-span batch-board">
    <div className="section-title"><div><h2>{bi(lang,"دفعات التنقيط — كلها تعد بالتوازي","Drip batches — all timers run in parallel")}</h2><p className="note">{bi(lang,"كل صندوق له عداده الخاص. عند انتهاء عداد أي دفعة يصدر صوت النوع، يُفتح الصندوق تلقائياً، وتظهر أزرار نقل الكائنات إلى الحوض. بقية العدادات تستمر بدون توقف.","Each box has its own timer. When a batch finishes, its category sound plays, the box opens automatically, and transfer buttons appear. All other timers continue without interruption.")}</p></div></div>
    <div className="batch-board-grid">
     {releaseBatches.map(batch=>{const runtime=batchRuntime(batch);const expanded=Boolean(expandedBatches[batch.id]);const visibleItems=runtime.remainingItems.filter((i:AcclimationItem)=>!i.emergency);const isReady=runtime.status==="ready";const dipRun=batch.lane==="coral"&&active.coralDipEnabled?coralDipBatchRun(active,batch.id):undefined;return <article className={`batch-box ${runtime.allAdded?"success":runtime.status}`} key={batch.id}>
      <button className="batch-box-head" onClick={()=>!runtime.allAdded&&setExpandedBatches(v=>({...v,[batch.id]:!v[batch.id]}))}>
       <span className="batch-box-icon">{releaseLaneIcon(batch.lane)}</span><span className="batch-box-title"><small>{releaseLaneLabel(lang,batch.lane)}</small><b>{bi(lang,`الدفعة ${batch.batch}`,`Batch ${batch.batch}`)} {batch.totalBatches>1?`/ ${batch.totalBatches}`:""}</b><em>{runtime.allItems.length} {bi(lang,"مجموعة","groups")} • {batch.plannedMinutes} {bi(lang,"دقيقة مخططة","planned min")}</em></span>
       <span className={`batch-box-status ${runtime.status}`}>{runtime.allAdded?bi(lang,"تم نقل الدفعة للحوض بنجاح","Batch transferred successfully"):acclimationStatusLabel(lang,runtime.status)}</span>
       <span className="batch-box-timer">{runtime.allAdded?"✓":fmt(runtime.timer)}</span><span className="batch-box-chevron">{runtime.allAdded?"✓":expanded?"⌃":"⌄"}</span>
      </button>
      {expanded&&!runtime.allAdded&&<div className="batch-box-body">
       {batch.lane==="coral"&&active.coralDipEnabled&&isReady&&<div className={`inline-alert ${dipRun?.status==="rinsed"?"good":dipRun?.status==="ready_to_rinse"?"warn":"info"}`}>
        <div><b>🪸 {bi(lang,"Coral Dip — مرحلة مستقلة قبل النقل","Coral Dip — separate pre-transfer stage")}</b><p>{!dipRun?bi(lang,"الدفعة خلصت التنقيط. إذا بدك تستخدم الـDip، ابدأ التحضير الآن؛ المادة رح تنخصم مرة واحدة من المخزون لهذه الدفعة.","Drip is complete. Start the dip bath now; the product will be deducted once from inventory for this batch."):dipRun.status==="running"?bi(lang,`الـDip شغال باستخدام ${dipRun.productName}. بعد انتهاء العداد لازم شطف بماء منفصل.`,`Dip is running with ${dipRun.productName}. A separate rinse is required when the timer ends.`):dipRun.status==="ready_to_rinse"?bi(lang,"انتهى الـDip. انقل المرجان لماء شطف منفصل ثم أكد الشطف قبل النقل للحوض.","Dip is complete. Move coral to separate rinse water and confirm the rinse before tank transfer."):bi(lang,"تم الـDip والشطف. صار مسموح نقل قطع هذه الدفعة بعد فحص الجاهزية.","Dip and rinse are complete. Batch items may now be transferred after readiness screening.")}</p></div>
        <div className="actions">{!dipRun&&<button className="btn primary" onClick={()=>startCoralDip(batch)}>▶ {bi(lang,"ابدأ Coral Dip","Start Coral Dip")}</button>}{dipRun?.status==="running"&&<span className="scene-badge">⏱ {fmt(Math.max(0,(dipRun.endAt??Date.now())-now))}</span>}{dipRun?.status==="ready_to_rinse"&&<button className="btn good" onClick={()=>confirmCoralRinse(dipRun.id)}>💧 {bi(lang,"تأكيد الشطف","Confirm rinse")}</button>}{dipRun?.status==="rinsed"&&<span className="status good">✓ {bi(lang,"Dip + Rinse","Dip + Rinse")}</span>}</div>
       </div>}
       {visibleItems.length===0?<div className="batch-empty">{bi(lang,"لا توجد عناصر متبقية في هذه الدفعة ضمن المسار العام.","No remaining items in this normal batch.")}</div>:visibleItems.map((item:AcclimationItem)=>{const transferGate=coralTransferGate(active,item);return <div className={`batch-livestock-row ${item.status}`} key={item.id}><span className="batch-live-icon">{icon[item.category]}</span><div><b>{lang==="ar"?item.name:(item.nameEn||item.name)} ×{item.quantity}</b><small>{healthLabel(lang,item.health)} • {sensitivityLabel(lang,item.sensitivity||"normal")}{item.subtype?` • ${subtypeLabel(lang,item.subtype)}`:""}</small>{item.category==="coral"&&active.coralDipEnabled&&!transferGate.allowed&&<small>🪸 {lang==="ar"?transferGate.reasonAr:transferGate.reasonEn}</small>}</div><div className="batch-live-actions">{item.status!=="ready"?<span className="waiting-chip">⏱ {bi(lang,"بانتظار انتهاء عداد الدفعة","Waiting for batch timer")}</span>:transferGate.allowed?<button className="btn primary" onClick={()=>markAdded(item)}>✓ {bi(lang,"تم النقل إلى الحوض","Transferred to tank")}</button>:<span className="waiting-chip">🪸 {bi(lang,"بانتظار Dip / Rinse","Waiting for Dip / Rinse")}</span>}{!["added","deferred"].includes(item.status)&&<button className="btn danger" onClick={()=>startEmergency(item.id)}>🚨 {bi(lang,"استثناء","Exception")}</button>}</div></div>})}
      </div>}
     </article>})}
    </div>
   </section>}
   <details className="card panel full-span acclimation-session-details" open={Boolean(sessionCompleted)}>
    <summary><div><small>{bi(lang,"السجل والتفاصيل","SESSION DETAILS")}</small><b>{sessionCompleted?bi(lang,"الجلسة مكتملة — راجع السجل","Session complete — review the record"):bi(lang,"تفاصيل الجلسة والسجل","Session details & record")}</b><span>{bi(lang,`${done}/${active.items.length} تم نقلها • ${active.events.length} أحداث مسجلة`,`${done}/${active.items.length} transferred • ${active.events.length} logged events`)}</span></div><em>⌄</em></summary>
    <div className="acclimation-session-detail-body">
     <div className="acclimation-metrics"><div className="card metric"><small>{bi(lang,"الحوض","Tank")}</small><b>{tank.name}</b></div><div className="card metric"><small>{bi(lang,"العناصر","Items")}</small><b>{active.items.length}</b></div><div className="card metric"><small>{bi(lang,"تم نقلها","Transferred")}</small><b>{done}/{active.items.length}</b><div className="progress"><i style={{width:`${pct}%`}}/></div></div><div className="card metric"><small>{bi(lang,"المرحلة","Stage")}</small><b>{acclimationGuide.stage}/5</b></div></div>
     <section className="acclimation-registry" id="acclimationRegistry"><div className="section-title"><div><h2>{bi(lang,"سجل الكائنات المدخلة","Livestock Input Register")}</h2><p className="note">{bi(lang,"يمكن طباعته أو حفظه PDF من المتصفح.","Print or save as PDF from the browser.")}</p></div><div className="actions"><button className="btn" onClick={()=>window.print()}>🖨 {bi(lang,"طباعة / PDF","Print / PDF")}</button><button className="btn" onClick={exportTxt}>TXT</button></div></div><div className="record-wrap"><table className="records"><thead><tr><th>#</th><th>{bi(lang,"النوع","Species")}</th><th>{bi(lang,"الفئة","Category")}</th><th>{bi(lang,"الصحة","Health")}</th><th>{bi(lang,"الحالة","Status")}</th><th>{bi(lang,"تاريخ الإدخال","Added")}</th><th>{bi(lang,"المكان / الملاحظات","Placement / Notes")}</th></tr></thead><tbody>{active.items.map((x,i)=><tr key={x.id}><td>{i+1}</td><td><b>{lang==="ar"?x.name:(x.nameEn||x.name)}</b> ×{x.quantity}</td><td>{categoryLabel(x.category)}{x.subtype?` • ${subtypeLabel(lang,x.subtype)}`:""}</td><td>{healthLabel(lang,x.health)}</td><td>{acclimationStatusLabel(lang,x.status)}</td><td>{x.addedAt?new Date(x.addedAt).toLocaleString():"—"}</td><td>{x.placement||"—"}<div className="record-note">{x.notes}</div></td></tr>)}</tbody></table></div></section>
     <section><div className="section-title"><h2>{tr(lang,"eventLog")}</h2></div><div className="history-list">{active.events.map(x=><div className="history-row" key={x.id}><b>{lang==="ar"?x.textAr:x.textEn}</b><span>{new Date(x.timestamp).toLocaleString()}</span></div>)}</div></section>
    </div>
   </details>
  </>}
  <style jsx>{`
   .acclimation-essential-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
   .acclimation-default-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding:11px 12px;border:1px solid rgba(255,255,255,.07);border-radius:13px;background:rgba(255,255,255,.025)}
   .acclimation-default-summary>div{display:grid;gap:3px}.acclimation-default-summary small{font-size:8px;color:var(--accent);font-weight:900}.acclimation-default-summary b{font-size:11px}.acclimation-default-summary span{font-size:8px;color:var(--muted)}
   .acclimation-item-advanced{margin-top:10px;padding:12px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(2,18,26,.34)}
   .acclimation-add-item{margin-top:12px}
   .acclimation-live-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}
   .acclimation-live-summary>div{display:grid;gap:2px;padding:8px 10px;border:1px solid rgba(255,255,255,.06);border-radius:11px;background:rgba(255,255,255,.02)}
   .acclimation-live-summary small{font-size:7px;color:var(--muted)}.acclimation-live-summary b{font-size:11px}.acclimation-live-summary .attention{border-color:rgba(255,201,99,.24);background:rgba(255,201,99,.04)}.acclimation-live-summary .danger{border-color:rgba(255,112,122,.3);background:rgba(255,112,122,.05)}
   .acclimation-session-details{padding:0;overflow:hidden}.acclimation-session-details>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px}.acclimation-session-details>summary::-webkit-details-marker{display:none}
   .acclimation-session-details>summary>div{display:grid;gap:2px}.acclimation-session-details>summary small{font-size:7px;color:var(--accent);font-weight:900}.acclimation-session-details>summary b{font-size:12px}.acclimation-session-details>summary span{font-size:8px;color:var(--muted)}.acclimation-session-details>summary em{font-style:normal;color:var(--accent);font-size:18px;transition:transform .2s}.acclimation-session-details[open]>summary em{transform:rotate(180deg)}
   .acclimation-session-detail-body{display:grid;gap:14px;padding:0 14px 14px;border-top:1px solid rgba(255,255,255,.05)}.acclimation-session-detail-body>.acclimation-metrics{margin-top:12px}
   @media(max-width:900px){.acclimation-essential-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.acclimation-live-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:620px){.acclimation-essential-grid,.acclimation-live-summary{grid-template-columns:1fr}.acclimation-default-summary{align-items:stretch;flex-direction:column}.acclimation-default-summary .btn{width:100%}}
  `}</style>
 </section>;
}
