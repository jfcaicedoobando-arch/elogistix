import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
export default defineConfig({
  testDir: "./specs", timeout: 45_000, expect: { timeout: 5_000 },
  workers: 1, retries: 0, forbidOnly: Boolean(process.env.CI),
  outputDir: root("test-results/cxp-filters"),
  reporter: [["list"], ["json", { outputFile: root("reports/cxp-filters/results.json") }]],
  webServer: {
    command: "node node_modules/vite/bin/vite.js build --config e2e/visual/cxp-filters/vite.config.ts && node node_modules/vite/bin/vite.js preview --config e2e/visual/cxp-filters/vite.config.ts",
    cwd: root(""), url: "http://127.0.0.1:8103", reuseExistingServer: false,
    stdout: "pipe", stderr: "pipe", timeout: 60_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8103", browserName: "chromium", locale: "es-MX",
    timezoneId: "America/Mexico_City", reducedMotion: "no-preference", serviceWorkers: "block",
    acceptDownloads: false, screenshot: "only-on-failure", trace: "retain-on-failure",
  },
});
