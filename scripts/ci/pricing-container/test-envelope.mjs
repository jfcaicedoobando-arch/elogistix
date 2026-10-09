#!/usr/bin/env node
/** CI-only pre-installer controls on owned clones of the real predecessor schema. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const config = JSON.parse(readFileSync(new URL("./envelope.json", import.meta.url), "utf8"));
assert.equal(process.argv[2], config.migration, "Only the registered container guard installer is supported");
assert.equal(process.env.GITHUB_ACTIONS, "true", "GitHub Actions ephemeral service only");
assert.equal(process.env.PRICING_CONTAINER_CI, "1", "Explicit container guard CI opt-in required");
assert(["localhost", "127.0.0.1"].includes(process.env.PGHOST), "Loopback required");
assert.equal(process.env.PGUSER, "postgres", "Existing postgres test owner required");
for (const key of ["DATABASE_URL", "SUPABASE_DB_URL", "PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE"]) {
  assert(!process.env[key], `Refusing connection override: ${key}`);
}
const parent = process.env.PGDATABASE;
assert(parent && /^[a-zA-Z0-9_]+$/.test(parent), "Explicit simple test database name required");
const source = readFileSync(config.migration, "utf8");
assert.equal(hash(source), config.sha256, "Migration bytes differ from the checked CI controls");
const run = randomUUID().replaceAll("-", "").slice(0, 12);
const directory = path.join(".pricing-container-logs", run);
mkdirSync(directory, { recursive: true });
const owned = new Set();
const results = [];
const target = config.signature;
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
function command(binary, args, database, stdin) {
  const result = spawnSync(binary, args, {
    env: { ...process.env, PGDATABASE: database, PGCONNECT_TIMEOUT: "5" },
    input: stdin, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120_000,
  });
  if (result.error) throw result.error;
  return result;
}
function psql(database, sql, transaction = false) {
  return command("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
    ...(transaction ? ["--single-transaction"] : []), "-f", "-"], database, sql);
}
function mustPass(result) {
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function clone(label) {
  const database = `pcg_${run}_${label}`;
  mustPass(psql("template1", `CREATE DATABASE "${database}" TEMPLATE "${parent}";`));
  owned.add(database);
  return database;
}
function snapshot(database) {
  const dump = command("pg_dump", ["--format=plain", "--no-password"], database);
  assert.equal(dump.status, 0, dump.stderr);
  const normalized = dump.stdout.replace(/^\\(?:un)?restrict .*\n/gm, "");
  const metadata = mustPass(psql(database, `SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
    FROM pg_catalog.pg_proc p WHERE p.oid=to_regprocedure(${quote(target)});`));
  return { dump: hash(normalized), target: hash(metadata) };
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
  assert.deepEqual(snapshot(database), once, "Second apply changed schema/data or function identity");
  const assertion = readFileSync("supabase/tests/rls/_ci_check_pricing_container_acl.sql", "utf8");
  const asserted = psql(database, assertion);
  record("pre-harness-assertion", asserted); mustPass(asserted);
  const rollback = clone("caller_rollback");
  const before = snapshot(rollback);
  const result = psql(rollback, `BEGIN;\n${source}\nROLLBACK;`);
  record("caller-rollback", result); mustPass(result);
  assert.deepEqual(snapshot(rollback), before, "Migration took ownership of caller transaction");

  reject("autocommit", source, /SAVEPOINT.*transaction/i, "", false);
  const raw = mustPass(psql(parent, `SELECT pg_get_functiondef(${quote(target)}::regprocedure);`));
  const delimiter = raw.match(/\bAS\s+(\$[A-Za-z_0-9]*\$)/)?.[1];
  assert(delimiter, "Cannot locate predecessor body delimiter");
  const close = raw.lastIndexOf(delimiter);
  assert(close > raw.indexOf(delimiter));
  const unknown = raw.slice(0, close) + "\n-- unknown-body CI fixture\n" + raw.slice(close);
  reject("unknown_body", source, /PRICING_CONTAINER_PRECONDITION: unreviewed target body/, unknown);
  reject("missing_target", source, /PRICING_CONTAINER_PRECONDITION: target must already exist/,
    `DROP FUNCTION ${target};`);
  for (const [label, prepare] of [
    ["public_acl", `GRANT EXECUTE ON FUNCTION ${target} TO PUBLIC;`],
    ["anon_acl", `GRANT EXECUTE ON FUNCTION ${target} TO anon;`],
    ["missing_auth", `REVOKE EXECUTE ON FUNCTION ${target} FROM authenticated;`],
    ["missing_service", `REVOKE EXECUTE ON FUNCTION ${target} FROM service_role;`],
    ["grant_option", `GRANT EXECUTE ON FUNCTION ${target} TO authenticated WITH GRANT OPTION;`],
    ["extra_role", `GRANT EXECUTE ON FUNCTION ${target} TO supabase_admin;`],
  ]) reject(label, source, /PRICING_CONTAINER_PRECONDITION: exact existing.*ACL required/, prepare);
  for (const [label, clause] of [
    ["owner", "OWNER TO authenticated"], ["invoker", "SECURITY INVOKER"],
    ["search_path", "SET search_path TO public, pg_temp"], ["volatility", "STABLE"],
    ["strict", "STRICT"], ["cost", "COST 101"],
  ]) reject(label, source, /PRICING_CONTAINER_PRECONDITION: unexpected owner, signature or attributes/,
    `ALTER FUNCTION ${target} ${clause};`);
  const marker = "DO $pricing_container_post$";
  assert.equal(source.split(marker).length, 2);
  const injected = source.replace(marker, `REVOKE EXECUTE ON FUNCTION ${target} FROM authenticated;\n${marker}`);
  reject("postcondition", injected, /PRICING_CONTAINER_INVARIANT: target identity, attributes, ACL or expected body changed/);
  console.log(`PASS container guard: ${results.length} real-schema installer controls`);
} finally {
  const failed = [];
  for (const database of owned) {
    const result = psql("template1", `DROP DATABASE "${database}";`);
    if (result.status !== 0) failed.push({ database, error: result.stderr });
  }
  writeFileSync(path.join(directory, "cleanup.json"), JSON.stringify({ owned: [...owned], failed }, null, 2) + "\n");
  assert.equal(failed.length, 0, `Owned clone cleanup failed: ${JSON.stringify(failed)}`);
}
