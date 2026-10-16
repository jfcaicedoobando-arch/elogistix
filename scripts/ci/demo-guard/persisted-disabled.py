#!/usr/bin/env python3
"""Committed-state contract, callable only by the owned Actions clone runner.

No connection discovery, migrations, imports of old SQL definitions or stubbed
business functions. Each Context.query starts a distinct psql connection.
This file prepares a CI regression; static tests do not certify PostgreSQL.
"""
import json
import os
from pathlib import Path
import re
import uuid

ROOT = Path(__file__).resolve().parents[3]
SUITE = ROOT / 'supabase/tests/rls/test_rls_demo_seed_disabled.sql'
MARKERS = ('absent', 'old', 'recent')
SETUP_START = "   IF marker='absent' THEN DELETE FROM public.demo_seed_state;"
SETUP_END = '   END IF;'


def require(ok, message):
    if not ok:
        raise RuntimeError('DEMO_DISABLED_PERSISTED: ' + message)


def program(suite, schema):
    """Reuse the exact real-function matrix, only relocating its QA objects."""
    require(re.fullmatch(r'qa_demo_stop_[a-f0-9]{32}', schema) is not None, 'Owned QA schema required')
    require('CREATE OR REPLACE FUNCTION public.' not in suite, 'Protected definitions cannot be replaced')
    require(suite.count('\nBEGIN;\n') == 1 and suite.rstrip().endswith('ROLLBACK;'), 'Single rollback source expected')
    require(suite.count('DO $matrix$') == 1, 'Exact final matrix required')
    fixture, matrix = suite.split('DO $matrix$', 1)
    matrix = 'DO $matrix$' + matrix
    fixture = fixture.split('\nBEGIN;\n', 1)[1]
    fixture = re.sub(r'CREATE TEMP TABLE (qa_stop_\w+)', rf'CREATE TABLE {schema}.\1', fixture)
    fixture = re.sub(r'CREATE TEMP SEQUENCE (qa_stop_\w+)', rf'CREATE SEQUENCE {schema}.\1', fixture)
    fixture = fixture.replace('pg_temp.', schema + '.')
    matrix = matrix.replace('pg_temp.', schema + '.')
    require('CREATE TEMP ' not in fixture and 'pg_temp.' not in fixture + matrix, 'QA objects must survive setup COMMIT')
    require(matrix.count(SETUP_START) == 1, 'Exact marker setup required')
    start = matrix.index(SETUP_START)
    end = matrix.index(SETUP_END, start) + len(SETUP_END)
    matrix = matrix[:start] + '   -- Marker is already committed by the separate setup connection.' + matrix[end:]
    require(not re.search(r'(INSERT INTO|UPDATE|DELETE FROM) public\.', matrix), 'Probe phase must not prepare or repair application data')
    require('count(*)=45' in matrix and "ARRAY['absent','old','recent']" in matrix, 'Exact 45-call source expected')
    return fixture, matrix


def identity(phase):
    return "SELECT jsonb_build_object('phase','" + phase + "','pid',pg_backend_pid(),'database',current_database(),'user',current_user,'session',session_user,'address',inet_server_addr());\n"


def records(stdout):
    return [json.loads(line) for line in stdout.splitlines() if line.startswith('{')]


