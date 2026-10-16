"""Offline source/mutation checks for runtime retry-security assertions.

No SQL, Docker, network or external identity is executed here. Runtime acceptance
requires the isolated Actions lane to execute the real boundary and every oracle.
"""
from pathlib import Path
import re
import unittest


HERE = Path(__file__).resolve().parent
SOURCE = (HERE / 'sql/retry_security.sql').read_text(encoding='utf-8')
UPSTREAM = HERE.parent / 'demo-financial-compile-recovery/upstream'


def executable(text):
    return re.sub(r'--[^\n]*', '', text)


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def positive_contract(text):
    require(text.startswith('\\set ON_ERROR_STOP on\n'), 'psql fail closed')
    call = "SELECT demo_flow_writer.prepare_execute_checkpoint(:'context_id'::uuid,0)::text"
    require(text.count(call) == 2, 'two authentic boundary calls')
    drain = 'SELECT demo_financial_lab.flush_deferred();'
    ordered = ['CREATE TEMP TABLE before_retry_security', 'BEGIN;', call + ' AS first_result',
               drain, 'PERFORM demo_flow_writer.verify_materialized(v_run);',
               '\\echo FINANCIAL_PHASE_retry_security_materialized',
               'CREATE TEMP TABLE retry_security_stable', call + ' AS second_result',
               'CREATE TEMP TABLE retry_security_second', 'DO $same_context$']
    positions = [text.find(token) for token in ordered]
    require(all(value >= 0 for value in positions) and positions == sorted(positions), 'genuine materialization order')
    require(text.count(drain) == 2, 'real deferred drains')
    for table, count in [('events', 13), ('receipts', 13), ('fixture_claims', 3),
                         ('current_approvals', 3), ('simulated_payments', 1), ('runs', 1)]:
        require(f'FROM demo_flow_writer.{table} WHERE lineage_id=v_lineage)<>{count}' in text,
                'materialized provenance cardinalities')
    for table in ['seed_checkpoints', 'execution_receipts']:
        require(f'FROM demo_flow_writer.{table} WHERE execution_run_id=v_run)<>1' in text,
                'one checkpoint/execution receipt')
    for table, count in [('proveedor_facturas', 3), ('proveedor_facturas_conceptos', 5), ('pagos_proveedor', 1)]:
        require(f'FROM public.{table})<>{count}' in text, 'business cardinalities')
    for oracle in ["result->>'status' IS DISTINCT FROM 'materialized'",
                   "result->>'materialization' IS DISTINCT FROM 'executed'",
                   "(result->>'context_id')::uuid IS DISTINCT FROM (SELECT context_id FROM pg_temp.financial_context)",
                   'x.checked_at=c.checked_at AND x.projection_sha256=c.projection_sha256',
                   's.last_seeded_at=c.checked_at',
                   '(SELECT result FROM pg_temp.retry_security_second) IS DISTINCT FROM',
                   '(SELECT result FROM pg_temp.retry_security_result)',
                   'Same context retry mutated persistent rows']:
        require(oracle in text, 'strict same-result and state oracle')


def adoption_contract(text):
    section = text[text.index('DO $initial_adoption_guards$'):text.index('END $initial_adoption_guards$;')]
    for actual in ['SELECT a.identity_receipt_id,a.scheduler_approval_id INTO STRICT v_receipt,v_policy',
                   'WHERE a.context_id=(SELECT context_id FROM pg_temp.financial_context)',
                   'PERFORM demo_flow_writer.verify_identity_receipt(v_receipt);',
                   'PERFORM demo_flow_writer.issue_scheduler_context(v_policy,v_receipt,120);']:
        require(actual in section, 'real original receipt/issuer')
    require(section.count("EXCEPTION WHEN SQLSTATE '23514' THEN") == 2, 'exact adoption SQLSTATE')
    strict = "IF v_state<>'23514' OR v_message IS DISTINCT FROM 'DEMO_FINANCIAL_ADOPTION_DENIED' THEN RAISE; END IF;"
    require(section.count(strict) == 2, 'exact adoption rejection message')
    require(section.count('IF NOT v_rejected THEN RAISE EXCEPTION') == 2, 'adoption success must fail')
    require('SELECT body FROM pg_temp.retry_security_stable' in section, 'adoption rejection snapshot')
    require('EXCEPTION WHEN OTHERS' not in section, 'no swallowed unrelated adoption errors')


