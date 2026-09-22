"use client";
import type { AcademyLessonId } from "@/data/academy";

export type AcademyProgress={completed:AcademyLessonId[];lastLessonId?:AcademyLessonId};
const KEY="aqua-nexus-academy-progress-v1";
const EVENT="aqua-nexus-academy-progress-change";
const EMPTY:AcademyProgress={completed:[]};

export function readAcademyProgress():AcademyProgress{
 if(typeof window==="undefined")return EMPTY;
 try{
  const raw=JSON.parse(localStorage.getItem(KEY)||"null");
  if(!raw||typeof raw!=="object")return EMPTY;
  const completed=Array.isArray(raw.completed)?raw.completed.filter((x:unknown)=>typeof x==="string") as AcademyLessonId[]:[];
  return{completed:[...new Set(completed)],lastLessonId:typeof raw.lastLessonId==="string"?raw.lastLessonId as AcademyLessonId:undefined};
 }catch{return EMPTY}
}
function write(state:AcademyProgress){
 if(typeof window==="undefined")return;
 localStorage.setItem(KEY,JSON.stringify(state));
 window.dispatchEvent(new CustomEvent(EVENT,{detail:state}));
}
export function setAcademyLastLesson(id:AcademyLessonId){const p=readAcademyProgress();write({...p,lastLessonId:id})}
export function toggleAcademyLessonComplete(id:AcademyLessonId){
 const p=readAcademyProgress(),has=p.completed.includes(id);
 write({...p,lastLessonId:id,completed:has?p.completed.filter(x=>x!==id):[...p.completed,id]});
}
export function resetAcademyProgress(){write(EMPTY)}
export function subscribeAcademyProgress(listener:(state:AcademyProgress)=>void){
 if(typeof window==="undefined")return()=>{};
 const fn=(event:Event)=>listener((event as CustomEvent<AcademyProgress>).detail||readAcademyProgress());
 window.addEventListener(EVENT,fn);return()=>window.removeEventListener(EVENT,fn);
}
