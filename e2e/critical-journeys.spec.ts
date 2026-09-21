import { expect,test,type Page } from "@playwright/test";

async function openTrainingDashboard(page:Page){
  await page.goto("/");
  const training=page.locator(".training-entry-card").first();
  const dashboard=page.locator(".progressive-dashboard");
  await expect.poll(async()=>Boolean(await dashboard.isVisible().catch(()=>false)||await training.isVisible().catch(()=>false)),{timeout:15_000}).toBe(true);
  if(await training.isVisible().catch(()=>false))await training.click();
  await expect(dashboard).toBeVisible({timeout:15_000});
}


async function goToPage(page:Page,key:string){
  const direct=page.locator(`[data-aqua-page="${key}"]`).first();
  if(await direct.isVisible().catch(()=>false)){await direct.click();return;}
  const more=page.getByRole("button",{name:/كل الوحدات|All modules/}).first();
  await more.click();
  const target=page.locator(`[data-aqua-page="${key}"]`).first();
  await expect(target).toBeVisible();
  await target.click();
}

async function pointerDrag(page:Page,downSelector:string,moveSelector:string,from:{x:number;y:number},to:{x:number;y:number},pointerId:number){
  await page.evaluate(({downSelector,moveSelector,from,to,pointerId})=>{
    const down=document.querySelector(downSelector) as HTMLElement|null;
    const move=document.querySelector(moveSelector) as HTMLElement|null;
    if(!down||!move)throw new Error(`Pointer drag target missing: ${downSelector} / ${moveSelector}`);
    const downRect=down.getBoundingClientRect(),moveRect=move.getBoundingClientRect();
    const point=(rect:DOMRect,p:{x:number;y:number})=>({clientX:rect.left+rect.width*p.x,clientY:rect.top+rect.height*p.y});
    const start=point(downRect,from),end=point(moveRect,to);
    const fire=(target:HTMLElement,type:string,p:{clientX:number;clientY:number},buttons:number)=>{
      target.dispatchEvent(new PointerEvent(type,{pointerId,pointerType:"touch",isPrimary:true,bubbles:true,cancelable:true,buttons,...p}));
    };
    fire(down,"pointerdown",start,1);
    fire(move,"pointermove",{clientX:(start.clientX+end.clientX)/2,clientY:(start.clientY+end.clientY)/2},1);
    fire(move,"pointermove",end,1);
    fire(move,"pointerup",end,0);
  },{downSelector,moveSelector,from,to,pointerId});
}

test("dashboard keeps health first and exposes state risk and next action",async({page})=>{
  await openTrainingDashboard(page);
  const hero=page.locator(".pd-hero");
  await expect(hero).toBeVisible();
  await expect(hero.locator(".pd-hero-main")).toBeVisible();
  await expect(hero.locator(".pd-health-score")).toBeVisible();
  await expect(hero.locator(".pd-first-look")).toBeVisible();
  const text=await hero.innerText();
  expect(text).not.toContain("\\n");
  await expect(hero).toContainText(/كيف الحوض|How is the tank/);
  await expect(hero).toContainText(/في خطر|Any risk/);
  await expect(hero).toContainText(/شو أعمل هلا|What should I do now/);
});

test("critical pages open from the real navigation",async({page})=>{
  await openTrainingDashboard(page);
  await goToPage(page,"chemistry");
  await expect(page.locator(".page-grid")).toContainText(/شو وضع الكيمياء فعلياً|What is actually happening with chemistry/);
  await goToPage(page,"maintenance");
  await expect(page.locator(".maintenance-page")).toBeVisible();
  await expect(page.locator(".maintenance-health-card")).toBeVisible();
  await goToPage(page,"livestock");
  await expect(page.locator(".page-grid")).toContainText(/توافق الكائنات الحالية|Current livestock compatibility/);
});

test("maintenance controls stay compact and disease category filters keep results",async({page})=>{
  await openTrainingDashboard(page);
  await goToPage(page,"maintenance");
  const complete=page.locator(".maintenance-complete-btn").first();
  await expect(complete).toBeVisible();
  const box=await complete.boundingBox();
  expect(box).not.toBeNull();
  if(box){expect(box.width).toBeLessThan(120);expect(box.height).toBeGreaterThanOrEqual(40);}

  await goToPage(page,"diseases");
  const category=page.locator('.filter-bar select').nth(1);
  await expect(category.locator('option[value="fish"]')).toHaveCount(1);
  await category.selectOption("fish");
  await expect(page.locator(".disease-card").first()).toBeVisible();
  await expect(page.locator(".disease-card")).not.toHaveCount(0);
});

