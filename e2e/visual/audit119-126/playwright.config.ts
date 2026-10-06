import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const fromRoot = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const viewports = [
  { width: 1180, height: 757 }, { width: 1280, height: 720 },
  { width: 691, height: 763 }, { width: 691, height: 420 },
  { width: 390, height: 640 },
];

export default defineConfig({
  testDir: "./specs", timeout: 45_000, expect: { timeout: 5_000 },
  workers: 1, retries: 0, forbidOnly: Boolean(process.env.CI),
  outputDir: fromRoot("test-results/audit119-126"),
  reporter: [
    ["list"],
    ["html", { outputFolder: fromRoot("reports/audit119-126/html"), open: "never" }],
    ["json", { outputFile: fromRoot("reports/audit119-126/results.json") }],
  ],
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --config e2e/visual/audit119-126/vite.config.ts",
    cwd: fromRoot(""), url: "http://127.0.0.1:8096", reuseExistingServer: false,
    stdout: "pipe", stderr: "pipe", timeout: 30_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8096", browserName: "chromium",
    locale: "es-MX", timezoneId: "America/Mexico_City", reducedMotion: "reduce",
    serviceWorkers: "block", acceptDownloads: false,
    screenshot: "only-on-failure", trace: "retain-on-failure",
    actionTimeout: 10_000, navigationTimeout: 15_000,
    launchOptions: { args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run"] },
  },
  projects: viewports.flatMap(viewport => (["light", "dark"] as const).flatMap(colorScheme =>
    [100, 150].map(fontPercent => ({
      name: `${viewport.width}x${viewport.height}-${colorScheme}-${fontPercent}text`,
      metadata: { fontPercent }, use: { viewport, colorScheme },
    })))),
});
