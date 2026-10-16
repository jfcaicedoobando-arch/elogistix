// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Read-only review contract. Never imports a runner or executes SQL/processes.
const read = (name: string) => readFileSync(new URL(name, import.meta.url));
const text = (name: string) => read(name).toString("utf8");
const fixed = {
  "run_isolated.py": "93ac69a3d0ae3cccbb9587ffdf07ba5751b99928d5a0ff8a4e747162731fa9f9",
  "snapshot.sql": "8214954821e88579ff76d10979b296edc6d5c47870c22e6e2c27e01df9e67fb0",
  "fixtures/R2.sql": "6be74b6205202a3288c654e055081fb088556ba2750f539a0e6a677bc34a19a4",
  "fixtures/TEST_ONLY_initial_functions.sql": "7e1169e7a0aa999d6469c2d8c68ba2d448163b19d7a882c89a3f677083b62f1d",
  "fixtures/dependencies.sql": "2adf086685863db5b86f62d7a3d1dd22c5344806687de47410c1aff538c5a7f8",
  "fixtures/event_drift.sql": "da545e97acee5fb41504cf134af35e6d051487bb9cd389a948493c6267db0f09",
  "PROPOSAL_R3_rename_lock_admission.sql": "7f054e3071b243ca6ada6359028c66efa0ac2ba5047a8cf7133f70f1b7924d86",
};
const sql = text("PROPOSAL_R3_rename_lock_admission.sql");
const runner = text("run_isolated.py");

describe("R3 inert review artifacts (static evidence only)", () => {
  it("matches independently reviewed fixed bytes, without regenerating a manifest", () => {
    expect(JSON.parse(text("provenance-sha256.json"))).toEqual(fixed);
    for (const [name, hash] of Object.entries(fixed)) {
      expect(createHash("sha256").update(read(name)).digest("hex"), name).toBe(hash);
    }
  });

  it("keeps the common terminal gate outside conditional replacements", () => {
    const start = sql.indexOf("IF NOT v_stopped THEN");
    const end = sql.indexOf("END IF; -- replacements and intermediate postchecks only");
    const finalGate = sql.indexOf("$atomic_hashes_admission_terminal$");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    expect(finalGate).toBeGreaterThan(end);
    expect(sql.indexOf("ADMISSION_POSTCHECK: event trigger or extension metadata changed")).toBeGreaterThan(end);
    expect(sql.indexOf("RAISE NOTICE 'R3: logical retry")).toBeGreaterThan(finalGate);
    expect(sql.slice(start, end).match(/EXECUTE \$atomic_stopped_definition_\d\$/g)).toHaveLength(4);
    // Exclude quoted function definitions before checking the outer admission block.
    const outer = sql.replace(/EXECUTE \$atomic_stopped_definition_(\d)\$[\s\S]*?\$atomic_stopped_definition_\1\$;/g, "");
    expect(outer).not.toMatch(/\bRETURN\s*;/i);
    for (const guard of ["lock_timeout','5s'", "pg_try_advisory_xact_lock", "current_user<>'postgres'", "session_user<>current_user", "unknown or mixed initial state", "ATOMIC_DEMO_POSTCHECK_admission_terminal"])
      expect(outer).toContain(guard);
  });

  it("preserves disposable-only isolation and restricted operator guards", () => {
    for (const guard of ["--run-disposable-only", "os.geteuid()==0", "exist_ok=False", "tempfile.mkdtemp", "mode=0o700", "--auth-host=reject", "'-X'", "PGPASSFILE", "NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS", "'listen_addresses':''", "'write':False", "'admin_member':False", "'version':'170006'", "env=env", "timeout=60"])
      expect(runner).toContain(guard);
    expect(runner).not.toMatch(/ap\.add_argument\(['"]--(?:dsn|host|port|database|socket|cluster)/);
    expect(runner).not.toContain("os.environ");
    expect(runner).not.toContain("tempfile.TemporaryDirectory(");
  });

  it("retains shutdown verification, preserved failure evidence and PASS ordering", () => {
    expect(runner.indexOf("start_attempted=True")).toBeLessThan(runner.indexOf("'start')"));
    expect(runner.indexOf("'cleanup-status-after'")).toBeLessThan(runner.indexOf("shutil.rmtree(t)"));
    expect(runner.indexOf("assert not (data/'postmaster.pid').exists()")).toBeLessThan(runner.indexOf("shutil.rmtree(t)"));
    expect(runner.indexOf("result['status']='pass'")).toBeGreaterThan(runner.indexOf("result['cleanup']='confirmed_stopped_and_removed'"));
    for (const guard of ["finally:", "TimeoutExpired", "unconfirmed_or_failed_directory_preserved", "assert stop_exit_code==0", "checks_pass_cleanup_pending"])
      expect(runner).toContain(guard);
  });

  it("keeps precise negative checks and the observed rollback scope", () => {
    for (const guard of ["phase='admission_terminal' if state=='terminal' else 'admission_0'", "r'^ERROR:\\s+P0001: '", "assert after==before", "assert logical(retry)==logical(after)", "if section!='functions'", "targets[0]['proname']=='seed_demo_organization_core'"])
      expect(runner).toContain(guard);
    for (const field of ["functions", "events", "extensions", "dependencies", "triggers", "rewrite", "roles", "control", "ledger", "marker", "bridge_rows", "xmin", "ctid"])
      expect(text("snapshot.sql")).toContain(`'${field}'`);
    for (const guard of ["c.renames=8", "d.objid=c.last_oid", "COST 101", "QA_EVENT_DRIFT_MARKER", "SECURITY DEFINER", "d.objid=ANY(c.tracked)"])
      expect(text("fixtures/event_drift.sql")).toContain(guard);
  });

  it("labels supplemental evidence without promoting it to full runtime coverage", () => {
    const result = JSON.parse(text("supplementary-result.json"));
    expect(result.status).toBe("supplementary_single_user_pass");
    expect(result.event_trigger_tests).toBe("NOT_RUN_DISABLED_IN_SINGLE_USER");
    expect(result.concurrency_tests).toBe("NOT_RUN");
    expect(result.production_equivalence).toBe(false);
    expect(result.historical_seed_invocations).toBe(0);
    expect(result.checks).toHaveLength(5);
    expect(result).not.toHaveProperty("output");
  });
});