test("equipment touch placement previews then commits on release",async({page})=>{
  await openTrainingDashboard(page);
  await goToPage(page,"equipment");
  const device=page.locator(".layout-device-btn").filter({hasText:"lighting"}).first();
  await expect(device).toBeVisible();
  await device.click();
  const pad=page.locator(".touch-position-pad").first();
  await expect(pad).toBeVisible();
  const dot=pad.locator(".touch-device-dot");
  const before=await dot.getAttribute("style");
  const padSelector=".touch-position-pad:not(.front)";
  await pointerDrag(page,padSelector,padSelector,{x:.35,y:.45},{x:.78,y:.22},41);
  await expect.poll(()=>dot.getAttribute("style"),{timeout:8_000}).not.toBe(before);
});

test("sump chamber touch editor changes geometry without page failure",async({page})=>{
  await openTrainingDashboard(page);
  await goToPage(page,"sump");
  const plan=page.locator(".sump-touch-plan");
  await expect(plan).toBeVisible();
  const chamber=plan.locator(".sump-touch-chamber").first();
  await expect(chamber).toBeVisible();
  const before=await chamber.getAttribute("style");
  await pointerDrag(page,".sump-touch-chamber",".sump-touch-plan",{x:.5,y:.5},{x:.72,y:.68},42);
  await expect.poll(()=>chamber.getAttribute("style"),{timeout:8_000}).not.toBe(before);
});


test("visual health intake is discoverable from diseases, analyzes locally and exposes safe AI second opinion",async({page})=>{
  await openTrainingDashboard(page);
  await goToPage(page,"diseases");
  await page.getByRole("button",{name:/تحليل صورة|Analyze photo/}).first().click();
  const visual=page.locator(".card.panel").filter({hasText:/Local Best Visual Insight/}).first();
  await expect(visual).toBeVisible();

  const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nXcAAAAASUVORK5CYII=","base64");
  await visual.locator('input[type="file"]').first().setInputFiles({name:"vision-test.png",mimeType:"image/png",buffer:png});
  await expect(visual).toContainText(/ماذا ألاحظ|WHAT I NOTICE/,{timeout:15_000});
  await expect(visual).toContainText(/مستوى الثقة|CONFIDENCE LEVEL/);

  const secondOpinion=visual.getByRole("button",{name:/AI Vision/}).first();
  await expect(secondOpinion).toBeVisible();
  await secondOpinion.click();
  await expect(visual).toContainText(/مزود AI Vision|external AI Vision provider|رأي ثانٍ|second opinion/,{timeout:15_000});
});

test("new wizard tank enters biological cycling and locks non-cycle workflows",async({page})=>{
  await page.goto("/");
  await page.locator(".empty-tank-cta").click();
  const modal=page.locator(".modal-card");
  await expect(modal).toBeVisible();
  await modal.locator('input').first().fill("E2E Cycling Tank");
  for(let i=0;i<6;i++){
    await modal.locator(".modal-actions .btn.primary").click();
    await page.waitForTimeout(40);
  }
  await expect(modal).toContainText(/الدورة البيولوجية ستبدأ تلقائياً|Biological Cycling Mode will start automatically/);
  await modal.locator(".modal-actions .btn.primary").click();

  await expect(page.locator(".cycle-panel")).toContainText(/الدورة البيولوجية|Biological cycle/);
  await expect(page.locator(".cycle-panel")).toContainText(/اليوم 1|day 1/i);
  await expect(page.locator(".progressive-dashboard")).toHaveCount(0);
  await expect(page.locator(".pd-health-score")).toHaveCount(0);
  await expect(page.locator(".cycle-global-banner")).toHaveCount(0);
  await page.getByRole("button",{name:/كل الوحدات|All modules/}).click();
  await expect(page.locator('[data-aqua-page="livestock"]')).toBeDisabled();
  await expect(page.locator('[data-aqua-page="feeding"]')).toBeDisabled();
  await expect(page.locator('[data-aqua-page="dosing"]')).toBeDisabled();
  await expect(page.locator('[data-aqua-page="chemistry"]')).toBeEnabled();
  await expect(page.locator('[data-aqua-page="maintenance"]')).toBeEnabled();

  await goToPage(page,"maintenance");
  await expect(page.locator(".maintenance-page")).toContainText(/Cycle-only mode/);
  await expect(page.locator(".maintenance-page")).toContainText(/الدورة البيولوجية|Biological cycle/);
});


