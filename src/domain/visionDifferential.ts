import type { Tank } from "./types";
import { DISEASE_LIBRARY } from "@/data/legacyCatalogs";
import type { VisionSymptom } from "./visionIntelligence";

export interface VisionDiseaseCandidate{
  id:string;
  ar:string;
  en:string;
  symptomsAr:string;
  symptomsEn:string;
  urgent:boolean;
  score:number;
}

const symptomWeights:Record<VisionSymptom,number>={
  whiteSpots:4,tissueLoss:4,paleColor:3,darkColor:3,closedPolyps:3,lesion:3,finDamage:4,rapidBreathing:2,algaeFilm:3,unknown:0
};

const symptomPatterns:Record<VisionSymptom,RegExp[]>={
  whiteSpots:[/white spot|white patch|gold.*dust|dusting|نقاط بيضاء|بقع بيضاء|غبار.*ذهبي|غبار.*رمادي/i],
  tissueLoss:[/tissue loss|tissue recession|brown jelly|rtn|stn|تراجع.*نسيج|فقد.*نسيج|براون جيلي/i],
  paleColor:[/pale|bleach|color loss|yellow|شحوب|ابيضاض|فقد لون|اصفرار/i],
  darkColor:[/dark|black|brown|اسمرار|غمقان|بقع داكنة/i],
  closedPolyps:[/closed|closure|contraction|polyps|انغلاق|انكماش|بوليبات/i],
  lesion:[/lesion|ulcer|wound|red sore|redness|آفة|تقرح|جروح|احمرار/i],
  finDamage:[/fin|frayed|زعانف|تآكل.*زعانف/i],
  rapidBreathing:[/rapid breathing|increased breathing|severe breathing|labored breathing|breathing.*fast|gill|تنفس سريع|تنفس أسرع|تنفس شديد|تنفس متعب|خياشيم/i],
  algaeFilm:[/algae|film|طحالب|غشاء/i],
  unknown:[]
};

function groupForSubject(tank:Tank,livestockId?:string){
  const subject=tank.livestock.find(x=>x.id===livestockId);
  if(!subject)return null;
  if(subject.category==="fish")return "fish";
  if(subject.category==="coral")return "coral";
  if(subject.category==="plant")return "plant";
  if(subject.category==="invert")return "crustacean";
  return null;
}

export function visionDiseaseCandidates(tank:Tank,livestockId:string|undefined,symptoms:VisionSymptom[],limit=4):VisionDiseaseCandidate[]{
  const group=groupForSubject(tank,livestockId);
  if(!group)return [];
  const entries:any[]=DISEASE_LIBRARY.filter((x:any)=>x.type===tank.type&&x.group===group);
  return entries.map(x=>{
    const haystack=`${x.ar} ${x.en} ${x.symAr} ${x.symEn}`;
    let score=0;
    for(const symptom of symptoms){
      const patterns=symptomPatterns[symptom]??[];
      if(patterns.some(pattern=>pattern.test(haystack)))score+=symptomWeights[symptom]??1;
    }
    if(x.urgent&&score>0)score+=.25;
    return {id:x.id,ar:x.ar,en:x.en,symptomsAr:x.symAr,symptomsEn:x.symEn,urgent:Boolean(x.urgent),score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||Number(b.urgent)-Number(a.urgent)).slice(0,Math.max(1,limit));
}
