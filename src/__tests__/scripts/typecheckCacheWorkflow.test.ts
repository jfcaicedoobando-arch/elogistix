// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");
const ci = read(".github/workflows/ci.yml");
const checks = ci.split("  checks:\n")[1].split("  tests:\n")[0];
const step = (name: string) => checks.split(`      - name: ${name}\n`)[1]?.split(/(?=^ {6}- name:)/m)[0] ?? "";
const restore = step("Restore TypeScript incremental cache");
const save = step("Save TypeScript incremental cache");
const key = restore.match(/^ {10}key: (.+)$/m)?.[1] ?? "";
const restoreKeys = restore.split("          restore-keys: |\n")[1]?.trim().split("\n").map(line => line.trim()) ?? [];
const patterns = [...(key.match(/hashFiles\(([^)]+)\)/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map(match => match[1]);
const configInputs = () => patterns.flatMap(pattern => pattern === "tsconfig*.json"
  ? readdirSync(".").filter(file => /^tsconfig.*\.json$/.test(file)).sort()
  : [pattern]);
const fingerprint = (changes: Record<string, string> = {}) => {
  const hash = createHash("sha256");
  for (const file of configInputs()) hash.update(file).update("\0").update(changes[file] ?? read(file)).update("\0");
  return hash.digest("hex");
};
const context = {
  "runner.os": "Linux",
  "runner.arch": "X64",
  "steps.setup.outputs.node-version": "v24.22.0",
  "steps.typescript.outputs.version": "6.0.3",
  "github.run_id": "100",
  "github.run_attempt": "1",
};
const expand = (template: string, changes: Record<string, string> = {}, files: Record<string, string> = {}) => template.replace(
  /\$\{\{\s*(.*?)\s*\}\}/g,
  (_, expression: string) => expression.startsWith("hashFiles(") ? fingerprint(files) : ({ ...context, ...changes } as Record<string, string>)[expression],
);

describe("TypeScript incremental cache workflow", () => {
  it("keeps build info outside the shared immutable dependency cache", () => {
    for (const project of ["app", "node"]) {
      const config = read(`tsconfig.${project}.json`);
      expect(config).toContain(`"tsBuildInfoFile": ".cache/tsc/tsconfig.${project}.tsbuildinfo"`);
      expect(config).toContain('"incremental": true');
      expect(config).toContain('"noEmit": true');
      expect(config).not.toContain("node_modules/.cache/tsc");
    }
    expect(read(".gitignore")).toMatch(/^\.cache\/$/m);
    expect(read(".github/actions/setup-bun/action.yml")).not.toContain(".cache/tsc");
  });

  it("uses installed Node and TypeScript metadata and never skips checking on a cache hit", () => {
    expect(step("Setup Bun + install")).toMatch(/id: setup\s+uses: \.\/.github\/actions\/setup-bun/);
    const version = step("Installed TypeScript version");
    expect(version).toContain("id: typescript");
    expect(version).toContain('require("typescript/package.json").version');
    expect(version).toContain("process.env.GITHUB_OUTPUT");
    const typecheck = step("TypeScript typecheck");
    expect(typecheck).toMatch(/id: typecheck\s+if: needs\.detector\.outputs\.frontend == 'true'\s+run: bun run typecheck:ci/);
    expect(typecheck).not.toMatch(/cache-hit|continue-on-error|--noCheck|--no-check/);
    expect(checks.indexOf("id: typescript")).toBeLessThan(checks.indexOf("id: ts-cache"));
    expect(checks.indexOf("id: ts-cache")).toBeLessThan(checks.indexOf("id: typecheck"));
  });

  it("restores and saves the same path and primary key with pinned standalone actions", () => {
    expect(restore).toContain("uses: actions/cache/restore@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0");
    expect(save).toContain("uses: actions/cache/save@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0");
    for (const block of [restore, save]) expect(block).toContain("path: .cache/tsc");
    expect(save).toContain("key: ${{ steps.ts-cache.outputs.cache-primary-key }}");
    expect(save).not.toContain("cache-matched-key");
    expect(save).toContain("if: success() && needs.detector.outputs.frontend == 'true' && steps.typecheck.outcome == 'success' && steps.ts-cache.outputs.cache-hit != 'true'");
    expect(checks.trimEnd().endsWith("key: ${{ steps.ts-cache.outputs.cache-primary-key }}")).toBe(true);
    expect(checks.indexOf("Save TypeScript incremental cache")).toBeGreaterThan(checks.indexOf("Deno tests (con typecheck, excluye smoke)"));
  });

  it("keeps checks as the sole cache owner and preserves frontend gating", () => {
    const sources = readdirSync(".github/workflows").filter(file => /\.ya?ml$/.test(file))
      .map(file => ({ file, source: read(`.github/workflows/${file}`) }));
    const owners = sources.filter(({ source }) => /^\s+path: \.cache\/tsc$/m.test(source));
    expect(owners.map(({ file }) => file)).toEqual(["ci.yml"]);
    expect(ci.match(/^\s+path: \.cache\/tsc$/gm)).toHaveLength(2);
    expect(checks.match(/^\s+path: \.cache\/tsc$/gm)).toHaveLength(2);
    expect(restore).toContain("if: needs.detector.outputs.frontend == 'true'");
    expect(checks).not.toMatch(/continue-on-error:\s*true/);
  });

  it("allows exactly one fallback retaining every compatibility component", () => {
    expect(patterns).toEqual(["tsconfig*.json", "package.json", "bun.lock", "scripts/ci/typecheck-incremental.mjs"]);
    expect(key).toContain("${{ runner.os }}-${{ runner.arch }}-tsc-v1-node${{ steps.setup.outputs.node-version }}-bun1.4.0-ts${{ steps.typescript.outputs.version }}-");
    const suffix = "${{ github.run_id }}-${{ github.run_attempt }}";
    expect(key.endsWith(suffix)).toBe(true);
    expect(restoreKeys).toEqual([key.slice(0, -suffix.length)]);
    expect(restore).not.toContain("enableCrossOsArchive: true");
    const primary = expand(key);
    const prefix = expand(restoreKeys[0]);
    expect(primary.startsWith(prefix)).toBe(true);
    for (const variable of ["github.run_id", "github.run_attempt"]) {
      expect(expand(key, { [variable]: "200" })).not.toBe(primary);
      expect(expand(restoreKeys[0], { [variable]: "200" })).toBe(prefix);
    }
  });

  it("invalidates the fallback for runtime, compiler, config, lock and runner changes", () => {
    const prefix = expand(restoreKeys[0]);
    for (const variable of ["runner.os", "runner.arch", "steps.setup.outputs.node-version", "steps.typescript.outputs.version"])
      expect(expand(restoreKeys[0], { [variable]: "different" }), variable).not.toBe(prefix);
    for (const file of configInputs())
      expect(expand(restoreKeys[0], {}, { [file]: read(file) + "\nchanged" }), file).not.toBe(prefix);
    expect(patterns).not.toContain("src/**");
    expect(restoreKeys[0]).not.toContain("github.sha");
  });
});
