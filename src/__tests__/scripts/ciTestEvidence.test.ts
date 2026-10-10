// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { assertExactPaths, buildCatalog, classifyFiles, hash, validateRlsEvidence } from "../../../scripts/ci/test-catalog.mjs";
import { selectLatestReports, validateEvidence } from "../../../scripts/ci/verify-test-evidence.mjs";
import { splitTestsByEnvironment } from "../../../scripts/lib/testEnvSplit";
import { esArchivoPerf } from "../../../vitest.shared";

const catalog = buildCatalog();
const entries = ["src/a.test.ts", "scripts/b.test.ts"].map(path => ({ path, lane: "vitest-normal" }));
const fixtureCatalog = { schemaVersion: 1, sha: "a".repeat(40), treeDigest: hash(JSON.stringify(entries)), entries };
const makeReport = (index: number) => ({
  schemaVersion: 1, sha: fixtureCatalog.sha, treeDigest: fixtureCatalog.treeDigest,
  shard: { index, total: 2 }, status: "passed", unhandledErrors: 0, wallTimeMs: 10, cacheHit: true,
  environment: { maxWorkers: 2, lockDigest: "b".repeat(64) },
  discovered: entries.map(entry => ({ path: entry.path, project: "node" })),
  selected: [{ path: entries[index - 1].path, project: "node" }],
  files: [{
    path: entries[index - 1].path, project: "node", state: "passed",
    cases: { total: 1, passed: 1, failed: 0, skipped: 0, pending: 0 },
    durationMs: 1, phasesMs: { environment: 0, prepare: 0, collect: 0, setup: 0 }, retries: 0, flaky: 0,
  }],
});
const source = (file: string) => fs.readFileSync(file, "utf8");

describe("CI catalog: effective discovery", () => {
  it("covers the actual normal selector exactly, including script tests and excluding perf", () => {
    const split = splitTestsByEnvironment(process.cwd());
    const actual = [...split.node, ...split.jsdom].filter(path => !esArchivoPerf(path));
    const expected = catalog.entries.filter(entry => entry.lane === "vitest-normal").map(entry => entry.path);
    expect(() => assertExactPaths(expected, actual, "normal discovery")).not.toThrow();
    expect(actual).toContain("scripts/__tests__/audit-acl-preservation.test.ts");
    expect(split.node).toContain("src/__tests__/scripts/vitestPerfSelection.test.ts");
  });

  it("discovers the CRM SQL suite under the actual RLS runner pattern", () => {
    expect(catalog.entries).toContainEqual(expect.objectContaining({ path: "supabase/tests/rls/test_rls_crm_oportunidad_empresa.sql", lane: "sql-rls" }));
    expect(source("scripts/ci/run-rls-suites.sh")).toContain("-name 'test_rls_*.sql'");
    const sql = source("supabase/tests/rls/test_rls_crm_oportunidad_empresa.sql");
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^ROLLBACK;\s*$/m);
    expect(sql).not.toMatch(/^COMMIT;/m);
  });

  it("labels manual/backend lanes without claiming they ran in ordinary CI", () => {
    expect(catalog.entries.find(entry => entry.path.endsWith("/smoke_test.ts"))?.mode).toBe("manual");
    expect(catalog.entries.filter(entry => entry.lane === "pdf-real" && entry.mode === "automatic").map(entry => entry.path))
      .toEqual(["tests/pdf/carteraPagination.test.tsx"]);
  });

  it("routes only the exact selector148 npm test files to its Node lane", () => {
    const expected = catalog.entries.filter(entry => entry.lane === "node-selector148").map(entry => entry.path);
    const pkg = JSON.parse(source("scripts/ci/selector148/package.json"));
    expect(pkg.scripts.test).toBe("node --test tests/profile.test.cjs");
    const actual = pkg.scripts.test.slice("node --test ".length).split(/\s+/)
      .map((file: string) => `scripts/ci/selector148/${file}`);
    expect(() => assertExactPaths(expected, actual, "selector148 npm test discovery")).not.toThrow();
    expect(expected.every(file => fs.existsSync(file))).toBe(true);
    expect(catalog.entries.find(entry => entry.path === expected[0])?.mode).toBe("automatic");
    expect(source(".github/workflows/rls-tests.yml")).toMatch(/^\s+node scripts\/ci\/selector148\/static-check\.cjs\r?\n\s+npm test --prefix scripts\/ci\/selector148$/m);
  });

  it("rejects unexecuted new selector148 CJS tests instead of accepting a folder wildcard", () => {
    const files = catalog.entries.map(entry => entry.path);
    const guards = catalog.entries.filter(entry => entry.lane === "sql-guards").map(entry => entry.path);
    const support = Object.fromEntries(catalog.entries.filter(entry => entry.lane === "sql-support").map(entry => [entry.path, entry.reason]));
    for (const extra of ["scripts/ci/selector148/tests/new.test.cjs", "scripts/ci/selector148/tests/nested/profile.test.cjs"]) {
      expect(() => classifyFiles([...files, extra], guards, support)).toThrow(/no execution lane/);
    }
  });

  it("fails closed for new unmatched SQL, script tests, missing and duplicate guards", () => {
    const files = catalog.entries.map(entry => entry.path);
    const guards = catalog.entries.filter(entry => entry.lane === "sql-guards").map(entry => entry.path);
    const support = Object.fromEntries(catalog.entries.filter(entry => entry.lane === "sql-support").map(entry => [entry.path, entry.reason]));
    expect(() => classifyFiles([...files, "supabase/tests/rls/test_unrouted.sql"], guards, support)).toThrow(/Unclassified/);
    expect(() => classifyFiles([...files, "new-folder/unrouted.test.ts"], guards, support)).toThrow(/no execution lane/);
    expect(() => classifyFiles(files, [...guards, guards[0]], support)).toThrow(/duplicated/);
    expect(() => classifyFiles(files, [...guards, "supabase/tests/missing.sql"], support)).toThrow(/Stale/);
    expect(() => classifyFiles(files, [], support)).toThrow(/empty/);
  });
});

