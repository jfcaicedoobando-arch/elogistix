"""Unit boundaries using independent TEST_ONLY doubles, never target captures.

Reduced doubles test renderer isolation and unsafe-reader rejection. They are
not represented as Draft-valid evidence; the owned PostgreSQL runtime lane
supplies complete captures and a real offline Draft validator separately.
"""
import copy
import hashlib
import inspect
import json
from pathlib import Path
import re
import unittest
from unittest.mock import patch

import transaction_envelope as transaction


def prepared():
    capture = dict(database='crm_acl_fixture_test_only_unit', database_oid='99000',
                   user='postgres', session_user='postgres')
    discovery = dict(context=dict(search_path='TEST_ONLY_ENTRY_PATH'), sequence=dict(oid='99030'))
    value = dict(discovery=dict(capture=capture, result=discovery), catalog=dict(result={'TEST_ONLY': []}),
                 sequence_state=dict(result=dict(sequence_state=dict(last_value='7', is_called=True))),
                 drizzle_history=dict(result=dict(rows=[], row_count='0')),
                 supabase_manifest_before=dict(result={'TEST_ONLY': 'manifest'},
                    capture=dict(format_settings={'TEST_ONLY': 'format'})))
    return value, {'TEST_ONLY': ['TARGET']}, dict(namespace='TEST_ONLY_SEQ_SCHEMA',
        name='TEST_ONLY_SEQ_NAME', oid='99030'), 7, True, {'TEST_ONLY': 'auxiliary'}, '99040'


def profile():
    """Minimal independently invented reader-profile double, not JSON Schema."""
    catalog = dict(roles=[dict(name='postgres', oid='99001', superuser=False)],
        namespaces=[dict(oid='11', nspname='pg_catalog')], access_methods=[
            dict(oid='2', amname='heap', amhandler='heap_tableam_handler', amtype='t'),
            dict(oid='403', amname='btree', amhandler='bthandler', amtype='i')],
        relations=[], attributes=[], types=[dict(metadata=dict(oid=oid, typnamespace='11', typtype='b', typbasetype='0'))
            for oid in ('23', '25', '20')], inheritance=[], triggers=[], rules=[], policies=[],
        constraints=[], indexes=[], operator_classes=[], operator_families=[])
    for number, name, columns in (
        (99021, 'drizzle.__drizzle_migrations', [('id', '23', True, True), ('hash', '25', True, False), ('created_at', '20', False, False)]),
        (99022, 'supabase_migrations.schema_migrations', [('version', '25', True, False)])):
        oid, index_oid = str(number), str(number + 100)
        meta = dict(oid=oid, relkind='r', relam='2', relowner='99001', relpersistence='p',
            relrowsecurity=False, relforcerowsecurity=False, relhasrules=False, relhastriggers=False,
            relispartition=False, relhassubclass=False, reloftype='0', relrewrite='0', relchecks=0,
            relnatts=len(columns))
        catalog['relations'].append(dict(qualified_name=name, metadata=meta))
        catalog['relations'].append(dict(qualified_name='TEST_ONLY_INDEX_' + index_oid,
                                        metadata=dict(oid=index_oid, relkind='i', relam='403')))
        for attnum, (attname, typ, notnull, hasdef) in enumerate(columns, 1):
            catalog['attributes'].append(dict(metadata=dict(attrelid=oid, attnum=attnum, attname=attname,
                atttypid=typ, attnotnull=notnull, atthasdef=hasdef, attisdropped=False, attidentity='',
                attgenerated='', attinhcount=0, attislocal=True, atttypmod=-1)))
        catalog['constraints'].append(dict(metadata=dict(conrelid=oid, confrelid='0', contype='p',
            condeferrable=False, condeferred=False, convalidated=True, conparentid='0', conkey=[1])))
        class_oid, family_oid = str(number + 200), str(number + 300)
        catalog['indexes'].append(dict(expressions_is_null=True, predicate_is_null=True,
            metadata=dict(indrelid=oid, indexrelid=index_oid, indisvalid=True, indisready=True, indislive=True,
                indimmediate=True, indisexclusion=False, indnatts=1, indnkeyatts=1, indkey=[1],
                indclass=[class_oid], indcollation=['0'], indisprimary=True)))
        catalog['operator_classes'].append(dict(oid=class_oid, opcfamily=family_oid, opcnamespace='11',
            opcmethod='403', opcintype=columns[0][1], opckeytype='0'))
        catalog['operator_families'].append(dict(oid=family_oid, opfnamespace='11', opfmethod='403'))
    return dict(catalog=dict(result=catalog))


