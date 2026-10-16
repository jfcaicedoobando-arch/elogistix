"""Offline observation-contract/mutation checks; never execute SQL or Docker.

These source checks do not certify COMMIT or substitute financial/authentication
oracles. Actions must run the pinned canonical functions on independent sessions.
"""
from pathlib import Path
import re
import unittest


HERE = Path(__file__).resolve().parent
SQL = HERE / 'sql'
SETUP = (SQL / 'setup-observation.sql').read_text(encoding='utf-8')
BUSINESS = (SQL / 'business.sql').read_text(encoding='utf-8')
OBSERVE = (SQL / 'observe.sql').read_text(encoding='utf-8')
RETRY = (SQL / 'retry.sql').read_text(encoding='utf-8')
FAILED = (SQL / 'observe-failed.sql').read_text(encoding='utf-8')


def code(text):
    return re.sub(r'--[^\n]*', '', text)


def require(ok, message):
    if not ok:
        raise ValueError(message)


def helper(text, name):
    match = re.search(r'CREATE FUNCTION demo_financial_commit_lab\.' + re.escape(name)
                      + r'\([^;]*?AS \$fn\$(.*?)END \$fn\$;', text, re.S)
    require(match is not None, 'required synthetic helper')
    return match[1]


def snapshot_contract(text):
    snapshot = helper(text, 'snapshot')
    require("n.nspname IN('public','auth','demo_flow_writer','demo_fixture_identity','financial_compile_fixture')" in snapshot,
            'all five schemas, metadata excluded')
    require("c.relkind IN('r','p')" in snapshot, 'all ordinary and partitioned tables')
    require("jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)" in snapshot, 'every column and stable row order')
    require("FROM %I.%I t'" in snapshot, 'no source-row filter')
    require("result:=result||jsonb_build_object(x.nspname||'.'||x.relname,data)" in snapshot,
            'all table keys including empty arrays')
    foreign = helper(text, 'foreign_snapshot')
    for actual in ["n.nspname='public' AND c.relkind IN('r','p')", "a.attname='organization_id'",
                   'a.attnum>0 AND NOT a.attisdropped', "FROM %I.%I t WHERE organization_id=$1'",
                   "USING '00000000-0000-4000-8000-000000000002'::uuid",
                   "FROM public.organizations t WHERE id='00000000-0000-4000-8000-000000000002'",
                   "jsonb_build_object('public.organizations',data)"]:
        require(actual in foreign, 'full second-tenant snapshot')
    require('LIMIT ' not in foreign and 'relname IN' not in foreign, 'tenant scope not narrowed to sentinels')
    global_rows = helper(text, 'global_snapshot')
    for actual in ["n.nspname IN('auth','financial_compile_fixture')", "n.nspname='public' AND c.relname<>'demo_seed_state'",
                   'AND NOT EXISTS(SELECT 1 FROM pg_attribute', "a.attname='organization_id'",
                   "jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)"]:
        require(actual in global_rows, 'full unchanged global/auth snapshot')


def private_metadata_contract(text):
    source = code(text)
    require(re.findall(r'CREATE SCHEMA ([a-z_]+);', source) == ['demo_financial_commit_lab'], 'new private lab schema only')
    require(re.findall(r'CREATE TABLE ([a-z_]+\.[a-z_]+)', source) == ['demo_financial_commit_lab.expected_contract'],
            'metadata table only')
    require(set(re.findall(r'INSERT INTO ([a-z_]+\.[a-z_]+)', source)) == {'demo_financial_commit_lab.expected_contract'},
            'no manufactured business authority')
    require(not re.search(r'\bGRANT\b|SECURITY\s+DEFINER|CREATE\s+OR\s+REPLACE', source, re.I), 'metadata does not delegate authority')
    require(source.count('LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog') == 8,
            'only invoker observation helpers')
    for obj in ['SCHEMA demo_financial_commit_lab', 'TABLE demo_financial_commit_lab.expected_contract',
                'ALL FUNCTIONS IN SCHEMA demo_financial_commit_lab']:
        require('REVOKE ALL ON ' + obj + ' FROM PUBLIC,anon,authenticated,service_role;' in source, 'closed metadata ACL')
    for field in ['context_id uuid NOT NULL UNIQUE', 'baseline_snapshot jsonb NOT NULL', 'foreign_snapshot jsonb NOT NULL',
                  'global_snapshot jsonb NOT NULL', 'manual_sentinels jsonb NOT NULL', 'first_result jsonb',
                  'committed_snapshot jsonb', 'retry_result jsonb', 'setup_backend_pid integer NOT NULL',
                  'business_backend_pid integer', 'retry_backend_pid integer']:
        require(field in source, 'persistent cross-session contract')
    for guard in ["current_database()<>'demo_financial_compile_recovery_lab'", "current_user<>'postgres'",
                  "session_user<>'postgres'", "current_setting('server_version_num')<>'170006'",
                  "current_setting('listen_addresses')<>''", 'inet_server_addr() IS NOT NULL',
                  'AND rolbypassrls AND NOT rolinherit AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication',
                  "pg_has_role(current_user,'supabase_admin','MEMBER')"]:
        require(guard in source, 'synthetic candidate guard')
    require('FROM pg_temp.financial_context c;' in source
            and 'FROM pg_temp.financial_manual_sentinels s)' in source, 'copy authentic initial TEMP contract')


