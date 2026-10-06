#!/usr/bin/env node
/**
 * Local-only, normal-schema PG17 concurrency regressions. Requires psql in PATH
 * and an already migrated disposable database. Creates COMMITTED synthetic
 * fixtures so independent sessions can see them; dispose the database after use.
 * No API calls, role changes, grants, RLS tests, production URL or remote host.
 *
 * PROFORMA_TEST_LOCAL=1 PGPORT=55432 node scripts/db/test-proforma-consistency-concurrency.mjs
 * Optional: PSQL=/path/to/psql PGDATABASE=postgres PGUSER=postgres
 *
 * Lock rendezvous observes pg_stat_activity rather than assuming that a sleep
 * put a writer in the desired state. All writers use READ COMMITTED and ordinary
 * single-row domain mutations. These cases do not promise arbitrary multi-row
 * transactions are deadlock-free.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

if (process.env.PROFORMA_TEST_LOCAL !== '1') {
  throw new Error('Set PROFORMA_TEST_LOCAL=1 only for an ephemeral, migrated local test database.');
}
if (process.env.PGHOST && !['127.0.0.1', 'localhost', '::1'].includes(process.env.PGHOST)) {
  throw new Error('This test refuses non-loopback PGHOST.');
}
const env = { ...process.env, PGHOST: '127.0.0.1', PGHOSTADDR: '127.0.0.1',
  PGPORT: process.env.PGPORT || '55432', PGDATABASE: process.env.PGDATABASE || 'postgres',
  PGUSER: process.env.PGUSER || 'postgres', PGSSLMODE: 'disable', PGCONNECT_TIMEOUT: '5' };
// Never let service files or connection URLs select a different target.
for (const key of ['PGSERVICE', 'PGSERVICEFILE', 'DATABASE_URL', 'SUPABASE_DB_URL']) delete env[key];
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;

class Session {
  constructor(label) {
    this.label = `proforma_consistency_${runId}_${label}`;
    this.buffer = '';
    this.stderr = '';
    this.pending = null;
    this.failure = null;
    this.proc = spawn(process.env.PSQL || 'psql', ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], {
      env: { ...env, PGAPPNAME: this.label }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stderr.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => { this.buffer += chunk; this.drain(); });
    this.proc.stderr.on('data', (chunk) => { this.stderr += chunk; });
    this.proc.on('error', (error) => this.fail(error));
    this.proc.on('exit', (code, signal) => {
      if (this.pending || code) this.fail(new Error(`${this.label} exited ${code ?? signal}: ${this.stderr}`));
    });
  }
  fail(error) {
    this.failure = error;
    this.pending?.reject(error);
    this.pending = null;
  }
  drain() {
    if (!this.pending) return;
    const end = this.buffer.indexOf(`${this.pending.marker}\n`);
    if (end < 0) return;
    const result = this.buffer.slice(0, end).trim();
    this.buffer = this.buffer.slice(end + this.pending.marker.length + 1);
    const { resolve } = this.pending;
    this.pending = null;
    resolve(result);
  }
  query(sql) {
    if (this.failure) return Promise.reject(this.failure);
    if (this.pending) return Promise.reject(new Error(`Concurrent query on session ${this.label}`));
    const marker = `__done_${randomUUID().replaceAll('-', '')}__`;
    return new Promise((resolve, reject) => {
      this.pending = { marker, resolve, reject };
      this.proc.stdin.write(`${sql};\n\\echo ${marker}\n`);
    });
  }
  async close() {
    if (!this.failure && !this.pending) {
      try { await this.query('ROLLBACK'); } catch { /* Broken sessions already roll back on disconnect. */ }
    }
    this.proc.stdin.end();
    this.proc.kill('SIGTERM');
  }
}

const control = new Session('control');
const first = new Session('first');
const second = new Session('second');
const gate = new Session('gate');
const sessions = [control, first, second, gate];
const results = [];
const org = randomUUID();
const client = randomUUID();
let shipmentNumber = 90000;

async function waitForLock(session) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    if (session.failure) throw session.failure;
    const waiting = await control.query(`SELECT coalesce(bool_or(wait_event_type = 'Lock'), false)
      FROM pg_stat_activity WHERE application_name = ${literal(session.label)}`);
    if (waiting === 't') return;
    await delay(20);
  }
  throw new Error(`${session.label} never reached the expected lock rendezvous`);
}

