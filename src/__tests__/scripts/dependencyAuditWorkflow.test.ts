// @vitest-environment node
import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const read = (file: string) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const workflow=read("scripts/ci/dependency-audit-manual.sh");
const job=workflow;
const config=read("e2e/visual/dependency-audit/playwright.config.ts");
const guard=read("scripts/ci/dependency-audit-report.mjs");
const passingReport = {
  stats: { expected: 4, unexpected: 0, skipped: 0, flaky: 0 },
  errors: [],
};

function runGuard(report: unknown, raw = false) {
  const directory = mkdtempSync(join(tmpdir(), "dependency-audit-guard-"));
  try {
    if (report !== undefined) {
      mkdirSync(join(directory, "reports/dependency-audit"), { recursive: true });
      writeFileSync(join(directory, "reports/dependency-audit/browser.json"), raw ? String(report) : JSON.stringify(report));
    }
    return spawnSync(process.execPath, ["--input-type=module", "-"], {
      cwd: directory, input: guard, encoding: "utf8", timeout: 10_000,
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("dependency audit isolated browser execution", () => {
  it("runs the exact demo with the existing setup and lockfile Chromium in a PR job", () => {
    expect(job).toContain("node node_modules/@playwright/test/cli.js install --with-deps chromium");
    expect(job).toContain("node node_modules/typescript/bin/tsc -p e2e/visual/dependency-audit/tsconfig.json");
    expect(job).toContain("node node_modules/eslint/bin/eslint.js --no-cache e2e/visual/dependency-audit");
    expect(job).toContain("node node_modules/@playwright/test/cli.js test --config e2e/visual/dependency-audit/playwright.config.ts");
    expect(job).not.toMatch(/continue-on-error|secrets\.|supabase|\.env|e2e\/specs/);
    expect(config).toContain('testMatch: "**/dependency-audit/specs/demo.spec.ts"');
    expect(config).toContain("retries: 0");
    expect(config).toContain("forbidOnly: Boolean(process.env.CI)");
  });

  it("builds fresh before preview while preserving the fixture's backend and environment isolation", () => {
    expect(config).toContain("vite.js build --config e2e/visual/dependency-audit/vite.config.ts && node node_modules/vite/bin/vite.js preview");
    expect(config).toContain("reuseExistingServer: false");
    const vite = read("e2e/visual/dependency-audit/vite.config.ts");
    expect(vite).toContain('envDir: here("./empty-env")');
    expect(vite).toContain("publicDir: false");
    expect(vite).toContain('this.error(`Forbidden demo dependencies:');
    expect(config).toContain('serviceWorkers: "block"');
    expect(read("e2e/visual/dependency-audit/specs/demo.spec.ts")).toContain('context.routeWebSocket(/.*/');
  });

  it("runs the exact report validator after browser completion",()=> {
    expect(job).toContain("node scripts/ci/dependency-audit-report.mjs");
    expect(guard).toContain('readFileSync("reports/dependency-audit/browser.json", "utf8")');
  });

  it("accepts the complete four-case report", () => {
    expect(guard).not.toBe("");
    const result = runGuard(passingReport);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
  });

  it.each([
    ["missing case", { ...passingReport, stats: { ...passingReport.stats, expected: 3 } }],
    ["extra case", { ...passingReport, stats: { ...passingReport.stats, expected: 5 } }],
    ["unexpected failure", { ...passingReport, stats: { ...passingReport.stats, unexpected: 1 } }],
    ["skipped case", { ...passingReport, stats: { ...passingReport.stats, skipped: 1 } }],
    ["flaky case", { ...passingReport, stats: { ...passingReport.stats, flaky: 1 } }],
    ["global error", { ...passingReport, errors: [{ message: "synthetic teardown error" }] }],
    ["missing error inventory", { stats: passingReport.stats }],
  ])("rejects a report with %s", (_label, report) => {
    const result = runGuard(report);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).not.toBe(0);
    expect(result.stderr).toContain("Expected 4 passing dependency GUI cases");
  });

  it.each([
    ["missing report", undefined],
    ["malformed report", "{not-json"],
  ])("fails closed for a %s", (_label, report) => {
    const result = runGuard(report, true);
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).not.toBe(0);
  });
});
