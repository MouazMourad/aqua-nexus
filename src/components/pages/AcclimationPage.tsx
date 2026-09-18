"use client";
import { useEffect,useMemo,useState } from "react";
import type { AcclimationItem,AcclimationSession,LivestockItem,Tank } from "@/domain/types";
import { LIVESTOCK_LIBRARY } from "@/data/legacyCatalogs";
import { useAquaStore } from "@/store/useAquaStore";
import { tr,bi,categoryText } from "@/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { compatibilityCheck } from "@/domain/compatibility";
import { uid,nowISO,today } from "@/lib/appUtils";
import { buildDelimitedText,downloadDelimitedFile,field,numberField,parseDelimitedText } from "@/lib/tabularImport";

type Cat=AcclimationItem["category"];
const icon:Record<string,string>={fish:"🐠",invert:"🦐",coral:"🪸",plant:"🌿",other:"◌"};
const healthOptions=["unknown","good","fair","stressed","critical"] as const;
const temperamentOptions=["peaceful","semi","aggressive"] as const;
const sensitivityOptions=["normal","sensitive","hardy"] as const;

function fmt(ms:number){const s=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(s/60),ss=s%60;return `${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`}
function itemDuration(i:AcclimationItem){return Math.max(0,(i.dripMinutes+(i.extraMinutes??0))*60000)}
function remaining(i:AcclimationItem,now:number){if(i.status==="acclimating"&&i.endAt)return Math.max(0,i.endAt-now);return i.remainingMs??itemDuration(i)}
function score(x:AcclimationItem){const cat={fish:0,invert:10,coral:20,plant:20,other:15}[x.category]||0;const t={peaceful:0,semi:20,aggressive:40}[x.temperament||"peaceful"]||0;const s={sensitive:-5,normal:0,hardy:3}[x.sensitivity||"normal"]||0;return cat+t+s}
function healthLabel(lang:"ar"|"en",h:string){const ar:any={unknown:"لم يتم التقييم",good:"جيدة / مستقرة",fair:"متوسطة",stressed:"مجهدة",critical:"حرجة"},en:any={unknown:"Not assessed",good:"Good / stable",fair:"Fair",stressed:"Stressed",critical:"Critical"};return (lang==="ar"?ar:en)[h]||h}
function temperamentLabel(lang:"ar"|"en",v:string){const ar:any={peaceful:"مسالم",semi:"نصف عدواني",aggressive:"عدواني / إقليمي"},en:any={peaceful:"Peaceful",semi:"Semi-aggressive",aggressive:"Aggressive / territorial"};return (lang==="ar"?ar:en)[v]||v}
function sensitivityLabel(lang:"ar"|"en",v:string){const ar:any={normal:"عادي",sensitive:"حساس",hardy:"قوي التحمل"},en:any={normal:"Normal",sensitive:"Sensitive",hardy:"Hardy"};return (lang==="ar"?ar:en)[v]||v}

