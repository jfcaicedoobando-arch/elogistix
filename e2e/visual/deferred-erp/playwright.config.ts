import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fromRoot = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
export default defineConfig({
  testDir: "./specs", timeout: 60_000, expect: { timeout: 7_000 },
  workers: 1, retries: 0, forbidOnly: Boolean(process.env.CI),
  outputDir: fromRoot("test-results/deferred-erp"),
  reporter: [["list"], ["html", { outputFolder: fromRoot("reports/deferred-erp/html"), open: "never" }], ["json", { outputFile: fromRoot("reports/deferred-erp/results.json") }]],
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --config e2e/visual/deferred-erp/vite.config.ts",
    cwd: fromRoot(""), url: "http://127.0.0.1:8097", reuseExistingServer: false,
    stdout: "pipe", stderr: "pipe", timeout: 30_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8097", browserName: "chromium", headless: true,
    locale: "es-MX", timezoneId: "America/Mexico_City", reducedMotion: "reduce",
    serviceWorkers: "block", acceptDownloads: false,
    screenshot: "only-on-failure", trace: "retain-on-failure",
    actionTimeout: 10_000, navigationTimeout: 15_000,
    launchOptions: { args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run"] },
  },
  projects: [
    { name: "desktop-1280x720", use: { viewport: { width: 1280, height: 720 } } },
    { name: "mobile-390x640", use: { viewport: { width: 390, height: 640 }, isMobile: true, hasTouch: true } },
  ],
});
