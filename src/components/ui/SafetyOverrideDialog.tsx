"use client";
import { useState } from "react";
import { createPortal } from "react-dom";

type RequestConfig={title:string;message:string;requireReason?:boolean;confirmLabel?:string};
type Pending=RequestConfig&{resolve:(value:string|null)=>void};

export function useSafetyOverrideDialog(lang:"ar"|"en"){
  const [pending,setPending]=useState<Pending|null>(null),[reason,setReason]=useState("");
  function requestOverride(config:RequestConfig){
    return new Promise<string|null>(resolve=>{setReason("");setPending({...config,resolve})});
  }
  function cancel(){pending?.resolve(null);setPending(null);setReason("")}
  function confirm(){
    if(!pending)return;
    const clean=reason.trim();
    if(pending.requireReason!==false&&clean.length<5)return;
    pending.resolve(clean);setPending(null);setReason("");
  }
  const dialog=pending&&typeof document!=="undefined"?createPortal(
    <div className="command-palette-backdrop" role="presentation">
      <section className="command-palette" role="dialog" aria-modal="true" aria-label={pending.title} style={{maxWidth:560}}>
        <div style={{padding:16,display:"grid",gap:12}}>
          <div className="inline-alert danger"><b>{pending.title}</b><p>{pending.message}</p></div>
          <label className="field"><span>{lang==="ar"?"سبب التجاوز — سيُحفظ في سجل الحوض":"Override reason — saved to tank history"}</span><textarea autoFocus value={reason} onChange={e=>setReason(e.target.value)} placeholder={lang==="ar"?"اكتب السبب العملي الواضح للتنفيذ الآن…":"Enter the concrete reason this action must proceed now…"} /></label>
          <div className="modal-actions"><button className="btn" onClick={cancel}>{lang==="ar"?"إلغاء":"Cancel"}</button><button className="btn danger" disabled={pending.requireReason!==false&&reason.trim().length<5} onClick={confirm}>{pending.confirmLabel??(lang==="ar"?"تأكيد التجاوز":"Confirm override")}</button></div>
        </div>
      </section>
    </div>,document.body):null;
  return{requestOverride,overrideDialog:dialog};
}
