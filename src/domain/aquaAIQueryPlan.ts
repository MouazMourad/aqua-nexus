import type { AquaQuestionIntent,AquaQuestionParam,AquaQuestionTopic } from "./aquaAIIntent";

export type AquaDomain=
 |"system"|"chemistry"|"bioload"|"livestock"|"equipment"|"maintenance"
 |"dosing"|"acclimation"|"emergency"|"rodi"|"feeding"|"water";

export type AquaOperation=
 |"status"|"why"|"action"|"trend"|"forecast"|"compare"
 |"canAdd"|"waterChange"|"dose"|"general";

export interface AquaAIQueryPlan{
 operation:AquaOperation;
 primary:AquaDomain;
 secondary:AquaDomain[];
 params:AquaQuestionParam[];
 broad:boolean;
 crossDomain:boolean;
 allowedSources:string[];
 confidence:"low"|"medium"|"high";
}

const SOURCE_MAP:Record<AquaDomain,string[]>={
 system:["data","chemistry","trend","history","equipment","maintenance","livestock","bioload","acclimation","nutrients","learning"],
 chemistry:["data","chemistry","trend","history","nutrients","learning"],
 bioload:["bioload","livestock","nutrients"],
 livestock:["livestock","bioload","acclimation"],
 equipment:["equipment"],
 maintenance:["maintenance","equipment"],
 dosing:["chemistry","trend","history","learning"],
 acclimation:["acclimation","livestock"],
 emergency:["equipment","chemistry","data","livestock"],
 rodi:["data","history","chemistry"],
 feeding:["livestock","bioload","nutrients"],
 water:["chemistry","history","maintenance","data"]
};

function broadQuery(s:string){
 return /(الوضع بشكل عام|الوضع العام|وضع الحوض|كيف الحوض|حاله الحوض|حالة الحوض|شو وضع الحوض|شو وضعنا|بشكل عام|overall|whole tank|tank status|general status)/i.test(s);
}

function topicToDomain(topic:AquaQuestionTopic):AquaDomain|undefined{
 if(topic==="general")return undefined;
 if(topic==="chemistry")return "chemistry";
 if(topic==="livestock")return "livestock";
 if(topic==="equipment")return "equipment";
 if(topic==="maintenance")return "maintenance";
 if(topic==="dosing")return "dosing";
 if(topic==="acclimation")return "acclimation";
 if(topic==="emergency")return "emergency";
 if(topic==="rodi")return "rodi";
 if(topic==="feeding")return "feeding";
 if(topic==="water")return "water";
 return undefined;
}

export function buildAquaAIQueryPlan(intent:AquaQuestionIntent):AquaAIQueryPlan{
 const s=intent.normalized;
 const broad=broadQuery(s);
 const scores:Record<AquaDomain,number>={
  system:0,chemistry:0,bioload:0,livestock:0,equipment:0,maintenance:0,
  dosing:0,acclimation:0,emergency:0,rodi:0,feeding:0,water:0
 };
 const add=(domain:AquaDomain,score:number)=>{scores[domain]+=score;};

 // Structured intent signals.
 for(const topic of intent.topics){
  const d=topicToDomain(topic);
  if(d)add(d,3);
 }
 if(intent.params.length)add("chemistry",12);
 if(intent.asksAboutBioload)add("bioload",14);
 if(broad)add("system",10);

 // Lexical weighting. Strong workflow words beat incidental nouns.
 if(/كيميا|كيمياء|قراءه|chemistry|parameter/.test(s))add("chemistry",6);
 if(/حمل حيوي|الحمل الحيوي|الحمل البيولوجي|bioload|bio load|قدره الحوض|قدرة الحوض/.test(s))add("bioload",12);
 if(/سمك|اسماك|مرجان|كائن|حلزون|قشريات|روبيان|جمبري|livestock|fish|coral|snail|shrimp/.test(s))add("livestock",5);
 if(/جهاز|معدات|مضخه|سكيمر|سخان|اضاءه|فلتر|equipment|pump|skimmer|heater|light/.test(s))add("equipment",5);
 if(/صيانه|تنظيف|موعد|مهمه|اخر صيانه|متى انظف|maintenance|clean|service|due/.test(s))add("maintenance",9);
 if(/جرعه|دوز|all for reef|بيكربونات|مكمل|dose|dosing|supplement/.test(s))add("dosing",9);
 if(/اقلمه|تاقلم|شحنه|تنقيط|acclimation|shipment|drip/.test(s))add("acclimation",10);
 if(/طوار|تسريب|انقطاع|خطر|emergency|leak|power outage/.test(s))add("emergency",11);
 if(/rodi|ro\/di|ماء المصدر|مياه المصدر|فلتر المي|tds/.test(s))add("rodi",10);
 if(/اكل|تغذيه|feeding|feed/.test(s))add("feeding",9);
 if(/تغيير مي|تغيير ماء|بدل مي|water change|change water/.test(s))add("water",11);

 // A broad question is system-wide only when no specific domain clearly wins.
 const ranked=(Object.entries(scores) as Array<[AquaDomain,number]>).sort((a,b)=>b[1]-a[1]);
 let primary:AquaDomain=ranked[0]?.[1]>0?ranked[0][0]:"system";
 if(broad&&ranked.filter(([d])=>d!=="system")[0]?.[1]<6)primary="system";

 const secondary=ranked
  .filter(([d,score])=>d!==primary&&score>=4)
  .slice(0,3)
  .map(([d])=>d);

 const operation=intent.mode as AquaOperation;
 const crossDomain=
  primary==="system"||
  operation==="canAdd"||
  operation==="waterChange"||
  (intent.asksForRisk&&(primary==="livestock"||primary==="bioload"));

 const allowedSources=crossDomain
  ? SOURCE_MAP.system
  : [...new Set([
      ...SOURCE_MAP[primary],
      ...secondary.flatMap(x=>SOURCE_MAP[x])
    ])];

 const confidence:AquaAIQueryPlan["confidence"]=
  ranked[0]?.[1]>=10?"high":
  ranked[0]?.[1]>=4||intent.mode!=="general"?"medium":
  intent.confidence;

 return {
  operation,
  primary,
  secondary,
  params:intent.params,
  broad,
  crossDomain,
  allowedSources,
  confidence
 };
}