def real_commit_contract(text, phase):
    source = code(text)
    require(text.startswith('\\set ON_ERROR_STOP on\n'), 'psql fail closed')
    role = source.index('SET LOCAL ROLE service_role;')
    begin = source.index('BEGIN;')
    call = source.index("SELECT demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)::text")
    commit = source.index('COMMIT;')
    result = 'first_result' if phase == 'business' else 'retry_result'
    result_write = source.index('SET ' + result + '=')
    pid_write = source.index('SET ' + phase + '_backend_pid=pg_backend_pid()')
    marker = '\\echo FINANCIAL_' + ('BUSINESS' if phase == 'business' else 'RETRY') + '_COMMIT_RETURNED'
    require(pid_write < begin < role < call < commit < source.index(marker) < result_write,
            'PID before real TX, result strictly after COMMIT returns')
    require('WHERE singleton RETURNING context_id \\gset' in source, 'cross-session context, no TEMP dependency')
    require(not re.search(r'\bRESET\s+ROLE\b|flush_deferred|SET\s+CONSTRAINTS|session_replication_role|DISABLE\s+TRIGGER', source, re.I),
            'no early role reset or deferred-guard drain')
    require(source.count('COMMIT;') == 1, 'one genuine business COMMIT')
    require(set(re.findall(r'UPDATE ([a-z_]+\.[a-z_]+)', source)) == {'demo_financial_commit_lab.expected_contract'},
            'only control metadata written directly')
    require(not re.search(r'\bINSERT\s+INTO|CREATE\s+FUNCTION|CREATE\s+TRIGGER|\bGRANT\b', source, re.I), 'no manual business provenance or privilege')
    require("jsonb_build_object('phase','" + phase + "','backend_pid',pg_backend_pid())" in text, 'public bounded connection evidence')


def observer_contract(text, failed=False):
    source = code(text)
    require(re.match(r'\\set ON_ERROR_STOP on\s+BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;', source.lstrip()),
            'observer entire transaction read-only repeatable-read')
    require('SELECT context_id FROM demo_financial_commit_lab.expected_contract WHERE singleton \\gset' in source,
            'observer has no original TEMP input')
    call = "SELECT demo_flow_writer.reconcile_context(:'context_id'::uuid)::text AS reconciliation \\gset"
    require('SET LOCAL ROLE service_role;\n' + call + '\nRESET ROLE;' in source, 'canonical authenticated readonly boundary')
    assertion = 'assert_failed_observation' if failed else 'assert_observation'
    require("SELECT demo_financial_commit_lab." + assertion + "(:'reconciliation'::jsonb);" in source, 'strict owner observation oracle')
    require(not re.search(r'\bINSERT\s+INTO|\bUPDATE\s+[a-z_]+\.|\bDELETE\s+FROM|\bCREATE\s+|\bGRANT\b', source, re.I),
            'observer cannot write metadata or business rows')
    marker = 'FINANCIAL_FAILED_COMMIT_ROLLBACK_OBSERVED' if failed else 'FINANCIAL_COMMIT_OBSERVED'
    require(source.index('COMMIT;') < source.index("SELECT '" + marker + "';"), 'observer marker after successful readonly TX')
    require('verify_materialized(' not in source and 'verify_preparation_origin(' not in source, 'no write locks in readonly observer')


