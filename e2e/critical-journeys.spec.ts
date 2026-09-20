import { expect,test,type Page } from "@playwright/test";

async function openTrainingDashboard(page:Page){
  await page.goto("/");
  const training=page.locator(".training-entry-card").first();
  if(await training.isVisible().catch(()=>false))await training.click();
  await expect(page.locator(".progressive-dashboard")).toBeVisible();
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
  await page.locator('[data-aqua-page="chemistry"]').click();
  await expect(page.locator(".page-grid")).toContainText(/شو وضع الكيمياء فعلياً|What is actually happening with chemistry/);
  await page.locator('[data-aqua-page="maintenance"]').click();
  await expect(page.locator(".maintenance-page")).toBeVisible();
  await expect(page.locator(".maintenance-health-card")).toBeVisible();
  await page.locator('[data-aqua-page="livestock"]').click();
  await expect(page.locator(".page-grid")).toContainText(/توافق الكائنات الحالية|Current livestock compatibility/);
});

test("equipment touch placement previews then commits on release",async({page})=>{
  await openTrainingDashboard(page);
  await page.locator('[data-aqua-page="equipment"]').click();
  const device=page.locator(".layout-device-btn").filter({hasText:"lighting"}).first();
  await expect(device).toBeVisible();
  await device.click();
  const pad=page.locator(".touch-position-pad").first();
  await expect(pad).toBeVisible();
  const dot=pad.locator(".touch-device-dot");
  const before=await dot.getAttribute("style");
  const box=await pad.boundingBox();
  expect(box).not.toBeNull();
  if(!box)return;
  const pointerId=41;
  await pad.dispatchEvent("pointerdown",{pointerId,pointerType:"touch",isPrimary:true,buttons:1,clientX:box.x+box.width*.35,clientY:box.y+box.height*.45,bubbles:true});
  await pad.dispatchEvent("pointermove",{pointerId,pointerType:"touch",isPrimary:true,buttons:1,clientX:box.x+box.width*.78,clientY:box.y+box.height*.22,bubbles:true});
  await expect.poll(()=>dot.getAttribute("style")).not.toBe(before);
  await pad.dispatchEvent("pointerup",{pointerId,pointerType:"touch",isPrimary:true,buttons:0,clientX:box.x+box.width*.78,clientY:box.y+box.height*.22,bubbles:true});
});

test("sump chamber touch editor changes geometry without page failure",async({page})=>{
  await openTrainingDashboard(page);
  await page.locator('[data-aqua-page="sump"]').click();
  const plan=page.locator(".sump-touch-plan");
  await expect(plan).toBeVisible();
  const chamber=plan.locator(".sump-touch-chamber").first();
  await expect(chamber).toBeVisible();
  const before=await chamber.getAttribute("style");
  const box=await chamber.boundingBox();
  expect(box).not.toBeNull();
  if(!box)return;
  const pointerId=42;
  await chamber.dispatchEvent("pointerdown",{pointerId,pointerType:"touch",isPrimary:true,buttons:1,clientX:box.x+box.width/2,clientY:box.y+box.height/2,bubbles:true});
  await plan.dispatchEvent("pointermove",{pointerId,pointerType:"touch",isPrimary:true,buttons:1,clientX:box.x+box.width/2+24,clientY:box.y+box.height/2+10,bubbles:true});
  await expect.poll(()=>chamber.getAttribute("style")).not.toBe(before);
  await plan.dispatchEvent("pointerup",{pointerId,pointerType:"touch",isPrimary:true,buttons:0,clientX:box.x+box.width/2+24,clientY:box.y+box.height/2+10,bubbles:true});
});


test("visual health intake analyzes an image locally and exposes safe AI second opinion",async({page})=>{
  await openTrainingDashboard(page);
  await page.locator('[data-aqua-page="journal"]').click();
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

test("setup defaults do not masquerade as stocking evidence",async({page})=>{
  await page.goto("/");
  await page.locator(".empty-tank-cta").click();
  const modal=page.locator(".modal-card");
  await expect(modal).toBeVisible();
  await modal.locator('input').first().fill("E2E Safety Tank");
  for(let i=0;i<6;i++){
    await modal.locator(".modal-actions .btn.primary").click();
    await page.waitForTimeout(40);
  }
  await modal.locator(".modal-actions .btn.primary").click();
  await expect(page.locator(".progressive-dashboard")).toBeVisible();

  await page.locator('[data-aqua-page="livestock"]').click();
  await page.locator(".page-grid button.btn.primary").first().click();
  const addModal=page.locator(".modal-card");
  await expect(addModal).toBeVisible();
  const selects=addModal.locator("select");
  await selects.nth(1).selectOption({index:1});
  await expect(addModal).toContainText(/بيانات غير كافية|Insufficient evidence|معلومة ناقصة|Missing evidence/);
});