def bindings_fixture():
    """Public builtin profiles plus exclusively invented fixture identities."""
    capture = dict(database='crm_acl_fixture_test_only_aux', database_oid='99000', user='postgres',
        session_user='postgres', backend_pid=99100, snapshot='99101:99101:', xid_if_assigned=None,
        statement_at='2026-01-01T01:02:03+00:00', captured_at='2026-01-01T01:02:04+00:00')
    function = dict(proacl=None, proallargtypes=None, proargdefaults=None, proargmodes=None,
        proargnames=None, probin=None, proconfig=None, procost=1, proisstrict=True, prokind='f',
        prolang='12', proleakproof=False, pronamespace='11', pronargdefaults=0, proowner='10',
        proretset=False, prorows=0, prosecdef=False, prosqlbody=None, prosupport='-',
        protrftypes=None, provariadic='0')
    functions = []
    for values in (
        dict(oid='480', proname='int4', proargtypes=['20'], pronargs=1, proparallel='s', prorettype='23', prosrc='int84', provolatile='i'),
        dict(oid='1574', proname='nextval', proargtypes=['2205'], pronargs=1, proparallel='u', prorettype='20', prosrc='nextval_oid', provolatile='v'),
        dict(oid='4568', proname='pg_event_trigger_ddl_commands', proargtypes=[], pronargs=0, proparallel='r', prorettype='2249',
             prosrc='pg_event_trigger_ddl_commands', provolatile='s', procost=10, proretset=True, prorows=100,
             proallargtypes=['26','26','23','25','25','25','25','16','32'], proargmodes=['o'] * 9,
             proargnames=['classid','objid','objsubid','command_tag','object_type','schema_name','object_identity','in_extension','command'])):
        functions.append({**function, **values})
    regclass = dict(oid='2205', typacl=None, typalign='i', typanalyze='-', typarray='2210', typbasetype='0',
        typbyval=True, typcategory='N', typcollation='0', typdefault=None, typdefaultbin=None, typdelim=',', typelem='0',
        typinput='regclassin', typisdefined=True, typispreferred=False, typlen=4, typmodin='-', typmodout='-', typname='regclass',
        typnamespace='11', typndims=0, typnotnull=False, typoutput='regclassout', typowner='10', typreceive='regclassrecv',
        typrelid='0', typsend='regclasssend', typstorage='p', typsubscript='-', typtype='b', typtypmod=-1)
    witness = dict(kind='crm-transaction-bindings-v1', admission='NOT_ADMITTED', capture=capture,
        result=dict(functions=functions, regclass=regclass, handler=dict(oid='99040', config=None)))
    bundle = dict(discovery=dict(capture=copy.deepcopy(capture)), catalog=dict(result=dict(
        namespaces=[dict(oid='11', nspname='pg_catalog', nspowner='10'), dict(oid='99015', nspname='extensions', nspowner='99001')],
        functions=[dict(metadata=dict(oid='99040', proname='pgrst_ddl_watch', pronamespace='99015',
            pronargs=0, proargtypes=[], prosecdef=False), source_sha256=transaction.BODY_SHA256,
            config_is_null=True, config_sha256=hashlib.sha256(b'<NULL>').hexdigest())],
        event_triggers=[dict(evtfoid='99040', evtevent='ddl_command_end', evtenabled='O', evttags=None)])))
    return witness, bundle


class TransactionEnvelopeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.candidate = (transaction.REPOSITORY / 'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes()

    def render(self, *, synthetic=False, fault=None, source=None, state=None):
        state = prepared() if state is None else state
        with patch.object(transaction, '_prepared', return_value=state):
            if synthetic:
                return transaction.render_synthetic_transaction(self.candidate if source is None else source,
                    {}, scope='synthetic-ci', validate_projection=lambda _: True, semantic_witness={}, fault=fault)
            return transaction.render_transaction_proposal(self.candidate if source is None else source,
                {}, validate_projection=lambda _: True, semantic_witness={})

    def core(self, sql):
        match = re.search(r'-- CRM_TRANSACTION_CORE_BEGIN\n([\s\S]*?)-- CRM_TRANSACTION_CORE_END', sql)
        self.assertIsNotNone(match)
        return match[1]

    def test_public_first_executable_statement_is_unconditional_raise(self):
        sql = self.render()
        self.assertIn("BEGIN\n  RAISE EXCEPTION 'CRM_TRANSACTION_NOT_ADMITTED';\n", sql)
        prefix = sql.split('BEGIN', 1)[0]
        self.assertNotIn(':=', prefix)
        declarations = prefix.split('DECLARE', 1)[1]
        self.assertTrue(all('pg_catalog.' in line for line in declarations.splitlines() if line.strip()))
        self.assertLess(sql.index('CRM_TRANSACTION_NOT_ADMITTED'), sql.index('v_contract :='))
        self.assertLess(sql.index('CRM_TRANSACTION_NOT_ADMITTED'), sql.index('LOCK TABLE'))

    def test_public_api_has_no_application_fault_or_enable_switch(self):
        signature = inspect.signature(transaction.render_transaction_proposal)
        self.assertEqual(set(signature.parameters), {'candidate', 'bundle', 'validate_projection', 'semantic_witness'})
        for keyword in ('admitted', 'enabled', 'apply', 'fault', 'scope'):
            with self.subTest(keyword=keyword), self.assertRaises(TypeError):
                transaction.render_transaction_proposal(self.candidate, {}, validate_projection=lambda _: True,
                    semantic_witness={}, **{keyword: True})

    def test_normal_public_and_owned_synthetic_core_are_identical_bytes(self):
        public, synthetic = self.render(), self.render(synthetic=True)
        self.assertEqual(self.core(public), self.core(synthetic))
        digest = hashlib.sha256(self.core(public).encode('utf8')).hexdigest()
        self.assertIn('-- CRM_TRANSACTION_CORE_SHA256:' + digest, public)
        with patch.object(transaction, '_prepared', return_value=prepared()):
            self.assertEqual(transaction.transaction_core_sha256(self.candidate, {},
                validate_projection=lambda _: True, semantic_witness={}), digest)
        self.assertIn('CRM_TRANSACTION_SYNTHETIC_CONTEXT', synthetic)
        self.assertLess(synthetic.index('CRM_TRANSACTION_SYNTHETIC_CONTEXT'), synthetic.index('v_contract :='))

    def test_private_data_only_hex_after_fence_and_input_is_never_mutated(self):
        state = prepared()
        trap = "TEST_ONLY_PRIVATE_' ; DROP DATABASE test_only; -- $crm_transaction_review$"
        state[0]['discovery']['result']['sequence']['state_select'] = trap
        state[0]['catalog']['result']['TEST_ONLY'].append(trap)
        saved = copy.deepcopy(state)
        sql = self.render(state=state)
        self.assertEqual(state, saved)
        self.assertNotIn(trap, sql)
        self.assertNotIn('TEST_ONLY_SEQ_SCHEMA', sql)
        self.assertNotIn('TEST_ONLY_ENTRY_PATH', sql)
        self.assertNotIn("EXECUTE v_contract->", sql)
        self.assertNotIn("EXECUTE v_contract->'discovery'->'sequence'->>'state_select'", sql)

    def test_exact_canonical_payload_is_verified_and_decoded_after_registered_return(self):
        sql = self.render()
        self.assertIn("pg_catalog.decode('" + self.candidate.hex() + "','hex')", sql)
        self.assertIn("pg_catalog.sha256(v_payload)", sql)
        self.assertIn('pg_catalog.convert_to(v_sql,\'UTF8\') IS DISTINCT FROM v_payload', sql)
        self.assertLess(sql.index('RETURN;'), sql.index('v_payload :='))
        self.assertEqual(sql.count('EXECUTE v_sql;'), 1)
        self.assertEqual(sql.count('INSERT INTO drizzle.__drizzle_migrations(hash,created_at)'), 1)
        self.assertNotIn('INSERT INTO drizzle.__drizzle_migrations(id', sql)
        self.assertNotIn('setval(', sql)
        self.assertNotIn('max(', sql)

    def test_metadata_recheck_precedes_ledger_reads_and_lock_order_is_fixed(self):
        sql = self.core(self.render())
        order = [sql.index('LOCK TABLE ONLY ' + name) for name in
                 ('drizzle.__drizzle_migrations', 'supabase_migrations.schema_migrations', 'public.crm_empresas')]
        self.assertEqual(order, sorted(order))
        self.assertIn('SHARE ROW EXCLUSIVE MODE NOWAIT', sql)
        self.assertIn('SHARE MODE NOWAIT', sql)
        self.assertIn('SHARE UPDATE EXCLUSIVE MODE NOWAIT', sql)
        self.assertLess(sql.index('CRM_TRANSACTION_PREIMAGE_CATALOG'), sql.index('FROM drizzle.__drizzle_migrations d'))
        self.assertLess(sql.index('CRM_TRANSACTION_PREIMAGE_BINDINGS'), sql.index('FROM drizzle.__drizzle_migrations d'))
        self.assertIn('v_now IS DISTINCT FROM v_expected_history', sql)
        self.assertIn("v_now IS DISTINCT FROM v_contract->'target_catalog'", sql)

    def test_terminal_sequence_uses_measured_next_and_fresh_safe_identifier(self):
        sql = self.core(self.render())
        self.assertIn("pg_catalog.format('%I.%I'", sql)
        self.assertIn("FROM %I.%I'", sql)
        self.assertIn("v_next := (v_sequence_now->>'last_value')", sql)
        self.assertIn("'last_value',v_next::pg_catalog.text,'is_called',true", sql)
        self.assertNotIn('last_value\',\'8\'', sql)
        self.assertIn("v_contract->'identity'->>'database_oid'", sql)

    def test_test_only_fault_not_public_switch_or_unvalidated_sql(self):
        self.assertNotIn('CRM_TRANSACTION_TEST_ONLY_AFTER_INSERT', self.render())
        sql = self.render(synthetic=True, fault='after_insert')
        self.assertGreater(sql.index('CRM_TRANSACTION_TEST_ONLY_AFTER_INSERT'), sql.index('RETURNING pg_catalog.jsonb_build_object'))
        for fault in ('before_insert', 'DROP DATABASE test_only', True, 1, {}):
            with self.subTest(fault=type(fault).__name__), self.assertRaisesRegex(transaction.TransactionError, 'SYNTHETIC_FAULT'):
                self.render(synthetic=True, fault=fault)

    def test_test_only_builder_rejects_other_scope_and_database(self):
        for scope in ('operational', '', True, None):
            with self.subTest(scope=scope), self.assertRaisesRegex(transaction.TransactionError, 'SYNTHETIC_SCOPE'):
                transaction.render_synthetic_transaction(self.candidate, {}, scope=scope,
                    validate_projection=lambda _: True, semantic_witness={})
        for name in ('postgres', 'crm_acl_fixture_', 'crm_acl_fixture_x;DROP DATABASE x', 'crm_acl_fixture_x\n'):
            state = prepared()
            state[0]['discovery']['capture']['database'] = name
            with self.subTest(name=name), patch.object(transaction, '_prepared', return_value=state), self.assertRaisesRegex(transaction.TransactionError, 'SYNTHETIC_DATABASE'):
                transaction.render_synthetic_transaction(self.candidate, {}, scope='synthetic-ci',
                    validate_projection=lambda _: True, semantic_witness={})

    def test_changed_candidate_and_missing_actual_validator_are_rejected(self):
        for candidate in (self.candidate + b'\n', self.candidate.decode('utf8'), b'\xff', None):
            with self.subTest(candidate=type(candidate).__name__), self.assertRaisesRegex(transaction.TransactionError, 'CANONICAL_BYTES'):
                transaction.render_transaction_proposal(candidate, {}, validate_projection=lambda _: True, semantic_witness={})
        with self.assertRaisesRegex(transaction.TransactionError, 'VALIDATOR_REQUIRED'):
            transaction.render_transaction_proposal(self.candidate, {}, validate_projection=None, semantic_witness={})

    def test_pin_or_validator_failure_is_sanitized_without_private_diagnostics(self):
        with patch.object(transaction.gate, 'verify_inputs', side_effect=RuntimeError('TEST_ONLY_PRIVATE_DIAGNOSTIC')):
            with self.assertRaises(transaction.TransactionError) as caught:
                transaction.render_transaction_proposal(self.candidate, {}, validate_projection=lambda _: True, semantic_witness={})
        self.assertEqual(str(caught.exception), 'CRM_TRANSACTION_BASELINE_REJECTED')
        self.assertTrue(caught.exception.__suppress_context__)

    def test_supported_reader_double_and_unsafe_definitions(self):
        transaction._ledger_read_profile(profile())
        changes = [lambda c: c['relations'][0]['metadata'].update(relrowsecurity=True),
            lambda c: c['relations'][0]['metadata'].update(relhasrules=True),
            lambda c: c['relations'][0]['metadata'].update(relhastriggers=True),
            lambda c: c['relations'][0]['metadata'].update(relam='99999'),
            lambda c: c['attributes'][0]['metadata'].update(attgenerated='s'),
            lambda c: c['attributes'][0]['metadata'].update(attidentity='a'),
            lambda c: c['types'][0]['metadata'].update(typnamespace='99010'),
            lambda c: c['constraints'][0]['metadata'].update(condeferrable=True),
            lambda c: c['indexes'][0].update(expressions_is_null=False),
            lambda c: c['operator_classes'][0].update(opcnamespace='99010')]
        for change in changes:
            bundle = profile()
            change(bundle['catalog']['result'])
            with self.subTest(change=changes.index(change)), self.assertRaises(transaction.TransactionError):
                transaction._ledger_read_profile(bundle)

    def test_auxiliary_select_is_fixed_and_never_embeds_private_oid_or_sql(self):
        sql = transaction._bindings_select('99040')
        self.assertNotIn('99040', sql)
        self.assertIn("pg_catalog.nextval(pg_catalog.regclass)", sql)
        self.assertIn("extensions.pgrst_ddl_watch()", sql)
        self.assertNotIn('nextval(', re.sub(r"'[^']*'", "''", sql))
        for value in ('0', '-1', '99;DROP DATABASE x', True, None):
            with self.subTest(value=value), self.assertRaisesRegex(transaction.TransactionError, 'HANDLER_IDENTITY'):
                transaction._bindings_select(value)

    def test_array_commitment_serialization_matches_public_literal_conventions(self):
        self.assertEqual(transaction._pg_text_array(None), '<NULL>')
        self.assertEqual(transaction._pg_text_array(['search_path=public']), '{search_path=public}')
        self.assertEqual(transaction._pg_text_array(['search_path=""']), '{"search_path=\\"\\""}')
        self.assertEqual(transaction._pg_text_array(['NULL', '', 'a,b', r'a\b']), '{"NULL","","a,b","a\\\\b"}')
        with self.assertRaises(transaction.TransactionError):
            transaction._pg_text_array(['a\x00b'])

    def test_auxiliary_fixed_profiles_bind_every_field_and_reject_extra_or_changed_fields(self):
        witness, bundle = bindings_fixture()
        saved = copy.deepcopy((witness, bundle))
        result, oid = transaction._bindings(witness, bundle)
        self.assertEqual(result, witness['result'])
        self.assertEqual(oid, '99040')
        self.assertEqual((witness, bundle), saved)
        for change in (
            lambda w: w['result']['functions'][0].update(prosrc='TEST_ONLY_OTHER_ROUTINE'),
            lambda w: w['result']['functions'][0].update(prosecdef=True),
            lambda w: w['result']['functions'][1].update(proconfig=['search_path=public']),
            lambda w: w['result']['functions'][1].update(proacl=[]),
            lambda w: w['result']['functions'][2].update(proretset=1),
            lambda w: w['result']['functions'][0].update(TEST_ONLY_extra=False),
            lambda w: w['result']['regclass'].update(typdefault='TEST_ONLY_UNKNOWN_EXPRESSION'),
            lambda w: w['result']['handler'].update(oid='99041'),
            lambda w: w['result']['handler'].update(config=['search_path=public']),
            lambda w: w.update(admission='ADMITTED'),
            lambda w: w['capture'].update(database_oid='99099'),
            lambda w: w['capture'].update(snapshot='20:10:'),
            lambda w: w['capture'].update(snapshot='10:20:15,14'),
            lambda w: w['capture'].update(captured_at='2026-01-01T01:02:02+00:00')):
            changed = copy.deepcopy(witness)
            change(changed)
            with self.subTest(change=str(change)), self.assertRaises(transaction.TransactionError):
                transaction._bindings(changed, bundle)

    def test_auxiliary_capture_preserves_distinct_snapshot_and_rejects_impossible_time(self):
        witness, bundle = bindings_fixture()
        witness['capture'].update(snapshot='99110:99110:', backend_pid=99111,
            statement_at='2026-01-02T01:02:03+00:00', captured_at='2026-01-02T01:02:04+00:00')
        transaction._bindings(witness, bundle)
        witness['capture']['captured_at'] = '2026-02-30T01:02:03+00:00'
        with self.assertRaises(ValueError):
            transaction._bindings(witness, bundle)


if __name__ == '__main__':
    unittest.main()