def authority_contract(text):
    start = text.index('CREATE FUNCTION demo_financial_lab.expect_retry_security_denial(')
    section = text[start:text.index('END $fn$;', start)]
    require('LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog' in section, 'real selected invoker role')
    for guard in ["current_database()<>'demo_financial_compile_recovery_lab'", "session_user<>'postgres'",
                  "current_user<>'service_role'", "current_setting('role')<>'service_role'",
                  "expected_message NOT IN('DEMO_RUN_UNAUTHORIZED','DEMO_SCHEDULER_APPROVAL_INVALID')",
                  'expected_message IS NULL']:
        require(guard in section, 'bounded synthetic technical-role probe')
    for oracle in ['PERFORM demo_flow_writer.prepare_execute_checkpoint(ctx,0);',
                   "EXCEPTION WHEN SQLSTATE '42501' THEN",
                   'GET STACKED DIAGNOSTICS v_state=RETURNED_SQLSTATE,v_message=MESSAGE_TEXT;',
                   "IF v_state<>'42501' OR v_message IS DISTINCT FROM expected_message THEN RAISE; END IF;",
                   "IF NOT v_rejected THEN RAISE EXCEPTION 'Revoked or disabled authority returned cached success'; END IF;"]:
        require(oracle in section, 'exact live-authority denial oracle')
    require('EXCEPTION WHEN OTHERS' not in section, 'no unrelated authority errors accepted')
    for target, reason in [('revoked_run', 'DEMO_RUN_UNAUTHORIZED'),
                           ('disabled_scheduler', 'DEMO_SCHEDULER_APPROVAL_INVALID')]:
        call = "SET LOCAL ROLE service_role;\nSELECT demo_financial_lab.expect_retry_security_denial(:'context_id'::uuid,'" + reason + "');\nRESET ROLE;"
        require(text.count(call) == 1, 'negative call uses real technical role')
        begin = text.index('SAVEPOINT retry_' + target + ';')
        rollback = text.index('ROLLBACK TO SAVEPOINT retry_' + target + ';')
        release = text.index('RELEASE SAVEPOINT retry_' + target + ';')
        require(begin < text.index(call) < rollback < release, 'reversible real authority change')
    require("UPDATE demo_flow_writer.runs SET revoked_at=clock_timestamp()" in text, 'real run revocation')
    require("UPDATE demo_flow_writer.scheduler_approvals SET disabled_at=clock_timestamp()" in text, 'real scheduler disablement')
    for required in ['Revoked run probe was not configured', 'Disabled scheduler probe was not configured',
                     'Revoked run denial mutated persistent rows', 'Disabled scheduler denial mutated persistent rows',
                     'Revoked run probe rollback incomplete', 'Disabled scheduler probe rollback incomplete']:
        require(required in text, 'negative mutation and rollback evidence')


