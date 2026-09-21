"use client";
import { useEffect } from "react";
import { useAquaStore } from "@/store/useAquaStore";

export function DocumentLocaleSync(){
  const language=useAquaStore(s=>s.language);
  useEffect(()=>{
    const root=document.documentElement;
    root.lang=language;
    root.dir=language==="ar"?"rtl":"ltr";
    document.body.dir=root.dir;
  },[language]);
  return null;
}
