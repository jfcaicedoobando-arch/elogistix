import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
export default defineConfig({
  testDir: "./specs", timeout: 45_000, expect: { timeout: 5_000 },
  workers: 1, retries: 0, forbidOnly: Boolean(process.env.CI),
  outputDir: root("test-results/audit136-137"),
  reporter: [["list"], ["json", { outputFile: root("reports/audit136-137/results.json") }]],
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --config e2e/visual/audit136-137/vite.config.ts",
    cwd: root(""), url: "http://127.0.0.1:8097", reuseExistingServer: false,
    stdout: "pipe", stderr: "pipe", timeout: 30_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8097", browserName: "chromium", locale: "es-MX",
    timezoneId: "America/Mexico_City", reducedMotion: "reduce", serviceWorkers: "block",
    acceptDownloads: false, screenshot: "only-on-failure", trace: "retain-on-failure",
    actionTimeout: 10_000, navigationTimeout: 15_000,
    launchOptions: { args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run"] },
  },
});
