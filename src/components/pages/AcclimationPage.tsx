"use client";
import { useEffect,useMemo,useRef,useState } from "react";
import type { AcclimationItem,AcclimationSession,CoralDipRun,LivestockItem,Tank } from "@/domain/types";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi,categoryText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { stockingReadiness } from "@/domain/stockingReadiness";
import { coralDipBatchRun,coralTransferGate } from "@/domain/acclimationSafety";
import { uid,nowISO,today } from "@/lib/appUtils";
import { buildDelimitedText,downloadDelimitedFile,field,numberField,parseDelimitedText } from "@/lib/tabularImport";

type Cat=AcclimationItem["category"];
const icon:Record<string,string>={fish:"🐠",invert:"🦐",coral:"🪸",plant:"🌿",other:"◌"};
const healthOptions=["unknown","good","fair","stressed","critical"] as const;
const temperamentOptions=["peaceful","semi","aggressive"] as const;
const sensitivityOptions=["normal","sensitive","hardy"] as const;

function fmt(ms:number){const s=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(s/60),ss=s%60;return `${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`}
function itemDuration(i:AcclimationItem){return Math.max(0,(i.dripMinutes+(i.extraMinutes??0))*60000)}
function remaining(i:AcclimationItem,now:number){if((i.status==="acclimating"||i.status==="emergency")&&i.endAt)return Math.max(0,i.endAt-now);return i.remainingMs??itemDuration(i)}
function score(x:AcclimationItem){const cat={fish:0,invert:10,coral:20,plant:20,other:15}[x.category]||0;const t={peaceful:0,semi:20,aggressive:40}[x.temperament||"peaceful"]||0;const s={sensitive:-5,normal:0,hardy:3}[x.sensitivity||"normal"]||0;return cat+t+s}
function healthLabel(lang:"ar"|"en",h:string){const ar:any={unknown:"لم يتم التقييم",good:"جيدة / مستقرة",fair:"متوسطة",stressed:"مجهدة",critical:"حرجة"},en:any={unknown:"Not assessed",good:"Good / stable",fair:"Fair",stressed:"Stressed",critical:"Critical"};return (lang==="ar"?ar:en)[h]||h}
function temperamentLabel(lang:"ar"|"en",v:string){const ar:any={peaceful:"مسالم",semi:"نصف عدواني",aggressive:"عدواني / إقليمي"},en:any={peaceful:"Peaceful",semi:"Semi-aggressive",aggressive:"Aggressive / territorial"};return (lang==="ar"?ar:en)[v]||v}
function sensitivityLabel(lang:"ar"|"en",v:string){const ar:any={normal:"عادي",sensitive:"حساس",hardy:"قوي التحمل"},en:any={normal:"Normal",sensitive:"Sensitive",hardy:"Hardy"};return (lang==="ar"?ar:en)[v]||v}
function subtypeLabel(lang:"ar"|"en",v?:string){
 const ar:any={crustacean:"قشريات",snail:"حلزون",echinoderm:"قنفذ / نجم بحر",worm:"وورمز / ديدان أنبوبية",macroalgae:"ماكرو ألجي"};
 const en:any={crustacean:"Crustaceans",snail:"Snails",echinoderm:"Urchin / Starfish",worm:"Worms",macroalgae:"Macroalgae"};
 return v?((lang==="ar"?ar:en)[v]||v):"";
}
function acclimationStatusLabel(lang:"ar"|"en",v?:string){
 const ar:any={waiting:"بانتظار البدء",running:"قيد التشغيل",paused:"متوقف مؤقتاً",ready:"جاهز للفحص",done:"مكتمل",acclimating:"قيد الإقلمة",added:"تم التنزيل",deferred:"مؤجل",emergency:"استثنائي"};
 const en:any={waiting:"Waiting",running:"Running",paused:"Paused",ready:"Ready for check",done:"Done",acclimating:"Acclimating",added:"Added",deferred:"Deferred",emergency:"Emergency"};
 return (lang==="ar"?ar:en)[v||""]||v||"";
}
function releasePriority(i:AcclimationItem){
 const health:any={critical:-25,stressed:-14,watch:-10,fair:-5,unknown:0,good:3};
 const sensitivity:any={sensitive:0,normal:12,hardy:22};
 const temperament:any={peaceful:0,semi:18,aggressive:36};
 const category:any={fish:0,invert:6,coral:10,plant:12,other:14};
 return (health[i.health]??0)+(sensitivity[i.sensitivity||"normal"]??12)+(temperament[i.temperament||"peaceful"]??0)+(category[i.category]??14);
}
function suggestedBatchSize(total:number){
 if(total>24)return 6;
 if(total>12)return 5;
 if(total>8)return 4;
 return Math.max(1,total);
}
function emergencyDuration(i:AcclimationItem){
 const baseMinutes:any={fish:10,invert:20,coral:10,plant:5,other:10};
 const base=baseMinutes[i.category]??10;
 const sensitivityExtra=i.sensitivity==="sensitive"?5:0;
 return Math.max(5,base+sensitivityExtra)*60000;
}
function releaseLaneKey(i:AcclimationItem){
 if(i.category==="fish")return "fish";
 if(i.category==="coral")return "coral";
 if(i.category==="plant")return i.subtype==="macroalgae"?"macroalgae":"plant";
 if(i.category==="invert"){
  if(i.subtype==="crustacean")return "crustacean";
  if(i.subtype==="snail")return "snail";
  if(i.subtype==="echinoderm")return "echinoderm";
  if(i.subtype==="worm")return "worm";
  return "invert";
 }
 return "other";
}
function releaseLaneLabel(lang:"ar"|"en",key:string){
 const ar:any={fish:"الأسماك",crustacean:"القشريات",snail:"الحلزون",echinoderm:"القنافذ ونجوم البحر",worm:"الوورمز / الديدان الأنبوبية",coral:"المرجان",macroalgae:"الماكرو ألجي",plant:"النباتات",invert:"اللافقاريات الأخرى",other:"أخرى"};
 const en:any={fish:"Fish",crustacean:"Crustaceans",snail:"Snails",echinoderm:"Urchins & Starfish",worm:"Worms / Feather Dusters",coral:"Corals",macroalgae:"Macroalgae",plant:"Plants",invert:"Other Invertebrates",other:"Other"};
 return (lang==="ar"?ar:en)[key]||key;
}
function releaseLaneIcon(key:string){
 const icons:any={fish:"🐠",crustacean:"🦐",snail:"🐌",echinoderm:"⭐",worm:"🪱",coral:"🪸",macroalgae:"🌿",plant:"🌿",invert:"🦐",other:"◌"};
 return icons[key]||"◌";
}