test("progressive navigation keeps every module reachable and supports keyboard search",async({page})=>{
  await openTrainingDashboard(page);
  await expect(page.getByRole("button",{name:/بحث في Aqua Nexus|Search Aqua Nexus/})).toBeVisible();
  await expect(page.locator('[data-aqua-page="chemistry"]')).toBeVisible();
  await expect(page.locator('[data-aqua-page="diseases"]')).toHaveCount(0);
  await page.getByRole("button",{name:/كل الوحدات|All modules/}).click();
  await expect(page.locator('[data-aqua-page="diseases"]')).toBeVisible();
  await page.getByRole("button",{name:"Close"}).click();

  await page.keyboard.press("Control+K");
  const dialog=page.getByRole("dialog",{name:/بحث وأدوات Aqua Nexus|Aqua Nexus search and tools/});
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-quick-action="chemistry"]')).toBeVisible();
  await dialog.locator("input").fill("lighting");
  await expect(dialog.locator('[data-command-kind="equipment"]').first()).toBeVisible();
  await dialog.locator("input").fill("RO/DI");
  await dialog.locator('[data-command-page="rodi"]').first().click();
  await expect(page.locator(".page-grid")).toContainText(/RO\/DI/);

  await page.getByRole("button",{name:/إجراءات سريعة|Quick actions/}).click();
  const quick=page.getByRole("dialog",{name:/بحث وأدوات Aqua Nexus|Aqua Nexus search and tools/});
  await quick.locator('[data-quick-action="chemistry"]').click();
  await expect(page.locator(".page-grid")).toContainText(/شو وضع الكيمياء فعلياً|What is actually happening with chemistry/);
});


test("IndexedDB persistence survives reload without keeping the tank JSON in localStorage",async({page})=>{
  await openTrainingDashboard(page);
  await goToPage(page,"expenses");
  const panel=page.locator(".card.panel").first();
  await panel.locator('input').nth(0).fill("IndexedDB Persistence Probe");
  await panel.locator('input[type="number"]').fill("12.34");
  await panel.getByRole("button",{name:/إضافة مصروف|Add expense/}).click();
  await expect(page.locator(".history-list")).toContainText("IndexedDB Persistence Probe");
  await page.waitForTimeout(500);
  const legacy=await page.evaluate(()=>localStorage.getItem("aqua-nexus-3d-v1"));
  expect(legacy).toBeNull();

  await page.reload();
  await openTrainingDashboard(page);
  await goToPage(page,"expenses");
  await expect(page.locator(".history-list")).toContainText("IndexedDB Persistence Probe");
});

test("maintenance checklist is a guided step workflow and cannot be bypassed",async({page})=>{
  await openTrainingDashboard(page);
  await goToPage(page,"equipment");
  await expect(page.locator(".page-grid")).toBeVisible();
  await page.waitForTimeout(250);
  await goToPage(page,"maintenance");

  const stepsButton=page.locator(".maintenance-checklist-btn").first();
  await expect(stepsButton).toBeVisible();
  await stepsButton.click();

  const workflow=page.locator(".maintenance-step-workflow");
  await expect(workflow).toBeVisible();
  await expect(workflow.locator(".maintenance-progress-ring")).toBeVisible();
  await expect(workflow.locator(".maintenance-step-card").first()).toBeVisible();
  const finish=workflow.locator(".maintenance-finish-workflow");
  await expect(finish).toBeDisabled();

  await workflow.locator(".maintenance-step-card").first().click();
  await expect(workflow.locator(".maintenance-step-card").first()).toHaveClass(/is-done/);
});

