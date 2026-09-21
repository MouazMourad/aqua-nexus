"use client";

import { useEffect,useState } from "react";
import type { AppPage } from "@/components/navigation/MainNav";
import { useAquaStore } from "@/store/useAquaStore";

type FeatureTip={
  page:AppPage;
  icon:string;
  ar:string;
  en:string;
};

const BUBBLE_RISE_MS=45000;
const BUBBLE_CYCLE_MS=80000;

const FEATURE_TIPS:FeatureTip[]=[
  {page:"equipment",icon:"⇧",ar:"ارفع صورة أو ملف جهاز؛ راجع القيم ثم Aqua Nexus يوزّعها تلقائياً.",en:"Upload a device screenshot or export, review the values, then Aqua Nexus routes them automatically."},
  {page:"lighting",icon:"☀",ar:"شغّل محاكاة الإنارة ×10 وشوف لون وسطوع الحوض 3D يتغير.",en:"Run the 10× lighting demo and watch the 3D tank change color and brightness."},
  {page:"lighting",icon:"↕",ar:"خريطة العمق تقترح مكان المرجان أو النبات حسب الضوء والمسافة عن السطح.",en:"The depth map suggests coral or plant placement from light and distance below the surface."},
  {page:"chemistry",icon:"⚗",ar:"استورد سجل الكيمياء CSV/TXT بدل إدخال القراءات القديمة يدوياً.",en:"Import old chemistry history from CSV/TXT instead of entering readings manually."},
  {page:"dashboard",icon:"✦",ar:"Tank Brain يربط بيانات الحوض كلها ليحدد الحالة والخطر والخطوة التالية.",en:"Tank Brain connects the whole aquarium to identify state, risk and the next action."},
  {page:"acclimation",icon:"⇄",ar:"الإقلمة تدير عدادات منفصلة ومتوازية للسمك والمرجان واللافقاريات والنبات.",en:"Acclimation runs separate parallel timers for fish, corals, inverts and plants."},
  {page:"equipment",icon:"⚙",ar:"حدد مكان الجهاز باللمس وتابع عمره وأعطاله والطاقة والاحتياط.",en:"Place equipment by touch and track lifecycle, failures, energy and backup readiness."},
  {page:"alerts",icon:"△",ar:"مركز التنبيهات يجمع مشاكل الحوض كلها بمكان واحد.",en:"The Alerts center brings aquarium problems together in one place."},
  {page:"journal",icon:"▧",ar:"Visual Tank Insight يربط الصورة بالكائن وسجل الحوض.",en:"Visual Tank Insight links a photo to the livestock item and tank history."},
  {page:"dashboard",icon:"⌕",ar:"البحث الشامل يوصلك لكائن أو جهاز أو KH أو مهمة بسرعة.",en:"Global search jumps quickly to livestock, equipment, KH or a task."},
  {page:"dashboard",icon:"⚙",ar:"رتّب صناديق الداشبورد وأخفِ ما لا تحتاجه.",en:"Reorder Dashboard cards and hide what you do not need."},
  {page:"sump",icon:"▤",ar:"مخطط السامب مبني على أبعاد الحجر الحقيقية ومحتوياتها.",en:"The sump layout uses the real chamber dimensions and contents."}
];

