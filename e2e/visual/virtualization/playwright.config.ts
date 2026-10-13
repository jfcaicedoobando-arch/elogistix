import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
export default defineConfig({
  testDir: "./specs", timeout: 45_000, expect: { timeout: 8_000 },
  workers: 1, retries: 0, forbidOnly: Boolean(process.env.CI),
  outputDir: root("test-results/virtualization"),
  reporter: [["list"], ["json", { outputFile: root("reports/virtualization/results.json") }]],
  webServer: {
    // A failed fresh build must never fall back to a previous compiled fixture.
    command: "node node_modules/vite/bin/vite.js build --config e2e/visual/virtualization/vite.config.ts && node node_modules/vite/bin/vite.js preview --config e2e/visual/virtualization/vite.config.ts",
    cwd: root(""), url: "http://127.0.0.1:8098", reuseExistingServer: false,
    stdout: "pipe", stderr: "pipe", timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  use: {
    baseURL: "http://127.0.0.1:8098", locale: "es-MX", timezoneId: "America/Mexico_City",
    reducedMotion: "reduce", serviceWorkers: "block", acceptDownloads: false,
    screenshot: "only-on-failure", trace: "retain-on-failure",
    actionTimeout: 10_000, navigationTimeout: 15_000,
  },
});