def evidence_contract(text):
    positive = helper(text, 'assert_observation')
    for actual in ['pg_backend_pid()=e.setup_backend_pid', 'e.business_backend_pid IS NULL',
                   'pg_backend_pid()=e.business_backend_pid', 'pg_backend_pid()=e.retry_backend_pid',
                   "to_regclass('pg_temp.financial_context') IS NOT NULL",
                   "reconciliation->>'classification' IS DISTINCT FROM 'complete'",
                   "reconciliation->'checkpoint' IS DISTINCT FROM e.first_result",
                   '(e.retry_result IS NOT NULL AND e.retry_result IS DISTINCT FROM e.first_result)',
                   'demo_financial_commit_lab.snapshot() IS DISTINCT FROM e.committed_snapshot',
                   'PERFORM demo_flow_writer.verify_identity_readonly(v_lineage);',
                   "PERFORM demo_flow_writer.verify_fixture_readonly(v_lineage,'aap-vencida',4);",
                   "PERFORM demo_flow_writer.verify_fixture_readonly(v_lineage,'ttn-vigente',4);",
                   "PERFORM demo_flow_writer.verify_fixture_readonly(v_lineage,'ofc-parcial',5);"]:
        require(actual in positive, 'independent sealed materialization evidence')
    for table, count in [('events', 13), ('receipts', 13), ('fixture_claims', 3),
                         ('current_approvals', 3), ('simulated_payments', 1)]:
        require(f'FROM demo_flow_writer.{table} WHERE lineage_id=v_lineage)<>{count}' in positive, 'complete lineage cardinality')
    for table, count in [('proveedor_facturas', 3), ('proveedor_facturas_conceptos', 5), ('pagos_proveedor', 1)]:
        require(f'FROM public.{table})<>{count}' in positive, 'complete business cardinality')
    invariant = helper(text, 'assert_invariants')
    require('demo_financial_commit_lab.foreign_snapshot() IS DISTINCT FROM e.foreign_snapshot' in invariant
            and 'demo_financial_commit_lab.global_snapshot() IS DISTINCT FROM e.global_snapshot' in invariant
            and 'PERFORM demo_financial_commit_lab.assert_manual_sentinels();' in invariant, 'other tenants/global/manual rows unchanged')
    sentinel = helper(text, 'assert_manual_sentinels')
    require('actual IS DISTINCT FROM x.snapshot' in sentinel and 'to_jsonb(t)' in sentinel,
            'full-row manual preimages')
    failed = helper(text, 'assert_failed_observation')
    for actual in ["reconciliation->>'classification' IS DISTINCT FROM 'unresolved'",
                   "reconciliation ? 'checkpoint'", 'e.first_result IS NOT NULL', 'e.committed_snapshot IS NOT NULL',
                   'demo_financial_commit_lab.snapshot() IS DISTINCT FROM e.baseline_snapshot',
                   'EXISTS(SELECT 1 FROM demo_flow_writer.authorization_receipts)',
                   'EXISTS(SELECT 1 FROM demo_flow_writer.runs)', 'EXISTS(SELECT 1 FROM demo_flow_writer.lineages)',
                   'EXISTS(SELECT 1 FROM demo_flow_writer.seed_checkpoints)',
                   'EXISTS(SELECT 1 FROM demo_flow_writer.execution_receipts)',
                   'EXISTS(SELECT 1 FROM public.proveedor_facturas)', 'EXISTS(SELECT 1 FROM public.demo_seed_state)']:
        require(actual in failed, 'controlled rollback, never fabricated COMMIT/absence')
    require('EXCEPTION WHEN' not in positive + failed, 'no swallowed observer errors')


