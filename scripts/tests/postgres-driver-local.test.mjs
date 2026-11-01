/**
 * Opt-in real-driver comparison, using ONLY a disposable Unix-socket database.
 * No application schema, migrations, credentials or remote endpoints are used.
 * See docs/qa/postgres4-driver-review.md for the isolated container recipe.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import postgres4 from 'postgres';

const enabled = process.env.POSTGRES_DRIVER_LOCAL === '1';
const socket = process.env.POSTGRES_DRIVER_SOCKET;
const baselinePath = process.env.POSTGRES_DRIVER_BASELINE;
const require = createRequire(import.meta.url);
const uuid = '00000000-0000-4000-8000-000000000001';

function versionOf(entry) {
  return JSON.parse(readFileSync(resolve(dirname(entry), '../package.json'), 'utf8')).version;
}

test('real Postgres.js 3/4 compatibility on a disposable local socket', { skip: !enabled, timeout: 45000 }, async (t) => {
  assert.match(socket ?? '', /^\/tmp\/elogistix-postgres-driver-[a-zA-Z0-9_-]+$/);
  assert.ok(baselinePath?.startsWith('/tmp/'), 'Explicit temporary postgres 3.4.9 module required');
  assert.equal(versionOf(baselinePath), '3.4.9');
  assert.equal(versionOf(require.resolve('postgres')), '4.0.0');
  const { default: postgres3 } = await import(pathToFileURL(baselinePath).href);
  const config = {
    host: socket, port: 5432, database: 'driver_compat', user: 'postgres',
    password: 'synthetic-driver-only', ssl: false, max: 1,
    connect_timeout: 3, onnotice() {},
  };
  const observations = {};

  for (const [version, factory] of [['3.4.9', postgres3], ['4.0.0', postgres4]]) {
    await t.test(version, async (v) => {
      const sql = factory({ ...config, connection: { application_name: `driver_review_${version}` } });
      try {
        const [identity] = await sql.unsafe(`select current_database() as db,
          current_setting('listen_addresses') as listen,
          current_setting('server_version') as version,
          (select count(*)::int from information_schema.tables where table_schema='public') as tables`);
        assert.equal(identity.db, 'driver_compat');
        assert.equal(identity.listen, '', 'Server must have no TCP listeners');
        assert.match(identity.version, /^17\.9\b/);
        assert.equal(identity.tables, 0, 'No application schema permitted');
        await sql.unsafe(`create temporary table driver_fixture (
          id uuid primary key, ids uuid[], payload jsonb, amount numeric(24,8),
          count_big bigint, label text check (length(label) > 0))`);

        await v.test('UUID, arrays, JSON, exact numerics and parameter binding', async () => {
          const payload = { synthetic: true, items: ['MXN', 'USD'], escaped: "'; select 1; --" };
          await sql.unsafe(`insert into driver_fixture values ($1::uuid, $2::uuid[], $3::jsonb,
            $4::numeric, $5::bigint, $6)`,
          [uuid, [uuid], payload, '1234567890123456.12345678', '9007199254740993', "synthetic ' $1"]);
          const [row] = await sql.unsafe('select * from driver_fixture where id=$1::uuid', [uuid]);
          assert.deepEqual({ ...row }, { id: uuid, ids: [uuid], payload,
            amount: '1234567890123456.12345678', count_big: '9007199254740993', label: "synthetic ' $1" });
          const [types] = await sql`select ${[uuid]}::uuid[] as ids,
            ${sql.json(payload)}::jsonb as payload, ${true}::boolean as flag`;
          assert.deepEqual({ ...types }, { ids: [uuid], payload, flag: true });
          const [empty] = await sql`select ${[]}::uuid[] as ids, ${null}::uuid as id`;
          assert.deepEqual({ ...empty }, { ids: [], id: null });
        });

        await v.test('prepared reuse, unprepared queries, values and simple batches', async () => {
          for (const prepare of [true, false]) {
            for (const n of [1, 2, 3]) {
              const rows = await sql.unsafe('select $1::int as n, $2::uuid as id', [n, uuid], { prepare }).values();
              assert.deepEqual([...rows[0]], [n, uuid]);
            }
          }
          const batches = await sql.unsafe('select 1 as n; select 2 as n').simple();
          assert.deepEqual(batches.map(rows => rows[0].n), [1, 2]);
          const [app] = await sql.unsafe("select current_setting('application_name') as name");
          assert.equal(app.name, `driver_review_${version}`);
        });

        await v.test('commit, application rollback, nested savepoint and SQL rollback', async () => {
          await sql.begin(async tx => {
            await tx.unsafe("update driver_fixture set label='committed'");
          });
          const abort = new Error('synthetic rollback');
          await assert.rejects(sql.begin(async tx => {
            await tx.unsafe("update driver_fixture set label='must rollback'");
            throw abort;
          }), error => error === abort);
          await sql.begin(async tx => {
            await assert.rejects(tx.savepoint(async sp => {
              await sp.unsafe("update driver_fixture set label='savepoint rollback'");
              throw abort;
            }), error => error === abort);
            const [row] = await tx.unsafe('select label from driver_fixture');
            assert.equal(row.label, 'committed');
          });
          await sql.unsafe("BEGIN; update driver_fixture set label='manual rollback'; ROLLBACK;").simple();
          const [row] = await sql.unsafe('select label from driver_fixture');
          assert.equal(row.label, 'committed');
        });

        await v.test('SQLSTATE and context survive constraint, UUID and aborted transactions', async () => {
          await assert.rejects(sql.unsafe('insert into driver_fixture (id) values ($1::uuid)', [uuid]),
            error => error.code === '23505' && error.constraint_name === 'driver_fixture_pkey');
          await assert.rejects(sql.unsafe("update driver_fixture set label=''") , error => error.code === '23514');
          await assert.rejects(sql.unsafe('select $1::uuid', ['invalid-synthetic-uuid']), error => error.code === '22P02');
          await assert.rejects(sql.unsafe("DO $test$ BEGIN RAISE EXCEPTION 'synthetic context' USING ERRCODE='P0001'; END $test$;").simple(),
            error => error.code === 'P0001' && error.message.includes('synthetic context') && error.where.includes('inline_code_block'));
          await sql.unsafe('BEGIN').simple();
          await assert.rejects(sql.unsafe('select 1/0'), error => error.code === '22012');
          await assert.rejects(sql.unsafe('select 1'), error => error.code === '25P02');
          await sql.unsafe('ROLLBACK').simple();
          assert.equal((await sql.unsafe('select 1 as n'))[0].n, 1);
        });

        await v.test('deadlock code used by the proforma fixture', async () => {
          const rival = factory({ ...config, connection: { application_name: `driver_rival_${version}` } });
          try {
            await rival.unsafe("set deadlock_timeout='50ms'");
            await sql.unsafe("set deadlock_timeout='50ms'");
            await sql.unsafe('BEGIN').simple();
            await rival.unsafe('BEGIN').simple();
            await sql.unsafe('select pg_advisory_xact_lock(761301)');
            await rival.unsafe('select pg_advisory_xact_lock(761302)');
            const pending = [sql.unsafe('select pg_advisory_xact_lock(761302)'),
              rival.unsafe('select pg_advisory_xact_lock(761301)')];
            const results = await Promise.allSettled(pending);
            assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === '40P01').length, 1);
            assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
          } finally {
            await Promise.all([sql.unsafe('ROLLBACK').simple(), rival.unsafe('ROLLBACK').simple()]);
            await rival.end({ timeout: 2 });
          }
        });

        await v.test('documented v4 inference and swallowed SQL failure rollback', async () => {
          await sql.unsafe("SET TIME ZONE 'America/Mexico_City'");
          const date = new Date('2026-11-01T00:30:00.000Z');
          const [dates] = await sql`select (${date}::date)::text as day,
            ${date}::timestamptz as instant`;
          assert.equal(dates.day, version === '3.4.9' ? '2026-10-31' : '2026-11-01');
          assert.equal(dates.instant.toISOString(), date.toISOString());
          const [boolean] = await sql`select ${true} as value`;
          assert.equal(boolean.value, version === '3.4.9' ? true : 'true');
          const swallowedFailure = sql.begin(async tx => {
            try { await tx.unsafe('select 1/0'); } catch { /* Compare commit on aborted transaction. */ }
          });
          await assert.rejects(swallowedFailure, error => error.code === '22012');
          observations[version] = { server: identity.version, dateCast: dates.day,
            bareBooleanType: typeof boolean.value,
            swallowedErrorCommit: 'rejected:22012' };
        });
      } finally {
        await sql.end({ timeout: 2 });
      }
    });
  }
  await t.test('real Drizzle ESM and CJS queries with explicit clients', async () => {
    const orm = await import('drizzle-orm');
    const { pgTable, uuid: uuidColumn, jsonb, numeric } = await import('drizzle-orm/pg-core');
    const esm = await import('drizzle-orm/postgres-js');
    const cjs = require('drizzle-orm/postgres-js');
    const table = pgTable('driver_orm_fixture', {
      id: uuidColumn('id').primaryKey(), payload: jsonb('payload'), amount: numeric('amount'),
    });
    for (const [mode, drizzle] of [['esm', esm.drizzle], ['cjs', cjs.drizzle]]) {
      const client = postgres4(config);
      try {
        await client.unsafe('create temporary table driver_orm_fixture (id uuid primary key, payload jsonb, amount numeric)');
        const db = drizzle({ client });
        const expected = { id: uuid, payload: { synthetic: true, mode }, amount: '1234567890.12345678' };
        assert.deepEqual(await db.insert(table).values(expected).returning(), [expected]);
        const prepared = db.select().from(table).where(orm.eq(table.id, orm.placeholder('id'))).prepare(`driver_${mode}`);
        for (let i = 0; i < 3; i++) assert.deepEqual(await prepared.execute({ id: uuid }), [expected]);
        await assert.rejects(db.transaction(async tx => {
          await tx.delete(table);
          throw new Error('synthetic ORM rollback');
        }), /synthetic ORM rollback/);
        assert.deepEqual(await db.select().from(table), [expected]);
      } finally {
        await client.end({ timeout: 2 });
      }
    }
  });
  t.diagnostic(JSON.stringify(observations));
});
