"use client";
import { useEffect,useState } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { forceTakeOverWriteLease,startMultiTabWriteLease } from "@/lib/multiTabGuard";

export function MultiTabGuard(){
  const lang=useAquaStore(s=>s.language);
  const [writable,setWritable]=useState(true);
  useEffect(()=>startMultiTabWriteLease(setWritable),[]);
  if(writable)return null;
  return <div dir={lang==="ar"?"rtl":"ltr"} style={{position:"fixed",inset:0,zIndex:12000,background:"rgba(1,14,20,.84)",backdropFilter:"blur(10px)",display:"grid",placeItems:"center",padding:20}}>
    <div style={{width:"min(520px,100%)",padding:22,borderRadius:20,border:"1px solid rgba(255,190,80,.38)",background:"rgba(4,31,42,.98)",boxShadow:"0 24px 70px rgba(0,0,0,.5)"}}>
      <h2 style={{marginTop:0}}>⚠ {lang==="ar"?"Aqua Nexus مفتوح بتبويب آخر":"Aqua Nexus is open in another tab"}</h2>
      <p style={{lineHeight:1.8,opacity:.85}}>{lang==="ar"?"لحماية بيانات الحوض من ضياع التعديلات، الكتابة مسموحة لتبويب واحد فقط. هذا التبويب موقوف عن التعديل حالياً. إذا سكّرت التبويب الآخر رح يرجع هاد التبويب قابل للكتابة تلقائياً.":"To prevent lost updates, only one tab may write aquarium data at a time. This tab is currently blocked from editing. Close the other tab and this one will become writable automatically."}</p>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:14}}>
        <button className="btn primary" onClick={()=>window.location.reload()}>{lang==="ar"?"إعادة تحميل أحدث بيانات":"Reload latest data"}</button>
        <button className="btn" onClick={()=>{forceTakeOverWriteLease();window.location.reload()}}>{lang==="ar"?"استلام الكتابة وإعادة التحميل":"Take over writing & reload"}</button>
      </div>
    </div>
  </div>;
}
