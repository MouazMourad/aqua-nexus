"use client";

import { useEffect,useState } from "react";
import type { Language } from "@/domain/types";
import { dismissContextHint,readContextHints,subscribeContextHints } from "@/lib/contextHints";

export type ContextHintTone="info"|"important"|"safety";

export function ContextHint({id,lang,ar,en,tone="info",dismissible=tone!=="safety"}:{
  id:string;
  lang:Language;
  ar:string;
  en:string;
  tone?:ContextHintTone;
  dismissible?:boolean;
}){
  const [hidden,setHidden]=useState(false);
  useEffect(()=>{
    const sync=()=>setHidden(readContextHints().dismissed.includes(id));
    sync();
    return subscribeContextHints(sync);
  },[id]);
  if(hidden&&dismissible)return null;

  const label=lang==="ar"?ar:en;
  const hide=()=>{
    if(!dismissible)return;
    dismissContextHint(id);
    setHidden(true);
  };

  return <button
    type="button"
    className={`context-hint context-hint-${tone} ${dismissible?"dismissible":"persistent"}`}
    onClick={hide}
    aria-label={dismissible?(lang==="ar"?"تلميح؛ اضغط لإخفائه":"Hint; tap to dismiss"):(lang==="ar"?"معلومة أمان":"Safety information")}
    title={dismissible?(lang==="ar"?"اضغط لإخفاء التلميح":"Tap to dismiss"):""}
  >
    <span className="context-hint-mark">{tone==="safety"?"!":"i"}</span>
    <span>{label}</span>
    {dismissible&&<small>×</small>}
    <style jsx>{`
      .context-hint{width:100%;border:1px solid rgba(94,211,238,.19);border-radius:10px;background:rgba(48,175,209,.055);color:inherit;padding:7px 9px;display:grid;grid-template-columns:20px 1fr auto;gap:7px;align-items:center;text-align:start;font:inherit;cursor:default}
      .context-hint.dismissible{cursor:pointer}
      .context-hint-mark{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-weight:900;font-size:11px;background:rgba(82,218,244,.11);color:#91e7f7}
      .context-hint>span:nth-child(2){font-size:10px;line-height:1.45;opacity:.86}
      .context-hint small{font-size:13px;opacity:.45;font-weight:900}
      .context-hint-important{border-color:rgba(245,197,91,.25);background:rgba(245,197,91,.065)}
      .context-hint-important .context-hint-mark{background:rgba(245,197,91,.13);color:#ffe09a}
      .context-hint-safety{border-color:rgba(255,126,137,.34);background:rgba(255,91,111,.075)}
      .context-hint-safety .context-hint-mark{background:rgba(255,91,111,.15);color:#ffabb4}
      @media(max-width:620px){.context-hint{padding:8px 9px}.context-hint>span:nth-child(2){font-size:10.5px}}
    `}</style>
  </button>;
}
