import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser", workers: 1, timeout: 60000,
  use: { baseURL: "http://127.0.0.1:8020", viewport: {width:1280,height:900}, screenshot:"only-on-failure", trace:"retain-on-failure" },
  outputDir: "/tmp/neighbourly-browser-results", reporter: "list",
});
