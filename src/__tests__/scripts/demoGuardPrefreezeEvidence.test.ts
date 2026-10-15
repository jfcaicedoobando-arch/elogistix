// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  DEMO_PREFREEZE_EVIDENCE, DEMO_PREFREEZE_SOURCES, buildCatalog, validatePrefreezeEvidence,
} from "../../../scripts/ci/test-catalog.mjs";

const root = process.cwd();
const sourceSha = "a".repeat(40);
const concurrencyPath = "scripts/ci/demo-guard/concurrency.py";
const concurrencySha = "01250f665e0bd3456c9272cc23616f94a296a0244fdf4a20aabc0af1660c87a0";
const entries = Object.entries(DEMO_PREFREEZE_SOURCES).map(([file, sha256]) => ({
  path: file, sha256, lane: "sql-support", mode: "support", verificationEvidence: DEMO_PREFREEZE_EVIDENCE,
}));
const catalog = { sha: sourceSha, entries };
const passedRun = (file: string, sha256: string) => ({
  path: file, sha256, status: "passed", exitCode: 0, executions: 2, durationMs: 1,
});
const evidence = () => ({
  schemaVersion: 1, sha: sourceSha, phase: "pre-forward",
  beforeMigration: "20261015050000_disable_demo_reseed.sql", status: "passed", sourcePreserved: true,
  checkpoint: {
    database: `demo_guard_checkpoint_${"1".repeat(32)}`, oid: 101, executions: 1, created: true, dropped: true,
  },
  cloneRuns: [2, 3].map(value => ({
    database: `demo_guard_race_${String(value).repeat(32)}`, oid: 100 + value, status: "passed", dropped: true,
  })),
  files: entries.map(entry => passedRun(entry.path, entry.sha256)),
  concurrency: passedRun(concurrencyPath, concurrencySha),
});

