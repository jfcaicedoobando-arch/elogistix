import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../package.json", import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const runner = require("vitest/package.json");
const coverage = require("@vitest/coverage-v8/package.json");

// Use the pinned package manager's parsers rather than treating JSONC or YAML
// as JavaScript, stripping commas with a regex, or depending on a hoisted parser.
const parsed = spawnSync("bun", ["-e", `
  const lock = Bun.JSON5.parse(await Bun.file("bun.lock").text());
  const config = Bun.YAML.parse(await Bun.file(".github/dependabot.yml").text());
  console.log(JSON.stringify({
    root: lock.workspaces[""].devDependencies,
    runner: lock.packages.vitest,
    coverage: lock.packages["@vitest/coverage-v8"],
    groups: config.updates.find(update => update["package-ecosystem"] === "bun").groups,
  }));
`], { cwd: root, encoding: "utf8", timeout: 10000 });
assert.equal(parsed.status, 0, parsed.error?.message ?? parsed.stderr);
const locked = JSON.parse(parsed.stdout);

function assertAlignment(pkg, lock, installedRunner = runner, installedCoverage = coverage) {
  const version = pkg.devDependencies.vitest;
  assert.match(version, /^\d+\.\d+\.\d+$/, "Vitest must have an exact stable pin");
  assert.equal(pkg.devDependencies["@vitest/coverage-v8"], version, "runner and coverage pins must match");
  assert.equal(lock.root.vitest, version, "lock workspace runner must match manifest");
  assert.equal(lock.root["@vitest/coverage-v8"], version, "lock workspace coverage must match manifest");
  assert.equal(lock.runner[0], `vitest@${version}`, "resolved runner must match manifest");
  assert.equal(lock.coverage[0], `@vitest/coverage-v8@${version}`, "resolved coverage must match manifest");
  assert.equal(lock.runner[2].peerDependencies["@vitest/coverage-v8"], version, "locked runner must accept exact coverage");
  assert.equal(lock.coverage[2].peerDependencies.vitest, version, "locked coverage must accept exact runner");
  assert.equal(installedRunner.version, version, "installed runner must match lock");
  assert.equal(installedCoverage.version, version, "installed coverage must match lock");
  assert.equal(installedRunner.peerDependencies["@vitest/coverage-v8"], version);
  assert.equal(installedCoverage.peerDependencies.vitest, version);
}

function matchesPattern(name, pattern) {
  return new RegExp(`^${pattern.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`).test(name);
}

function selectedGroup(name, kind, groups) {
  return Object.entries(groups).find(([, group]) =>
    group["update-types"].includes(kind)
    && (group.patterns ?? ["*"]).some(pattern => matchesPattern(name, pattern))
    && !(group["exclude-patterns"] ?? []).some(pattern => matchesPattern(name, pattern)))?.[0];
}

test("Vitest runner, V8 provider, lockfile and installed peers share an exact version", () => {
  assertAlignment(manifest, locked);
});

test("rejects either half of the split #452/#453 update and stale installations", () => {
  for (const dependency of ["vitest", "@vitest/coverage-v8"]) {
    const split = structuredClone(manifest);
    split.devDependencies[dependency] = "5.0.5";
    assert.throws(() => assertAlignment(split, locked), /runner and coverage pins must match/);
  }
  const staleLock = structuredClone(locked);
  staleLock.coverage[0] = "@vitest/coverage-v8@5.0.5";
  assert.throws(() => assertAlignment(manifest, staleLock), /resolved coverage/);
  assert.throws(() => assertAlignment(manifest, locked, runner, { ...coverage, version: "5.0.5" }), /installed coverage/);
});

test("Dependabot selects the Vitest family together and excludes it from the general group", () => {
  for (const kind of ["major", "minor", "patch"]) {
    const expected = kind === "major" ? "vitest-major" : "vitest-minor-patch";
    for (const name of ["vitest", "@vitest/coverage-v8", "@vitest/browser-playwright"]) {
      assert.equal(selectedGroup(name, kind, locked.groups), expected, `${name} ${kind}`);
    }
  }
  const general = { "bun-minor-patch": locked.groups["bun-minor-patch"] };
  for (const name of ["vitest", "@vitest/coverage-v8"]) {
    assert.equal(selectedGroup(name, "minor", general), undefined, `${name} must not fall back to the general group`);
  }
  assert.equal(selectedGroup("unrelated-package", "minor", general), "bun-minor-patch");
});

test("V8 coverage survives two blob shards and report merging", { timeout: 60000 }, () => {
  const cache = path.join(root, ".cache");
  mkdirSync(cache, { recursive: true });
  const fixture = mkdtempSync(path.join(cache, "vitest-alignment-"));
  try {
    writeFileSync(path.join(fixture, "calculator.mjs"), `export function total(amount) {\n  if (amount < 0) return 0;\n  return amount * 2;\n}\n`);
    for (const [name, input, expected] of [["positive", 21, 42], ["negative", -1, 0]]) {
      writeFileSync(path.join(fixture, `${name}.test.mjs`), `import { expect, test } from "vitest";\nimport { total } from "./calculator.mjs";\ntest("${name}", () => expect(total(${input})).toBe(${expected}));\n`);
    }
    writeFileSync(path.join(fixture, "vitest.config.mjs"), `import { defineConfig } from "vitest/config";
export default defineConfig({ test: {
  include: ["*.test.mjs"], environment: "node", maxWorkers: 1,
  coverage: { provider: "v8", include: ["calculator.mjs"], reporter: ["json", "json-summary"], reportsDirectory: "./coverage" },
} });\n`);
    writeFileSync(path.join(fixture, "package.json"), JSON.stringify({ type: "module", scripts: {
      "test:coverage:shard": manifest.scripts["test:coverage:shard"],
      "test:coverage:merge": manifest.scripts["test:coverage:merge"],
    } }));
    const run = (script, args = []) => {
      const result = spawnSync("bun", ["run", script, "--", "--config", path.join(fixture, "vitest.config.mjs"), "--root", fixture, ...args], {
        cwd: fixture, encoding: "utf8", timeout: 20000,
        // No application environment, secrets, network, SQL, or backend used.
        env: { PATH: `${path.join(root, "node_modules/.bin")}${path.delimiter}${process.env.PATH}`, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, TMP: process.env.TMP, NO_COLOR: "1" },
      });
      assert.equal(result.status, 0, result.error?.message ?? `${result.stdout}\n${result.stderr}`);
      assert.doesNotMatch(result.stdout + result.stderr, /mixed versions|versions? (?:do not|does not|mismatch)/i);
    };
    run("test:coverage:shard", ["--shard=1/2"]);
    run("test:coverage:shard", ["--shard=2/2"]);
    assert.equal(readdirSync(path.join(fixture, ".vitest/blob")).filter(name => name.endsWith(".json")).length, 2);
    run("test:coverage:merge");
    const summary = JSON.parse(readFileSync(path.join(fixture, "coverage/coverage-summary.json"), "utf8"));
    for (const metric of ["lines", "statements", "functions", "branches"]) {
      assert.ok(summary.total[metric].total > 0, `${metric}: nonempty coverage`);
      assert.equal(summary.total[metric].pct, 100, `${metric}: both shards must contribute`);
    }
    const report = JSON.parse(readFileSync(path.join(fixture, "coverage/coverage-final.json"), "utf8"));
    assert.equal(Object.keys(report).length, 1);
    assert.equal(path.basename(Object.keys(report)[0]), "calculator.mjs");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
