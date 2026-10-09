#!/usr/bin/env node
/** Target-only installer controls, immediately before the registered forward in ephemeral CI. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const config = JSON.parse(readFileSync(new URL("./envelope.json", import.meta.url), "utf8"));
assert.equal(process.argv[2], config.migration, "Only the registered leads forward is supported");
assert.equal(process.env.GITHUB_ACTIONS, "true", "Ephemeral GitHub Actions service required");
assert.equal(process.env.LEADS_SCOPE_CI, "1", "Explicit leads-scope CI opt-in required");
assert(["localhost", "127.0.0.1"].includes(process.env.PGHOST), "Loopback required");
assert.equal(process.env.PGUSER, "postgres", "Existing postgres test owner required");
for (const key of ["DATABASE_URL", "SUPABASE_DB_URL", "PGHOSTADDR", "PGSERVICE", "PGSERVICEFILE"]) {
  assert(!process.env[key], `Refusing connection override: ${key}`);
}
const parent = process.env.PGDATABASE;
assert(parent && /^[a-zA-Z0-9_]+$/.test(parent), "Explicit simple test database name required");
const source = readFileSync(config.migration, "utf8");
assert.equal(sha(source), config.sha256, "Migration bytes differ from registered controls");
const run = randomUUID().replaceAll("-", "").slice(0, 12);
const directory = path.join(".leads-scope-logs", run);
mkdirSync(directory, { recursive: true });
const owned = new Set();
const cleaned = [];
const results = [];
const target = config.signature;
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
function command(binary, args, database, input) {
  const result = spawnSync(binary, args, {
    env: { ...process.env, PGDATABASE: database, PGCONNECT_TIMEOUT: "5" },
    input, encoding: "utf8", timeout: 120_000, maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}
function psql(database, sql, transaction = false) {
  return command("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1",
    ...(transaction ? ["--single-transaction"] : []), "-f", "-"], database, sql);
}
function pass(result) {
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function clone(label) {
  const database = `leads_${run}_${label}`;
  pass(psql("template1", `CREATE DATABASE "${database}" TEMPLATE "${parent}";`));
  owned.add(database);
  return database;
}
function drop(database) {
  pass(psql("template1", `DROP DATABASE "${database}";`));
  owned.delete(database);
  cleaned.push(database);
}
function snapshot(database) {
  const dump = command("pg_dump", ["--format=plain", "--no-password"], database);
  pass(dump);
  const catalog = pass(psql(database, `SELECT jsonb_build_object(
    'target',(SELECT to_jsonb(p) FROM pg_proc p WHERE p.oid=${quote(target)}::regprocedure),
    'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.oid) FROM pg_roles r),
    'members',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_auth_members m),
    'effective',(SELECT jsonb_agg(jsonb_build_object('role',r.oid,
      'execute',has_function_privilege(r.oid,${quote(target)},'EXECUTE'),
      'grant',has_function_privilege(r.oid,${quote(target)},'EXECUTE WITH GRANT OPTION'))
      ORDER BY r.oid) FROM pg_roles r));`));
  return { dump: sha(dump.stdout.replace(/^\\(?:un)?restrict .*\n/gm, "")), catalog: sha(catalog) };
}
function record(label, result) {
  writeFileSync(path.join(directory, `${label}.log`), result.stdout + result.stderr);
  results.push({ label, exit: result.status });
  writeFileSync(path.join(directory, "results.json"), JSON.stringify(results, null, 2) + "\n");
}
function reject(label, sql, expected, prepare = "", transaction = true) {
  const database = clone(label);
  const before = snapshot(database);
  // Preparation is in the SAME transaction as refusal, including cluster role
  // membership changes. An aborted control cannot leak grants to another case.
  const result = psql(database, `${prepare}\n${sql}`, transaction);
  record(label, result);
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.match(result.stderr, expected, `${label} failed for an unrelated reason`);
  assert.deepEqual(snapshot(database), before, `${label} changed schema, data, roles or privileges`);
  drop(database);
}
function mutateBeforePost(sql) {
  const marker = "DO $leads_scope_post$";
  assert.equal(source.split(marker).length, 2, "Unique postcondition marker required");
  return source.replace(marker, `${sql}\n${marker}`);
}
try {
  const database = clone("success");
  const first = psql(database, source, true);
  record("first-apply", first); pass(first);
  const once = snapshot(database);
  const second = psql(database, source, true);
  record("second-apply", second); pass(second);
  assert.deepEqual(snapshot(database), once, "Second application changed state");
  const ownerGrant = pass(psql(database, `SELECT has_function_privilege('postgres',${quote(target)},'EXECUTE WITH GRANT OPTION');`));
  assert.equal(ownerGrant, "t", "Owner must retain the legitimate effective grant option");
  drop(database);

  const rollback = clone("caller_rollback");
  const before = snapshot(rollback);
  const result = psql(rollback, `BEGIN;\n${source}\nROLLBACK;`);
  record("caller-rollback", result); pass(result);
  assert.deepEqual(snapshot(rollback), before, "Migration committed caller-owned work");
  drop(rollback);

  reject("autocommit", source, /SAVEPOINT.*transaction/i, "", false);
  const definition = pass(psql(parent, `SELECT pg_get_functiondef(${quote(target)}::regprocedure);`));
  const delimiter = definition.match(/\bAS\s+(\$[A-Za-z_0-9]*\$)/)?.[1];
  assert(delimiter, "Cannot locate predecessor dollar delimiter");
  const close = definition.lastIndexOf(delimiter);
  assert(close > definition.indexOf(delimiter));
  const unknown = definition.slice(0, close) + "\n-- unreviewed leads fixture\n" + definition.slice(close) + ";";
  reject("unknown_body", source, /LEADS_SCOPE_PRECONDITION: unreviewed target body/, unknown);
  reject("missing_target", source, /LEADS_SCOPE_PRECONDITION: target must already exist/,
    `ALTER FUNCTION ${target} RENAME TO leads_scope_missing_fixture;`);
  reject("wrong_owner", source, /LEADS_SCOPE_PRECONDITION: unexpected owner/,
    `ALTER FUNCTION ${target} OWNER TO service_role;`);
  reject("wrong_cost", source, /LEADS_SCOPE_PRECONDITION: unexpected owner/,
    `ALTER FUNCTION ${target} COST 101;`);
  reject("wrong_rows", source, /LEADS_SCOPE_PRECONDITION: unexpected owner/,
    `ALTER FUNCTION ${target} ROWS 999;`);
  reject("wrong_volatility", source, /LEADS_SCOPE_PRECONDITION: unexpected owner/,
    `ALTER FUNCTION ${target} VOLATILE;`);
  reject("wrong_security", source, /LEADS_SCOPE_PRECONDITION: unexpected owner/,
    `ALTER FUNCTION ${target} SECURITY INVOKER;`);
  reject("wrong_path", source, /LEADS_SCOPE_PRECONDITION: unexpected owner/,
    `ALTER FUNCTION ${target} SET search_path TO public, pg_temp;`);
  for (const [label, sql] of [
    ["public_acl", `GRANT EXECUTE ON FUNCTION ${target} TO PUBLIC;`],
    ["anon_acl", `GRANT EXECUTE ON FUNCTION ${target} TO anon;`],
    ["missing_auth_grant", `REVOKE EXECUTE ON FUNCTION ${target} FROM authenticated;`],
    ["missing_service_grant", `REVOKE EXECUTE ON FUNCTION ${target} FROM service_role;`],
    ["direct_grant_option", `GRANT EXECUTE ON FUNCTION ${target} TO authenticated WITH GRANT OPTION;`],
    ["unexpected_grantee", `GRANT EXECUTE ON FUNCTION ${target} TO authenticator;`],
  ]) reject(label, source, /LEADS_SCOPE_PRECONDITION: unexpected direct ACL/, sql);
  reject("inherited_anon", source, /LEADS_SCOPE_PRECONDITION: unexpected effective/,
    "GRANT authenticated TO anon WITH INHERIT TRUE;");
  reject("inherited_auth_option", source, /LEADS_SCOPE_PRECONDITION: unexpected effective/,
    "GRANT postgres TO authenticated WITH INHERIT TRUE;");
  reject("inherited_service_option", source, /LEADS_SCOPE_PRECONDITION: unexpected effective/,
    "GRANT postgres TO service_role WITH INHERIT TRUE;");
  reject("post_acl", mutateBeforePost(`GRANT EXECUTE ON FUNCTION ${target} TO anon;`),
    /LEADS_SCOPE_INVARIANT: identity, nonbody metadata or privileges changed/);
  reject("post_metadata", mutateBeforePost(`ALTER FUNCTION ${target} COST 101;`),
    /LEADS_SCOPE_INVARIANT: identity, nonbody metadata or privileges changed/);
  reject("post_body", mutateBeforePost(unknown), /LEADS_SCOPE_INVARIANT: final body differs/);
  reject("transaction_snapshot", source.replace("DO $leads_scope_post$",
    "SELECT set_config('librecarga.leads_scope_snapshot','',true);\nDO $leads_scope_post$"),
  /LEADS_SCOPE_TRANSACTION: missing target or transaction snapshot/);
  console.log(`PASS leads-scope: ${results.length} installer controls; owner grant option retained`);
} finally {
  const failed = [];
  for (const database of owned) {
    const result = psql("template1", `DROP DATABASE "${database}";`);
    if (result.status !== 0) failed.push({ database, error: result.stderr });
    else cleaned.push(database);
  }
  writeFileSync(path.join(directory, "cleanup.json"), JSON.stringify({ cleaned, failed }, null, 2) + "\n");
  assert.equal(failed.length, 0, `Owned database cleanup failed: ${JSON.stringify(failed)}`);
}
