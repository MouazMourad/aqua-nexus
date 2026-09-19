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
  await page.mouse.move(box.x+box.width*.35,box.y+box.height*.45);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.78,box.y+box.height*.22,{steps:5});
  await page.mouse.up();
  await expect.poll(()=>dot.getAttribute("style")).not.toBe(before);
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
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+24,box.y+box.height/2+10,{steps:4});
  await page.mouse.up();
  await expect.poll(()=>chamber.getAttribute("style")).not.toBe(before);
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
