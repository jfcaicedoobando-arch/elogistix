#!/usr/bin/env node
/**
 * Local-only PG17 race regression. Requires an isolated, migrated database.
 * Commits synthetic fixtures for independent sessions; dispose the database.
 * NONCASH_TEST_LOCAL=1 PGPORT=55447 node scripts/db/test-noncash-bank-concurrency.mjs
 * Uses a gate and observed lock waits, never sleeps to guess writer readiness.
 * *-first labels identify submission order, not which writer executes first after release.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

if (process.env.NONCASH_TEST_LOCAL !== '1') {
  throw new Error('Set NONCASH_TEST_LOCAL=1 only for an ephemeral, migrated local test database.');
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
    this.label = `noncash_bank_${runId}_${label}`;
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
    if (this.closed) return;
    this.closed = true;
    if (!this.failure && !this.pending) {
      try { await this.query('ROLLBACK'); } catch { /* Broken sessions already roll back on disconnect. */ }
    }
    this.proc.stdin.end();
    this.proc.kill('SIGTERM');
  }
}


const control = new Session('control');
const sessions = [control];
const org = randomUUID(), actor = randomUUID(), provider = randomUUID();
const category = randomUUID(), account = randomUUID(), invoice = randomUUID();
const results = [];
async function waitForLock(session) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    if (session.failure) throw session.failure;
    const waiting = await control.query(`SELECT coalesce(bool_or(wait_event_type='Lock'),false)
      FROM pg_stat_activity WHERE application_name=${literal(session.label)}`);
    if (waiting === 't') return;
    await delay(20);
  }
  throw new Error(`${session.label}: writer did not reach the lock gate`);
}
try {
  assert.equal(await control.query('SHOW server_version_num'), '170009', 'PostgreSQL17.9 required');
  await control.query(`INSERT INTO auth.users(id,email) VALUES(${literal(actor)},${literal(`noncash-${runId}@test.local`)});
    INSERT INTO public.organizations(id,nombre) VALUES(${literal(org)},'TEST noncash race');
    INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(${literal(org)},${literal(actor)},'tesorero');
    INSERT INTO public.proveedores(id,organization_id,nombre,categoria,subtipo_gasto)
      VALUES(${literal(provider)},${literal(org)},'TEST noncash race','GastoOperativo','Otros');
    INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(${literal(category)},${literal(org)},'TEST noncash race');
    INSERT INTO public.cuentas_bancarias(id,organization_id,alias,moneda,saldo_inicial,fecha_saldo_inicial)
      VALUES(${literal(account)},${literal(org)},'TEST noncash race','MXN',100,public.fecha_negocio_mx()-30);
    INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,folio_proveedor,
      fecha_emision,moneda,tipo_cambio_usd,subtotal,total,estado,estado_aprobacion)
      VALUES(${literal(invoice)},${literal(org)},${literal(provider)},${literal(category)},'TEST noncash race',
        public.fecha_negocio_mx()-1,'MXN',1,100,100,'Vigente','aprobada')`);
  for (const isolation of ['READ COMMITTED', 'REPEATABLE READ']) {
    for (const adjustment of [false, true]) {
      for (const first of ['flag', 'bank']) {
        const label = `${isolation}/${adjustment ? 'adjustment' : 'ordinary'}/${first}-first`;
        const pay = randomUUID(), mov = randomUUID();
        await control.query(`INSERT INTO public.pagos_proveedor(id,organization_id,proveedor_factura_id,fecha_pago,monto,moneda,es_ajuste)
          VALUES(${literal(pay)},${literal(org)},${literal(invoice)},public.fecha_negocio_mx(),1,'MXN',${adjustment});
          INSERT INTO public.bbva_movimientos(id,organization_id,cuenta_bancaria_id,fecha,concepto,cargo,abono,hash_dedupe)
          VALUES(${literal(mov)},${literal(org)},${literal(account)},public.fecha_negocio_mx(),'TEST noncash race',1,0,${literal(mov)})`);
        const gate = new Session('gate'), flag = new Session('flag'), bank = new Session('bank');
        sessions.push(gate, flag, bank);
        await gate.query(`BEGIN; SELECT id FROM public.pagos_proveedor WHERE id=${literal(pay)} FOR UPDATE;
          SELECT id FROM public.bbva_movimientos WHERE id=${literal(mov)} FOR UPDATE`);
        for (const writer of [flag, bank]) {
          await writer.query(`BEGIN ISOLATION LEVEL ${isolation}; SET LOCAL statement_timeout='15s';
            SELECT set_config('request.jwt.claims',${literal(JSON.stringify({sub:actor,role:'authenticated'}))},true);
            SET LOCAL ROLE authenticated; SELECT es_ajuste FROM public.pagos_proveedor WHERE id=${literal(pay)}`);
        }
        const sqlFlag = `UPDATE public.pagos_proveedor SET es_ajuste=${!adjustment} WHERE id=${literal(pay)}`;
        const sqlBank = `UPDATE public.bbva_movimientos SET pago_proveedor_id=${literal(pay)},
          estado_conciliacion='Conciliado',conciliado_por=${literal(actor)} WHERE id=${literal(mov)}`;
        const run = (session, sql) => session.query(sql).then(() => ({ok:true})).catch(error => ({ok:false,error:String(error)}));
        let flagResult, bankResult;
        if (first === 'flag') { flagResult=run(flag,sqlFlag); bankResult=run(bank,sqlBank); }
        else { bankResult=run(bank,sqlBank); flagResult=run(flag,sqlFlag); }
        await waitForLock(flag);
        await waitForLock(bank);
        await gate.query('COMMIT');
        const [classification, linkage] = await Promise.all([flagResult,bankResult]);
        assert.equal(classification.ok,false,label);
        assert.match(classification.error,/LC_PAGO_CLASIFICACION_INMUTABLE/,label);
        assert.equal(linkage.ok,!adjustment,label);
        if (adjustment) assert.match(linkage.error,/LC_MOVIMIENTO_AJUSTE_NO_MONETARIO/,label);
        else await bank.query('COMMIT');
        const actual = await control.query(`SELECT json_build_object('adjustment',p.es_ajuste,'linked',m.pago_proveedor_id IS NOT NULL,
          'state',m.estado_conciliacion,'actor',m.conciliado_por)::text FROM public.pagos_proveedor p
          CROSS JOIN public.bbva_movimientos m WHERE p.id=${literal(pay)} AND m.id=${literal(mov)}`);
        assert.deepEqual(JSON.parse(actual), {adjustment,linked:!adjustment,
          state:adjustment?'Pendiente':'Conciliado',actor:adjustment?null:actor},label);
        results.push({case:label,result:'pass',lockRendezvous:true});
        await Promise.all([gate.close(),flag.close(),bank.close()]);
      }
    }
  }
  console.log(JSON.stringify({postgres:'17.9',cases:results.length,results},null,2));
} finally { await Promise.all(sessions.map(session => session.close())); }