describe("demo prefreeze evidence: mandatory execution", () => {
  it("accepts the exact historical union, one checkpoint and two positive fresh clone runs", () => {
    expect(validatePrefreezeEvidence(catalog, evidence())).toEqual({
      sha: sourceSha, files: 4, executions: 8, concurrencyExecutions: 2, checkpoints: 1, clones: 2,
    });
  });

  it("binds all four catalog entries to required evidence without moving them into post-forward RLS", () => {
    const actual = buildCatalog();
    const historical = actual.entries.filter(entry => entry.verificationEvidence === DEMO_PREFREEZE_EVIDENCE);
    expect(historical.map(entry => entry.path).sort()).toEqual(entries.map(entry => entry.path).sort());
    for (const entry of historical) {
      expect(entry).toMatchObject({ lane: "sql-support", mode: "support", sha256: DEMO_PREFREEZE_SOURCES[entry.path] });
    }
  });

  it("rejects missing evidence, source identity, phase, source preservation and timestamp-only claims", () => {
    const changes = [
      (value: ReturnType<typeof evidence>) => { value.schemaVersion = 2; },
      (value: ReturnType<typeof evidence>) => { value.sha = "b".repeat(40); },
      (value: ReturnType<typeof evidence>) => { value.phase = "post-forward"; },
      (value: ReturnType<typeof evidence>) => { value.beforeMigration = "20261015050000"; },
      (value: ReturnType<typeof evidence>) => { value.status = "failed"; },
      (value: ReturnType<typeof evidence>) => { value.sourcePreserved = false; },
    ];
    for (const value of [undefined, {}, { status: "passed", recordedAt: new Date().toISOString() }]) {
      expect(() => validatePrefreezeEvidence(catalog, value)).toThrow();
    }
    for (const change of changes) {
      const value = evidence(); change(value);
      expect(() => validatePrefreezeEvidence(catalog, value)).toThrow();
    }
  });

  it("rejects missing, duplicate and equal-count substituted suites and catalog evidence bindings", () => {
    const value = evidence();
    value.files.pop();
    expect(() => validatePrefreezeEvidence(catalog, value)).toThrow(/missing/);
    value.files.push(value.files[0]);
    expect(() => validatePrefreezeEvidence(catalog, value)).toThrow(/duplicate/);
    value.files[3] = { ...value.files[0], path: "supabase/tests/rls/history/demo-prefreeze/unreviewed.sql" };
    expect(() => validatePrefreezeEvidence(catalog, value)).toThrow(/unexpected/);
    for (const change of [
      { sha256: "0".repeat(64) }, { verificationEvidence: "reports/optional.json" }, { lane: "sql-rls" }, { mode: "manual" },
    ]) {
      const altered = { ...catalog, entries: entries.map((entry, index) => index ? entry : { ...entry, ...change }) };
      expect(() => validatePrefreezeEvidence(altered, evidence())).toThrow();
    }
    expect(() => validatePrefreezeEvidence({ ...catalog, entries: entries.slice(1) }, evidence())).toThrow(/missing/);
  });

  it("requires two successful executions of each exact original source, including concurrency", () => {
    for (const target of ["file", "concurrency"]) {
      for (const change of [
        { status: "failed" }, { exitCode: 3 }, { executions: 0 }, { executions: 1 }, { executions: 3 },
        { sha256: "f".repeat(64) }, { durationMs: -1 }, { durationMs: NaN }, { durationMs: Infinity },
        { durationMs: "1" }, { exitCode: "0" },
      ]) {
        const value = evidence();
        Object.assign(target === "file" ? value.files[0] : value.concurrency, change);
        expect(() => validatePrefreezeEvidence(catalog, value)).toThrow();
      }
    }
    const value = evidence(); value.concurrency.path = "scripts/ci/demo-guard/replacement.py";
    expect(() => validatePrefreezeEvidence(catalog, value)).toThrow(/source mismatch/);
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "demo-prefreeze-source-"));
    try {
      const file = path.join(folder, concurrencyPath);
      fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, "replacement source");
      expect(() => validatePrefreezeEvidence(catalog, evidence(), folder)).toThrow(/source drift/);
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  });

  it("requires the exact checkpoint and two distinct removed clone identities", () => {
    for (const change of [
      { executions: 0 }, { executions: 2 }, { created: false }, { dropped: false },
      { database: "postgres" }, { oid: 0 }, { oid: -1 }, { oid: 1.5 }, { oid: "101" },
    ]) {
      const value = evidence(); Object.assign(value.checkpoint, change);
      expect(() => validatePrefreezeEvidence(catalog, value)).toThrow(/checkpoint/);
    }
    for (const change of [
      { status: "failed" }, { dropped: false }, { database: "postgres" }, { oid: 0 }, { oid: 1.5 }, { oid: "102" },
    ]) {
      const value = evidence(); Object.assign(value.cloneRuns[0], change);
      expect(() => validatePrefreezeEvidence(catalog, value)).toThrow(/clone/);
    }
    const value = evidence(); value.cloneRuns.pop();
    expect(() => validatePrefreezeEvidence(catalog, value)).toThrow(/two fresh/);
    value.cloneRuns.push(value.cloneRuns[0]);
    expect(() => validatePrefreezeEvidence(catalog, value)).toThrow(/distinct/);
    value.cloneRuns[1] = { ...evidence().cloneRuns[1], oid: value.checkpoint.oid };
    expect(() => validatePrefreezeEvidence(catalog, value)).toThrow(/distinct/);
  });
});

