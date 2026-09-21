import type { AcclimationItem,AcclimationSession } from "@/domain/types";
import { bi } from "@/i18n";
import { coralTransferGate } from "@/domain/acclimationSafety";

export type AcclimationCategory=AcclimationItem["category"];

export const acclimationIcon:Record<string,string>={fish:"🐠",invert:"🦐",coral:"🪸",plant:"🌿",macroalgae:"🌿",other:"◌"};
export const healthOptions=["unknown","good","fair","stressed","critical"] as const;
export const temperamentOptions=["peaceful","semi","aggressive"] as const;
export const sensitivityOptions=["normal","sensitive","hardy"] as const;

export function formatTimer(ms:number){const s=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(s/60),ss=s%60;return `${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`}
export function acclimationItemDuration(i:AcclimationItem){return Math.max(0,(i.dripMinutes+(i.extraMinutes??0))*60000)}
export function acclimationRemaining(i:AcclimationItem,now:number){if((i.status==="acclimating"||i.status==="emergency")&&i.endAt)return Math.max(0,i.endAt-now);return i.remainingMs??acclimationItemDuration(i)}
export function acclimationScore(x:AcclimationItem){const cat:any={fish:0,invert:10,coral:20,plant:20,macroalgae:20,other:15},t:any={peaceful:0,semi:20,aggressive:40},s:any={sensitive:-5,normal:0,hardy:3};return (cat[x.category]||0)+(t[x.temperament||"peaceful"]||0)+(s[x.sensitivity||"normal"]||0)}
export function healthLabel(lang:"ar"|"en",h:string){const ar:any={unknown:"لم يتم التقييم",good:"جيدة / مستقرة",fair:"متوسطة",stressed:"مجهدة",critical:"حرجة"},en:any={unknown:"Not assessed",good:"Good / stable",fair:"Fair",stressed:"Stressed",critical:"Critical"};return (lang==="ar"?ar:en)[h]||h}
export function temperamentLabel(lang:"ar"|"en",v:string){const ar:any={peaceful:"مسالم",semi:"نصف عدواني",aggressive:"عدواني / إقليمي"},en:any={peaceful:"Peaceful",semi:"Semi-aggressive",aggressive:"Aggressive / territorial"};return (lang==="ar"?ar:en)[v]||v}
export function sensitivityLabel(lang:"ar"|"en",v:string){const ar:any={normal:"عادي",sensitive:"حساس",hardy:"قوي التحمل"},en:any={normal:"Normal",sensitive:"Sensitive",hardy:"Hardy"};return (lang==="ar"?ar:en)[v]||v}
export function subtypeLabel(lang:"ar"|"en",v?:string){const ar:any={crustacean:"قشريات",snail:"حلزون",echinoderm:"قنفذ / نجم بحر",worm:"وورمز / ديدان أنبوبية",macroalgae:"ماكرو ألجي"},en:any={crustacean:"Crustaceans",snail:"Snails",echinoderm:"Urchin / Starfish",worm:"Worms",macroalgae:"Macroalgae"};return v?((lang==="ar"?ar:en)[v]||v):""}
export function acclimationStatusLabel(lang:"ar"|"en",v?:string){const ar:any={waiting:"بانتظار البدء",running:"قيد التشغيل",paused:"متوقف مؤقتاً",ready:"جاهز للفحص",done:"مكتمل",acclimating:"قيد الإقلمة",added:"تم التنزيل",deferred:"مؤجل",emergency:"استثنائي"},en:any={waiting:"Waiting",running:"Running",paused:"Paused",ready:"Ready for check",done:"Done",acclimating:"Acclimating",added:"Added",deferred:"Deferred",emergency:"Emergency"};return (lang==="ar"?ar:en)[v||""]||v||""}
export function releasePriority(i:AcclimationItem){const health:any={critical:-25,stressed:-14,watch:-10,fair:-5,unknown:0,good:3},sensitivity:any={sensitive:0,normal:12,hardy:22},temperament:any={peaceful:0,semi:18,aggressive:36},category:any={fish:0,invert:6,coral:10,plant:12,macroalgae:12,other:14};return (health[i.health]??0)+(sensitivity[i.sensitivity||"normal"]??12)+(temperament[i.temperament||"peaceful"]??0)+(category[i.category]??14)}
export function suggestedBatchSize(total:number){if(total>24)return 6;if(total>12)return 5;if(total>8)return 4;return Math.max(1,total)}
export function emergencyDuration(i:AcclimationItem){const baseMinutes:any={fish:10,invert:20,coral:10,plant:5,macroalgae:5,other:10};const base=baseMinutes[i.category]??10,sensitivityExtra=i.sensitivity==="sensitive"?5:0;return Math.max(5,base+sensitivityExtra)*60000}
export function releaseLaneKey(i:AcclimationItem){if(i.category==="fish")return"fish";if(i.category==="coral")return"coral";if(i.category==="macroalgae")return"macroalgae";if(i.category==="plant")return i.subtype==="macroalgae"?"macroalgae":"plant";if(i.category==="invert"){if(i.subtype==="crustacean")return"crustacean";if(i.subtype==="snail")return"snail";if(i.subtype==="echinoderm")return"echinoderm";if(i.subtype==="worm")return"worm";return"invert"}return"other"}
export function releaseLaneLabel(lang:"ar"|"en",key:string){const ar:any={fish:"الأسماك",crustacean:"القشريات",snail:"الحلزون",echinoderm:"القنافذ ونجوم البحر",worm:"الوورمز / الديدان الأنبوبية",coral:"المرجان",macroalgae:"الماكرو ألجي",plant:"النباتات",invert:"اللافقاريات الأخرى",other:"أخرى"},en:any={fish:"Fish",crustacean:"Crustaceans",snail:"Snails",echinoderm:"Urchins & Starfish",worm:"Worms / Feather Dusters",coral:"Corals",macroalgae:"Macroalgae",plant:"Plants",invert:"Other Invertebrates",other:"Other"};return (lang==="ar"?ar:en)[key]||key}
export function releaseLaneIcon(key:string){const icons:any={fish:"🐠",crustacean:"🦐",snail:"🐌",echinoderm:"⭐",worm:"🪱",coral:"🪸",macroalgae:"🌿",plant:"🌿",invert:"🦐",other:"◌"};return icons[key]||"◌"}

