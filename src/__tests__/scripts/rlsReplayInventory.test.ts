// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../..");
const candidate = fs.readFileSync(path.join(root, "scripts/ci/rls-prepare-db.sh"), "utf8");
const fastPath = `  # Avoid one subprocess per ordinary migration. Keep basename for any token
  # outside the existing glob shape, preserving legacy word-splitting/errors.
  if [[ "$f" == supabase/migrations/*.sql ]]; then
    base="\${f##*/}"
  else
    base="$(basename "$f")"
  fi`;
const legacy = candidate.replace(fastPath, '  base="$(basename "$f")"');
const digest = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");

// No PostgreSQL process, network connection, checkpoint SQL, or live credential
// is used. The actual preparer and extension filter run against local command
// doubles; SQL bytes and ordered checkpoint dispatches are retained verbatim.
const commands = String.raw`
psql() {
  printf 'psql\0' >> "$MIRROR_CALLS"
  printf '%s\0' "$@" >> "$MIRROR_CALLS"
  printf '\0' >> "$MIRROR_CALLS"
  if [[ "$*" == *"SELECT count(*) FROM pg_class"* ]]; then
    printf '%s\n' "\${MIRROR_RELATIONS:-0}"; return "\${MIRROR_GUARD_STATUS:-0}"
  fi
  if [[ "$*" == *"SELECT md5(to_jsonb(p)::text)"* ]]; then
    printf '%s\n' fingerprint; return 0
  fi
  local sql="" file="" previous="" arg
  for arg in "$@"; do
    if [[ "$previous" == -f ]]; then file="$arg"; fi
    previous="$arg"
  done
  if [[ -n "$file" ]]; then
    IFS= read -r -d '' sql < "$file" || :
  else
    IFS= read -r -d '' sql || :
  fi
  printf '%s\0' "$sql" >> "$MIRROR_SQL"
  [[ "$sql" != *MIRROR_FAIL_SQL* ]] || return 7
}
node() {
  printf 'node\0' >> "$MIRROR_CALLS"
  printf '%s\0' "$@" >> "$MIRROR_CALLS"
  printf '\0' >> "$MIRROR_CALLS"
  if [[ "$*" == *"control.cjs locate" ]]; then
    printf '%s\n' "$MIRROR_INSTALLER"
  fi
  [[ "$*" != "\${MIRROR_FAIL_CHECKPOINT:-absent}" ]] || return 9
}
pg_dump() {
  printf 'pg_dump\0schema-only\0\0' >> "$MIRROR_CALLS"
  local arg
  for arg in "$@"; do
    if [[ "$arg" == --file=* ]]; then printf 'checkpoint\n' > "\${arg#--file=}"; fi
  done
}
bash() {
  if [[ "$1" == scripts/ci/audit54-cxc-forward-runtime.sh ]]; then
    printf 'audit54-runtime\0\0' >> "$MIRROR_CALLS"
    return 0
  fi
  command bash "$@"
}
`.replaceAll("\\${", "${");