describe("demo prefreeze CLI: post-forward RLS cannot omit prior execution", () => {
  function fixture(historicalCount = entries.length) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "demo-prefreeze-cli-"));
    const write = (file: string, content: string | Uint8Array) => {
      const full = path.join(folder, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, content);
    };
    const files = [
      "src/a.test.ts", "src/a.perf.test.ts", "supabase/tests/a.sql", "supabase/tests/rls/test_rls_a.sql", "supabase/tests/_generic_fixture.sql",
      "supabase/functions/a/a_test.ts", "supabase/functions/a/smoke_test.ts", "tests/pdf/carteraPagination.test.tsx",
      "e2e/specs/a.spec.ts", "e2e/visual/audit119-126/specs/a.spec.ts", "e2e/visual/specs/shared-ui.spec.ts",
    ];
    for (const file of files) write(file, "synthetic test census fixture\n");
    const support = JSON.parse(fs.readFileSync(path.join(root, "scripts/ci/test-catalog/sql-support.json"), "utf8"));
    const historical = entries.slice(0, historicalCount);
    for (const entry of historical) {
      write(entry.path, fs.readFileSync(path.join(root, entry.path))); files.push(entry.path);
    }
    write("scripts/ci/test-catalog/sql-support.json", JSON.stringify({
      "supabase/tests/_generic_fixture.sql": "Synthetic generic support fixture",
      ...Object.fromEntries(historical.map(entry => [entry.path, support[entry.path]])),
    }));
    write("supabase/tests/_guards_manifest.txt", "supabase/tests/a.sql\n");
    write(concurrencyPath, fs.readFileSync(path.join(root, concurrencyPath)));
    write("rls.tsv", "path\tstatus\tdurationMs\nsupabase/tests/rls/test_rls_a.sql\tpassed\t1\n");
    const fakeGit = path.join(folder, "bin/git");
    write("bin/git", `#!${process.execPath}\nif(process.argv[2]==='ls-files')process.stdout.write(${JSON.stringify(files.join("\0") + "\0")});else if(process.argv[2]==='rev-parse')process.stdout.write('${sourceSha}\\n');else process.exit(91);\n`);
    fs.chmodSync(fakeGit, 0o700);
    const run = (...args: string[]) => spawnSync(process.execPath, [path.join(root, "scripts/ci/test-catalog.mjs"), ...args], {
      cwd: folder, encoding: "utf8", env: { ...process.env, PATH: `${path.dirname(fakeGit)}:${process.env.PATH}`, GITHUB_SHA: sourceSha },
    });
    return { folder, write, run };
  }

  it("fails without prior evidence even when every current RLS suite passed; accepts only the complete positive record", () => {
    const f = fixture();
    try {
      expect(f.run("--verify-rls", "rls.tsv").status).toBe(1);
      f.write(DEMO_PREFREEZE_EVIDENCE, JSON.stringify(evidence()));
      const accepted = f.run("--verify-rls", "rls.tsv");
      expect(accepted.status, accepted.stderr).toBe(0);
      expect(JSON.parse(accepted.stdout)).toMatchObject({ files: 1, prefreeze: { files: 4, executions: 8, concurrencyExecutions: 2 } });
      const explicit = f.run("--verify-prefreeze", DEMO_PREFREEZE_EVIDENCE);
      expect(explicit.status, explicit.stderr).toBe(0);
      const failed = evidence(); failed.files[0].executions = 1;
      f.write(DEMO_PREFREEZE_EVIDENCE, JSON.stringify(failed));
      expect(f.run("--verify-rls", "rls.tsv").status).toBe(1);
      expect(f.run("--verify-prefreeze", DEMO_PREFREEZE_EVIDENCE).status).toBe(1);
    } finally { fs.rmSync(f.folder, { recursive: true, force: true }); }
  });

  it("accepts a generic catalog without historical suites and keeps explicit prefreeze verification strict", () => {
    const f = fixture(0);
    try {
      const result = f.run("--verify-rls", "rls.tsv");
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({ sha: sourceSha, files: 1, durationMs: 1 });
      f.write(DEMO_PREFREEZE_EVIDENCE, JSON.stringify(evidence()));
      expect(f.run("--verify-prefreeze", DEMO_PREFREEZE_EVIDENCE).status).toBe(1);
    } finally { fs.rmSync(f.folder, { recursive: true, force: true }); }
  });

  it.each([1, 3])("requires the complete four-suite catalog when %i historical suites remain", historicalCount => {
    const f = fixture(historicalCount);
    try {
      f.write(DEMO_PREFREEZE_EVIDENCE, JSON.stringify(evidence()));
      const result = f.run("--verify-rls", "rls.tsv");
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/Demo prefreeze catalog: missing/);
    } finally { fs.rmSync(f.folder, { recursive: true, force: true }); }
  });
});