export function AcclimationPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const sessions=tank.acclimationSessions??[],active=sessions.find(s=>s.status!=="completed");
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
 const lib:any[]=LIVESTOCK_LIBRARY.filter((x:any)=>x.type===tank.type);
 const allowedCats:Cat[]=tank.type==="marine"?["fish","invert","coral","plant"]:["fish","invert","plant"];
 const choices=useMemo(()=>lib.filter((x:any)=>{const c=String(x.cat).toLowerCase(),m=c==="fish"?"fish":c==="coral"?"coral":c==="invert"?"invert":c==="plant"?"plant":"other";return m===category}),[category,tank.type]);
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
 const acclimationGuide=useMemo(()=>{
  const items=active?.items??[];
  const ready=items.filter(i=>i.status==="ready"&&!i.emergency);
  const running=items.filter(i=>i.status==="acclimating"&&!i.emergency);
  const waiting=items.filter(i=>i.status==="waiting"&&!i.emergency);
  const completed=items.filter(i=>i.status==="added"||i.status==="deferred");
  if(!active)return{stage:1,title:"",detail:"",tone:"info" as const};
  if(!active.floatConfirmed){
   if(active.floatStatus==="ready")return{stage:1,title:bi(lang,"أكد انتهاء موازنة الحرارة","Confirm temperature equalization"),detail:bi(lang,"العداد الكبير انتهى. تأكد أن حرارة الأكياس قريبة من حرارة الحوض، ثم أكد انتهاء المرحلة. بعدها سيبدأ تلقائياً عداد 5 دقائق لنقل كل الكائنات إلى الأوعية.","The main timer has finished. Confirm bag temperature is close to tank temperature, then confirm the stage. A 5-minute transfer-to-containers timer will start automatically next."),tone:"ready" as const};
   return{stage:1,title:bi(lang,"موازنة حرارة كل الشحنة","Temperature equalization for the whole shipment"),detail:bi(lang,"هذا العداد يخص كل الشحنة. حالياً اترك جميع الأكياس مغلقة حتى ينتهي العداد.","This timer applies to the whole shipment. Keep all bags sealed until it finishes."),tone:"info" as const};
  }
  if(active.bucketStatus!=="done"){
   if(active.bucketStatus==="ready")return{stage:2,title:bi(lang,"انتهى وقت النقل إلى الأوعية","Container-transfer time is complete"),detail:bi(lang,"تأكد أن كل الأسماك والقشريات والمرجان وبقية الكائنات نُقلت إلى أوعيتها المخصصة. بعد ذلك أكد المرحلة وابدأ التنقيط لجميع الدفعات دفعة واحدة.","Confirm all fish, crustaceans, corals and other livestock have been moved to their dedicated containers. Then confirm this stage and start drip acclimation for all batches together."),tone:"ready" as const};
   if(!active.bucketStatus||active.bucketStatus==="waiting")return{stage:2,title:bi(lang,"جاهز لبدء نقل الكائنات إلى الأوعية","Ready to start transfer to containers"),detail:bi(lang,"اضغط «ابدأ عداد النقل — 5 دقائق»، ثم انقل كل مجموعة إلى وعائها المخصص وجهّز خطوط التنقيط. هذا العداد يخص كل الشحنة.","Tap “Start transfer timer — 5 min,” then move every group into its dedicated container and prepare the drip lines. This timer applies to the whole shipment."),tone:"action" as const};
   return{stage:2,title:bi(lang,"انقل كل الكائنات إلى الأوعية الآن","Move all livestock to containers now"),detail:bi(lang,"عداد 5 دقائق هذا عام لكل الشحنة. خلاله انقل كل مجموعة إلى وعائها المخصص وجهّز خطوط التنقيط. لا تبدأ التنقيط قبل انتهاء هذه المرحلة.","This 5-minute timer applies to the whole shipment. Use it to move every group into its dedicated container and prepare drip lines. Do not start dripping before this stage ends."),tone:"action" as const};
  }
  if(!active.dripStartedAt){
   return{stage:3,title:bi(lang,"ابدأ التنقيط لجميع الدفعات","Start drip acclimation for all batches"),detail:bi(lang,"كل الكائنات أصبحت في أوعيتها. اضغط «ابدأ التنقيط» مرة واحدة؛ بعدها ستظهر صناديق الدفعات وتبدأ كل عداداتها معاً بالتوازي.","All livestock is now in its containers. Tap “Start drip acclimation” once; the batch boxes will appear and all their timers will start together in parallel."),tone:"action" as const};
  }
  if(ready.length){
   return{stage:4,title:bi(lang,"دفعة أو أكثر جاهزة للنقل","One or more batches are ready for transfer"),detail:bi(lang,"الصندوق الجاهز سيفتح تلقائياً ويصدر صوته الخاص. افحص الكائنات داخله، ثم اضغط «تم النقل إلى الحوض» لكل كائن. بقية عدادات الدفعات تستمر بدون أي تأثير.","A ready batch opens automatically and plays its category-specific sound. Inspect its livestock, then tap “Transferred to tank” for each item. All other batch timers continue unaffected."),tone:"ready" as const};
  }
  if(running.length){
   return{stage:3,title:bi(lang,"التنقيط شغال لكل الدفعات بالتوازي","All batch drip timers are running in parallel"),detail:bi(lang,"كل صندوق له عداده الخاص. لا تحتاج تعمل شي الآن غير المراقبة؛ عند انتهاء أي دفعة سيظهر تنبيه وصوت مميز وتُفتح تلقائياً للفحص والنقل.","Every batch box has its own timer. For now, just monitor them; when any batch finishes, you’ll get a distinct alert and sound and that box will open automatically for inspection and transfer."),tone:"running" as const};
  }
  if(items.length&&completed.length===items.length){
   return{stage:5,title:bi(lang,"اكتملت جلسة الإقلمة","Acclimation session complete"),detail:bi(lang,"تم نقل كل الدفعات ومعالجة كل العناصر. راجع سجل الإدخال للتأكد من توثيق الكائنات بالحوض.","All batches have been processed and transferred. Review the input register to confirm all livestock is recorded in the tank."),tone:"done" as const};
  }
  if(waiting.length)return{stage:3,title:bi(lang,"جاهز لبدء التنقيط","Ready to start drip acclimation"),detail:bi(lang,"اضغط زر بدء التنقيط العام ليبدأ عداد كل دفعة بالتوازي.","Tap the global start-drip button to start every batch timer in parallel."),tone:"action" as const};
  return{stage:4,title:bi(lang,"راجع الدفعات الجاهزة","Review ready batches"),detail:bi(lang,"راجع الصناديق المفتوحة وانقل الكائنات الجاهزة إلى الحوض واحداً واحداً.","Review the open batch boxes and transfer ready livestock to the tank one by one."),tone:"ready" as const};
 },[active?.items,active?.floatConfirmed,active?.floatStatus,active?.bucketStatus,active?.dripStartedAt,lang]);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{
  if(!active)return;
  let changed=false,next={...active,items:active.items.map(i=>{
    if((i.status==="acclimating"||i.status==="emergency")&&i.endAt&&i.endAt<=now){changed=true;return {...i,status:"ready" as const,endAt:null,remainingMs:0,readyAt:nowISO()}}
    return i;
  })};
  if(active.floatStatus==="running"&&active.floatEndAt&&active.floatEndAt<=now){changed=true;next={...next,floatStatus:"ready",floatEndAt:null,floatRemainingMs:0};}
  if(active.bucketStatus==="running"&&active.bucketEndAt&&active.bucketEndAt<=now){changed=true;next={...next,bucketStatus:"ready",bucketEndAt:null,bucketRemainingMs:0};}
  const coralDipRuns=(active.coralDipRuns??[]).map(run=>{
   if(run.status==="running"&&run.endAt&&run.endAt<=now){
    changed=true;
    return {...run,status:"ready_to_rinse" as const,endAt:null,remainingMs:0,completedAt:nowISO()};
   }
   return run;
  });
  next={...next,coralDipRuns};
  if(changed)saveSession(next,false);
 },[now]);
 useEffect(()=>{
  if(!active||step<5)return;
  if(active.floatStatus==="ready"&&active.floatStartedAt){
   const key=`${active.id}:global-float`;
   if(!notifiedTimersRef.current.has(key)){
    notifiedTimersRef.current.add(key);
    setTimerAlerts(prev=>[{id:uid("alert"),lane:"global",message:bi(lang,"انتهى عداد موازنة حرارة الأكياس — جاهزة للتأكيد.","Sealed-bag temperature timer finished — ready for confirmation.")},...prev].slice(0,5));
    playTimerSound("global");
   }
  }
  if(active.bucketStatus==="ready"&&active.bucketStartedAt){
   const key=`${active.id}:bucket-transfer`;
   if(!notifiedTimersRef.current.has(key)){
    notifiedTimersRef.current.add(key);
    setTimerAlerts(prev=>[{id:uid("alert"),lane:"global",message:bi(lang,"انتهت 5 دقائق نقل الكائنات إلى الأوعية — تأكد أن الجميع جاهز ثم ابدأ التنقيط.","The 5-minute transfer-to-containers stage is complete — confirm all groups are ready, then start drip acclimation.")},...prev].slice(0,5));
    playTimerSound("global");
   }
  }
  if(active.dripStartedAt){
   for(const batch of releaseBatches){
    const runtime=batchRuntime(batch);
    const normalItems=runtime.allItems.filter((i:AcclimationItem)=>!i.emergency);
    if(!normalItems.length)continue;
    const finished=normalItems.every((i:AcclimationItem)=>["ready","added","deferred"].includes(i.status));
    if(!finished)continue;
    const key=`${active.id}:batch:${batch.id}`;
    if(!notifiedTimersRef.current.has(key)){
     notifiedTimersRef.current.add(key);
     pushTimerAlert(batch.lane,batch.batch);
     setExpandedBatches(v=>({...v,[batch.id]:true}));
    }
    if(runtime.allAdded)setExpandedBatches(v=>({...v,[batch.id]:false}));
   }
  }
  if(exceptionAllItems.length){
   const runtime=exceptionBoxRuntime();
   const readyToTransfer=runtime.remainingItems.length>0&&runtime.remainingItems.every((i:AcclimationItem)=>i.status==="ready");
   if(readyToTransfer){
    const signature=exceptionAllItems.map(i=>i.id).sort().join(".");
    const key=`${active.id}:exception-box:${signature}`;
    if(!notifiedTimersRef.current.has(key)){
     notifiedTimersRef.current.add(key);
     setTimerAlerts(prev=>[{id:uid("alert"),lane:"emergency",message:bi(lang,"انتهى عداد صندوق الاستثناءات — افتح الصندوق وافحص الكائنات ثم انقلها إلى الحوض.","Exception Box timer finished — open the box, inspect the livestock, then transfer them to the tank.")},...prev].slice(0,5));
     playTimerSound("emergency");
     setExceptionBoxExpanded(true);
    }
   }
  }
  for(const run of active.coralDipRuns??[]){
   if(run.status!=="ready_to_rinse")continue;
   const key=`${active.id}:coral-dip:${run.id}`;
   if(notifiedTimersRef.current.has(key))continue;
   notifiedTimersRef.current.add(key);
   const message=bi(lang,`انتهى عداد Coral Dip لـ ${run.productName} — انقل المرجان إلى ماء الشطف المنفصل ثم أكد الشطف.`,`Coral Dip timer for ${run.productName} finished — move the coral to separate rinse water, then confirm the rinse.`);
   setTimerAlerts(prev=>[{id:uid("alert"),lane:"coral",message},...prev].slice(0,5));
   playTimerSound("coral");
   try{if("vibrate" in navigator)(navigator as any).vibrate([180,80,180,80,260]);}catch{}
   try{if("Notification" in window&&Notification.permission==="granted")new Notification("Aqua Nexus",{body:message});}catch{}
  }
 },[active?.items,active?.floatStatus,active?.bucketStatus,active?.dripStartedAt,active?.coralDipRuns,releaseBatches,emergencyItems,exceptionAllItems,step,lang]);

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
  try{if("Notification" in window&&Notification.permission==="granted")new Notification("Aqua Nexus",{body:message});}catch{}
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
 function newSession(){const s:AcclimationSession={id:uid("acs"),startedAt:nowISO(),status:"setup",wizardStep:1,categories:[],tankSalinity:tank.type==="marine"?1.025:undefined,bagSalinity:tank.type==="marine"?1.020:undefined,temperature:25,existingNotes:"",coralDipEnabled:false,coralDipMinutes:10,coralDipQuantityPerPrep:0,coralDipRuns:[],coralDipSkippedItemIds:[],floatConfirmed:false,floatStatus:"waiting",floatRemainingMs:15*60000,bucketStatus:"waiting",bucketRemainingMs:5*60000,preflight:{},items:[],events:[ev("بدأت جلسة أقلمة جديدة.","New acclimation session started.")]};saveSession(s);}
 function sessionPatch(p:Partial<AcclimationSession>){if(!active)return;saveSession({...active,...p});}
 function setStep(n:number){sessionPatch({wizardStep:n})}
 function toggleCat(c:Cat){if(!active)return;const cats=active.categories??[];sessionPatch({categories:cats.includes(c)?cats.filter(x=>x!==c):[...cats,c]});}

 function speciesApply(id:string){setSelected(id);const x:any=choices.find(y=>y.id===id);if(!x)return;setCustom(lang==="ar"?x.ar:x.en);setPlacement(x.care||x.placement||"");setDrip(category==="invert"?45:category==="fish"?20:20);setIntervalMin(category==="coral"?5:category==="plant"?0:15);setTemperament((x.temperament||"peaceful") as any);setSensitivity((x.sensitivity||"normal") as any);}
 function readPhoto(file?:File){if(!file){setImageData("");return}const r=new FileReader();r.onload=()=>setImageData(String(r.result||""));r.readAsDataURL(file)}
 function addItem(){if(!active||(!selected&&!custom.trim()))return;const x:any=choices.find(y=>y.id===selected);const ar=x?.ar||custom.trim(),en=x?.en||custom.trim();const item:AcclimationItem={id:uid("aci"),libraryId:x?.id,name:ar,nameEn:en,category,quantity:Math.max(1,qty),dripMinutes:Math.max(0,drip),intervalMinutes:Math.max(0,interval),placement:placement||x?.care||"",notes,temperament,sensitivity,subtype,health,status:"waiting",remainingMs:Math.max(0,drip)*60000,imageDataUrl:imageData||undefined};saveSession({...active,items:[...active.items,item],events:[ev(`تمت إضافة ${ar} إلى الشحنة.`,`Added ${en} to the shipment.`),...active.events]});setSelected("");setCustom("");setQty(1);setNotes("");setPlacement("");setImageData("");}
 function removeItem(id:string){if(!active)return;saveSession({...active,items:active.items.filter(x=>x.id!==id)});}
 function moveItem(id:string,dir:number){if(!active)return;const a=[...active.items],i=a.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];saveSession({...active,items:a});}
 function autoOrder(){if(!active)return;saveSession({...active,items:[...active.items].sort((a,b)=>score(a)-score(b)),events:[ev("تم تطبيق ترتيب التنزيل المقترح.","Suggested release order applied."),...active.events]});}

 const preflight=useMemo(()=>{const base=lang==="ar"?["سطل/وعاء نظيف ومخصص لكل مجموعة","خرطوم تنقيط مع محبس تحكم","شبكة / وعاء نقل منفصل","Refractometer أو جهاز قياس الملوحة","ميزان حرارة","مناشف ومكان عمل جاف","اختبار صوت التنبيهات"]:["Clean dedicated container(s)","Airline / drip line + valve","Net / specimen container","Refractometer or salinity meter","Thermometer","Towels + dry working area","Timer/sound volume checked"];if(active?.items.some(i=>i.category==="coral")&&active.coralDipEnabled)base.push(lang==="ar"?"ماء Coral Dip وماء شطف منفصل جاهزان":"Coral dip + separate rinse water prepared");if(active?.items.some(i=>i.category==="plant"))base.push(lang==="ar"?"وعاء فحص/شطف النباتات جاهز":"Plant rinse/inspection container");return base},[active?.items,active?.coralDipEnabled,lang]);
 function toggleCheck(i:number){if(!active)return;sessionPatch({preflight:{...(active.preflight??{}),[i]:!(active.preflight??{})[i]}})}
 function startSession(){
  if(!active||!active.items.length)return;
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
 function markAdded(item:AcclimationItem){
  if(!active)return;
  const catalog:any=lib.find((x:any)=>x.id===item.libraryId);
  const readiness=stockingReadiness(tank,{candidate:catalog,quantity:item.quantity,candidateKnown:Boolean(catalog),candidateLabelAr:item.name,candidateLabelEn:item.nameEn||item.name});
  let riskOverride=false;
  if(readiness.state!=="ready"){
    const reason=lang==="ar"?(readiness.blockersAr[0]||readiness.missingEvidenceAr[0]||"الجاهزية غير مؤكدة."):(readiness.blockersEn[0]||readiness.missingEvidenceEn[0]||"Readiness is not confirmed.");
    const token=window.prompt(lang==="ar"
      ?("قرار الجاهزية المركزي لا يسمح بتنزيل الكائن بشكل طبيعي الآن. "+reason+" إذا كان إبقاء الكائن في ماء الشحنة أخطر ولا يوجد بديل آمن، اكتب OVERRIDE لتسجيل تجاوز استثنائي.")
      :("Central readiness does not support a normal release right now. "+reason+" If keeping the animal in shipping water is riskier and there is no safer alternative, type OVERRIDE to log an exceptional override."));
    if(token!=="OVERRIDE")return;
    riskOverride=true;
  }else if(readiness.requiresConfirmation){
    const ok=window.confirm(lang==="ar"?"الجاهزية تسمح مبدئياً لكن يوجد تنبيه مهم. هل تريد متابعة التنزيل وتسجيله؟":"Readiness is provisionally acceptable but has an important caution. Continue and log the release?");
    if(!ok)return;
  }
  const livestock:LivestockItem={id:uid("live"),libraryId:item.libraryId,name:item.name,nameEn:item.nameEn,category:item.category,quantity:item.quantity,health:item.health==="critical"||item.health==="stressed"?"watch":"good",load:catalog?.load??1,addedAt:today()};
  const nextItems=active.items.map(x=>x.id===item.id?{...x,status:"added" as const,addedAt:nowISO()}:x);
  const allDone=nextItems.every(x=>x.status==="added"||x.status==="deferred");
  patch(tank.id,t=>({...t,acclimationSessions:[{...active,status:allDone?"completed":"release",completedAt:allDone?nowISO():undefined,items:nextItems,events:[ev(`تم إدخال ${item.name} إلى الحوض بدون ماء الشحنة.`,`Transferred ${item.nameEn||item.name} to the aquarium without shipping water.`),...active.events]},...(t.acclimationSessions??[]).filter(x=>x.id!==active.id)],livestock:[...t.livestock,livestock],timeline:[{id:uid("ev"),timestamp:nowISO(),type:riskOverride?"acclimation-risk-override":"acclimation",textAr:riskOverride?`تم إدخال ${item.name} مع تسجيل Risk Override استثنائي بعد فحص الجاهزية المركزي.`:`اكتملت أقلمة ${item.name} وتم إدخاله بعد فحص الجاهزية المركزي.`,textEn:riskOverride?`Transferred ${item.nameEn||item.name} with an explicitly logged exceptional override after central readiness screening.`:`Acclimation completed for ${item.nameEn||item.name} after central readiness screening.`},...t.timeline]}));
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
  const value=(raw||String(catalog?.cat||"")).trim().toLowerCase();
  const aliases:Record<string,Cat>={fish:"fish",fishes:"fish",coral:"coral",corals:"coral",invert:"invert",invertebrate:"invert",invertebrates:"invert",shrimp:"invert",plant:"plant",plants:"plant",other:"other"};
  const result=aliases[value]??null;
  if(!result)return null;
  if(tank.type==="freshwater"&&result==="coral")return null;
  return result;
 }

 async function importShipment(file?:File){
  if(!file||!active)return;
  try{
   const {rows}=parseDelimitedText(await file.text());
   const items:AcclimationItem[]=[];
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
    const defaultInterval=cat==="coral"?5:cat==="plant"?0:15;
    const dripValue=numberField(row,"dripMinutes")??defaultDrip;
    const intervalValue=numberField(row,"intervalMinutes")??defaultInterval;
    items.push({
     id:uid("aci"),
     libraryId:catalog?.id||libraryId||undefined,
     name:ar||en,
     nameEn:en||ar,
     category:cat,
     quantity:Math.max(1,Math.round(numberField(row,"quantity")??1)),
     health:importedHealth,
     temperament:importedTemperament,
     sensitivity:importedSensitivity,
     subtype:field(row,"subtype"),
     dripMinutes:Math.max(0,dripValue),
     intervalMinutes:Math.max(0,intervalValue),
     placement:field(row,"placement")||catalog?.care||"",
     notes:field(row,"notes")||undefined,
     status:"waiting",
     remainingMs:Math.max(0,dripValue)*60000
    });
    categories.add(cat);
   });
   if(!items.length){setImportNote(bi(lang,"لم أجد كائنات صالحة في الملف.","No valid shipment items were found in the file."));return;}
   saveSession({...active,categories:[...categories],wizardStep:2,items:[...active.items,...items],events:[ev(`تم استيراد ${items.length} كائن/مجموعة من ملف الشحنة.`,`Imported ${items.length} shipment item(s) from a file.`),...active.events]});
   setImportNote(bi(lang,`تم استيراد ${items.length} عنصر بنجاح.`,`${items.length} item(s) imported successfully.`));
  }catch{
   setImportNote(bi(lang,"تعذر قراءة الملف. استخدم قالب Aqua Nexus بصيغة CSV أو TXT.","Could not read the file. Use the Aqua Nexus CSV or TXT template."));
  }
 }

 function registryText(){if(!active)return"";const L=[bi(lang,"سجل إدخال الكائنات — Aqua Nexus","Livestock Input Register — Aqua Nexus"),`${bi(lang,"الحوض","Tank")}: ${tank.name}`,`${bi(lang,"بداية الجلسة","Session started")}: ${new Date(active.startedAt).toLocaleString()}`,""];active.items.forEach((x,i)=>{L.push(`${i+1}. ${lang==="ar"?x.name:(x.nameEn||x.name)} ×${x.quantity}`);L.push(`   ${categoryText(lang,x.category)} • ${healthLabel(lang,x.health)} • ${x.status}`);L.push(`   ${bi(lang,"المكان","Placement")}: ${x.placement||"—"}`);if(x.notes)L.push(`   ${bi(lang,"ملاحظات","Notes")}: ${x.notes}`);L.push("")});return L.join("\n")}
 function exportTxt(){const blob=new Blob([registryText()],{type:"text/plain;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Aqua_Nexus_Acclimation_${new Date().toISOString().slice(0,10)}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

 if(!active)return <section className="page-grid acclimation-page"><PageHeader eyebrow="ACCLIMATION CONTROL" title={tr(lang,"acclimation")} actions={<div className="actions"><button className="btn" onClick={()=>downloadShipmentTemplate("csv")}>↓ Excel / CSV</button><button className="btn" onClick={()=>downloadShipmentTemplate("txt")}>↓ TXT</button><button className="btn primary" onClick={newSession}>+ {tr(lang,"newShipment")}</button></div>}/><div className="card panel full-span acclimation-empty"><div className="acclimation-empty-icon">⇄</div><h2>{bi(lang,"ابدأ جلسة أقلمة جديدة","Start a new acclimation session")}</h2><p className="note">{bi(lang,"للشحنات الكبيرة نزّل القالب، عبّيه في Excel أو TXT، وبعد بدء الجلسة ارفعه دفعة واحدة.","For large shipments, download the template, fill it in Excel or TXT, then upload it after starting the session.")}</p><button className="btn primary" onClick={newSession}>{tr(lang,"newShipment")}</button></div></section>;

 const cats=active.categories??[];
 const floatRem=active.floatStatus==="running"&&active.floatEndAt?Math.max(0,active.floatEndAt-now):(active.floatRemainingMs??15*60000);
 const bucketRem=active.bucketStatus==="running"&&active.bucketEndAt?Math.max(0,active.bucketEndAt-now):(active.bucketRemainingMs??5*60000);
 const batchStates=releaseBatches.map(batch=>({batch,runtime:batchRuntime(batch)}));
 const runningBatchTimes=batchStates.filter(x=>!x.runtime.complete&&x.runtime.timer>0).map(x=>x.runtime.timer);
 const nearestBatchRem=runningBatchTimes.length?Math.min(...runningBatchTimes):0;
 const done=active.items.filter(x=>x.status==="added").length,pct=active.items.length?Math.round(done/active.items.length*100):0;
 const selectedCats=cats.length?cats:allowedCats;
 return <section className="page-grid acclimation-page">
  <PageHeader eyebrow="ACCLIMATION CONTROL" title={tr(lang,"acclimation")} actions={<><span className="pill">{tank.type==="marine"?tr(lang,"marine"):tr(lang,"freshwater")} • {lang.toUpperCase()}</span><button className="btn" onClick={newSession}>+ {tr(lang,"newShipment")}</button></>}/>
  {step<5&&<div className="card acclimation-wizard full-span">
    <div className="acclimation-wizard-hero"><span>{tank.type==="marine"?"🌊":"🌿"}</span><div><small>AQUA NEXUS</small><h2>{bi(lang,"مساعد الإقلمة الذكي","Smart Acclimation Wizard")}</h2><p>{bi(lang,"لغة البرنامج ونوع الحوض مطبقان تلقائياً.","App language and selected tank type are applied automatically.")}</p></div></div>
    <div className="acclimation-stepper">{[1,2,3,4].map(n=><i key={n} className={n<step?"done":n===step?"active":""}/>)}</div>
    <div className="acclimation-wizard-body">
      {step===1&&<><h2>{bi(lang,"ما الذي وصل في الشحنة؟","What is arriving?")}</h2><p className="note">{bi(lang,"اختر الفئات يدوياً، أو استورد شحنة كبيرة مباشرة من ملف.","Select groups manually, or bulk-import a large shipment from a file.")}</p><div className="inline-alert info"><div><b>{bi(lang,"إضافة جماعية من ملف","Bulk shipment import")}</b><small>{bi(lang,"القالب يعمل مباشرة مع Excel ويمكن حفظه CSV أو TXT.","The template opens directly in Excel and can be saved as CSV or TXT.")}</small></div><div className="actions"><button className="btn" onClick={()=>downloadShipmentTemplate("csv")}>↓ Excel / CSV</button><button className="btn" onClick={()=>downloadShipmentTemplate("txt")}>↓ TXT</button><label className="btn primary">↑ {bi(lang,"رفع الملف","Upload file")}<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e=>{importShipment(e.target.files?.[0]);e.currentTarget.value="";}}/></label></div></div>{importNote&&<div className="inline-alert good">{importNote}</div>}<div className="acclimation-choice-grid">{allowedCats.map(c=><button className={`acclimation-choice ${cats.includes(c)?"selected":""}`} key={c} onClick={()=>toggleCat(c)}><span>{icon[c]}</span><b>{categoryText(lang,c)}</b></button>)}</div><div className="wizard-nav"><span/><button className="btn primary" disabled={!cats.length} onClick={()=>setStep(2)}>{bi(lang,"التالي","Next")} →</button></div></>}
      {step===2&&<><div className="section-title"><div><h2>{bi(lang,"إضافة محتويات الشحنة","Add shipment items")}</h2><p className="note">{bi(lang,"اختر النوع أو أدخل نوعاً مخصصاً، أو أضف قائمة كاملة من ملف.","Choose a species, enter a custom one, or add a complete list from a file.")}</p></div><div className="actions"><button className="btn" onClick={()=>downloadShipmentTemplate("csv")}>↓ Excel / CSV</button><label className="btn">↑ {bi(lang,"استيراد","Import")}<input type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={e=>{importShipment(e.target.files?.[0]);e.currentTarget.value="";}}/></label></div></div>{importNote&&<div className="inline-alert good">{importNote}</div>}<div className="form-grid">
       <label className="field"><span>{tr(lang,"category")}</span><select value={category} onChange={e=>{const c=e.target.value as Cat;setCategory(c);setSelected("");setCustom("");setDrip(c==="invert"?45:c==="fish"?20:20);setIntervalMin(c==="coral"?5:c==="plant"?0:15)}}>{selectedCats.map(c=><option key={c} value={c}>{categoryText(lang,c)}</option>)}</select></label>
       <label className="field"><span>{tr(lang,"selectOrganism")}</span><select value={selected} onChange={e=>speciesApply(e.target.value)}><option value="">— {bi(lang,"نوع مخصص","Custom species")} —</option>{choices.map((x:any)=><option value={x.id} key={x.id}>{lang==="ar"?x.ar:x.en}</option>)}</select></label>
       <label className="field"><span>{tr(lang,"name")}</span><input value={custom} onChange={e=>setCustom(e.target.value)}/></label><label className="field"><span>{tr(lang,"quantity")}</span><input type="number" min="1" value={qty} onChange={e=>setQty(Number(e.target.value))}/></label>
       <label className="field"><span>{bi(lang,"الصحة عند الوصول","Arrival health")}</span><select value={health} onChange={e=>setHealth(e.target.value as any)}>{healthOptions.map(h=><option key={h} value={h}>{healthLabel(lang,h)}</option>)}</select></label>
       <label className="field"><span>{bi(lang,"السلوك","Temperament")}</span><select value={temperament} onChange={e=>setTemperament(e.target.value as any)}>{temperamentOptions.map(v=><option key={v} value={v}>{temperamentLabel(lang,v)}</option>)}</select></label>
       <label className="field"><span>{bi(lang,"الحساسية","Sensitivity")}</span><select value={sensitivity} onChange={e=>setSensitivity(e.target.value as any)}>{sensitivityOptions.map(v=><option key={v} value={v}>{sensitivityLabel(lang,v)}</option>)}</select></label>
       {(category==="coral"||category==="plant")&&<label className="field"><span>{bi(lang,"بروفايل العناية","Care profile")}</span><select value={subtype} onChange={e=>setSubtype(e.target.value)}><option value="">{bi(lang,"تلقائي / يدوي","Auto / Manual")}</option>{category==="coral"?<><option value="soft">Soft</option><option value="lps">LPS</option><option value="sps">SPS</option></>:<><option value="low">Low light</option><option value="medium">Medium light</option><option value="high">High light</option></>}</select></label>}
       <label className="field"><span>{tr(lang,"dripMinutes")}</span><input type="number" min="0" value={drip} onChange={e=>setDrip(Number(e.target.value))}/></label><label className="field"><span>{tr(lang,"releaseInterval")}</span><input type="number" min="0" value={interval} onChange={e=>setIntervalMin(Number(e.target.value))}/></label>
       <label className="field full-field"><span>{tr(lang,"placement")}</span><input value={placement} onChange={e=>setPlacement(e.target.value)}/></label><label className="field full-field"><span>{bi(lang,"ملاحظات","Notes")}</span><textarea value={notes} onChange={e=>setNotes(e.target.value)}/></label>
       <label className="field full-field"><span>{bi(lang,"صورة اختيارية","Optional photo")}</span><input type="file" accept="image/*" onChange={e=>readPhoto(e.target.files?.[0])}/></label>
      </div><button className="btn primary" onClick={addItem} disabled={!selected&&!custom.trim()}>＋ {bi(lang,"إضافة","Add item")}</button>
      <div className="added-list">{active.items.map(i=><div className="acclimation-mini" key={i.id}>{i.imageDataUrl?<img src={i.imageDataUrl} alt=""/>:<span>{icon[i.category]}</span>}<div><b>{lang==="ar"?i.name:(i.nameEn||i.name)} ×{i.quantity}</b><small>{categoryText(lang,i.category)}{i.subtype?` • ${subtypeLabel(lang,i.subtype)}`:""} • {healthLabel(lang,i.health)} • {i.dripMinutes} min</small></div><button className="btn danger" onClick={()=>removeItem(i.id)}>×</button></div>)}</div>
      <div className="wizard-nav"><button className="btn" onClick={()=>setStep(1)}>← {bi(lang,"رجوع","Back")}</button><button className="btn primary" disabled={!active.items.length} onClick={()=>setStep(3)}>{bi(lang,"التالي","Next")} →</button></div></>}
      {step===3&&<><div className="section-title"><div><h2>{bi(lang,"مراجعة ترتيب التنزيل المقترح","Review suggested release order")}</h2><p className="note">{bi(lang,"الترتيب المقترح تنظيمي فقط ويمكنك تغييره.","Suggested order is organizational only and can be overridden.")}</p></div><button className="btn" onClick={autoOrder}>{bi(lang,"تطبيق المقترح","Apply suggestion")}</button></div><div className="acclimation-review">{active.items.map((i,idx)=><div className="acclimation-review-row" key={i.id}><span className="rank">{idx+1}</span><span className="review-icon">{icon[i.category]}</span><div><b>{lang==="ar"?i.name:(i.nameEn||i.name)} ×{i.quantity}</b><small>{temperamentLabel(lang,i.temperament||"peaceful")} • {sensitivityLabel(lang,i.sensitivity||"normal")}{i.subtype?` • ${subtypeLabel(lang,i.subtype)}`:""}<br/>{i.placement||"—"}</small></div><div className="move"><button className="btn" disabled={idx===0} onClick={()=>moveItem(i.id,-1)}>↑</button><button className="btn" disabled={idx===active.items.length-1} onClick={()=>moveItem(i.id,1)}>↓</button></div></div>)}</div><div className="wizard-nav"><button className="btn" onClick={()=>setStep(2)}>← {bi(lang,"رجوع","Back")}</button><button className="btn primary" onClick={()=>setStep(4)}>{bi(lang,"التالي","Next")} →</button></div></>}
      {step===4&&<><h2>{bi(lang,"إعدادات الماء والسلامة","Water & safety setup")}</h2><p className="note">{bi(lang,"القيم مرجعية والقرار النهائي للمستخدم.","Values are for reference; the final decision remains with the user.")}</p><div className="form-grid">{tank.type==="marine"&&<><label className="field"><span>{tr(lang,"tankSalinity")}</span><input type="number" step=".001" value={active.tankSalinity??""} onChange={e=>sessionPatch({tankSalinity:Number(e.target.value)})}/></label><label className="field"><span>{tr(lang,"bagSalinity")}</span><input type="number" step=".001" value={active.bagSalinity??""} onChange={e=>sessionPatch({bagSalinity:Number(e.target.value)})}/></label></>}<label className="field"><span>{tr(lang,"temperature")}</span><input type="number" step=".1" value={active.temperature??""} onChange={e=>sessionPatch({temperature:Number(e.target.value)})}/></label><label className="field"><span>{bi(lang,"ملاحظات سكان الحوض الحاليين","Existing tank notes")}</span><input value={active.existingNotes??""} onChange={e=>sessionPatch({existingNotes:e.target.value})}/></label>{active.items.some(i=>i.category==="coral")&&<><label className="check-field"><input type="checkbox" checked={active.coralDipEnabled??false} onChange={e=>sessionPatch({coralDipEnabled:e.target.checked})}/><span>🪸 {bi(lang,"استخدام Coral Dip اختياري","Use optional Coral Dip")}</span></label><label className="field"><span>{bi(lang,"مدة الـDip حسب المنتج","Dip minutes from product")}</span><input type="number" value={active.coralDipMinutes??10} onChange={e=>sessionPatch({coralDipMinutes:Number(e.target.value)})}/></label></>}</div><div className="inline-alert info acclimation-workflow-note">💧 {bi(lang,"التسلسل: الأكياس مغلقة لموازنة الحرارة → نقل كل مجموعة إلى وعائها → تنقيط ماء الحوض → فحص / Dip عند الحاجة → نقل الكائن فقط بدون ماء الشحنة.","Workflow: sealed-bag temperature equalization → dedicated container → drip tank water → inspect / optional dip → transfer animal only, without shipping water.")}</div><h3>{bi(lang,"قائمة التجهيز قبل الوصول","Pre-arrival checklist")}</h3><div className="preflight-grid">{preflight.map((x,i)=><label className="check-field" key={i}><input type="checkbox" checked={Boolean(active.preflight?.[i])} onChange={()=>toggleCheck(i)}/><span>{x}</span></label>)}</div><div className="wizard-nav"><button className="btn" onClick={()=>setStep(3)}>← {bi(lang,"رجوع","Back")}</button><button className="btn primary" onClick={startSession}>▶ {bi(lang,"بدء الجلسة","Start Session")}</button></div></>}
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
     </div>
    </div>
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
      {visible.map((item:AcclimationItem)=><div className={`batch-livestock-row ${item.status}`} key={item.id}>
       <span className="batch-live-icon">{releaseLaneIcon(releaseLaneKey(item))}</span>
       <div><b>{lang==="ar"?item.name:(item.nameEn||item.name)} ×{item.quantity}</b><small>{releaseLaneLabel(lang,releaseLaneKey(item))} • {healthLabel(lang,item.health)} • {sensitivityLabel(lang,item.sensitivity||"normal")}</small></div>
       <div className="batch-live-actions">
        {item.status==="ready"?<button className="btn primary" onClick={()=>markAdded(item)}>✓ {bi(lang,"تم النقل إلى الحوض","Transferred to tank")}</button>:<span className="waiting-chip">⏱ {bi(lang,"التنقيط السريع قيد التشغيل","Rapid drip running")}</span>}
        {!["added","deferred"].includes(item.status)&&<button className="btn warn" onClick={()=>cancelEmergency(item.id)}>↩ {bi(lang,"إرجاع للخطة العامة","Return to main plan")}</button>}
       </div>
      </div>)}
     </div>}
    </article>
   </section>})()}
   <div className="acclimation-metrics full-span"><div className="card metric"><small>{bi(lang,"الحوض","Tank")}</small><b>{tank.name}</b></div><div className="card metric"><small>{bi(lang,"العناصر","Items")}</small><b>{active.items.length}</b></div><div className="card metric"><small>{bi(lang,"تم نقلها","Transferred")}</small><b>{done}/{active.items.length}</b><div className="progress"><i style={{width:`${pct}%`}}/></div></div><div className="card metric"><small>{bi(lang,"المرحلة","Stage")}</small><b>{acclimationGuide.stage}/5</b></div></div>
   {active.dripStartedAt&&<section className="full-span batch-board">
    <div className="section-title"><div><h2>{bi(lang,"دفعات التنقيط — كلها تعد بالتوازي","Drip batches — all timers run in parallel")}</h2><p className="note">{bi(lang,"كل صندوق له عداده الخاص. عند انتهاء عداد أي دفعة يصدر صوت النوع، يُفتح الصندوق تلقائياً، وتظهر أزرار نقل الكائنات إلى الحوض. بقية العدادات تستمر بدون توقف.","Each box has its own timer. When a batch finishes, its category sound plays, the box opens automatically, and transfer buttons appear. All other timers continue without interruption.")}</p></div></div>
    <div className="batch-board-grid">
     {releaseBatches.map(batch=>{const runtime=batchRuntime(batch);const expanded=Boolean(expandedBatches[batch.id]);const visibleItems=runtime.remainingItems.filter((i:AcclimationItem)=>!i.emergency);const isReady=runtime.status==="ready";return <article className={`batch-box ${runtime.allAdded?"success":runtime.status}`} key={batch.id}>
      <button className="batch-box-head" onClick={()=>!runtime.allAdded&&setExpandedBatches(v=>({...v,[batch.id]:!v[batch.id]}))}>
       <span className="batch-box-icon">{releaseLaneIcon(batch.lane)}</span><span className="batch-box-title"><small>{releaseLaneLabel(lang,batch.lane)}</small><b>{bi(lang,`الدفعة ${batch.batch}`,`Batch ${batch.batch}`)} {batch.totalBatches>1?`/ ${batch.totalBatches}`:""}</b><em>{runtime.allItems.length} {bi(lang,"مجموعة","groups")} • {batch.plannedMinutes} {bi(lang,"دقيقة مخططة","planned min")}</em></span>
       <span className={`batch-box-status ${runtime.status}`}>{runtime.allAdded?bi(lang,"تم نقل الدفعة للحوض بنجاح","Batch transferred successfully"):acclimationStatusLabel(lang,runtime.status)}</span>
       <span className="batch-box-timer">{runtime.allAdded?"✓":fmt(runtime.timer)}</span><span className="batch-box-chevron">{runtime.allAdded?"✓":expanded?"⌃":"⌄"}</span>
      </button>
      {expanded&&!runtime.allAdded&&<div className="batch-box-body">
       {visibleItems.length===0?<div className="batch-empty">{bi(lang,"لا توجد عناصر متبقية في هذه الدفعة ضمن المسار العام.","No remaining items in this normal batch.")}</div>:visibleItems.map((item:AcclimationItem)=><div className={`batch-livestock-row ${item.status}`} key={item.id}><span className="batch-live-icon">{icon[item.category]}</span><div><b>{lang==="ar"?item.name:(item.nameEn||item.name)} ×{item.quantity}</b><small>{healthLabel(lang,item.health)} • {sensitivityLabel(lang,item.sensitivity||"normal")}{item.subtype?` • ${subtypeLabel(lang,item.subtype)}`:""}</small></div><div className="batch-live-actions">{item.status==="ready"?<button className="btn primary" onClick={()=>markAdded(item)}>✓ {bi(lang,"تم النقل إلى الحوض","Transferred to tank")}</button>:<span className="waiting-chip">⏱ {bi(lang,"بانتظار انتهاء عداد الدفعة","Waiting for batch timer")}</span>}{!["added","deferred"].includes(item.status)&&<button className="btn danger" onClick={()=>startEmergency(item.id)}>🚨 {bi(lang,"استثناء","Exception")}</button>}</div></div>)}
      </div>}
     </article>})}
    </div>
   </section>}
   <section className="card panel full-span acclimation-registry" id="acclimationRegistry"><div className="section-title"><div><h2>{bi(lang,"سجل الكائنات المدخلة","Livestock Input Register")}</h2><p className="note">{bi(lang,"يمكن طباعته أو حفظه PDF من المتصفح.","Print or save as PDF from the browser.")}</p></div><div className="actions"><button className="btn" onClick={()=>window.print()}>🖨 {bi(lang,"طباعة / PDF","Print / PDF")}</button><button className="btn" onClick={exportTxt}>TXT</button></div></div><div className="record-wrap"><table className="records"><thead><tr><th>#</th><th>{bi(lang,"النوع","Species")}</th><th>{bi(lang,"الفئة","Category")}</th><th>{bi(lang,"الصحة","Health")}</th><th>{bi(lang,"الحالة","Status")}</th><th>{bi(lang,"تاريخ الإدخال","Added")}</th><th>{bi(lang,"المكان / الملاحظات","Placement / Notes")}</th></tr></thead><tbody>{active.items.map((x,i)=><tr key={x.id}><td>{i+1}</td><td><b>{lang==="ar"?x.name:(x.nameEn||x.name)}</b> ×{x.quantity}</td><td>{categoryText(lang,x.category)}{x.subtype?` • ${subtypeLabel(lang,x.subtype)}`:""}</td><td>{healthLabel(lang,x.health)}</td><td>{acclimationStatusLabel(lang,x.status)}</td><td>{x.addedAt?new Date(x.addedAt).toLocaleString():"—"}</td><td>{x.placement||"—"}<div className="record-note">{x.notes}</div></td></tr>)}</tbody></table></div></section>
   <section className="card panel full-span"><div className="section-title"><h2>{tr(lang,"eventLog")}</h2></div><div className="history-list">{active.events.map(x=><div className="history-row" key={x.id}><b>{lang==="ar"?x.textAr:x.textEn}</b><span>{new Date(x.timestamp).toLocaleString()}</span></div>)}</div></section>
  </>}
 </section>;
}
