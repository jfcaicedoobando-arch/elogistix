#!/usr/bin/env node
/**
 * Local-only red/green reproduction of the fixture signup/DOF lock inversion.
 * Requires a fresh CI-replayed disposable PG17 database, including the REAL
 * auth.users signup trigger. Preserves the audit122/125 assertions and body,
 * adding a transactional actor/gate to force the observed CI schedule.
 * No external services/PAC calls, role grants, security probes or production data.
 *
 * PROFORMA_TEST_LOCAL=1 PGPORT=55478 node scripts/db/test-proforma-fixture-lock-order.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import postgres from 'postgres';

if (process.env.PROFORMA_TEST_LOCAL !== '1') throw new Error('Disposable local test database required');
if (process.env.PGHOST && !['127.0.0.1', 'localhost'].includes(process.env.PGHOST)) {
  throw new Error('Non-loopback host refused');
}
for (const key of ['PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'DATABASE_URL', 'SUPABASE_DB_URL']) {
  if (process.env[key]) throw new Error(`${key} must be unset`);
}
const config = { host: '127.0.0.1', port: Number(process.env.PGPORT || 55478),
  database: process.env.PGDATABASE || 'postgres', user: process.env.PGUSER || 'postgres',
  ssl: false, max: 1, connect_timeout: 5, onnotice() {} };
const control = postgres({ ...config, connection: { application_name: 'proforma_fixture_control' } });
const fixturePath = 'supabase/tests/proforma_no_objeto_snapshot.sql';
const current = readFileSync(fixturePath, 'utf8');
const signup = "  INSERT INTO auth.users(id, email) VALUES (v_uid, 'no-objeto-consolidation@example.invalid');\n";
assert.equal(current.split(signup).length, 2, 'Expected one real signup statement');
const organization = "  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'TEST no objeto consolidation');\n";
// Reconstruct only the prior ordering; all assertions and domain calls remain identical.
const previous = current.replace(signup, '').replace(organization, organization + signup);
const competitor = readFileSync('supabase/tests/audit122_125_nc_proveedor_base_valuacion.sql', 'utf8')
  .replace(/^\\i (.+)$/gm, (_, path) => readFileSync(path.trim(), 'utf8'));
const gate = 853517;

async function waitingFor(label, blocker) {
  const until = Date.now() + 7000;
  while (Date.now() < until) {
    const rows = await control.unsafe(`SELECT EXISTS (
      SELECT 1 FROM pg_stat_activity a JOIN pg_stat_activity b ON b.pid = ANY(pg_blocking_pids(a.pid))
      WHERE a.application_name = $1 AND b.application_name = $2 AND a.wait_event_type = 'Lock'
    ) AS waiting`, [label, blocker]);
    if (rows[0].waiting) return;
    await delay(20);
  }
  throw new Error(`Expected lock rendezvous missing: ${label} blocked by ${blocker}`);
}
async function run(sql, source) {
  try { await sql.unsafe(source).simple(); return { ok: true }; }
  catch (error) {
    await sql.unsafe('ROLLBACK').simple();
    return { ok: false, code: error.code, message: error.message, where: error.where };
  }
}
async function pair(source, label) {
  const rivalName = `proforma_fixture_competitor_${label}`;
  const subjectName = `proforma_fixture_subject_${label}`;
  const rival = postgres({ ...config, connection: { application_name: rivalName } });
  const subject = postgres({ ...config, connection: { application_name: subjectName } });
  try {
    // Align both test sessions to the competitor's business date; no clock mutation.
    await Promise.all([rival.unsafe("SET TIME ZONE 'America/Mexico_City'"),
      subject.unsafe("SET TIME ZONE 'America/Mexico_City'")]);
    await control.unsafe(`SELECT pg_advisory_lock(${gate})`);
    const gated = competitor.replace('BEGIN;', `BEGIN;
      INSERT INTO auth.users(id, email) VALUES (gen_random_uuid(), 'fixture-gate@example.invalid');
      SELECT pg_advisory_xact_lock(${gate});`);
    const rivalResult = run(rival, gated);
    await waitingFor(rivalName, 'proforma_fixture_control');
    const subjectResult = run(subject, source);
    await waitingFor(subjectName, rivalName);
    await control.unsafe(`SELECT pg_advisory_unlock(${gate})`);
    return { label, competitor: await rivalResult, subject: await subjectResult };
  } finally {
    await control.unsafe(`SELECT pg_advisory_unlock(${gate})`);
    await Promise.all([rival.end({ timeout: 2 }), subject.end({ timeout: 2 })]);
  }
}
try {
  const trigger = await control.unsafe(`SELECT EXISTS (
    SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'auth.users'::regclass
      AND t.tgname = 'on_auth_user_created' AND t.tgenabled = 'O'
      AND t.tgfoid = 'public.handle_new_user_signup()'::regprocedure
  ) AS present`);
  assert.equal(trigger[0].present, true, 'Real CI signup trigger must be installed and enabled');
  const [rate] = await control.unsafe('SELECT count(*)::int AS n FROM public.tipos_cambio_dof WHERE fecha = public.fecha_negocio_mx()');
  assert.equal(rate.n, 0, 'Use a fresh disposable database; the test does not delete shared rows');
  const red = await pair(previous, 'old');
  assert.ok([red.competitor, red.subject].some((r) => r.code === '40P01'), 'Prior order must reproduce a deadlock');
  const green = await pair(current, 'fixed');
  assert.equal(green.competitor.ok, true, JSON.stringify(green));
  assert.equal(green.subject.ok, true, JSON.stringify(green));
  console.log(JSON.stringify({ realSignupTrigger: true, red, green }, null, 2));
} finally { await control.end({ timeout: 2 }); }