def run_persisted(context):
    require(os.environ.get('GITHUB_ACTIONS') == 'true' and os.environ.get('ISOLATED_QA_DB') == '1'
            and os.environ.get('DEMO_GUARD_DISPOSABLE') == '1', 'Explicit isolated Actions opt-in required')
    require(re.fullmatch(r'demo_guard_race_[a-f0-9]{32}', context.database) is not None, 'Owned final clone required')
    require(not any(os.environ.get(k) for k in ('DATABASE_URL', 'SUPABASE_DB_URL', 'PGSERVICE', 'PGSERVICEFILE', 'PGHOSTADDR')),
            'Ambient remote routing refused')
    out = context.evidence_dir / 'persisted-disabled'
    require(not out.exists(), 'Fresh evidence directory required')
    out.mkdir(parents=True)
    schema = 'qa_demo_stop_' + uuid.uuid4().hex
    fixture, matrix = program(SUITE.read_text(encoding='utf-8'), schema)
    result = {'status': 'running', 'source_commit': context.source_commit, 'database': context.database,
              'qa_schema': schema, 'calls': 0, 'attempted_DML': 0, 'cases': [],
              'real_functions': True, 'stubbed': False, 'runtime_tested': True}

    def save():
        (out / 'result.json').write_text(json.dumps(result, indent=2) + '\n')

    def query(sql, label):
        (out / (label + '.sql')).write_text(sql)
        stdout, stderr = context.query(sql, 'persisted-disabled-' + label, timeout=180)
        (out / (label + '.stdout.log')).write_text(stdout)
        (out / (label + '.stderr.log')).write_text(stderr)
        return records(stdout)

    # Only digests are emitted; QA schema objects are deliberately outside the
    # public/auth snapshot. All real business triggers, constraints and ACL stay.
    metadata = """
CREATE FUNCTION QA_SCHEMA.qa_stop_metadata() RETURNS jsonb LANGUAGE sql AS $meta$
 SELECT jsonb_build_object(
  'functions',(SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth')),
  'relations',(SELECT md5(coalesce(jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid)::text,'')) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')),
  'columns',(SELECT md5(coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum)::text,'')) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth')),
  'policies',(SELECT md5(coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid)::text,'')) FROM pg_policy p),
  'constraints',(SELECT md5(coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.oid)::text,'')) FROM pg_constraint c),
  'triggers',(SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.oid)::text,'')) FROM pg_trigger t),
  'roles',(SELECT md5(coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.oid)::text,'')) FROM pg_roles r));
$meta$;
CREATE TABLE QA_SCHEMA.qa_stop_checkpoint(marker text PRIMARY KEY, rows jsonb NOT NULL, metadata jsonb NOT NULL);
""".replace('QA_SCHEMA', schema)
    save()
    try:
        query('BEGIN;\n' + identity('fixture') + 'CREATE SCHEMA ' + schema + ';\n' + fixture + metadata
              + 'SET CONSTRAINTS ALL IMMEDIATE;\nCOMMIT;\n', 'fixture-commit')
        for index, marker in enumerate(MARKERS, 1):
            setup = "DELETE FROM public.demo_seed_state;\n"
            if marker != 'absent':
                timestamp = "'2000-01-01'::timestamptz" if marker == 'old' else 'clock_timestamp()'
                setup += 'INSERT INTO public.demo_seed_state(id,last_seeded_at) VALUES(true,' + timestamp + ');\n'
            setup += 'INSERT INTO ' + schema + '.qa_stop_checkpoint SELECT \'' + marker + "'," + schema + '.qa_stop_snapshot(),' + schema + '.qa_stop_metadata();\n'
            a = query('BEGIN;\n' + identity('A') + setup + 'SET CONSTRAINTS ALL IMMEDIATE;\nCOMMIT;\n', marker + '-A-commit')
            selected = matrix.replace("ARRAY['absent','old','recent']", "ARRAY['" + marker + "']")
            selected = selected.replace('count(*)=45', 'count(*)=' + str(15 * index))
            selected = selected.removesuffix('ROLLBACK;\n').removesuffix('ROLLBACK;')
            require('ROLLBACK;' not in selected and 'COMMIT;' not in selected, 'Probe transaction is owned by this phase')
            b = query('BEGIN;\n' + identity('B')
                      + "SELECT " + schema + ".qa_stop_assert((SELECT rows=" + schema + '.qa_stop_snapshot() AND metadata=' + schema + ".qa_stop_metadata() FROM " + schema + ".qa_stop_checkpoint WHERE marker='" + marker + "'),'reopened committed fixture snapshot');\n"
                      + selected + '\nCOMMIT;\n', marker + '-B-rejections-commit')
            verification = 'BEGIN READ ONLY;\n' + identity('C') + "SELECT jsonb_build_object('verified',rows=" + schema + '.qa_stop_snapshot() AND metadata=' + schema + ".qa_stop_metadata(),'marker','" + marker + "','calls',(SELECT count(*) FROM " + schema + '.qa_stop_runs),\n'
            verification += "'attempted_DML',(SELECT coalesce(sum(attempts),0) FROM " + schema + '.qa_stop_runs),\n'
            verification += "'routes',(SELECT count(DISTINCT route) FROM " + schema + ".qa_stop_runs),'transaction_read_only',current_setting('transaction_read_only')) FROM " + schema + ".qa_stop_checkpoint WHERE marker='" + marker + "';\nCOMMIT;\n"
            c = query(verification, marker + '-C-read-only')
            identities = [next((r for r in rows if r.get('phase') == phase), {}) for rows, phase in [(a, 'A'), (b, 'B'), (c, 'C')]]
            require(all(r.get('database') == context.database and r.get('user') == 'postgres' and r.get('session') == 'postgres' and r.get('address') is None for r in identities), 'Owned socket identity required in all three connections')
            require(len({r.get('pid') for r in identities}) == 3, 'Distinct A/B/C connections required')
            checks = [r for r in c if 'verified' in r]
            require(len(checks) == 1 and checks[0] == {'verified': True, 'marker': marker, 'calls': 15 * index,
                    'attempted_DML': 0, 'routes': 4, 'transaction_read_only': 'on'}, 'Committed application data, metadata or marker changed')
            result['cases'].append({'marker': marker, 'status': 'pass', 'connections': identities, 'verification': checks[0]})
            result['calls'] = 15 * index
            save()
        result['status'] = 'pass'
        return result
    except BaseException as error:
        result.update(status='fail', error_type=type(error).__name__, error=str(error))
        raise
    finally:
        save()


if __name__ == '__main__':
    raise SystemExit('Only the verified owned-clone Actions adapter may call this module')