def scope_contract(text):
    source = executable(text)
    require('SYNTHETIC' in text, 'scope label')
    require(not re.search(r'\bCOMMIT\s*;|DISABLE\s+TRIGGER|session_replication_role|CREATE\s+OR\s+REPLACE', source, re.I),
            'no commit/guard override')
    require(not re.search(r'\b(?:INSERT\s+INTO|DELETE\s+FROM|TRUNCATE)\s+(?:public|auth|demo_flow_writer|demo_fixture_identity)\.', source, re.I),
            'no manual financial/provenance rows')
    require(re.findall(r'\bUPDATE\s+([a-z_]+\.[a-z_]+)\s+SET', source, re.I)
            == ['demo_flow_writer.runs', 'demo_flow_writer.scheduler_approvals'], 'only reversible authority updates')
    require(re.findall(r'CREATE\s+FUNCTION\s+([a-z_]+\.[a-z_]+)', source, re.I)
            == ['demo_financial_lab.expect_retry_security_denial'], 'only lab helper created')
    require(not re.search(r'\b(?:CREATE|ALTER|DROP)\s+(?:ROLE|DATABASE|TRIGGER|POLICY)\b', source, re.I), 'no authority/trigger DDL')
    require(re.findall(r'GRANT\s+([^;]+);', source, re.I) ==
            ['EXECUTE ON FUNCTION demo_financial_lab.expect_retry_security_denial(uuid,text) TO service_role'], 'bounded ephemeral helper grant')
    marker = "SELECT 'FINANCIAL_ASSERTIONS_COMPLETE_retry_security';"
    rollback = '\nROLLBACK;\n'
    terminal = "SELECT 'FINANCIAL_ROLLBACK_COMPLETE_retry_security';"
    require(text.count(marker) == text.count(rollback) == text.count(terminal) == 1, 'unique suite terminal markers')
    require(text.index(marker) < text.index(rollback) < text.index('SELECT body FROM pg_temp.before_retry_security')
            < text.index(terminal), 'full persistent rollback before terminal success')


