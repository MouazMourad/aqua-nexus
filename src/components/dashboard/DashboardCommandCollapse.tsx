"use client";

import { useEffect } from "react";

/**
 * Dashboard progressive-disclosure polish:
 * - keeps Today collapsed to one glanceable summary row by default
 * - leaves the emergency console always visible
 * - turns Share/Customize into floating sheets instead of inline content
 * - keeps the floating Local Best AI control out of the way on mobile
 */
export function DashboardCommandCollapse(){
  useEffect(()=>{
    const placeCommandLayer=()=>{
      const dashboard=document.querySelector<HTMLElement>(".progressive-dashboard");
      const mount=document.getElementById("aqua-command-layer-mount");
      const moduleGrid=dashboard?.querySelector<HTMLElement>(".pd-module-grid");
      if(!dashboard||!mount||!moduleGrid)return;
      if(mount.nextElementSibling!==moduleGrid)dashboard.insertBefore(mount,moduleGrid);
    };

    const refreshGlance=(panel:HTMLElement)=>{
      const head=panel.querySelector<HTMLElement>(".command-head");
      if(!head)return;
      let glance=panel.querySelector<HTMLElement>(".aqua-command-glance");
      if(!glance){
        glance=document.createElement("div");
        glance.className="aqua-command-glance";
        head.insertAdjacentElement("afterend",glance);
      }
      const isArabic=Boolean(panel.closest('[dir="rtl"]'));
      const clear=Boolean(panel.querySelector(".today-clear"));
      const count=clear?0:panel.querySelectorAll(".today-actions button").length;
      const confidence=panel.querySelector<HTMLElement>(".confidence-pill b")?.textContent?.trim()||"—";
      const taskText=isArabic
        ? (count===0?"لا مهام ضرورية اليوم":count===1?"1 مهمة اليوم":`${count} مهام اليوم`)
        : (count===0?"No required tasks today":count===1?"1 task today":`${count} tasks today`);
      const html=`<span>${count===0?"✓":"◎"}</span><b>${taskText}</b><em>${isArabic?"ثقة":"Confidence"} ${confidence}</em>`;
      if(glance.innerHTML!==html)glance.innerHTML=html;
    };

    const bindCommand=(panel:HTMLElement)=>{
      refreshGlance(panel);
      if(panel.dataset.aquaCollapsible==="1")return;
      const head=panel.querySelector<HTMLElement>(".command-head");
      if(!head)return;

      panel.dataset.aquaCollapsible="1";
      panel.classList.add("aqua-command-collapsed");
      head.setAttribute("role","button");
      head.setAttribute("tabindex","0");
      head.setAttribute("aria-expanded","false");

      const toggle=()=>{
        const opening=panel.classList.contains("aqua-command-collapsed");
        panel.classList.toggle("aqua-command-collapsed",!opening);
        panel.classList.toggle("aqua-command-expanded",opening);
        head.setAttribute("aria-expanded",String(opening));
      };
      const onKey=(event:KeyboardEvent)=>{
        if(event.key!=="Enter"&&event.key!==" ")return;
        event.preventDefault();
        toggle();
      };
      head.addEventListener("click",toggle);
      head.addEventListener("keydown",onKey);
    };

    const closeSheets=()=>{
      const share=document.querySelector<HTMLElement>(".pd-inline-share");
      if(share)share.querySelector<HTMLButtonElement>(".icon-btn")?.click();
      const customize=document.querySelector<HTMLElement>(".pd-customizer");
      if(customize)document.querySelector<HTMLButtonElement>(".pd-customize-wrap .btn")?.click();
    };

    const syncSheets=()=>{
      const sheets=[...document.querySelectorAll<HTMLElement>(".pd-inline-share,.pd-customizer")];
      sheets.forEach(sheet=>sheet.classList.add("aqua-floating-sheet"));

      const customize=document.querySelector<HTMLElement>(".pd-customizer");
      if(customize&&!customize.querySelector(".aqua-sheet-close")){
        const head=customize.querySelector<HTMLElement>(".module-head")||customize;
        const close=document.createElement("button");
        close.type="button";
        close.className="icon-btn aqua-sheet-close";
        close.setAttribute("aria-label","Close");
        close.textContent="×";
        close.addEventListener("click",()=>document.querySelector<HTMLButtonElement>(".pd-customize-wrap .btn")?.click());
        head.appendChild(close);
      }

      let backdrop=document.querySelector<HTMLButtonElement>(".aqua-sheet-backdrop");
      if(sheets.length){
        document.body.classList.add("aqua-sheet-open");
        const backdropHost=sheets[0]?.parentElement??document.body;
        if(!backdrop){
          backdrop=document.createElement("button");
          backdrop.type="button";
          backdrop.className="aqua-sheet-backdrop";
          backdrop.setAttribute("aria-label","Close panel");
          backdrop.addEventListener("click",closeSheets);
        }
        // Keep the overlay in the same stacking context as the floating sheet.
        // A body-level backdrop can cover/blur fixed descendants on iOS Safari.
        if(backdrop.parentElement!==backdropHost)backdropHost.appendChild(backdrop);
      }else{
        document.body.classList.remove("aqua-sheet-open");
        backdrop?.remove();
      }
    };

    const scan=()=>{
      placeCommandLayer();
      document.querySelectorAll<HTMLElement>(".aqua-command-center").forEach(bindCommand);
      syncSheets();
    };

    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"&&document.body.classList.contains("aqua-sheet-open"))closeSheets();
    };
    window.addEventListener("keydown",onKeyDown);
    scan();
    const observer=new MutationObserver(scan);
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
    return()=>{
      observer.disconnect();
      window.removeEventListener("keydown",onKeyDown);
      document.body.classList.remove("aqua-sheet-open");
      document.querySelector(".aqua-sheet-backdrop")?.remove();
    };
  },[]);

  return <style jsx global>{`
    .aqua-command-center[data-aqua-collapsible="1"]{transition:border-color .18s ease,box-shadow .18s ease}
    .aqua-command-center[data-aqua-collapsible="1"] .command-head{cursor:pointer;position:relative;outline:none;border-radius:12px}
    .aqua-command-center[data-aqua-collapsible="1"] .command-head:focus-visible{box-shadow:0 0 0 2px rgba(83,218,255,.45)}
    .aqua-command-center[data-aqua-collapsible="1"] .command-head:after{content:"−";width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);font-size:19px;font-weight:900;line-height:1;color:#aeefff;margin-inline-start:7px}
    .aqua-command-glance{display:none}
    .aqua-command-center.aqua-command-collapsed{padding:12px 14px!important;overflow:hidden}
    .aqua-command-center.aqua-command-collapsed .command-head:after{content:"+"}
    .aqua-command-center.aqua-command-collapsed .confidence-pill,
    .aqua-command-center.aqua-command-collapsed .today-actions,
    .aqua-command-center.aqua-command-collapsed .command-grid,
    .aqua-command-center.aqua-command-collapsed .quick-log,
    .aqua-command-center.aqua-command-collapsed .quick-note,
    .aqua-command-center.aqua-command-collapsed .smart-followup{display:none!important}
    .aqua-command-center.aqua-command-collapsed .aqua-command-glance{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:8px;margin-top:9px;padding:10px 11px;border:1px solid rgba(77,211,244,.12);border-radius:12px;background:rgba(70,197,232,.045)}
    .aqua-command-glance>span{width:24px;height:24px;display:grid;place-items:center;border-radius:8px;background:rgba(91,224,167,.09);color:#79e4b0;font-weight:900}
    .aqua-command-glance>b{font-size:12px;line-height:1.3}
    .aqua-command-glance>em{font-size:11px;font-style:normal;color:#79e4b0;white-space:nowrap}
    .aqua-command-center.aqua-command-expanded{border-color:rgba(83,218,255,.22)!important;box-shadow:0 14px 34px rgba(0,0,0,.16)}

    .aqua-sheet-backdrop{position:fixed;inset:0;z-index:8390;border:0;background:rgba(0,9,15,.52);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);padding:0;margin:0;width:100vw;height:100dvh;cursor:default}
    body.aqua-sheet-open{overflow:hidden}
    .pd-inline-share.aqua-floating-sheet,.pd-customizer.aqua-floating-sheet{position:fixed!important;z-index:8400!important;left:50%!important;right:auto!important;bottom:max(18px,env(safe-area-inset-bottom))!important;top:auto!important;transform:translateX(-50%);width:min(720px,calc(100vw - 24px));max-height:min(78dvh,760px);overflow:auto;margin:0!important;border-color:rgba(77,213,244,.34)!important;background:linear-gradient(180deg,rgba(9,35,49,.995),rgba(5,24,35,.998))!important;box-shadow:0 30px 90px rgba(0,0,0,.58),0 0 34px rgba(51,200,235,.08)!important;isolation:isolate;animation:aquaSheetUp .2s ease-out}
    .pd-inline-share.aqua-floating-sheet>.module-head,.pd-customizer.aqua-floating-sheet>.module-head{position:sticky;top:0;z-index:2;padding-bottom:9px;background:linear-gradient(180deg,rgba(7,30,43,.98) 74%,rgba(7,30,43,0));backdrop-filter:blur(10px)}
    .aqua-sheet-close{margin-inline-start:6px;flex:0 0 34px}
    body.aqua-sheet-open .aqua-ai-shell{opacity:0!important;pointer-events:none!important}
    @keyframes aquaSheetUp{from{opacity:0;transform:translate(-50%,18px) scale(.985)}to{opacity:1;transform:translate(-50%,0) scale(1)}}

    @media(max-width:760px){
      .app-shell{padding-bottom:max(92px,calc(78px + env(safe-area-inset-bottom)))}
      .aqua-command-center.aqua-command-collapsed{padding:11px 12px!important}
      .aqua-command-center[data-aqua-collapsible="1"] .command-head{gap:8px;align-items:center}
      .aqua-command-center[data-aqua-collapsible="1"] .command-head:after{width:26px;height:26px;flex-basis:26px;font-size:18px;margin-inline-start:2px}
      .aqua-command-center.aqua-command-collapsed .command-head h3{font-size:18px;margin-top:2px}
      .aqua-command-center.aqua-command-collapsed .aqua-command-glance{grid-template-columns:24px 1fr auto;padding:9px 10px}
      .aqua-command-glance>b{font-size:11px}.aqua-command-glance>em{font-size:10px}
      .aqua-sheet-backdrop{background:rgba(0,9,15,.48);backdrop-filter:none;-webkit-backdrop-filter:none}
      .pd-inline-share.aqua-floating-sheet,.pd-customizer.aqua-floating-sheet{bottom:0!important;width:100vw;max-height:84dvh;border-radius:24px 24px 0 0!important;padding-bottom:max(16px,env(safe-area-inset-bottom))!important}
      .pd-customizer.aqua-floating-sheet .pd-custom-list{grid-template-columns:1fr!important}
      .aqua-ai-fish-button{width:70px!important;height:52px!important;border-radius:18px!important}
      .aqua-ai-fish-label{font-size:7px!important;bottom:3px!important}
      .aqua-ai-shell{inset-inline-end:8px!important;bottom:max(10px,env(safe-area-inset-bottom))!important}
    }
  `}</style>;
}
