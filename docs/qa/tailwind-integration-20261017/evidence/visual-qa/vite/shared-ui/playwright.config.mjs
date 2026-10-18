import assert from 'node:assert/strict';
import original from "file:///C:/Users/torta/Documents/Codex/2026-10-17/task-6/elogistix-tailwind4/playwright.visual.config.ts";
assert.equal(original.workers, 1);
assert.equal(original.retries, 0);
assert.ok(!original.use?.channel && !(original.projects ?? []).some(project => project.use?.channel), 'Only managed Playwright browsers');
export default {
  ...original,
  testDir: "C:\\Users\\torta\\Documents\\Codex\\2026-10-17\\task-6\\elogistix-tailwind4\\e2e\\visual\\specs",
  outputDir: "C:\\Users\\torta\\Documents\\Codex\\2026-10-17\\task-6\\elogistix-tailwind4\\reports\\tailwind-integration\\ui-full-20261017\\vite\\shared-ui\\test-results",
  reporter: [['list'], ['json', { outputFile: "C:\\Users\\torta\\Documents\\Codex\\2026-10-17\\task-6\\elogistix-tailwind4\\reports\\tailwind-integration\\ui-full-20261017\\vite\\shared-ui\\results.json" }], ['html', { outputFolder: "C:\\Users\\torta\\Documents\\Codex\\2026-10-17\\task-6\\elogistix-tailwind4\\reports\\tailwind-integration\\ui-full-20261017\\vite\\shared-ui\\html", open: 'never' }]],
  webServer: {
    ...(Array.isArray(original.webServer) ? {} : original.webServer),
    command: "\"C:\\Users\\torta\\Documents\\Codex\\2026-10-17\\task-6\\.tools\\node.exe\" \"C:\\Users\\torta\\Documents\\Codex\\2026-10-17\\task-6\\elogistix-tailwind4\\docs\\qa\\tailwind-integration-20261017\\ui-server.mjs\" \"--variant\" \"vite\" \"--suite\" \"shared-ui\" \"--port\" \"50053\" \"--output\" \"C:\\Users\\torta\\Documents\\Codex\\2026-10-17\\task-6\\elogistix-tailwind4\\reports\\tailwind-integration\\ui-full-20261017\\vite\\shared-ui\"", cwd: "C:\\Users\\torta\\Documents\\Codex\\2026-10-17\\task-6\\elogistix-tailwind4\\",
    url: "http://127.0.0.1:50053/e2e/visual/index.html",
    reuseExistingServer: false, timeout: 180000, stdout: 'pipe', stderr: 'pipe',
  },
  use: { ...original.use, baseURL: "http://127.0.0.1:50053", serviceWorkers: 'block', acceptDownloads: false },
};