describe("CI execution gate: exact union, never count-only", () => {
  it("accepts complete disjoint successful shards", () => {
    expect(validateEvidence(fixtureCatalog, [makeReport(1), makeReport(2)], 2)).toMatchObject({ files: 2, shards: 2, cases: { passed: 2 } });
  });
  it("rejects absent reports, duplicate shards and changed SHA/catalog", () => {
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1)], 2)).toThrow(/Expected/);
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), makeReport(1)], 2)).toThrow(/duplicate/);
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), { ...makeReport(2), sha: "b".repeat(40) }], 2)).toThrow(/identity/);
    expect(() => validateEvidence({ ...fixtureCatalog, treeDigest: "0".repeat(64) }, [makeReport(1), makeReport(2)], 2)).toThrow(/identity/);
  });
  it("rejects incomplete pre-shard discovery even if selected modules pass", () => {
    const report = makeReport(2);
    report.discovered = [report.discovered[1]];
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), report], 2)).toThrow(/complete discovery/);
  });
  it("rejects an equal-count substitution, duplicate execution or selected-but-unrun module", () => {
    const report = makeReport(2);
    report.selected[0].path = report.files[0].path = "src/missing.test.ts";
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), report], 2)).toThrow(/missing/);
    report.selected[0].path = report.files[0].path = entries[0].path;
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), report], 2)).toThrow(/duplicate/);
    report.files = [];
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), report], 2)).toThrow(/empty/);
  });
  it.each(["failed", "interrupted", "running"])("rejects %s reports", status => {
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), { ...makeReport(2), status }], 2)).toThrow(/cleanly/);
  });
  it.each(["failed", "skipped", "pending"] as const)("rejects %s cases", state => {
    const report = makeReport(2);
    report.files[0].cases.passed = 0;
    report.files[0].cases[state] = 1;
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), report], 2)).toThrow(/cases/);
  });
  it("rejects unhandled errors, empty test files, retries, flaky passes and invalid timing", () => {
    const report = makeReport(2);
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), { ...report, unhandledErrors: 1 }], 2)).toThrow(/cleanly/);
    report.files[0].cases.total = report.files[0].cases.passed = 0;
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), report], 2)).toThrow(/Empty/);
    report.files[0].cases.total = report.files[0].cases.passed = 1;
    report.files[0].retries = 1;
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), report], 2)).toThrow(/Retried/);
    report.files[0].retries = 0; report.files[0].flaky = 1;
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), report], 2)).toThrow(/flaky/);
    report.files[0].flaky = 0; report.files[0].durationMs = -1;
    expect(() => validateEvidence(fixtureCatalog, [makeReport(1), report], 2)).toThrow(/duration/);
  });
});