async function shipment(state = 'Confirmado') {
  const id = randomUUID();
  await control.query(`INSERT INTO public.embarques(id, organization_id, cliente_id, expediente, modo, tipo, estado)
    VALUES (${literal(id)}, ${literal(org)}, ${literal(client)}, ${literal(`ELPCC${++shipmentNumber}`)}, 'Marítimo', 'Importación', ${literal(state)})`);
  return id;
}
async function proforma(emb, approval = 'aprobada') {
  const id = randomUUID();
  await control.query(`INSERT INTO public.proformas(id, organization_id, embarque_id, cliente_id,
      cliente_nombre, expediente, numero, estado_aprobacion)
    VALUES (${literal(id)}, ${literal(org)}, ${emb === null ? 'NULL' : literal(emb)}, ${literal(client)}, 'Synthetic concurrency client',
      ${literal(`TEST-PC-${emb}`)}, ${literal(`TEST-PC-${id}`)}, ${literal(approval)})`);
  return id;
}
async function concept(emb, pf) {
  const id = randomUUID();
  await control.query(`INSERT INTO public.conceptos_venta(id, organization_id, embarque_id, proforma_id, descripcion)
    VALUES (${literal(id)}, ${literal(org)}, ${literal(emb)}, ${literal(pf)}, 'Synthetic concurrency service')`);
  return id;
}
async function flags(expected, label) {
  for (const [id, value] of expected) {
    const observed = await control.query(`SELECT tiene_proforma FROM public.embarques WHERE id = ${literal(id)}`);
    assert.equal(observed, value ? 't' : 'f', `${label}: shipment ${id}`);
  }
  results.push({ case: label, result: 'pass' });
}
async function serialRace(sqlA, sqlB, rollbackFirst = false) {
  await first.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  await second.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  await first.query(sqlA);
  const pending = second.query(sqlB);
  // Register an error handler immediately while waiting on the lock rendezvous.
  pending.catch(() => {});
  await waitForLock(second);
  await first.query(rollbackFirst ? 'ROLLBACK' : 'COMMIT');
  await pending;
  await second.query('COMMIT');
}
async function oppositeMoves(embA, embB, sqlA, sqlB, label) {
  await gate.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  await gate.query(`SELECT id FROM public.embarques WHERE id IN (${literal(embA)}, ${literal(embB)})
    ORDER BY id FOR NO KEY UPDATE`);
  await first.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  await second.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  const pendingA = first.query(sqlA);
  pendingA.catch(() => {});
  await waitForLock(first);
  const pendingB = second.query(sqlB);
  pendingB.catch(() => {});
  await waitForLock(second);
  // Both writers must serialize through a common first lock: either the
  // sorted shipment tuple or (for concept moves) the sorted proforma advisory
  // locks that precede it. PostgreSQL need not expose every row lock as a
  // tuple entry, so also verify the explicit peer-blocking relationship.
  const waitedTuples = await control.query(`SELECT count(DISTINCT (l.relation, l.page, l.tuple))
    FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
    WHERE a.application_name IN (${literal(first.label)}, ${literal(second.label)})
      AND l.locktype = 'tuple' AND l.relation = 'public.embarques'::regclass`);
  const blocksPeer = await control.query(`SELECT coalesce(bool_or(
      b.pid = ANY(pg_blocking_pids(a.pid)) OR a.pid = ANY(pg_blocking_pids(b.pid))), false)
    FROM pg_stat_activity a CROSS JOIN pg_stat_activity b
    WHERE a.application_name = ${literal(first.label)} AND b.application_name = ${literal(second.label)}`);
  assert.ok(waitedTuples === '1' || blocksPeer === 't',
    `${label}: writers must queue through a common first lock, got ${waitedTuples} shipment tuples and peer blocking ${blocksPeer}`);
  await gate.query('COMMIT');
  // PostgreSQL may let either queued writer win after the gate releases.
  // Commit that winner immediately; do not accidentally make the test harness
  // hold it open while waiting for the other writer's shipment lock.
  const winner = await Promise.race([pendingA.then(() => first), pendingB.then(() => second)]);
  await winner.query('COMMIT');
  await (winner === first ? pendingB : pendingA);
  await (winner === first ? second : first).query('COMMIT');
}

