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
 const broad=broadQuery(intent.normalized);
 let primary:AquaDomain="system";

 if(intent.params.length)primary="chemistry";
 else if(intent.asksAboutBioload)primary="bioload";
 else {
  const domains=intent.topics.map(topicToDomain).filter(Boolean) as AquaDomain[];
  if(domains.length===1)primary=domains[0];
  else if(domains.length>1){
   // Keep the first explicit domain as primary; the others remain secondary context.
   primary=domains[0];
  } else if(broad)primary="system";
 }

 const explicitDomains=intent.topics.map(topicToDomain).filter(Boolean) as AquaDomain[];
 const secondary=[...new Set(explicitDomains.filter(x=>x!==primary))];

 const operation=intent.mode as AquaOperation;
 const crossDomain=
  primary==="system"||
  operation==="canAdd"||
  operation==="waterChange"||
  intent.asksForRisk&&primary==="livestock";

 const allowedSources=crossDomain
  ? SOURCE_MAP.system
  : [...new Set([
      ...SOURCE_MAP[primary],
      ...secondary.flatMap(x=>SOURCE_MAP[x])
    ])];

 const confidence:AquaAIQueryPlan["confidence"] = intent.confidence;

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