export function AcclimationPage({tank}:{tank:Tank}) {
 const lang=useAquaStore(s=>s.language),patch=useAquaStore(s=>s.patchTank);
 const sessions=tank.acclimationSessions??[],active=sessions.find(s=>s.status!=="completed");
 const [now,setNow]=useState(Date.now());
 const [category,setCategory]=useState<Cat>("fish"),[selected,setSelected]=useState(""),[custom,setCustom]=useState(""),[qty,setQty]=useState(1),[drip,setDrip]=useState(15),[interval,setIntervalMin]=useState(15),[placement,setPlacement]=useState(""),[notes,setNotes]=useState(""),[health,setHealth]=useState<AcclimationItem["health"]>("unknown"),[temperament,setTemperament]=useState<"peaceful"|"semi"|"aggressive">("peaceful"),[sensitivity,setSensitivity]=useState<"normal"|"sensitive"|"hardy">("normal"),[subtype,setSubtype]=useState(""),[imageData,setImageData]=useState(""),[importNote,setImportNote]=useState("");
 const lib:any[]=LIVESTOCK_LIBRARY.filter((x:any)=>x.type===tank.type);
 const allowedCats:Cat[]=tank.type==="marine"?["fish","invert","coral"]:["fish","invert","plant"];
 const choices=useMemo(()=>lib.filter((x:any)=>{const c=String(x.cat).toLowerCase(),m=c==="fish"?"fish":c==="coral"?"coral":c==="invert"?"invert":c==="plant"?"plant":"other";return m===category}),[category,tank.type]);
 const chosen:any=choices.find(x=>x.id===selected);
 const step=active?.wizardStep??1;
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
 useEffect(()=>{
  if(!active)return;
  let changed=false,next={...active,items:active.items.map(i=>{
    if(i.status==="acclimating"&&i.endAt&&i.endAt<=now){changed=true;return {...i,status:"ready" as const,endAt:null,remainingMs:0,readyAt:nowISO()}}
    return i;
  })};
  if(active.floatStatus==="running"&&active.floatEndAt&&active.floatEndAt<=now){changed=true;next={...next,floatStatus:"ready",floatEndAt:null,floatRemainingMs:0};}
  if(changed)saveSession(next,false);
 },[now]);

 function ev(ar:string,en:string){return{id:uid("ace"),timestamp:nowISO(),textAr:ar,textEn:en}}
 function saveSession(s:AcclimationSession,withLog=true){patch(tank.id,t=>({...t,acclimationSessions:[s,...(t.acclimationSessions??[]).filter(x=>x.id!==s.id)]}));}
 function newSession(){const s:AcclimationSession={id:uid("acs"),startedAt:nowISO(),status:"setup",wizardStep:1,categories:[],tankSalinity:tank.type==="marine"?1.025:undefined,bagSalinity:tank.type==="marine"?1.020:undefined,temperature:25,existingNotes:"",coralDipEnabled:false,coralDipMinutes:10,floatConfirmed:false,floatStatus:"waiting",floatRemainingMs:15*60000,preflight:{},items:[],events:[ev("بدأت جلسة أقلمة جديدة.","New acclimation session started.")]};saveSession(s);}
 function sessionPatch(p:Partial<AcclimationSession>){if(!active)return;saveSession({...active,...p});}
 function setStep(n:number){sessionPatch({wizardStep:n})}
 function toggleCat(c:Cat){if(!active)return;const cats=active.categories??[];sessionPatch({categories:cats.includes(c)?cats.filter(x=>x!==c):[...cats,c]});}

 function speciesApply(id:string){setSelected(id);const x:any=choices.find(y=>y.id===id);if(!x)return;setCustom(lang==="ar"?x.ar:x.en);setPlacement(x.care||x.placement||"");setDrip(category==="invert"?45:category==="fish"?20:20);setIntervalMin(category==="coral"?5:category==="plant"?0:15);setTemperament((x.temperament||"peaceful") as any);setSensitivity((x.sensitivity||"normal") as any);}
 function readPhoto(file?:File){if(!file){setImageData("");return}const r=new FileReader();r.onload=()=>setImageData(String(r.result||""));r.readAsDataURL(file)}
 function addItem(){if(!active||(!selected&&!custom.trim()))return;const x:any=choices.find(y=>y.id===selected);const ar=x?.ar||custom.trim(),en=x?.en||custom.trim();const item:AcclimationItem={id:uid("aci"),libraryId:x?.id,name:ar,nameEn:en,category,quantity:Math.max(1,qty),dripMinutes:Math.max(0,drip),intervalMinutes:Math.max(0,interval),placement:placement||x?.care||"",notes,temperament,sensitivity,subtype,health,status:"waiting",remainingMs:Math.max(0,drip)*60000,imageDataUrl:imageData||undefined};saveSession({...active,items:[...active.items,item],events:[ev(`تمت إضافة ${ar} إلى الشحنة.`,`Added ${en} to the shipment.`),...active.events]});setSelected("");setCustom("");setQty(1);setNotes("");setPlacement("");setImageData("");}
 function removeItem(id:string){if(!active)return;saveSession({...active,items:active.items.filter(x=>x.id!==id)});}
 function moveItem(id:string,dir:number){if(!active)return;const a=[...active.items],i=a.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];saveSession({...active,items:a});}
 function autoOrder(){if(!active)return;saveSession({...active,items:[...active.items].sort((a,b)=>score(a)-score(b)),events:[ev("تم تطبيق ترتيب التنزيل المقترح.","Suggested release order applied."),...active.events]});}

 const preflight=useMemo(()=>{const base=lang==="ar"?["سطل/وعاء نظيف ومخصص لكل مجموعة","خرطوم تنقيط مع محبس تحكم","شبكة / وعاء نقل منفصل","Refractometer أو جهاز قياس الملوحة","ميزان حرارة","مناشف ومكان عمل جاف","اختبار صوت التنبيهات"]:["Clean dedicated container(s)","Airline / drip line + valve","Net / specimen container","Refractometer or salinity meter","Thermometer","Towels + dry working area","Timer/sound volume checked"];if(active?.items.some(i=>i.category==="coral"))base.push(lang==="ar"?"ماء Coral Dip وماء شطف منفصل جاهزان":"Coral dip + separate rinse water prepared");if(active?.items.some(i=>i.category==="plant"))base.push(lang==="ar"?"وعاء فحص/شطف النباتات جاهز":"Plant rinse/inspection container");return base},[active?.items,lang]);
 function toggleCheck(i:number){if(!active)return;sessionPatch({preflight:{...(active.preflight??{}),[i]:!(active.preflight??{})[i]}})}
 function startSession(){if(!active||!active.items.length)return;const start=Date.now(),left=active.floatRemainingMs??15*60000;saveSession({...active,status:"floating",wizardStep:5,floatStatus:"running",floatStartedAt:nowISO(),floatEndAt:start+left,events:[ev("بدأت موازنة حرارة الأكياس المغلقة لمدة 15 دقيقة.","Started sealed-bag temperature equalization for 15 minutes."),...active.events]});}
 function floatAction(action:"pause"|"resume"|"plus5"|"plus15"|"done"){
  if(!active)return;let s={...active},r=s.floatRemainingMs??15*60000;
  if(s.floatStatus==="running"&&s.floatEndAt)r=Math.max(0,s.floatEndAt-Date.now());
  if(action==="pause")s={...s,floatStatus:"paused",floatRemainingMs:r,floatEndAt:null};
  if(action==="resume")s={...s,floatStatus:"running",floatEndAt:Date.now()+r};
  if(action==="plus5"||action==="plus15"){const add=(action==="plus5"?5:15)*60000;s={...s,floatRemainingMs:r+add,floatEndAt:s.floatStatus==="running"?Date.now()+r+add:null,floatStatus:s.floatStatus==="ready"?"paused":s.floatStatus};}
  if(action==="done")s={...s,floatConfirmed:true,floatStatus:"done",floatRemainingMs:0,floatEndAt:null,status:"drip",events:[ev("تم تأكيد انتهاء موازنة الحرارة.","Temperature equalization confirmed complete."),...s.events]};
  saveSession(s);
 }
 function updateItem(id:string,fn:(x:AcclimationItem)=>AcclimationItem){if(!active)return;saveSession({...active,items:active.items.map(x=>x.id===id?fn(x):x)});}
 function startDrip(id:string){updateItem(id,x=>({...x,status:"acclimating",startedAt:nowISO(),endAt:Date.now()+(x.remainingMs??itemDuration(x)),remainingMs:x.remainingMs??itemDuration(x)}));}
 function itemAction(id:string,action:"pause"|"resume"|"plus5"|"plus15"|"ready"|"defer"|"emergency"){
  updateItem(id,x=>{let r=remaining(x,Date.now()),n={...x};if(action==="pause")n={...n,status:"paused",remainingMs:r,endAt:null};if(action==="resume")n={...n,status:"acclimating",endAt:Date.now()+r,remainingMs:r};if(action==="plus5"||action==="plus15"){const add=(action==="plus5"?5:15)*60000;n={...n,remainingMs:r+add,endAt:n.status==="acclimating"?Date.now()+r+add:null,status:n.status==="ready"?"paused":n.status};}if(action==="ready")n={...n,status:"ready",remainingMs:0,endAt:null,readyAt:nowISO()};if(action==="defer")n={...n,status:"deferred",endAt:null};if(action==="emergency")n={...n,status:n.emergency?"waiting":"emergency",emergency:!n.emergency,endAt:null};return n;});
 }
 function markAdded(item:AcclimationItem){if(!active)return;const catalog:any=lib.find((x:any)=>x.id===item.libraryId);if(catalog){const check=compatibilityCheck(tank,catalog,item.quantity);if(check.level==="danger"&&!window.confirm(lang==="ar"?"يوجد تحذير توافق/حمل بيولوجي قوي. هل تريد متابعة الإدخال رغم ذلك؟":"A strong compatibility/bioload warning exists. Continue anyway?"))return;}
  const livestock:LivestockItem={id:uid("live"),libraryId:item.libraryId,name:item.name,nameEn:item.nameEn,category:item.category,quantity:item.quantity,health:item.health==="critical"||item.health==="stressed"?"watch":"good",load:catalog?.load??1,addedAt:today()};const nextItems=active.items.map(x=>x.id===item.id?{...x,status:"added" as const,addedAt:nowISO()}:x);const allDone=nextItems.every(x=>x.status==="added"||x.status==="deferred");patch(tank.id,t=>({...t,acclimationSessions:[{...active,status:allDone?"completed":"release",completedAt:allDone?nowISO():undefined,items:nextItems,events:[ev(`تم إدخال ${item.name} إلى الحوض بدون ماء الشحنة.`,`Transferred ${item.nameEn||item.name} to the aquarium without shipping water.`),...active.events]},...(t.acclimationSessions??[]).filter(x=>x.id!==active.id)],livestock:[...t.livestock,livestock],timeline:[{id:uid("ev"),timestamp:nowISO(),type:"acclimation",textAr:`اكتملت أقلمة ${item.name} وتم إدخاله.`,textEn:`Acclimation completed for ${item.nameEn||item.name}.`},...t.timeline]}));
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
  if(tank.type==="marine"&&result==="plant")return null;
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
      <div className="added-list">{active.items.map(i=><div className="acclimation-mini" key={i.id}>{i.imageDataUrl?<img src={i.imageDataUrl} alt=""/>:<span>{icon[i.category]}</span>}<div><b>{lang==="ar"?i.name:(i.nameEn||i.name)} ×{i.quantity}</b><small>{categoryText(lang,i.category)} • {healthLabel(lang,i.health)} • {i.dripMinutes} min</small></div><button className="btn danger" onClick={()=>removeItem(i.id)}>×</button></div>)}</div>
      <div className="wizard-nav"><button className="btn" onClick={()=>setStep(1)}>← {bi(lang,"رجوع","Back")}</button><button className="btn primary" disabled={!active.items.length} onClick={()=>setStep(3)}>{bi(lang,"التالي","Next")} →</button></div></>}
      {step===3&&<><div className="section-title"><div><h2>{bi(lang,"مراجعة ترتيب التنزيل المقترح","Review suggested release order")}</h2><p className="note">{bi(lang,"الترتيب المقترح تنظيمي فقط ويمكنك تغييره.","Suggested order is organizational only and can be overridden.")}</p></div><button className="btn" onClick={autoOrder}>{bi(lang,"تطبيق المقترح","Apply suggestion")}</button></div><div className="acclimation-review">{active.items.map((i,idx)=><div className="acclimation-review-row" key={i.id}><span className="rank">{idx+1}</span><span className="review-icon">{icon[i.category]}</span><div><b>{lang==="ar"?i.name:(i.nameEn||i.name)} ×{i.quantity}</b><small>{temperamentLabel(lang,i.temperament||"peaceful")} • {sensitivityLabel(lang,i.sensitivity||"normal")}<br/>{i.placement||"—"}</small></div><div className="move"><button className="btn" disabled={idx===0} onClick={()=>moveItem(i.id,-1)}>↑</button><button className="btn" disabled={idx===active.items.length-1} onClick={()=>moveItem(i.id,1)}>↓</button></div></div>)}</div><div className="wizard-nav"><button className="btn" onClick={()=>setStep(2)}>← {bi(lang,"رجوع","Back")}</button><button className="btn primary" onClick={()=>setStep(4)}>{bi(lang,"التالي","Next")} →</button></div></>}
      {step===4&&<><h2>{bi(lang,"إعدادات الماء والسلامة","Water & safety setup")}</h2><p className="note">{bi(lang,"القيم مرجعية والقرار النهائي للمستخدم.","Values are for reference; the final decision remains with the user.")}</p><div className="form-grid">{tank.type==="marine"&&<><label className="field"><span>{tr(lang,"tankSalinity")}</span><input type="number" step=".001" value={active.tankSalinity??""} onChange={e=>sessionPatch({tankSalinity:Number(e.target.value)})}/></label><label className="field"><span>{tr(lang,"bagSalinity")}</span><input type="number" step=".001" value={active.bagSalinity??""} onChange={e=>sessionPatch({bagSalinity:Number(e.target.value)})}/></label></>}<label className="field"><span>{tr(lang,"temperature")}</span><input type="number" step=".1" value={active.temperature??""} onChange={e=>sessionPatch({temperature:Number(e.target.value)})}/></label><label className="field"><span>{bi(lang,"ملاحظات سكان الحوض الحاليين","Existing tank notes")}</span><input value={active.existingNotes??""} onChange={e=>sessionPatch({existingNotes:e.target.value})}/></label>{active.items.some(i=>i.category==="coral")&&<><label className="check-field"><input type="checkbox" checked={active.coralDipEnabled??false} onChange={e=>sessionPatch({coralDipEnabled:e.target.checked})}/><span>🪸 {bi(lang,"استخدام Coral Dip اختياري","Use optional Coral Dip")}</span></label><label className="field"><span>{bi(lang,"مدة الـDip حسب المنتج","Dip minutes from product")}</span><input type="number" value={active.coralDipMinutes??10} onChange={e=>sessionPatch({coralDipMinutes:Number(e.target.value)})}/></label></>}</div><div className="inline-alert info acclimation-workflow-note">💧 {bi(lang,"التسلسل: الأكياس مغلقة لموازنة الحرارة → نقل كل مجموعة إلى وعائها → تنقيط ماء الحوض → فحص / Dip عند الحاجة → نقل الكائن فقط بدون ماء الشحنة.","Workflow: sealed-bag temperature equalization → dedicated container → drip tank water → inspect / optional dip → transfer animal only, without shipping water.")}</div><h3>{bi(lang,"قائمة التجهيز قبل الوصول","Pre-arrival checklist")}</h3><div className="preflight-grid">{preflight.map((x,i)=><label className="check-field" key={i}><input type="checkbox" checked={Boolean(active.preflight?.[i])} onChange={()=>toggleCheck(i)}/><span>{x}</span></label>)}</div><div className="wizard-nav"><button className="btn" onClick={()=>setStep(3)}>← {bi(lang,"رجوع","Back")}</button><button className="btn primary" onClick={startSession}>▶ {bi(lang,"بدء الجلسة","Start Session")}</button></div></>}
    </div>
  </div>}

  {step>=5&&<>
   {active.items.some(x=>x.emergency&&x.status!=="added")&&<div className="acclimation-emergency full-span">🚨 <b>{bi(lang,"حالة استثنائية","Emergency")}</b> — {active.items.filter(x=>x.emergency&&x.status!=="added").map(x=>lang==="ar"?x.name:(x.nameEn||x.name)).join(", ")}</div>}
   <div className="acclimation-metrics full-span"><div className="card metric"><small>{bi(lang,"الحوض","Tank")}</small><b>{tank.name}</b></div><div className="card metric"><small>{bi(lang,"العناصر","Items")}</small><b>{active.items.length}</b></div><div className="card metric"><small>{bi(lang,"التقدم","Progress")}</small><b>{done}/{active.items.length}</b><div className="progress"><i style={{width:`${pct}%`}}/></div></div><div className="card metric"><small>{bi(lang,"الحالة","Status")}</small><b>{pct===100?bi(lang,"مكتمل","Complete"):bi(lang,"قيد الإقلمة","Acclimating")}</b></div></div>
   <section className="card panel full-span acclimation-stage"><div className="section-title"><div><small>1</small><h2>{bi(lang,"موازنة حرارة الأكياس المغلقة","Global sealed-bag temperature equalization")}</h2></div><span className={`status ${active.floatStatus}`}>{active.floatStatus}</span></div><div className="stage-timer">{fmt(floatRem)}</div><p className="note">{bi(lang,"يمكن وضع الأكياس المغلقة معاً. لا تفتحها قبل تأكيد انتهاء هذه المرحلة.","All sealed bags can float together. Do not open them before confirming this stage.")}</p><div className="acclimation-actions">{active.floatStatus==="running"&&<button className="btn" onClick={()=>floatAction("pause")}>{bi(lang,"إيقاف","Pause")}</button>}{active.floatStatus==="paused"&&<button className="btn primary" onClick={()=>floatAction("resume")}>{bi(lang,"استئناف","Resume")}</button>}<button className="btn" onClick={()=>floatAction("plus5")}>+5</button><button className="btn" onClick={()=>floatAction("plus15")}>+15</button>{(active.floatStatus==="ready"||active.floatStatus==="paused"||active.floatStatus==="running")&&<button className="btn good" onClick={()=>floatAction("done")}>{bi(lang,"تأكيد انتهاء المرحلة","Confirm stage complete")}</button>}</div></section>
   <section className="full-span"><div className="section-title"><div><h2>{bi(lang,"طابور التنزيل / التثبيت","Release / placement queue")}</h2><p className="note">{bi(lang,"انتهاء العداد يعني جاهز للفحص وليس يجب التنزيل.","Timer ending means ready for inspection, not mandatory release.")}</p></div></div><div className="acclimation-queue">{active.items.map(item=>{const rem=remaining(item,now);return <article className={`acclimation-item ${item.status}`} key={item.id}>{item.imageDataUrl?<img className="acclimation-item-photo" src={item.imageDataUrl} alt=""/>:<div className="acclimation-item-photo placeholder">{icon[item.category]}</div>}<div className="itembody"><div className="itemhead"><div><small>{categoryText(lang,item.category)}</small><h3>{lang==="ar"?item.name:(item.nameEn||item.name)} ×{item.quantity}</h3></div><span className={`status ${item.status}`}>{item.status}</span></div><div className="meta"><span className="pill">{healthLabel(lang,item.health)}</span><span className="pill">{temperamentLabel(lang,item.temperament||"peaceful")}</span><span className="pill">{sensitivityLabel(lang,item.sensitivity||"normal")}</span></div><p className="placement">📍 {item.placement||"—"}</p>{["acclimating","paused","ready"].includes(item.status)&&<div className="item-timer">{fmt(rem)}</div>}<div className="acclimation-actions">{item.status==="waiting"&&<button className="btn primary" disabled={!active.floatConfirmed} onClick={()=>startDrip(item.id)}>{bi(lang,"تم النقل — ابدأ التنقيط","Transferred — start drip")}</button>}{item.status==="acclimating"&&<button className="btn" onClick={()=>itemAction(item.id,"pause")}>{bi(lang,"إيقاف","Pause")}</button>}{item.status==="paused"&&<button className="btn primary" onClick={()=>itemAction(item.id,"resume")}>{bi(lang,"استئناف","Resume")}</button>}{["acclimating","paused","ready"].includes(item.status)&&<><button className="btn" onClick={()=>itemAction(item.id,"plus5")}>+5</button><button className="btn" onClick={()=>itemAction(item.id,"plus15")}>+15</button></>}{["acclimating","paused"].includes(item.status)&&<button className="btn good" onClick={()=>itemAction(item.id,"ready")}>{bi(lang,"جاهز للفحص","Ready for check")}</button>}{item.status==="ready"&&<button className="btn primary" onClick={()=>markAdded(item)}>{bi(lang,"نقل الكائن فقط — بدون ماء الشحنة","Transfer animal only — no shipping water")}</button>}{!['added','deferred'].includes(item.status)&&<button className="btn warn" onClick={()=>itemAction(item.id,"defer")}>{bi(lang,"تخطي / تأجيل","Skip / defer")}</button>}{!['added','deferred'].includes(item.status)&&<button className={`btn ${item.emergency?"danger":""}`} onClick={()=>itemAction(item.id,"emergency")}>🚨 {bi(lang,"استثنائية","Emergency")}</button>}</div></div></article>})}</div></section>
   <section className="card panel full-span acclimation-registry" id="acclimationRegistry"><div className="section-title"><div><h2>{bi(lang,"سجل الكائنات المدخلة","Livestock Input Register")}</h2><p className="note">{bi(lang,"يمكن طباعته أو حفظه PDF من المتصفح.","Print or save as PDF from the browser.")}</p></div><div className="actions"><button className="btn" onClick={()=>window.print()}>🖨 {bi(lang,"طباعة / PDF","Print / PDF")}</button><button className="btn" onClick={exportTxt}>TXT</button></div></div><div className="record-wrap"><table className="records"><thead><tr><th>#</th><th>{bi(lang,"النوع","Species")}</th><th>{bi(lang,"الفئة","Category")}</th><th>{bi(lang,"الصحة","Health")}</th><th>{bi(lang,"الحالة","Status")}</th><th>{bi(lang,"تاريخ الإدخال","Added")}</th><th>{bi(lang,"المكان / الملاحظات","Placement / Notes")}</th></tr></thead><tbody>{active.items.map((x,i)=><tr key={x.id}><td>{i+1}</td><td><b>{lang==="ar"?x.name:(x.nameEn||x.name)}</b> ×{x.quantity}</td><td>{categoryText(lang,x.category)}</td><td>{healthLabel(lang,x.health)}</td><td>{x.status}</td><td>{x.addedAt?new Date(x.addedAt).toLocaleString():"—"}</td><td>{x.placement||"—"}<div className="record-note">{x.notes}</div></td></tr>)}</tbody></table></div></section>
   <section className="card panel full-span"><div className="section-title"><h2>{tr(lang,"eventLog")}</h2></div><div className="history-list">{active.events.map(x=><div className="history-row" key={x.id}><b>{lang==="ar"?x.textAr:x.textEn}</b><span>{new Date(x.timestamp).toLocaleString()}</span></div>)}</div></section>
  </>}
 </section>;
}
