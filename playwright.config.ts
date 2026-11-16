import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test",
  testMatch: "browser.spec.ts",
  workers: 1,
  use: {
    baseURL: process.env.VERITAS_TEST_URL || "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1100 },
    headless: true,
    // APIRequestContext must use the same test identity as browser fetches.
    extraHTTPHeaders:process.env.VERITAS_TEST_TOKEN&&process.env.VERITAS_DEMO_AUTH_UI!=='1'?{Authorization:`Bearer ${process.env.VERITAS_TEST_TOKEN}`}:{},
  },
});
