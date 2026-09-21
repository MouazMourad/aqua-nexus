import type { ReactNode } from "react";

export function DecisionGuidance({what,why,next,safety}:{what:ReactNode;why:ReactNode;next:ReactNode;safety?:ReactNode}){
  return <div className="decision-guidance">
    <div className="decision-guidance-item"><small>WHAT</small><div>{what}</div></div>
    <div className="decision-guidance-item"><small>WHY</small><div>{why}</div></div>
    <div className="decision-guidance-item"><small>NEXT</small><div>{next}</div></div>
    {safety&&<div className="decision-guidance-item safety"><small>SAFETY</small><div>{safety}</div></div>}
    <style jsx>{`
      .decision-guidance{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px}
      .decision-guidance-item{min-width:0;border:1px solid rgba(255,255,255,.08);border-radius:13px;padding:10px 11px;background:rgba(255,255,255,.025);display:grid;gap:4px}
      .decision-guidance-item small{font-size:9px;letter-spacing:.11em;font-weight:900;opacity:.58}
      .decision-guidance-item div{font-size:12px;line-height:1.5}
      .decision-guidance-item.safety{grid-column:1/-1;border-color:rgba(255,185,72,.2);background:rgba(255,185,72,.05)}
      @media(max-width:720px){.decision-guidance{grid-template-columns:1fr}.decision-guidance-item.safety{grid-column:auto}}
    `}</style>
  </div>;
}
