import type { ReactNode } from "react";
export function PageHeader({eyebrow,title,actions}:{eyebrow:string;title:string;actions?:ReactNode}) {
  return <div className="page-header"><div><small>{eyebrow}</small><h2>{title}</h2></div><div className="page-actions">{actions}</div></div>;
}
