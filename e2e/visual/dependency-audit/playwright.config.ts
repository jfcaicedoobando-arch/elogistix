import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
export default defineConfig({
  testDir: "./specs", testMatch: "**/dependency-audit/specs/demo.spec.ts",
  workers: 1, retries: 0, forbidOnly: Boolean(process.env.CI),
  outputDir: root("test-results/dependency-audit"),
  reporter: [["list"], ["json", { outputFile: root("reports/dependency-audit/browser.json") }]],
  webServer: {
    // A failed fresh build must not serve a previously compiled fixture.
    command: "node node_modules/vite/bin/vite.js build --config e2e/visual/dependency-audit/vite.config.ts && node node_modules/vite/bin/vite.js preview --config e2e/visual/dependency-audit/vite.config.ts",
    cwd: root(""), url: "http://127.0.0.1:8099", reuseExistingServer: false,
    stdout: "pipe", stderr: "pipe", timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:8099", browserName: "chromium", serviceWorkers: "block",
    trace: "retain-on-failure", screenshot: "only-on-failure",
  },
});
