/** Compact, allowlisted execution evidence. Never serializes logs, errors or env wholesale. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import type { Reporter, TestModule, TestSpecification, Vitest } from "vitest/node";
import { assertExactPaths, buildCatalog, hash, writeJson } from "./test-catalog.mjs";

const require = createRequire(import.meta.url);
const relative = (root: string, file: string) => path.relative(root, file).split(path.sep).join("/");
const key = (entry: { path: string; project: string }) => `${entry.project}:${entry.path}`;

export default class EvidenceReporter implements Reporter {
  private started = Date.now();
  private root = process.cwd();
  private directory = process.env.CI_EVIDENCE_DIR ?? "reports/ci-evidence";
  private catalog = buildCatalog(this.root);
  private discovered: { path: string; project: string }[] = [];
  private selected: { path: string; project: string }[] = [];
  private shard: { index: number; total: number; maxParallel: number | null } = { index: 1, total: 1, maxParallel: null };
  private pool = "forks";
  private isolate = true;
  private maxWorkers = 0;

  onInit(vitest: Vitest) {
    this.root = vitest.config.root;
    this.maxWorkers = vitest.config.maxWorkers;
    const configured = vitest.config.shard ?? { index: 1, count: 1 };
    const declared = process.env.CI_TEST_SHARD ?? `${configured.index}/${configured.count}`;
    if (declared !== `${configured.index}/${configured.count}`) throw new Error("CI_TEST_SHARD differs from actual Vitest shard");
    const maxParallel = process.env.CI_TEST_MAX_PARALLEL ? Number(process.env.CI_TEST_MAX_PARALLEL) : null;
    if (maxParallel !== null && (!Number.isSafeInteger(maxParallel) || maxParallel < 1 || maxParallel > configured.count)) throw new Error("Invalid CI_TEST_MAX_PARALLEL");
    this.shard = { index: configured.index, total: configured.count, maxParallel };
    writeJson(path.join(this.directory, "inventory.json"), this.catalog);
  }

  onTestRunStart(specifications: readonly TestSpecification[]) {
    for (const spec of specifications) {
      if (spec.project.config.pool !== "forks" || spec.project.config.isolate !== true) throw new Error("Execution evidence requires the reviewed forks/isolate contract");
      this.pool = spec.project.config.pool;
      this.isolate = spec.project.config.isolate;
    }
    // Vitest 5 calls this hook BEFORE its sequencer applies --shard.
    this.discovered = specifications.map(spec => ({ path: relative(this.root, spec.moduleId), project: spec.project.name })).sort((a, b) => key(a).localeCompare(key(b)));
    const expected = this.catalog.entries.filter(entry => entry.lane === "vitest-normal").map(entry => entry.path);
    assertExactPaths(expected, this.discovered.map(item => item.path), "Vitest full discovery");
    for (const item of this.discovered) {
      if (!["node", "jsdom"].includes(item.project)) throw new Error(`Unexpected Vitest project: ${key(item)}`);
    }
    this.selected = [];
    // A killed process leaves explicit incomplete evidence, never a synthetic pass.
    this.save([], 0, "running");
  }

  onTestModuleQueued(module: TestModule) {
    // This public hook is post-shard. It records assigned work before execution,
    // so a queued file that never finishes cannot disappear from the evidence.
    const selected = { path: relative(this.root, module.moduleId), project: module.project.name };
    if (!this.discovered.some(item => key(item) === key(selected)) || this.selected.some(item => item.path === selected.path)) throw new Error(`Unexpected/duplicate queued module: ${key(selected)}`);
    this.selected.push(selected);
  }

  onTestRunEnd(modules: readonly TestModule[], errors: readonly unknown[], reason: string) {
    const files = modules.map(module => {
      const cases = { total: 0, passed: 0, failed: 0, skipped: 0, pending: 0 };
      let retries = 0;
      let flaky = 0;
      for (const test of module.children.allTests()) {
        cases.total++;
        cases[test.result().state]++;
        retries += test.diagnostic()?.retryCount ?? 0;
        flaky += test.diagnostic()?.flaky ? 1 : 0;
      }
      const diagnostic = module.diagnostic();
      return {
        path: relative(this.root, module.moduleId), project: module.project.name,
        state: module.state(), cases, retries, flaky,
        durationMs: diagnostic.duration,
        phasesMs: {
          environment: diagnostic.environmentSetupDuration,
          prepare: diagnostic.prepareDuration,
          collect: diagnostic.collectDuration,
          setup: diagnostic.setupDuration,
        },
      };
    }).sort((a, b) => key(a).localeCompare(key(b)));
    this.save(files, errors.length, reason);
    // Vitest already fails assertions/imports. This additionally catches missing modules.
    assertExactPaths(this.selected.map(key), files.map(key), "Vitest selected/executed");
  }

  private save(files: object[], unhandledErrors: number, status: string) {
    let bun: string | null = null;
    try { bun = execFileSync("bun", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* local Node-only runs are explicit */ }
    writeJson(path.join(this.directory, `vitest-shard-${this.shard.index}-of-${this.shard.total}.json`), {
      schemaVersion: 1, sha: this.catalog.sha, treeDigest: this.catalog.treeDigest,
      memoryMeasurementId: process.env.CI_MEMORY_MEASUREMENT_ID ?? null,
      shard: this.shard, discovered: this.discovered, selected: this.selected.slice().sort((a, b) => key(a).localeCompare(key(b))), files,
      status, unhandledErrors, wallTimeMs: Date.now() - this.started,
      cacheHit: process.env.CI_CACHE_HIT === "true" ? true : process.env.CI_CACHE_HIT === "false" ? false : null,
      run: { id: process.env.GITHUB_RUN_ID ?? null, attempt: process.env.GITHUB_RUN_ATTEMPT ?? null, event: process.env.GITHUB_EVENT_NAME ?? null },
      environment: {
        node: process.version, bun, vitest: require("vitest/package.json").version,
        platform: process.platform, arch: process.arch,
        runnerOS: process.env.RUNNER_OS ?? null, runnerArch: process.env.RUNNER_ARCH ?? null,
        imageOS: process.env.ImageOS ?? null, imageVersion: process.env.ImageVersion ?? null,
        lockDigest: hash(fs.readFileSync(path.join(this.root, "bun.lock"))),
        maxWorkers: this.maxWorkers, pool: this.pool, isolate: this.isolate,
      },
    });
  }
}