class RetrySecuritySourceTests(unittest.TestCase):
    def test_current_real_positive_and_negative_oracles(self):
        positive_contract(SOURCE)
        adoption_contract(SOURCE)
        authority_contract(SOURCE)
        scope_contract(SOURCE)

    def test_regression_original_initial_guard_precedes_cached_authorization(self):
        issuer = (UPSTREAM / 'flow/issuer/10-issuer.sql').read_text(encoding='utf-8')
        bridge = (UPSTREAM / 'authentic/bridge.sql').read_text(encoding='utf-8')
        registry = (UPSTREAM / 'flow/issuer/16-owner-registry.sql').read_text(encoding='utf-8')
        atomic = (UPSTREAM / 'flow/issuer/11-atomic-entry.sql').read_text(encoding='utf-8')
        self.assertLess(issuer.index('i:=demo_flow_writer.verify_identity_receipt('),
                        issuer.index('SELECT * INTO existing FROM demo_flow_writer.authorization_receipts'))
        self.assertIn("RAISE EXCEPTION 'DEMO_FINANCIAL_ADOPTION_DENIED' USING ERRCODE='23514'", bridge)
        self.assertIn("'purpose','initial'", registry)
        self.assertIn('SELECT * INTO receipt FROM demo_flow_writer.execution_receipts WHERE execution_run_id=p_run_id;', atomic)
        self.assertIn("'status',receipt.status,'materialization',receipt.materialization", atomic)

    def test_missing_real_boundary_or_deferred_drain_is_rejected(self):
        for old, new in [("prepare_execute_checkpoint(:'context_id'::uuid,0)", 'synthetic_success()'),
                         ('SELECT demo_financial_lab.flush_deferred();', 'SELECT true;'),
                         ('PERFORM demo_flow_writer.verify_materialized(v_run);', 'NULL;')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                positive_contract(SOURCE.replace(old, new))

    def test_weak_positive_cardinality_and_result_oracles_are_rejected(self):
        for old, new in [('WHERE lineage_id=v_lineage)<>13', 'WHERE lineage_id=v_lineage)>13'),
                         ('FROM public.proveedor_facturas_conceptos)<>5', 'FROM public.proveedor_facturas_conceptos)>5'),
                         ('(SELECT result FROM pg_temp.retry_security_second) IS DISTINCT FROM', 'false AND'),
                         ('Same context retry mutated persistent rows', 'omitted assertion')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                positive_contract(SOURCE.replace(old, new))

    def test_original_bridge_and_owner_issuer_are_both_required(self):
        for old, new in [('PERFORM demo_flow_writer.verify_identity_receipt(v_receipt);', 'NULL;'),
                         ('PERFORM demo_flow_writer.issue_scheduler_context(v_policy,v_receipt,120);', 'NULL;')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                adoption_contract(SOURCE.replace(old, new))

    def test_unrelated_adoption_errors_or_success_cannot_pass(self):
        for old, new in [("EXCEPTION WHEN SQLSTATE '23514' THEN", 'EXCEPTION WHEN OTHERS THEN'),
                         ("IF v_state<>'23514' OR v_message IS DISTINCT FROM 'DEMO_FINANCIAL_ADOPTION_DENIED' THEN RAISE; END IF;", 'NULL;'),
                         ('IF NOT v_rejected THEN RAISE EXCEPTION', 'IF false THEN RAISE EXCEPTION')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                adoption_contract(SOURCE.replace(old, new))

    def test_wrong_role_or_definer_shortcut_is_rejected(self):
        for old, new in [('LANGUAGE plpgsql SECURITY INVOKER', 'LANGUAGE plpgsql SECURITY DEFINER'),
                         ("current_user<>'service_role'", 'false'),
                         ("current_setting('role')<>'service_role'", 'false')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                authority_contract(SOURCE.replace(old, new))

    def test_unrelated_authority_error_and_cached_success_cannot_pass(self):
        for old, new in [("EXCEPTION WHEN SQLSTATE '42501' THEN", 'EXCEPTION WHEN OTHERS THEN'),
                         ("IF v_state<>'42501' OR v_message IS DISTINCT FROM expected_message THEN RAISE; END IF;", 'NULL;'),
                         ("IF NOT v_rejected THEN RAISE EXCEPTION 'Revoked or disabled authority returned cached success'; END IF;", 'NULL;')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                authority_contract(SOURCE.replace(old, new))

    def test_real_reversible_authority_changes_are_required(self):
        for old, new in [('UPDATE demo_flow_writer.runs SET revoked_at=clock_timestamp()', 'SELECT false'),
                         ('UPDATE demo_flow_writer.scheduler_approvals SET disabled_at=clock_timestamp()', 'SELECT false'),
                         ('ROLLBACK TO SAVEPOINT retry_revoked_run;', 'SELECT false;'),
                         ('Revoked run denial mutated persistent rows', 'omitted'),
                         ('Disabled scheduler probe rollback incomplete', 'omitted')]:
            with self.subTest(old=old), self.assertRaises(ValueError):
                authority_contract(SOURCE.replace(old, new))

    def test_canonical_guards_and_manual_provenance_cannot_be_bypassed(self):
        for suffix in ['ALTER TABLE public.proveedor_facturas DISABLE TRIGGER ALL;',
                       'SET session_replication_role=replica;',
                       'INSERT INTO demo_flow_writer.authorization_receipts VALUES(NULL);',
                       'UPDATE public.proveedor_facturas SET total=0;',
                       'CREATE OR REPLACE FUNCTION demo_flow_writer.authorize() RETURNS void LANGUAGE sql AS $$ SELECT $$;',
                       'GRANT ALL ON ALL TABLES IN SCHEMA demo_flow_writer TO service_role;']:
            with self.subTest(suffix=suffix), self.assertRaises(ValueError):
                scope_contract(SOURCE + '\n' + suffix)

    def test_commit_or_premature_terminal_success_is_rejected(self):
        with self.assertRaises(ValueError):
            scope_contract(SOURCE.replace('ROLLBACK;', 'COMMIT;'))
        with self.assertRaises(ValueError):
            scope_contract(SOURCE.replace("SELECT 'FINANCIAL_ROLLBACK_COMPLETE_retry_security';", '') +
                           "\nSELECT 'FINANCIAL_ROLLBACK_COMPLETE_retry_security';\n".replace('retry_security', 'other_suite'))


if __name__ == '__main__':
    unittest.main()