class ObservationContractTests(unittest.TestCase):
    def test_actual_metadata_and_full_snapshot_contract(self):
        private_metadata_contract(SETUP)
        snapshot_contract(SETUP)
        evidence_contract(SETUP)

    def test_both_real_commit_sequences(self):
        real_commit_contract(BUSINESS, 'business')
        real_commit_contract(RETRY, 'retry')
        self.assertIn('e.retry_result IS DISTINCT FROM e.first_result', RETRY)
        self.assertIn('demo_financial_commit_lab.snapshot() IS DISTINCT FROM e.committed_snapshot', RETRY)

    def test_both_independent_observers(self):
        observer_contract(OBSERVE)
        observer_contract(FAILED, True)

    def test_metadata_cannot_gain_authority_or_write_real_receipts(self):
        for suffix in ['GRANT USAGE ON SCHEMA demo_financial_commit_lab TO service_role;',
                       'INSERT INTO demo_flow_writer.authorization_receipts VALUES(NULL);']:
            with self.subTest(suffix=suffix), self.assertRaises(ValueError):
                private_metadata_contract(SETUP + '\n' + suffix)
        with self.assertRaises(ValueError):
            private_metadata_contract(SETUP.replace('SECURITY INVOKER', 'SECURITY DEFINER'))

    def test_missing_schema_or_filtered_core_snapshot_is_rejected(self):
        for old, new in [("'public','auth',", "'public',"), ("FROM %I.%I t'", "FROM %I.%I t WHERE false'"),
                         ('to_jsonb(t) ORDER BY to_jsonb(t)::text', "to_jsonb(t)-'updated_at' ORDER BY to_jsonb(t)::text")]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                snapshot_contract(SETUP.replace(old, new))

    def test_foreign_tenant_not_narrowed_to_two_supplier_sentinels(self):
        for old, new in [("a.attname='organization_id'", "a.attname='id'"),
                         ('WHERE organization_id=$1', "WHERE organization_id=$1 AND id='sentinel'"),
                         ("USING '00000000-0000-4000-8000-000000000002'::uuid", "USING '00000000-0000-4000-8000-000000000001'::uuid")]:
            mutant = SETUP.replace(old, new)
            with self.subTest(old=old), self.assertRaises(ValueError):
                snapshot_contract(mutant)

    def test_global_or_auth_rows_cannot_be_omitted(self):
        for old, new in [("n.nspname IN('auth','financial_compile_fixture')", 'false'),
                         ("c.relname<>'demo_seed_state'", "c.relname NOT IN('demo_seed_state','organizations')")]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                snapshot_contract(SETUP.replace(old, new))

    def test_early_role_reset_constraint_drain_or_fake_commit_is_rejected(self):
        for text, phase in [(BUSINESS, 'business'), (RETRY, 'retry')]:
            for mutant in [text.replace('COMMIT;', 'ROLLBACK;'),
                           text.replace('COMMIT;', 'RESET ROLE;\nCOMMIT;'),
                           text.replace('COMMIT;', 'SET CONSTRAINTS ALL IMMEDIATE;\nCOMMIT;'),
                           text.replace('COMMIT;', 'SELECT demo_financial_lab.flush_deferred();\nCOMMIT;')]:
                with self.subTest(phase=phase), self.assertRaises((ValueError, IndexError)):
                    real_commit_contract(mutant, phase)

    def test_results_written_before_commit_are_rejected(self):
        for text, phase, result in [(BUSINESS, 'business', 'first_result'), (RETRY, 'retry', 'retry_result')]:
            mutation = 'UPDATE demo_financial_commit_lab.expected_contract SET ' + result + "='{}';\n"
            with self.subTest(phase=phase), self.assertRaises(ValueError):
                real_commit_contract(text.replace('BEGIN;', mutation + 'BEGIN;'), phase)

    def test_observer_cannot_write_or_use_live_locking_verifier(self):
        for suffix in ['UPDATE demo_financial_commit_lab.expected_contract SET first_result=NULL;',
                       'SELECT demo_flow_writer.verify_materialized(NULL);']:
            with self.subTest(suffix=suffix), self.assertRaises(ValueError):
                observer_contract(OBSERVE + '\n' + suffix)
        with self.assertRaises(ValueError):
            observer_contract(OBSERVE.replace('REPEATABLE READ READ ONLY', 'READ COMMITTED'))

    def test_partial_seals_wrong_result_or_same_backend_is_rejected(self):
        for old, new in [('WHERE lineage_id=v_lineage)<>13', 'WHERE lineage_id=v_lineage)>13'),
                         ("reconciliation->'checkpoint' IS DISTINCT FROM e.first_result", 'false'),
                         ('pg_backend_pid()=e.business_backend_pid', 'false'),
                         ('actual IS DISTINCT FROM x.snapshot', "actual->'id' IS DISTINCT FROM x.snapshot->'id'")]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                evidence_contract(SETUP.replace(old, new))

    def test_failed_commit_cannot_be_reported_complete_or_absent(self):
        for new in ['complete', 'absent']:
            with self.subTest(classification=new), self.assertRaises(ValueError):
                evidence_contract(SETUP.replace("classification' IS DISTINCT FROM 'unresolved'",
                                                "classification' IS DISTINCT FROM '" + new + "'"))
        with self.assertRaises(ValueError):
            evidence_contract(SETUP.replace('demo_financial_commit_lab.snapshot() IS DISTINCT FROM e.baseline_snapshot', 'false'))


if __name__ == '__main__':
    unittest.main()