type Fixture = {
  files?: Record<string, string>;
  remove?: string[];
  modes?: Record<string, number>;
  env?: NodeJS.ProcessEnv;
};
function runPair(fixture: Fixture = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rls inventory [literal] "));
  const write = (file: string, text: string) => {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  };
  write("supabase/tests/rls/_ci_bootstrap.sql", "-- bootstrap\nSELECT 0;\n");
  write("supabase/schema/squash/cutoff.env", "SQUASH_FILE=supabase/schema/squash/baseline.sql\nSQUASH_INCLUDED=supabase/schema/squash/included.txt\n");
  write("supabase/schema/squash/baseline.sql", "CREATE EXTENSION IF NOT EXISTS pg_cron;\nSELECT 1;\n");
  write("supabase/schema/squash/included.txt", "20200101000000_included.sql\n");
  write("supabase/migrations/20200101000000_included.sql", "SELECT 'included';\n");
  write("supabase/migrations/20260101000000_apply.sql", "SELECT 'applied';\n");
  write("scripts/ci/selector148/profile-replay.sh", fs.readFileSync(path.join(root, "scripts/ci/selector148/profile-replay.sh"), "utf8"));
  write("commands.sh", commands);
  for (const [file, text] of Object.entries(fixture.files ?? {})) write(file, text);
  for (const file of fixture.remove ?? []) fs.rmSync(path.join(dir, file), { force: true });
  for (const [file, mode] of Object.entries(fixture.modes ?? {})) fs.chmodSync(path.join(dir, file), mode);
  const run = (source: string) => {
    write("preparer.sh", source);
    write("calls.bin", "");
    write("sql.bin", "");
    const result = spawnSync("/bin/bash", ["preparer.sh"], {
      cwd: dir,
      encoding: "utf8",
      timeout: 30_000,
      env: {
        PATH: process.env.PATH,
        LC_ALL: "C",
        PGHOST: "127.0.0.1",
        PGUSER: "postgres",
        PGDATABASE: "postgres",
        BASH_ENV: path.join(dir, "commands.sh"),
        MIRROR_CALLS: path.join(dir, "calls.bin"),
        MIRROR_SQL: path.join(dir, "sql.bin"),
        MIRROR_INSTALLER: "supabase/migrations/20261009012000_selector.sql",
        ...fixture.env,
      },
    });
    const profilePath = path.join(dir, ".selector148-logs/replay-profile.jsonl");
    const profile = fs.existsSync(profilePath)
      ? fs.readFileSync(profilePath, "utf8").trim().split("\n").filter(Boolean).map(line => {
        const { duration_us: _duration, ...record } = JSON.parse(line);
        return record;
      }) : [];
    return {
      status: result.status,
      signal: result.signal,
      error: result.error?.message,
      stdout: result.stdout,
      stderr: result.stderr,
      calls: fs.readFileSync(path.join(dir, "calls.bin")),
      sql: fs.readFileSync(path.join(dir, "sql.bin")),
      profile,
    };
  };
  try {
    const before = run(legacy);
    const after = run(candidate);
    expect(after).toEqual(before);
    return { ...after, sqlSha256: digest(after.sql), callSha256: digest(after.calls) };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe("RLS replay inventory: basename-only candidate", () => {
  it("compares the exact new block with the original basename expression", () => {
    expect(candidate.split(fastPath)).toHaveLength(2);
    expect(legacy).not.toBe(candidate);
  });

  it.each([
    "supabase/migrations/20260101000000_normal.sql",
    "supabase/migrations/-n.sql",
    "supabase/migrations/space name.sql",
    "supabase/migrations/tab\tname.sql",
    "supabase/migrations/new\nline.sql",
    "supabase/migrations/back\\slash.sql",
    "supabase/migrations/[brackets]*?.sql",
    "supabase/migrations/üñícode.sql",
    "supabase/migrations/a/../nested.sql",
    "supabase/migrations/trailing/",
    "/", "//", ".", "..", "-n", "--help", "word\n", "",
  ])("preserves basename value/status/errors for token %j", token => {
    const env = { PATH: process.env.PATH, LC_ALL: "C", TOKEN: token };
    const before = spawnSync("/bin/bash", ["-c", 'set -euo pipefail; f="$TOKEN"; base="$(basename "$f")"; printf "%s\\0" "$base"'], { env });
    const after = spawnSync("/bin/bash", ["-c", 'set -euo pipefail; f="$TOKEN";\n' + fastPath + '\nprintf "%s\\0" "$base"'], { env });
    expect({ status: after.status, stdout: after.stdout, stderr: after.stderr })
      .toEqual({ status: before.status, stdout: before.stdout, stderr: before.stderr });
  });

  it("preserves default replay and the exact extension-stubbed bytes", () => {
    const result = runPair();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 migraciones aplicadas · 0 de datos omitidas");
    expect(result.sql.toString()).toContain("SELECT 1; -- [ci] stubbed pg_cron");
    expect(result.sql.toString()).not.toContain("SELECT 'included'");
  });

  it("preserves duplicate inventory entries, absent inventory names and data-only precedence", () => {
    const result = runPair({ files: {
      "supabase/schema/squash/included.txt": "20200101000000_included.sql\n20200101000000_included.sql\nmissing.sql\n",
      "supabase/schema/squash/data-only.txt": "20200101000000_included.sql\n20260101000000_apply.sql\n20260101000000_apply.sql\nabsent.sql\n",
      "supabase/migrations/20260101000000_other.sql": "SELECT 'same timestamp different file';\n",
    } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("1 migraciones aplicadas · 1 de datos omitidas");
  });

  it.each([
    "space name.sql", "tab\tname.sql", "new\nline.sql", "-n.sql",
    "back\\slash.sql", "[brackets].sql", "star*.sql", "question?.sql", "üñícode.sql",
  ])("preserves the whole preparer's existing behavior for filename %j", name => {
    runPair({ files: { ["supabase/migrations/" + name]: "SELECT 'odd name';\n" } });
  });

  it("preserves duplicate expansion from a literal wildcard in a filename", () => {
    const result = runPair({ files: {
      "supabase/migrations/same*.sql": "SELECT 'wildcard';\n",
      "supabase/migrations/sameA.sql": "SELECT 'literal';\n",
    } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("4 migraciones aplicadas");
  });

  it.each(["cutoff.env", "baseline.sql", "included.txt"])("preserves required-file failures for missing %s", file => {
    const result = runPair({ remove: ["supabase/schema/squash/" + file] });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("no existe, no es legible o está vacío");
  });

  it.each(["cutoff.env", "baseline.sql", "included.txt"])("preserves required-file failures for empty %s", file => {
    const result = runPair({ files: { ["supabase/schema/squash/" + file]: "" } });
    expect(result.status).toBe(1);
  });

  it.each(["cutoff.env", "baseline.sql", "included.txt"])("preserves required-file failures for unreadable %s", file => {
    const result = runPair({ modes: { ["supabase/schema/squash/" + file]: 0 } });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("no existe, no es legible o está vacío");
  });

  it("preserves exact grep matching for CRLF, no final newline and binary inventory", () => {
    for (const included of ["20200101000000_included.sql\r\n", "20200101000000_included.sql", "20200101000000_included.sql\0\n"]) {
      const result = runPair({ files: { "supabase/schema/squash/included.txt": included } });
      expect(result.status).toBe(0);
    }
  });

  it("preserves empty migration discovery without inventing an applied file", () => {
    const result = runPair({ remove: ["supabase/migrations/20200101000000_included.sql", "supabase/migrations/20260101000000_apply.sql"] });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("0 migraciones aplicadas · 0 de datos omitidas");
  });

  it("preserves a missing migration's read failure without bypassing it", () => {
    const result = runPair({ files: { "supabase/migrations/broken name.sql": "SELECT 1;\n" } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("can't read supabase/migrations/broken");
    expect(result.stdout).toContain("la migración no aplica sobre el baseline squash");
  });

  it("preserves SQL pipeline failure and the failing profile phase", () => {
    const result = runPair({ files: { "supabase/migrations/20260101000000_apply.sql": "MIRROR_FAIL_SQL;\n" } });
    expect(result.status).toBe(1);
    expect(result.profile).toContainEqual(expect.objectContaining({ phase: "migration/20260101000000_apply.sql", exit_code: 1 }));
  });

  it.each([{ PGHOST: "example.invalid" }, { DATABASE_URL: "blocked" }, { PGHOSTADDR: "127.0.0.1" }, { MIRROR_RELATIONS: "1" }, { MIRROR_GUARD_STATUS: "7" }])("preserves the safety guard for %j", env => {
    const result = runPair({ env });
    expect(result.status).toBe(1);
    expect(result.sql.length).toBe(0);
    expect(result.stderr).toContain("Refusing schema replay");
  });

  it("preserves every opt-in checkpoint before its exact migration", () => {
    const files = Object.fromEntries([
      "20261009005400_audit54_cierre_cxc_saldo_real.sql",
      "20261009010000_audit148_cobertura_documental_exacta.sql",
      "20261009010100_audit148_papelera_seguros.sql",
      "20261009012000_selector.sql",
      "20261009014000_pricing_container_rpc_guard.sql",
      "20261009031000_crm_leads_duplicados_scope.sql",
    ].map(name => ["supabase/migrations/" + name, "SELECT '" + name + "';\n"]));
    const result = runPair({ files, env: {
      AUD54_CI: "1", FINANCIAL49_CI: "1", SELECTOR148_ISOLATED_CI: "1",
      PRICING_CONTAINER_CI: "1", LEADS_SCOPE_CI: "1", ISOLATED_QA_DB: "1",
    } });
    expect(result.status).toBe(0);
    expect(result.profile.filter(row => row.phase.startsWith("checkpoint/")).map(row => row.phase)).toEqual([
      "checkpoint/audit54",
      "checkpoint/financial49/20261009010000_audit148_cobertura_documental_exacta.sql",
      "checkpoint/financial49/20261009010100_audit148_papelera_seguros.sql",
      "checkpoint/selector148", "checkpoint/pricing_container", "checkpoint/leads_scope",
    ]);
  });

  it("preserves an enabled but missing AUD54 checkpoint failure", () => {
    const result = runPair({ env: { AUD54_CI: "1", ISOLATED_QA_DB: "1" } });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("AUD54 runtime checkpoint was not executed");
  });

  it("preserves checkpoint command failure before migration SQL", () => {
    const name = "20261009014000_pricing_container_rpc_guard.sql";
    const result = runPair({ files: { ["supabase/migrations/" + name]: "SELECT 'never applied';\n" }, env: {
      PRICING_CONTAINER_CI: "1", MIRROR_FAIL_CHECKPOINT: "scripts/ci/pricing-container/test-envelope.mjs supabase/migrations/" + name,
    } });
    expect(result.status).toBe(9);
    expect(result.sql.toString()).not.toContain("never applied");
  });
});
