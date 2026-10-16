// @vitest-environment node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkCssBudget, measureCss, readCssBudget } from "../check-css-size.mjs";

const metrics = ["raw", "gzip", "brotli"] as const;
const temporaryRoots: string[] = [];

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "elogistix-css-size-"));
  temporaryRoots.push(root);
  return root;
}

function writeAsset(root: string, file: string, contents: string) {
  const path = join(root, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

// Varied, deterministic valid rules exercise compressed growth as well as raw growth.
function syntheticCss(seed: string, rules: number) {
  return Array.from({ length: rules }, (_, index) => {
    const hash = createHash("sha256").update(`${seed}:${index}`).digest("hex");
    return `.synthetic-${hash}{color:#${hash.slice(0, 6)};--sample:"${hash.slice(6)}"}`;
  }).join("\n");
}

function isolatedCli(root: string, budgets: Record<string, unknown>) {
  const script = join(root, "guard", "check-css-size.mjs");
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(resolve("scripts/check-css-size.mjs"), script);
  writeFileSync(join(dirname(script), "css-size-budget.json"), JSON.stringify(budgets));
  return (...args: string[]) => spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, DIST_DIR: join(root, "dist") },
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("emitted CSS measurement", () => {
  it("includes nested CSS in stable slash-path order and ignores other assets", () => {
    const root = temporaryRoot();
    const first = "a::after{content:'envío'}\n";
    const second = syntheticCss("nested", 24);
    writeAsset(root, "assets/nested/z.css", second);
    writeAsset(root, "assets/a.css", first);
    writeAsset(root, "assets/ignored.css.map", "sourcemap");
    writeAsset(root, "assets/ignored.js", "javascript");

    const report = measureCss(root);
    expect(report.files.map((file) => file.file)).toEqual(["assets/a.css", "assets/nested/z.css"]);
    expect(report.files.map((file) => file.raw)).toEqual([Buffer.byteLength(first), Buffer.byteLength(second)]);
    expect(report.files.map((file) => file.sha256)).toEqual(
      [first, second].map((contents) => createHash("sha256").update(contents).digest("hex")),
    );
    for (const metric of metrics) {
      expect(report.total[metric]).toBe(report.files.reduce((sum, file) => sum + file[metric], 0));
      expect(report.files.every((file) => Number.isSafeInteger(file[metric]) && file[metric] > 0)).toBe(true);
    }
  });

  it("sums independently compressed resources, including the overhead of each response", () => {
    const root = temporaryRoot();
    const first = join(root, "first");
    const second = join(root, "second");
    const combined = join(root, "combined");
    const css = syntheticCss("same-resource", 32);
    writeAsset(first, "a.css", css);
    writeAsset(second, "b.css", css);
    writeAsset(combined, "a.css", css);
    writeAsset(combined, "nested/b.css", css);
    const report = measureCss(combined);
    for (const metric of metrics) {
      expect(report.total[metric]).toBe(measureCss(first).total[metric] + measureCss(second).total[metric]);
    }
  });

  it("rejects a missing directory, a file instead of a directory, and no emitted CSS", () => {
    const root = temporaryRoot();
    writeAsset(root, "asset.js", "javascript");
    expect(() => measureCss(join(root, "missing"))).toThrow();
    expect(() => measureCss(join(root, "asset.js"))).toThrow(/directory/i);
    expect(() => measureCss(root)).toThrow(/No CSS files/i);
  });
});

describe("CSS byte budgets", () => {
  it("loads positive safe integer byte limits from the checked-in policy", () => {
    const budgets = readCssBudget();
    expect(Object.keys(budgets).sort()).toEqual([...metrics].sort());
    for (const metric of metrics) {
      expect(Number.isSafeInteger(budgets[metric])).toBe(true);
      expect(budgets[metric]).toBeGreaterThan(0);
    }
  });

  it("accepts equality for all three exact byte limits", () => {
    const root = temporaryRoot();
    writeAsset(root, "app.css", syntheticCss("boundary", 32));
    const report = measureCss(root);
    expect(checkCssBudget(report, { ...report.total })).toEqual([]);
  });

  it.each(metrics)("rejects a one-byte %s excess without rounding or conflating metrics", (metric) => {
    const root = temporaryRoot();
    writeAsset(root, "app.css", syntheticCss("boundary", 32));
    const report = measureCss(root);
    const limit = report.total[metric] - 1;
    expect(checkCssBudget(report, { ...report.total, [metric]: limit })).toEqual([
      `CSS ${metric}: ${report.total[metric]} bytes exceeds limit ${limit} bytes`,
    ]);
  });
});

describe("CSS guard CLI", () => {
  it("emits the same JSON report and passes exact limits from a different cwd", () => {
    const root = temporaryRoot();
    const dist = join(root, "dist");
    writeAsset(dist, "app.css", syntheticCss("cli", 32));
    const report = measureCss(dist);
    const run = isolatedCli(root, report.total);
    const result = run(dist, "--json");
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual(report);
    const defaultDist = run("--json");
    expect(defaultDist.status).toBe(0);
    expect(JSON.parse(defaultDist.stdout)).toEqual(report);
  });

  it.each(metrics)("fails on synthetic CSS growth in %s and retains its JSON evidence", (metric) => {
    const root = temporaryRoot();
    const dist = join(root, "dist");
    writeAsset(dist, "app.css", syntheticCss("baseline", 32));
    const baseline = measureCss(dist);
    writeAsset(dist, "added.css", syntheticCss("added-resource", 64));
    const grown = measureCss(dist);
    expect(grown.total[metric]).toBeGreaterThan(baseline.total[metric]);
    const run = isolatedCli(root, { ...grown.total, [metric]: baseline.total[metric] });
    const result = run(dist, "--json");
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual(grown);
    expect(result.stderr.trim()).toBe(
      `::error::CSS ${metric}: ${grown.total[metric]} bytes exceeds limit ${baseline.total[metric]} bytes`,
    );
  });

  it.each([
    ["raw", 0], ["gzip", -1], ["brotli", 0.5],
    ["raw", Number.MAX_SAFE_INTEGER + 1], ["gzip", "100"], ["brotli", undefined],
  ])("rejects an invalid %s budget (%s)", (metric, invalid) => {
    const root = temporaryRoot();
    const dist = join(root, "dist");
    writeAsset(dist, "app.css", syntheticCss("invalid-policy", 8));
    const run = isolatedCli(root, { raw: 10000, gzip: 10000, brotli: 10000, [String(metric)]: invalid });
    const result = run(dist, "--json");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`CSS budget ${metric} must be a positive safe integer in bytes`);
  });

  it("fails when the build emitted no CSS instead of accepting zero bytes", () => {
    const root = temporaryRoot();
    mkdirSync(join(root, "dist"));
    const result = isolatedCli(root, { raw: 10000, gzip: 10000, brotli: 10000 })("--json");
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/No CSS files/i);
  });
});
