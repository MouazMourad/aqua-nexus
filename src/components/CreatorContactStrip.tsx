"use client";

import { useAquaStore } from "@/store/useAquaStore";

const name=process.env.NEXT_PUBLIC_AQUA_CONTACT_NAME?.trim()||"";
const phone=process.env.NEXT_PUBLIC_AQUA_CONTACT_PHONE?.trim()||"";
const email=process.env.NEXT_PUBLIC_AQUA_CONTACT_EMAIL?.trim()||"";

export function CreatorContactStrip(){
 const lang=useAquaStore(s=>s.language);
 if(!name&&!phone&&!email)return null;
 return <section className="creator-contact-strip" aria-label={lang==="ar"?"معلومات التواصل":"Contact information"}>
  <span className="creator-contact-label">{lang==="ar"?"للتواصل":"Contact"}</span>
  {name&&<b>{name}</b>}
  {phone&&<a href={`tel:${phone.replace(/\s+/g,"")}`}>☎ {phone}</a>}
  {email&&<a href={`mailto:${email}`}>✉ {email}</a>}
 </section>;
}