describe("RLS runner: discovery and red controls without a database", () => {
  const runner = path.resolve("scripts/ci/run-rls-suites.sh");
  function runFixture(names: string[], fail = false) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ci-rls-discovery-"));
    try {
      const suites = path.join(root, "supabase/tests/rls");
      fs.mkdirSync(suites, { recursive: true });
      for (const name of names) fs.writeFileSync(path.join(suites, name), "BEGIN;\nROLLBACK;\n");
      fs.writeFileSync(path.join(root, "psql"), `#!/bin/sh\nexit ${fail ? 3 : 0}\n`, { mode: 0o700 });
      const result = spawnSync("bash", [runner], {
        cwd: root, encoding: "utf8",
        env: { ...process.env, PATH: `${root}:${process.env.PATH}`, LOG_DIR: path.join(root, "logs"), GITHUB_STEP_SUMMARY: "/dev/null" },
      });
      const evidence = path.join(root, "logs/execution.tsv");
      return { status: result.status, output: result.stdout + result.stderr, evidence: fs.existsSync(evidence) ? fs.readFileSync(evidence, "utf8") : "" };
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  }
  it("rejects empty and formerly orphaned SQL before invoking psql", () => {
    expect(runFixture([]).status).toBe(1);
    const orphan = runFixture(["test_crm_oportunidad_empresa.sql"]);
    expect(orphan.status).toBe(1);
    expect(orphan.output).toContain("sin runner RLS");
    expect(orphan.evidence).toBe("");
  });
  it("executes the discovered CRM name and records only path/status/duration", () => {
    const result = runFixture(["test_rls_crm_oportunidad_empresa.sql"]);
    expect(result.status).toBe(0);
    expect(result.evidence).toMatch(/test_rls_crm_oportunidad_empresa\.sql\tpassed\t\d+/);
  });
  it("preserves a psql failure and records failed evidence", () => {
    const result = runFixture(["test_rls_crm_oportunidad_empresa.sql"], true);
    expect(result.status).toBe(1);
    expect(result.evidence).toMatch(/test_rls_crm_oportunidad_empresa\.sql\tfailed\t\d+/);
  });
});

describe("CI wiring: evidence is required by the existing aggregate check", () => {
  it("uploads even on failure and gates successful matrix results by the exact report union", () => {
    const ci = source(".github/workflows/ci.yml");
    expect(ci).toContain("CI_EVIDENCE_DIR: reports/ci-evidence");
    expect(ci).toContain("if-no-files-found: error");
    expect(ci).toContain("pattern: vitest-evidence-*");
    expect(ci).toContain("node scripts/ci/verify-test-evidence.mjs reports/ci-evidence");
    expect(ci).toContain("fail-fast: false");
    expect(source("vitest.config.ts")).toContain("./scripts/ci/vitest-evidence-reporter.ts");
  });
});


describe("CI evidence: re-run failed jobs", () => {
  const provenance = (index: number, attempt: string, status = "passed") => ({ ...makeReport(index), status, run: { id: "123", attempt, event: "pull_request" } });
  const current = { id: "123", attempt: "2", event: "pull_request" };
  it("retains an earlier successful shard and selects the newest report for a rerun shard", () => {
    const selected = selectLatestReports([provenance(1, "1"), provenance(2, "1", "failed"), provenance(2, "2")], current);
    expect(validateEvidence(fixtureCatalog, selected, 2)).toMatchObject({ files: 2, attemptByShard: ["1", "2"] });
  });
  it("never falls back from a newer failure to an older pass", () => {
    const selected = selectLatestReports([provenance(1, "1"), provenance(2, "1"), provenance(2, "2", "failed")], current);
    expect(() => validateEvidence(fixtureCatalog, selected, 2)).toThrow(/cleanly/);
  });
  it("rejects another run, future attempt, event mismatch and duplicate shard attempts", () => {
    expect(() => selectLatestReports([{ ...provenance(1, "1"), run: { ...current, id: "456" } }], current)).toThrow(/another run/);
    expect(() => selectLatestReports([provenance(1, "3")], current)).toThrow(/future attempt/);
    expect(() => selectLatestReports([provenance(1, "1")], { ...current, event: "push" })).toThrow(/another event/);
    expect(() => selectLatestReports([provenance(1, "1"), provenance(1, "1")], current)).toThrow(/Duplicate/);
  });
});


describe("RLS evidence exact union", () => {
  const sqlCatalog = { sha: "a".repeat(40), entries: [{ path: "test_rls_crm.sql", lane: "sql-rls" }] };
  const header = "path\tstatus\tdurationMs\n";
  it("accepts exactly the successful discovered paths", () => {
    expect(validateRlsEvidence(sqlCatalog, header + "test_rls_crm.sql\tpassed\t12\n")).toMatchObject({ files: 1, durationMs: 12 });
  });
  it("rejects omitted, duplicated, failed or unexpected paths", () => {
    for (const body of ["", "test_rls_other.sql\tpassed\t12\n", "test_rls_crm.sql\tfailed\t12\n", "test_rls_crm.sql\tpassed\t12\ntest_rls_crm.sql\tpassed\t12\n"]) {
      expect(() => validateRlsEvidence(sqlCatalog, header + body)).toThrow();
    }
  });
});