try {
  await Promise.all(sessions.map((session) => session.query("SET statement_timeout = '20s'; SET lock_timeout = '15s'")));
  const version = await control.query('SHOW server_version_num');
  assert.ok(Number(version) >= 170000 && Number(version) < 180000, `PG17 required, got ${version}`);
  await control.query(`INSERT INTO public.organizations(id, nombre) VALUES (${literal(org)}, 'TEST proforma concurrency ${runId}');
    INSERT INTO public.clientes(id, organization_id, nombre, email)
      VALUES (${literal(client)}, ${literal(org)}, 'Synthetic concurrency client', ${literal(`pc-${runId}@example.invalid`)})`);

  {
    const emb = await shipment();
    const p1 = await proforma(emb); const p2 = await proforma(emb);
    await serialRace(`UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = ${literal(p1)}`,
      `UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = ${literal(p2)}`);
    await flags([[emb, false]], 'simultaneous cancellation of the last two operative proformas');
  }
  {
    const emb = await shipment();
    const pf = await proforma(emb, 'borrador');
    const c1 = await concept(emb, pf); const c2 = await concept(emb, pf);
    await serialRace(`UPDATE public.conceptos_venta SET proforma_id = NULL WHERE id = ${literal(c1)}`,
      `UPDATE public.conceptos_venta SET proforma_id = NULL WHERE id = ${literal(c2)}`);
    await flags([[emb, false]], 'concurrent removal of the final two live draft concepts');
  }
  {
    const emb = await shipment();
    const pf = await proforma(emb, 'borrador');
    const c1 = await concept(emb, pf); const c2 = await concept(emb, pf);
    await serialRace(`UPDATE public.conceptos_venta SET deleted_at = now() WHERE id = ${literal(c1)}`,
      `UPDATE public.conceptos_venta SET deleted_at = now() WHERE id = ${literal(c2)}`);
    await flags([[emb, false]], 'concurrent soft-delete-only removal of final live draft concepts');
  }
  {
    const emb = await shipment();
    const p1 = await proforma(emb); const p2 = await proforma(emb);
    await serialRace(`UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = ${literal(p1)}`,
      `UPDATE public.proformas SET estado_proforma = 'cancelada' WHERE id = ${literal(p2)}`, true);
    await flags([[emb, true]], 'waiting cancellation observes first writer rollback');
    assert.equal(await control.query(`SELECT estado_proforma FROM public.proformas WHERE id = ${literal(p1)}`), 'pendiente');
  }
  {
    const embA = await shipment(); const embB = await shipment();
    const pA = await proforma(embA); const pB = await proforma(embB);
    await oppositeMoves(embA, embB,
      `UPDATE public.proformas SET embarque_id = ${literal(embB)} WHERE id = ${literal(pA)}`,
      `UPDATE public.proformas SET embarque_id = ${literal(embA)} WHERE id = ${literal(pB)}`,
      'opposite proforma moves');
    await flags([[embA, true], [embB, true]], 'opposite single-row proforma moves use sorted locks');
    assert.equal(await control.query(`SELECT embarque_id FROM public.proformas WHERE id = ${literal(pA)}`), embB);
    assert.equal(await control.query(`SELECT embarque_id FROM public.proformas WHERE id = ${literal(pB)}`), embA);
  }
  {
    const embA = await shipment(); const embB = await shipment();
    const pA = await proforma(embA, 'borrador'); const pB = await proforma(embB, 'borrador');
    const cA = await concept(embA, pA); const cB = await concept(embB, pB);
    await oppositeMoves(embA, embB,
      `UPDATE public.conceptos_venta SET proforma_id = ${literal(pB)}, embarque_id = ${literal(embB)} WHERE id = ${literal(cA)}`,
      `UPDATE public.conceptos_venta SET proforma_id = ${literal(pA)}, embarque_id = ${literal(embA)} WHERE id = ${literal(cB)}`,
      'opposite concept moves');
    await flags([[embA, true], [embB, true]], 'opposite single-row concept moves use sorted locks');
  }
  // A separate autocommit transaction gives now() a different value: an
  // unchanged boolean must preserve both row identity and updated_at exactly.
  {
    const emb = await shipment(); const pf = await proforma(emb);
    const before = await control.query(`SELECT json_build_array(ctid::text, updated_at::text) FROM public.embarques WHERE id = ${literal(emb)}`);
    await control.query(`UPDATE public.proformas SET notas = 'ordinary metadata after concurrent operations' WHERE id = ${literal(pf)};
      SELECT public.recompute_embarque_tiene_proforma(${literal(emb)})`);
    const after = await control.query(`SELECT json_build_array(ctid::text, updated_at::text) FROM public.embarques WHERE id = ${literal(emb)}`);
    assert.equal(after, before, 'no-op recomputation must not write a row or change its timestamp');
    results.push({ case: 'no-op helper preserves shipment row and timestamp across transactions', result: 'pass' });
  }
  {
    const actor = randomUUID();
    await control.query(`INSERT INTO auth.users(id, email) VALUES (${literal(actor)}, ${literal(`pc-actor-${runId}@example.invalid`)});
      INSERT INTO public.organization_members(organization_id, user_id, role) VALUES (${literal(org)}, ${literal(actor)}, 'admin_org');
      INSERT INTO public.user_roles(user_id, role) VALUES (${literal(actor)}, 'admin_org')
        ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role`);
    const emb = await shipment('Por liquidar'); const cv = randomUUID();
    await control.query(`INSERT INTO public.conceptos_venta(id, organization_id, embarque_id, descripcion,
        cantidad, precio_unitario, total, aplica_iva, tipo_iva, tasa_iva_aplicada)
      VALUES (${literal(cv)}, ${literal(org)}, ${literal(emb)}, 'Close versus create', 1, 100, 100, true, 'gravado_16', 0.16)`);
    const claims = literal(JSON.stringify({ sub: actor }));
    await first.query(`SET request.jwt.claims = ${claims}`);
    await second.query(`SET request.jwt.claims = ${claims}`);
    await serialRace(`SELECT public.cerrar_embarque(${literal(emb)})`, `DO $test$
      BEGIN
        PERFORM public.crear_proforma_atomica(${literal(org)}, ${literal(emb)}, ${literal(client)},
          'Synthetic concurrency client', 'ELPCC99999', NULL, ARRAY[${literal(cv)}::uuid],
          0,0,0,100,16,116,NULL,'TEST',30,0.16,'{}'::jsonb);
        RAISE EXCEPTION 'PROFORMA_TEST_CREATE_AFTER_CLOSE_ALLOWED';
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT ILIKE '%cerrado%' THEN RAISE; END IF;
      END $test$`);
    assert.equal(await control.query(`SELECT estado FROM public.embarques WHERE id = ${literal(emb)}`), 'Cerrado');
    assert.equal(await control.query(`SELECT count(*) FROM public.proformas WHERE embarque_id = ${literal(emb)}`), '0');
    assert.equal(await control.query(`SELECT proforma_id IS NULL FROM public.conceptos_venta WHERE id = ${literal(cv)}`), 't');
    results.push({ case: 'concurrent creation waits for closure and requires reopening without partial writes', result: 'pass' });
    await first.query("SET request.jwt.claims = ''");
    await second.query("SET request.jwt.claims = ''");
  }
  {
    const emb = await shipment(); const pf = await proforma(null, 'borrador');
    const cv = randomUUID();
    await first.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await first.query(`INSERT INTO public.conceptos_venta(id, organization_id, embarque_id, proforma_id, descripcion)
      VALUES (${literal(cv)}, ${literal(org)}, ${literal(emb)}, ${literal(pf)}, 'Concept while proforma has no shipment')`);
    await second.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const moved = second.query(`UPDATE public.proformas SET embarque_id = ${literal(emb)} WHERE id = ${literal(pf)}`);
    moved.catch(() => {});
    // Either a coordinating lock blocks the move until the concept commits,
    // or the move completes first. The invariant must hold in both schedules.
    const completedEarly = await Promise.race([moved.then(() => true), delay(150).then(() => false)]);
    if (completedEarly) {
      await second.query('COMMIT');
      await first.query('COMMIT');
    } else {
      await waitForLock(second);
      await first.query('COMMIT');
      await moved;
      await second.query('COMMIT');
    }
    await flags([[emb, true]], 'live concept insertion concurrent with NULL-to-shipment proforma move');
  }
  {
    const emb = await shipment(); const pf = await proforma(null, 'borrador');
    const cv = await concept(emb, pf);
    await first.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await first.query(`UPDATE public.conceptos_venta SET proforma_id = NULL WHERE id = ${literal(cv)}`);
    await second.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const moved = second.query(`UPDATE public.proformas SET embarque_id = ${literal(emb)} WHERE id = ${literal(pf)}`);
    moved.catch(() => {});
    const completedEarly = await Promise.race([moved.then(() => true), delay(150).then(() => false)]);
    if (completedEarly) {
      await second.query('COMMIT');
      await first.query('COMMIT');
    } else {
      await waitForLock(second);
      await first.query('COMMIT');
      await moved;
      await second.query('COMMIT');
    }
    await flags([[emb, false]], 'last live concept unlink concurrent with NULL-to-shipment proforma move');
  }
  console.log(JSON.stringify({ postgres: version, schema: 'normal migrated schema', isolation: 'READ COMMITTED',
    syntheticOrganization: org, results, note: 'Committed synthetic fixtures remain only in this disposable local test database.' }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ results, failure: error.message }, null, 2));
  process.exitCode = 1;
} finally {
  await Promise.allSettled(sessions.map((session) => session.close()));
}