export function DashboardFeatureBubble(){
  const lang=useAquaStore(s=>s.language);
  const [index,setIndex]=useState(0);
  const [cycle,setCycle]=useState(0);
  useEffect(()=>{
    const timer=window.setInterval(()=>{
      setIndex(i=>(i+1)%FEATURE_TIPS.length);
      setCycle(c=>c+1);
    },BUBBLE_CYCLE_MS);
    return()=>window.clearInterval(timer);
  },[]);

  const tip=FEATURE_TIPS[index];
  const names:Partial<Record<AppPage,{ar:string;en:string}>>={
    dashboard:{ar:"لوحة القيادة",en:"Dashboard"},equipment:{ar:"التجهيزات",en:"Equipment"},lighting:{ar:"الإنارة",en:"Lighting"},
    chemistry:{ar:"الكيمياء",en:"Chemistry"},acclimation:{ar:"الإقلمة",en:"Acclimation"},alerts:{ar:"التنبيهات",en:"Alerts"},
    journal:{ar:"الصور والسجل",en:"Journal"},sump:{ar:"السامب",en:"Sump"}
  };
  const label=names[tip.page]?.[lang==="ar"?"ar":"en"]??tip.page;

  return <div className="feature-bubble-lane" aria-hidden="true">
    <div className="feature-bubble" key={cycle}>
      <div className="feature-bubble-body">
        <span className="feature-bubble-icon">{tip.icon}</span>
        <span>
          <b>{lang==="ar"?"💡 ميزة في Aqua Nexus":"💡 Aqua Nexus tip"}</b>
          <small>{lang==="ar"?tip.ar:tip.en}</small>
          <em>{lang==="ar"?`التفاصيل: ؟ أعلى صفحة ${label}`:`Details: ? at the top of ${label}`}</em>
        </span>
      </div>
    </div>
    <style jsx>{`
      .feature-bubble-lane{position:fixed;inset:0;z-index:2600;pointer-events:none;overflow:hidden}
      .feature-bubble{position:absolute;inset-inline-end:clamp(12px,4vw,58px);bottom:-190px;width:min(360px,calc(100vw - 28px));pointer-events:none;animation:aquaBubbleRise ${BUBBLE_RISE_MS}ms linear forwards;filter:drop-shadow(0 14px 28px rgba(0,0,0,.28))}
      .feature-bubble:before,.feature-bubble:after{content:"";position:absolute;border-radius:50%;border:1px solid rgba(149,235,255,.28);background:radial-gradient(circle at 30% 28%,rgba(255,255,255,.22),rgba(91,212,239,.06) 48%,rgba(22,105,137,.035) 72%,transparent 73%);pointer-events:none}
      .feature-bubble:before{width:36px;height:36px;inset-inline-start:-18px;top:-24px}.feature-bubble:after{width:18px;height:18px;inset-inline-end:18px;bottom:-19px}
      .feature-bubble-body{width:100%;border:1px solid rgba(134,228,248,.28);border-radius:32px 32px 32px 18px;background:linear-gradient(135deg,rgba(17,75,98,.66),rgba(5,31,46,.54));backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px);color:inherit;padding:13px 15px;display:grid;grid-template-columns:38px 1fr;gap:9px;text-align:inherit;box-shadow:inset 0 1px 0 rgba(255,255,255,.09)}
      .feature-bubble-icon{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(142,230,250,.24);background:rgba(104,218,244,.08);font-size:18px}
      .feature-bubble-body>span:last-child{display:grid;gap:3px;min-width:0}.feature-bubble-body b{font-size:13px;color:#bceefa;line-height:1.3}.feature-bubble-body small{font-size:12px;line-height:1.55;color:#eafaff}.feature-bubble-body em{font-style:normal;font-size:10px;line-height:1.35;color:#91c9d6}
      @keyframes aquaBubbleRise{
        0%{transform:translate3d(0,0,0) scale(.92);opacity:0}
        6%{opacity:.96}
        32%{transform:translate3d(-8px,-46vh,0) scale(1)}
        62%{transform:translate3d(5px,-49vh,0) scale(1);opacity:.96}
        90%{transform:translate3d(-5px,-108vh,0) scale(1.03);opacity:.88}
        97%{transform:translate3d(6px,-118vh,0) scale(1.08);opacity:.78}
        100%{transform:translate3d(6px,-122vh,0) scale(1.55);opacity:0}
      }
      @media(max-width:620px){.feature-bubble{inset-inline-end:10px;width:min(350px,calc(100vw - 20px))}.feature-bubble-body{padding:14px 15px;grid-template-columns:36px 1fr;gap:10px}.feature-bubble-icon{width:36px;height:36px;font-size:18px}.feature-bubble-body b{font-size:13px}.feature-bubble-body small{font-size:12px;line-height:1.55}.feature-bubble-body em{font-size:10px}}
      @media(prefers-reduced-motion:reduce){.feature-bubble{animation:aquaBubbleFade ${BUBBLE_RISE_MS}ms ease forwards}@keyframes aquaBubbleFade{0%,100%{opacity:0}10%,88%{opacity:.95}}}
    `}</style>
  </div>;
}
