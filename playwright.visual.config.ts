import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/visual/specs", timeout: 30_000,
  retries: 0, workers: 1, forbidOnly: Boolean(process.env.CI),
  outputDir: "test-results/visual", reporter: [["list"], ["html", { outputFolder: "reports/visual", open: "never" }]],
  snapshotPathTemplate: "{testDir}/../baselines/{projectName}/{arg}{ext}",
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.005 } },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --config vite.visual.config.ts",
    url: "http://127.0.0.1:8087/e2e/visual/index.html", reuseExistingServer: false,
  },
  use: {
    baseURL: "http://127.0.0.1:8087", browserName: "chromium", locale: "es-MX",
    timezoneId: "America/Mexico_City", reducedMotion: "reduce", trace: "retain-on-failure",
  },
  projects: [
    { name: "hd-light", use: { viewport: { width: 1280, height: 720 }, colorScheme: "light" } },
    { name: "hd-dark", use: { viewport: { width: 1280, height: 720 }, colorScheme: "dark" } },
    { name: "compact-light", use: { viewport: { width: 691, height: 763 }, colorScheme: "light" } },
    { name: "compact-dark", use: { viewport: { width: 691, height: 763 }, colorScheme: "dark" } },
  ],
});
