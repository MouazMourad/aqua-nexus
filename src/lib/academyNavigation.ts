"use client";
import type { AcademyLessonId } from "@/data/academy";
const FOCUS_KEY="aqua-nexus-academy-focus";
export function openAcademyLesson(id:AcademyLessonId){
 if(typeof window==="undefined")return;
 sessionStorage.setItem(FOCUS_KEY,id);
 window.dispatchEvent(new CustomEvent("aqua:navigate",{detail:"academy"}));
}
export function consumeAcademyFocus():AcademyLessonId|undefined{
 if(typeof window==="undefined")return;
 const id=sessionStorage.getItem(FOCUS_KEY) as AcademyLessonId|null;
 if(id)sessionStorage.removeItem(FOCUS_KEY);
 return id??undefined;
}