test("dirty local fallback wins over stale IndexedDB and repairs durable storage",async({page})=>{
  await openTrainingDashboard(page);
  await page.waitForTimeout(600);
  const seeded=await page.evaluate(async()=>{
    const key="aqua-nexus-3d-v1";
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("aqua-nexus-state-v1",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const raw=await new Promise<string>((resolve,reject)=>{const tx=db.transaction("zustand","readonly"),r=tx.objectStore("zustand").get(key);r.onsuccess=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close()});
    const parsed=JSON.parse(raw);
    parsed.state.tanks[0].name="Recovery Fallback Probe";
    const newer=JSON.stringify(parsed);
    localStorage.setItem(key,newer);
    localStorage.setItem(key+":fallback-dirty","1");
    return raw!==newer;
  });
  expect(seeded).toBe(true);
  await page.reload();
  await page.waitForTimeout(900);
  const repaired=await page.evaluate(async()=>{
    const key="aqua-nexus-3d-v1";
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("aqua-nexus-state-v1",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const raw=await new Promise<string>((resolve,reject)=>{const tx=db.transaction("zustand","readonly"),r=tx.objectStore("zustand").get(key);r.onsuccess=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close()});
    return{rawName:JSON.parse(raw).state.tanks[0].name,dirty:localStorage.getItem(key+":fallback-dirty"),fallback:localStorage.getItem(key)};
  });
  expect(repaired.rawName).toBe("Recovery Fallback Probe");
  expect(repaired.dirty).toBeNull();
  expect(repaired.fallback).toBeNull();
});

test("verified two-year archive keeps old events searchable while shrinking hot history",async({page})=>{
  await openTrainingDashboard(page);
  await page.waitForTimeout(600);
  await page.evaluate(async()=>{
    const key="aqua-nexus-3d-v1";
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("aqua-nexus-state-v1",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    const raw=await new Promise<string>((resolve,reject)=>{const tx=db.transaction("zustand","readonly"),r=tx.objectStore("zustand").get(key);r.onsuccess=()=>resolve(String(r.result||""));r.onerror=()=>reject(r.error)});
    const parsed=JSON.parse(raw),source=structuredClone(parsed.state.tanks[0]),old="2020-01-01T00:00:00.000Z";
    source.id="archive-e2e";source.name="Archive E2E";source.isTraining=false;
    source.timeline=[{id:"archive-old-timeline",timestamp:old,type:"manual",textAr:"حدث أرشيف قديم",textEn:"Very old archive event"},...(source.timeline||[])];
    source.intelligenceEvents=[{id:"archive-old-intel",timestamp:old,kind:"fact",domain:"system",verb:"old_event",confidence:100,sourcePage:"timeline",textAr:"ذاكرة أرشيف قديمة",textEn:"Very old archive memory"},...(source.intelligenceEvents||[])];
    parsed.state.tanks=[...parsed.state.tanks.filter((x:any)=>x.id!=="archive-e2e"),source];
    parsed.state.selectedTankId=source.id;
    const next=JSON.stringify(parsed);
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction("zustand","readwrite"),r=tx.objectStore("zustand").put(next,key);r.onerror=()=>reject(r.error);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)});
  });
  await page.reload();
  await openTrainingDashboard(page);
  await goToPage(page,"timeline");
  await expect(page.locator(".timeline")).toContainText(/Very old archive event|حدث أرشيف قديم/);
  await page.getByRole("button",{name:/أرشفة القديم|Archive old history/}).click();
  await expect(page.locator(".page-grid")).toContainText(/تم نقل التاريخ الأقدم|History older than two years/);
  await expect(page.locator(".timeline")).toContainText(/Very old archive event|حدث أرشيف قديم/);
  const archived=await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("aqua-nexus-history-v1",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
    return await new Promise<number>((resolve,reject)=>{const tx=db.transaction("tank-history","readonly"),r=tx.objectStore("tank-history").get("archive-e2e");r.onsuccess=()=>resolve((r.result?.timeline?.length||0)+(r.result?.intelligenceEvents?.length||0));r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close()});
  });
  expect(archived).toBeGreaterThanOrEqual(2);
});

test("high-risk decision pages expose a consistent What Why Next Safety pattern",async({page})=>{
  await openTrainingDashboard(page);
  for(const key of ["dosing","waterchange","rodi","maintenance","acclimation"]){
    await goToPage(page,key);
    const guidance=page.locator(".decision-guidance").first();
    await expect(guidance).toBeVisible();
    await expect(guidance).toContainText("WHAT");
    await expect(guidance).toContainText("WHY");
    await expect(guidance).toContainText("NEXT");
  }
});

