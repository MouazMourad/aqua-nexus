"use client";
import { useEffect,useState } from "react";
import { useAquaStore } from "@/store/useAquaStore";
import { readDataSafetyStatus,subscribeDataSafety,type DataSafetyStatus } from "@/lib/dataSafetyStatus";

export function DataSafetyBanner(){
  const lang=useAquaStore(s=>s.language);
  const [status,setStatus]=useState<DataSafetyStatus>({persistence:"ok"});
  useEffect(()=>{setStatus(readDataSafetyStatus());return subscribeDataSafety(setStatus)},[]);
  if(status.persistence==="ok")return null;
  const failed=status.persistence==="failed";
  return <aside className={`data-safety-banner ${failed?"danger":"warn"}`} role="alert" aria-live="assertive" dir={lang==="ar"?"rtl":"ltr"}>
    <div><b>{failed?(lang==="ar"?"⚠️ تعذر حفظ آخر التغييرات بشكل دائم":"⚠️ Latest changes could not be saved durably"):(lang==="ar"?"⚠️ الحفظ يعمل بوضع احتياطي":"⚠️ Storage is running in fallback mode")}</b><small>{status.lastFailure||(lang==="ar"?"راجع سلامة التخزين من الإعدادات قبل إعادة تحميل الصفحة.":"Review Data Safety in Settings before reloading the page.")}</small></div>
    <style jsx>{`
      .data-safety-banner{position:fixed;z-index:10050;left:max(10px,env(safe-area-inset-left));right:max(10px,env(safe-area-inset-right));top:max(10px,env(safe-area-inset-top));display:grid;gap:4px;padding:11px 14px;border-radius:14px;box-shadow:0 12px 36px #0008;backdrop-filter:blur(12px)}
      .data-safety-banner>div{display:grid;gap:3px}.data-safety-banner b{font-size:12px}.data-safety-banner small{font-size:10px;line-height:1.45;opacity:.9}
      .data-safety-banner.warn{background:#30250f;border:1px solid #86651d;color:#fff6d8}.data-safety-banner.danger{background:#351219;border:1px solid #9e4354;color:#ffe9ed}
    `}</style>
  </aside>;
}