export function buildAcclimationGuide(active:AcclimationSession|undefined,lang:"ar"|"en"){
  const items=active?.items??[],ready=items.filter(i=>i.status==="ready"&&!i.emergency),running=items.filter(i=>i.status==="acclimating"&&!i.emergency);
  if(!active)return{stage:1,title:"",detail:"",tone:"info" as const};
  if(!active.floatConfirmed){
    if(active.floatStatus==="ready")return{stage:1,title:bi(lang,"أكد انتهاء موازنة الحرارة","Confirm temperature equalization"),detail:bi(lang,"العداد انتهى. تأكد أن حرارة الأكياس قريبة من حرارة الحوض ثم أكد المرحلة.","Timer finished. Confirm bag temperature is close to tank temperature, then confirm the stage."),tone:"ready" as const};
    return{stage:1,title:bi(lang,"موازنة حرارة كل الشحنة","Temperature equalization for the whole shipment"),detail:bi(lang,"اترك جميع الأكياس مغلقة حتى ينتهي العداد.","Keep all bags sealed until the timer finishes."),tone:"info" as const};
  }
  if(active.bucketStatus!=="done"){
    if(active.bucketStatus==="ready")return{stage:2,title:bi(lang,"انتهى وقت النقل إلى الأوعية","Container-transfer time is complete"),detail:bi(lang,"تأكد أن كل الكائنات نُقلت إلى أوعيتها ثم أكد المرحلة.","Confirm all livestock has moved to dedicated containers, then confirm the stage."),tone:"ready" as const};
    return{stage:2,title:bi(lang,"نقل الكائنات إلى الأوعية","Move livestock to containers"),detail:bi(lang,"جهز الأوعية وخطوط التنقيط ولا تبدأ التنقيط قبل انتهاء هذه المرحلة.","Prepare containers and drip lines; do not start dripping before this stage completes."),tone:"action" as const};
  }
  if(!active.dripStartedAt)return{stage:3,title:bi(lang,"ابدأ التنقيط لجميع الدفعات","Start drip acclimation for all batches"),detail:bi(lang,"ابدأ التنقيط مرة واحدة؛ كل دفعة ستعمل بعداد مستقل بالتوازي.","Start drip acclimation once; each batch will run on its own timer in parallel."),tone:"action" as const};
  const rinseRun=(active.coralDipRuns??[]).find(r=>r.status==="ready_to_rinse");
  if(rinseRun)return{stage:4,title:bi(lang,"Coral Dip انتهى — الشطف الآن","Coral Dip finished — rinse now"),detail:bi(lang,"انقل المرجان إلى ماء شطف منفصل ثم أكد الشطف قبل النقل.","Move coral to separate rinse water and confirm the rinse before transfer."),tone:"ready" as const};
  const transferableReady=ready.filter(i=>i.category!=="coral"||!active.coralDipEnabled||coralTransferGate(active,i).allowed);
  if(transferableReady.length)return{stage:4,title:bi(lang,"دفعة أو أكثر جاهزة للفحص والنقل","One or more batches are ready to inspect and transfer"),detail:bi(lang,"افحص الكائنات الجاهزة وانقلها واحدة واحدة؛ بقية العدادات تستمر بالتوازي.","Inspect ready livestock and transfer one by one; other timers continue in parallel."),tone:"ready" as const};
  const coralNeedsDip=ready.find(i=>i.category==="coral"&&active.coralDipEnabled&&!coralTransferGate(active,i).allowed&&!coralTransferGate(active,i).run);
  if(coralNeedsDip)return{stage:4,title:bi(lang,"دفعة مرجان جاهزة للـCoral Dip","A coral batch is ready for Coral Dip"),detail:bi(lang,"ابدأ الـDip من صندوق الدفعة؛ الخصم من المخزون يحصل عند بدء التحضير فعلياً.","Start the dip from the batch box; inventory is deducted only when preparation actually begins."),tone:"action" as const};
  const runningDip=(active.coralDipRuns??[]).find(r=>r.status==="running");
  if(runningDip)return{stage:4,title:bi(lang,"Coral Dip شغال بالتوازي","Coral Dip is running in parallel"),detail:bi(lang,"راقب عداد الـDip وبقية عدادات الإقلمة.","Monitor the dip timer alongside the other acclimation timers."),tone:"running" as const};
  if(running.length)return{stage:3,title:bi(lang,"التنقيط شغال لكل الدفعات بالتوازي","All batch drip timers are running in parallel"),detail:bi(lang,"راقب العدادات؛ عند انتهاء أي دفعة سيظهر تنبيه مستقل.","Monitor the timers; each finished batch produces its own alert."),tone:"running" as const};
  return{stage:4,title:bi(lang,"راجع الحالة الحالية","Review current state"),detail:bi(lang,"راجع الدفعات والعناصر المؤجلة أو المكتملة قبل إنهاء الجلسة.","Review batches and deferred/completed items before closing the session."),tone:"info" as const};
}
