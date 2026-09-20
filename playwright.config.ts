import { defineConfig,devices } from "@playwright/test";

export default defineConfig({
  testDir:"./e2e",
  timeout:55_000,
  expect:{timeout:10_000},
  fullyParallel:false,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?"line":"list",
  use:{
    baseURL:"http://127.0.0.1:3000",
    trace:"retain-on-failure",
    screenshot:"only-on-failure",
    video:"retain-on-failure"
  },
  projects:[
    {name:"desktop-chromium",use:{...devices["Desktop Chrome"]}},
    {name:"android-chromium",use:{...devices["Pixel 5"]}},
    {name:"iphone-webkit",use:{...devices["iPhone 13"]}}
  ],
  webServer:{
    command:"npm run dev -- --hostname 127.0.0.1",
    url:"http://127.0.0.1:3000",
    reuseExistingServer:!process.env.CI,
    timeout:120_000
  }
});
