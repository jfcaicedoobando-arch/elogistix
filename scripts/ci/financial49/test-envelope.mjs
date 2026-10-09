#!/usr/bin/env node
/** Narrow installer controls. CI only; run immediately BEFORE the selected migration. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const settings = JSON.parse(readFileSync(new URL("./envelopes.json", import.meta.url), "utf8"));
const input = process.argv[2];
const config = settings[input];
assert(config, "Only the two registered financial49 files are supported");
assert.equal(process.env.GITHUB_ACTIONS, "true", "GitHub Actions ephemeral service only");
assert.equal(process.env.FINANCIAL49_CI, "1", "Explicit financial49 CI opt-in required");
assert(["localhost", "127.0.0.1"].includes(process.env.PGHOST), "Loopback required");
assert.equal(process.env.PGUSER, "postgres", "Existing postgres test owner required");
for (const key of ["DATABASE_URL", "SUPABASE_DB_URL", "PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE"]) {
  assert(!process.env[key], `Refusing connection override: ${key}`);
}
const parent = process.env.PGDATABASE;
assert(parent && /^[a-zA-Z0-9_]+$/.test(parent), "Explicit simple test database name required");
const source = readFileSync(input, "utf8");
assert.equal(hash(source), config.sha256, "Migration bytes differ from reviewed CI controls");
const run = randomUUID().replaceAll("-", "").slice(0, 12);
const directory = path.join(".financial49-logs", path.basename(input, ".sql"), run);
mkdirSync(directory, { recursive: true });
const owned = new Set();
const results = [];
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const envFor = (database) => ({ ...process.env, PGDATABASE: database, PGCONNECT_TIMEOUT: "5" });
function command(binary, args, database, stdin) {
  const result = spawnSync(binary, args, {
    env: envFor(database), input: stdin, encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
    timeout: 120_000,
  });
  if (result.error) throw result.error;
  return result;
}
function psql(database, sql, transaction = false) {
  return command("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", ...(transaction ? ["--single-transaction"] : []), "-f", "-"], database, sql);
}
function mustPass(result) {
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function clone(label) {
  const database = `fin49_${run}_${label}`;
  mustPass(psql("template1", `CREATE DATABASE "${database}" TEMPLATE "${parent}";`));
  owned.add(database);
  return database;
}
function snapshot(database) {
  const dump = command("pg_dump", ["--format=plain", "--no-password"], database);
  assert.equal(dump.status, 0, dump.stderr);
  const normalized = dump.stdout.replace(/^\\(?:un)?restrict .*\n/gm, "");
  const targets = config.signatures.map((signature) => `${quote(signature)}::regprocedure`).join(",");
  const metadata = mustPass(psql(database, `SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid)
    FROM pg_catalog.pg_proc p WHERE p.oid IN (${targets});`));
  return { dump: hash(normalized), targets: hash(metadata) };
}
function record(label, result, extra = {}) {
  writeFileSync(path.join(directory, `${label}.log`), result.stdout + result.stderr);
  results.push({ label, exit: result.status, ...extra });
  writeFileSync(path.join(directory, "results.json"), JSON.stringify(results, null, 2) + "\n");
}
function reject(label, sql, expected, prepare = "", transaction = true) {
  const database = clone(label);
  if (prepare) mustPass(psql(database, prepare));
  const before = snapshot(database);
  const result = psql(database, sql, transaction);
  record(label, result);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.match(result.stderr, expected, `${label} failed for an unrelated reason`);
  assert.deepEqual(snapshot(database), before, `${label} changed state despite refusal`);
}
try {
  const database = clone("success");
  const first = psql(database, source, true);
  record("first-apply", first); mustPass(first);
  const once = snapshot(database);
  const second = psql(database, source, true);
  record("second-apply", second); mustPass(second);
  assert.deepEqual(snapshot(database), once, "Second apply changed schema/data or target identities");

  const rollback = clone("caller_rollback");
  const before = snapshot(rollback);
  const result = psql(rollback, `BEGIN;\n${source}\nROLLBACK;`);
  record("caller-rollback", result); mustPass(result);
  assert.deepEqual(snapshot(rollback), before, "Migration took ownership of caller transaction");

  reject("autocommit", source, /SAVEPOINT.*transaction/i, "", false);
  const target = config.signatures[0];
  const rawDefinition = mustPass(psql(parent, `SELECT pg_get_functiondef(${quote(target)}::regprocedure);`));
  const delimiter = rawDefinition.match(/\bAS\s+(\$[A-Za-z_0-9]*\$)/)?.[1];
  assert(delimiter, "Cannot locate function dollar delimiter");
  const close = rawDefinition.lastIndexOf(delimiter);
  assert(close > rawDefinition.indexOf(delimiter));
  const unknown = rawDefinition.slice(0, close) + "\n-- financial49 unknown-body fixture\n" + rawDefinition.slice(close);
  reject("unknown_body", source, /FIN49_PRECONDITION: unreviewed target body/, unknown);
  reject("public_acl", source, /FIN49_PRECONDITION: PUBLIC and anon must already be closed/,
    `GRANT EXECUTE ON FUNCTION ${target} TO PUBLIC;`);
  const callable = config.callable;
  reject("missing_grant", source, /FIN49_PRECONDITION: matching direct authenticated grant required/,
    `REVOKE EXECUTE ON FUNCTION ${callable} FROM authenticated;`);
  reject("grant_option", source, /FIN49_PRECONDITION: unexpected ACL role, grantor or grant option/,
    `GRANT EXECUTE ON FUNCTION ${callable} TO authenticated WITH GRANT OPTION;`);
  if (config.privateTrigger) {
    reject("private_trigger", source, /FIN49_PRECONDITION: trigger must already be private/,
      `GRANT EXECUTE ON FUNCTION ${config.privateTrigger} TO authenticated;`);
  }
  const marker = `DO $${config.key}_post$`;
  assert.equal(source.split(marker).length, 2);
  const injected = source.replace(marker, `REVOKE EXECUTE ON FUNCTION ${callable} FROM authenticated;\n${marker}`);
  reject("postcondition", injected, /FIN49_INVARIANT: target identity, nonbody metadata or privileges changed/);
  console.log(`PASS financial49 ${input}: ${results.length} installer controls; no service_role grant added`);
} finally {
  const failed = [];
  for (const database of owned) {
    const result = psql("template1", `DROP DATABASE "${database}";`);
    if (result.status !== 0) failed.push({ database, error: result.stderr });
  }
  writeFileSync(path.join(directory, "cleanup.json"), JSON.stringify({ owned: [...owned], failed }, null, 2) + "\n");
  assert.equal(failed.length, 0, `Owned test database cleanup failed: ${JSON.stringify(failed)}`);
}
