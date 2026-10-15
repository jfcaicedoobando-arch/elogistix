"""Offline synthetic renderer contracts. Never starts SQL, a process, or a database.

All 970xx identities below are invented TEST_ONLY fixture values. They are never
instance evidence, output IDs, migration reservations, or a nextval convention.
"""
import ast
import copy
import hashlib
import json
from pathlib import Path
import re
import unittest

import direct_wrapper as wrapper

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
CANDIDATE = (REPO / 'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes()


def synthetic_contract():
    """Small measured-shape stand-in; no private capture or real object IDs."""
    source = (REPO / 'drizzle/migrations/0017_crm_empresa_no_borrar_cliente.sql').read_text(encoding='utf8')
    bodies = dict(re.findall(r'CREATE OR REPLACE FUNCTION public\.(\w+)\(\).*?AS \$\$(.*?)\$\$;', source, re.S))
    owner, service, public, drizzle = '97010', '97011', '97020', '97021'
    ledger, sequence, crm, language, trigger_type = '97030', '97031', '97032', '97040', '2279'
    helpers = []
    for index, name in enumerate(wrapper.NAMES):
        helpers.append(dict(
            oid=str(97001 + index), proname=name, pronamespace=public, proowner=owner,
            prolang=language, prorettype=trigger_type, prokind='f', pronargs=0,
            pronargdefaults=0, proargtypes=[], proallargtypes=None, proargmodes=None,
            proargnames=None, proargdefaults=None, protrftypes=None, provariadic='0',
            prosupport='-', prosecdef=False, proleakproof=False, proisstrict=False,
            proretset=False, provolatile='v', proparallel='u', procost=100, prorows=0,
            proconfig=['search_path=public'], probin=None, prosqlbody=None,
            prosrc=bodies[name], proacl=['postgres=X/postgres', 'service_role=X/postgres']))

    def relation(oid, name, namespace, kind='r'):
        return dict(oid=oid, relname=name, relnamespace=namespace, relowner=owner,
                    relkind=kind, relispartition=False, relrowsecurity=False,
                    relforcerowsecurity=False, relhasrules=False, relhastriggers=False)

    attrs = []
    for attnum, name, typ in ((1, 'id', '23'), (2, 'hash', '25'), (3, 'created_at', '20')):
        attrs.append(dict(attrelid=ledger, attnum=attnum, attname=name, atttypid=typ,
                          attisdropped=False, attidentity='', attgenerated='', attnotnull=attnum < 3))
    attrs.append(dict(attrelid=crm, attnum=4, attname='deleted_at', atttypid='1184',
                      attisdropped=False, attidentity='', attgenerated='', attnotnull=False))
    triggers = []
    for index, name in enumerate(wrapper.NAMES):
        triggers.append(dict(oid=str(97050 + index), tgfoid=helpers[index]['oid'], tgrelid=crm,
                             tgisinternal=False, tgenabled='O', tgconstraint='0', tgconstrrelid='0',
                             tgconstrindid='0', tgparentid='0', tgdeferrable=False,
                             tginitdeferred=False, tgnargs=0, tgargs='\\x', tgqual=None,
                             tgoldtable=None, tgnewtable=None, tgname='trg' + name,
                             tgtype=19 if index == 0 else 11, tgattr=[4] if index == 0 else []))
    cat = dict(
        pg_class=[relation(ledger, '__drizzle_migrations', drizzle),
                  relation(sequence, '__drizzle_migrations_id_seq', drizzle, 'S'),
                  relation(crm, 'crm_empresas', public),
                  relation('97033', 'schema_migrations', '97022')],
        pg_namespace=[dict(oid=public, nspname='public', nspowner=owner),
                      dict(oid=drizzle, nspname='drizzle', nspowner=owner),
                      dict(oid='97022', nspname='supabase_migrations', nspowner=owner)],
        pg_attribute=attrs, pg_trigger=triggers, pg_proc=helpers,
        pg_rewrite=[], pg_policy=[], pg_inherits=[], pg_description=[], pg_seclabel=[],
        pg_event_trigger=[], event_functions=[], pg_auth_members=[], pg_extension=[],
        pg_roles=[dict(oid=owner, rolname='postgres', rolsuper=False),
                  dict(oid=service, rolname='service_role', rolsuper=False),
                  dict(oid='97012', rolname='anon', rolsuper=False),
                  dict(oid='97013', rolname='authenticated', rolsuper=False)],
        pg_language=[dict(oid=language, lanname='plpgsql')],
        pg_type=[dict(oid=trigger_type, typname='trigger', typnamespace='11')],
        pg_constraint=[dict(oid='97034', conrelid=ledger, confrelid='0', contype='p',
                            conkey=[1], condeferrable=False)],
        pg_index=[dict(indexrelid='97035', indrelid=ledger, indisprimary=True, indisvalid=True,
                       indisready=True, indislive=True, indkey=[1], indexprs=None, indpred=None)],
        pg_attrdef=[dict(oid='97036', adrelid=ledger, adnum=1, adbin='TEST_ONLY_DEFAULT_NODE')],
        pg_sequence=[dict(seqrelid=sequence, seqcache=1, seqincrement=1, seqcycle=False,
                          seqtypid='23', seqmin=1, seqmax=2147483647)],
        pg_depend=[dict(classid='1259', objid=sequence, objsubid=0, refclassid='1259',
                        refobjid=ledger, refobjsubid=1, deptype='a')],
        pg_shdepend=[dict(dbid='97060', classid='1255', objid=p['oid'], objsubid=0,
                         refclassid='1260', refobjid=service, deptype='a') for p in helpers],
    )
    return dict(scope='synthetic-ci',
                context=dict(database='crm_acl_fixture_unit', user='postgres', session_user='postgres',
                             superuser=False, version='170006', isolation='read committed'),
                catalog=cat, sequence_name='drizzle.__drizzle_migrations_id_seq',
                ledger_default="nextval('drizzle.__drizzle_migrations_id_seq'::regclass)",
                sequence_state=dict(last_value=970, is_called=True),
                drizzle=[dict(id=969, hash=hashlib.sha256(b'TEST_ONLY_PRIOR').hexdigest(), created_at=1)],
                supabase=[dict(version='TEST_ONLY_PRIOR', statements=['-- synthetic'], name='TEST_ONLY_PRIOR')])


class DirectWrapperContracts(unittest.TestCase):
    def reject(self, contract, reason):
        with self.assertRaisesRegex(ValueError, 'CRM_DIRECT_' + reason):
            wrapper.render(contract, CANDIDATE)

    def test_minimal_synthetic_contract_renders_one_do(self):
        contract = synthetic_contract()
        self.assertEqual(wrapper.validate_contract(contract)[0], 971)
        sql = wrapper.render(contract, CANDIDATE)
        self.assertEqual(sql.count('DO $crm_direct_lab$'), 1)
        self.assertEqual(sql.count('$crm_direct_lab$;'), 1)
        self.assertIn('DISPOSABLE CI ONLY', sql)
        executable = re.sub(r'--[^\n]*', '', sql)
        self.assertNotIn('BEGIN;', executable)
        self.assertNotIn('COMMIT;', executable)
        self.assertNotRegex(sql, r'(?i)\bEXCEPTION\s+WHEN\b')

    def test_exact_candidate_bytes_are_embedded_without_reconstruction(self):
        sql = wrapper.render(synthetic_contract(), CANDIDATE)
        match = re.search(r"v_payload constant bytea := pg_catalog.decode\('([0-9a-f]+)','hex'\)", sql)
        self.assertIsNotNone(match)
        self.assertEqual(bytes.fromhex(match[1]), CANDIDATE)
        self.assertEqual(hashlib.sha256(CANDIDATE).hexdigest(), wrapper.SHA)
        self.assertEqual(CANDIDATE, (REPO / 'supabase/migrations/20261015194324_crm_helpers_owner_only.sql').read_bytes())
        self.assertIn("pg_catalog.sha256(v_payload)", sql)
        self.assertIn('EXECUTE v_sql;', sql)
        self.assertIn('CRM_DIRECT_ROUNDTRIP', sql)

    def test_candidate_tampering_and_wrong_types_fail_before_contract(self):
        for bad in (CANDIDATE + b'\n', CANDIDATE.replace(b'REVOKE', b'--VOKE', 1),
                    CANDIDATE.decode('utf8'), bytearray(CANDIDATE)):
            with self.subTest(kind=type(bad).__name__):
                with self.assertRaisesRegex(ValueError, 'CRM_DIRECT_CANONICAL_BYTES'):
                    wrapper.render({}, bad)

    def test_scope_and_database_fence(self):
        for scope in (None, 'production', 'private', 'isolated_local_test'):
            contract = synthetic_contract()
            contract['scope'] = scope
            self.reject(contract, 'SYNTHETIC_SCOPE_REQUIRED')
        for name in ('postgres', 'crm_acl_fixture_', 'crm_acl_fixture_x;DROP DATABASE x',
                     'crm_acl_fixture_X', 'crm_acl_fixture_x\n'):
            contract = synthetic_contract()
            contract['context']['database'] = name
            self.reject(contract, 'DISPOSABLE_DATABASE_REQUIRED')

    def test_permission_context_fence(self):
        for key, value in (('user', 'service_role'), ('session_user', 'supabase_admin'),
                           ('superuser', True), ('version', '170005'), ('isolation', 'repeatable read')):
            contract = synthetic_contract()
            contract['context'][key] = value
            self.reject(contract, 'CONTEXT')

    def test_ledger_and_namespace_owner_and_event_trigger_admission(self):
        for key, index, field in (('pg_class', 0, 'relowner'), ('pg_namespace', 1, 'nspowner')):
            contract = synthetic_contract()
            contract['catalog'][key][index][field] = '97099'
            self.reject(contract, 'LEDGER_OWNER')
        contract = synthetic_contract()
        contract['catalog']['pg_event_trigger'] = [dict(oid='97099', evtname='TEST_ONLY_EVENT')]
        self.reject(contract, 'EVENT_TRIGGERS_UNSUPPORTED_IN_LAB')

    def test_each_helper_has_frozen_source_config_signature_owner_and_language(self):
        mutations = (('prosrc', 'BEGIN RETURN NULL; END'), ('proconfig', ['search_path=pg_catalog']),
                     ('proowner', '97099'), ('pronamespace', '97021'), ('prolang', '97099'),
                     ('prorettype', '23'), ('pronargs', 1), ('proargtypes', ['23']),
                     ('provariadic', '23'), ('prosupport', 'TEST_ONLY_SUPPORT'),
                     ('prosecdef', True), ('proisstrict', True), ('provolatile', 's'),
                     ('proparallel', 's'), ('procost', 101), ('probin', 'TEST_ONLY_BINARY'),
                     ('prosqlbody', 'TEST_ONLY_SQL_BODY'))
        for helper in (0, 1):
            for field, value in mutations:
                with self.subTest(helper=helper, field=field):
                    contract = synthetic_contract()
                    contract['catalog']['pg_proc'][helper][field] = value
                    self.reject(contract, 'TARGET_SOURCE_CONTRACT')

    def test_helper_acl_contract_rejects_additional_roles_grantor_and_grant_option(self):
        for acl in (None, [], ['service_role=X/postgres'], ['postgres=X/postgres', 'anon=X/postgres'],
                    ['postgres=X/postgres', 'service_role=X*/postgres'],
                    ['postgres=X/postgres', 'service_role=X/TEST_ONLY_OTHER'],
                    ['postgres=X/postgres', 'postgres=X/postgres']):
            contract = synthetic_contract()
            contract['catalog']['pg_proc'][0]['proacl'] = acl
            self.reject(contract, 'TARGET_ACL_CONTRACT')
        contract = synthetic_contract()
        contract['catalog']['pg_proc'][0]['proacl'] = ['postgres=X/postgres']
        self.assertEqual(wrapper.validate_contract(contract)[0], 971)

    def test_helper_identity_is_unambiguous(self):
        for mode in ('missing', 'extra_same_name', 'duplicate_other_name'):
            contract = synthetic_contract()
            helpers = contract['catalog']['pg_proc']
            if mode == 'missing':
                helpers.pop()
            elif mode == 'extra_same_name':
                helpers.append(dict(helpers[0], oid='97099'))
            else:
                helpers[1]['proname'] = helpers[0]['proname']
            self.reject(contract, 'TARGET_IDENTITIES')

    def test_target_relation_cannot_be_partitioned_inherited_or_owned_elsewhere(self):
        for field, value in (('relkind', 'p'), ('relispartition', True), ('relowner', '97099')):
            contract = synthetic_contract()
            contract['catalog']['pg_class'][2][field] = value
            self.reject(contract, 'TARGET_RELATION')
        contract = synthetic_contract()
        contract['catalog']['pg_inherits'] = [dict(inhparent='97032', inhrelid='97099')]
        self.reject(contract, 'TARGET_RELATION')

    def test_each_helper_has_exact_canonical_trigger_link(self):
        mutations = (('tgrelid', '97099'), ('tgname', 'TEST_ONLY_WRONG_LINK'), ('tgtype', 7),
                     ('tgattr', [999]), ('tgenabled', 'D'), ('tgisinternal', True),
                     ('tgdeferrable', True), ('tginitdeferred', True), ('tgnargs', 1),
                     ('tgargs', '\\x00'), ('tgconstraint', '97099'), ('tgparentid', '97099'),
                     ('tgqual', 'TEST_ONLY_WHEN'), ('tgoldtable', 'TEST_ONLY_OLD'),
                     ('tgnewtable', 'TEST_ONLY_NEW'))
        for link in (0, 1):
            for field, value in mutations:
                with self.subTest(link=link, field=field):
                    contract = synthetic_contract()
                    contract['catalog']['pg_trigger'][link][field] = value
                    self.reject(contract, 'TARGET_LINK_CONTRACT')
        for mode in ('missing', 'extra', 'duplicate_first'):
            contract = synthetic_contract()
            links = contract['catalog']['pg_trigger']
            if mode == 'missing':
                links.pop()
            elif mode == 'extra':
                links.append(dict(links[0], oid='97099'))
            else:
                links[1]['tgfoid'] = links[0]['tgfoid']
            self.reject(contract, 'TARGET_LINKS')

    def test_timeout_must_preexist_and_encoding_is_checked(self):
        sql = wrapper.render(synthetic_contract(), CANDIDATE)
        self.assertIn("current_setting('statement_timeout')::interval<=interval '0'", sql)
        self.assertIn("current_setting('statement_timeout')::interval>interval '20 seconds'", sql)
        self.assertIn("current_setting('server_encoding')<>'UTF8'", sql)
        self.assertIn("current_setting('client_encoding')<>'UTF8'", sql)
        self.assertNotIn("set_config('statement_timeout'", sql)

    def test_hex_json_is_safe_for_dollars_quotes_and_newlines(self):
        attack = "'; END; DROP TABLE x; --\n$$ $crm_direct_lab$ \\\u2028"
        encoded = wrapper.json_sql({'probe': attack})
        match = re.fullmatch(r"pg_catalog.convert_from\(pg_catalog.decode\('([0-9a-f]+)','hex'\),'UTF8'\)::jsonb", encoded)
        self.assertIsNotNone(match)
        self.assertEqual(json.loads(bytes.fromhex(match[1]).decode('utf8')), {'probe': attack})
        contract = synthetic_contract()
        contract['catalog']['pg_description'] = [dict(objoid='97001', description=attack)]
        sql = wrapper.render(contract, CANDIDATE)
        self.assertNotIn(attack, sql)
        self.assertEqual(sql.count('DO $crm_direct_lab$'), 1)

    def test_sequence_identifier_is_measured_qualified_and_injection_safe(self):
        self.assertEqual(wrapper.sequence_state_sql('drizzle.__drizzle_migrations_id_seq'),
                         'SELECT pg_catalog.jsonb_build_object(\'last_value\',last_value,\'is_called\',is_called) FROM "drizzle"."__drizzle_migrations_id_seq";')
        for name in ('id_seq', 'public.x;DROP TABLE x', 'public."x"', 'public.x.y', 'Public.x', 'public.x\n'):
            with self.assertRaisesRegex(ValueError, 'CRM_DIRECT_SEQUENCE_NAME'):
                wrapper.sequence_state_sql(name)

    def test_default_requires_exact_builtin_nextval(self):
        for default in (None, '970', "public.nextval('drizzle.__drizzle_migrations_id_seq'::regclass)",
                        "nextval('public.other_seq'::regclass)", "nextval('drizzle.__drizzle_migrations_id_seq'::regclass)+1"):
            contract = synthetic_contract()
            contract['ledger_default'] = default
            self.reject(contract, 'BUILTIN_NEXTVAL_REQUIRED')
        for default_rows in ([], [dict(adrelid='97030', adnum=2)],
                             [dict(adrelid='97030', adnum=1), dict(adrelid='97030', adnum=2)]):
            contract = synthetic_contract()
            contract['catalog']['pg_attrdef'] = default_rows
            self.reject(contract, 'LEDGER_DEFAULTS')

    def test_ledger_columns_and_behavior_reject(self):
        for field, value, reason in (('atttypid', '97070', 'LEDGER_COLUMNS'),
                                     ('attidentity', 'a', 'LEDGER_COLUMN_BEHAVIOR'),
                                     ('attgenerated', 's', 'LEDGER_COLUMN_BEHAVIOR'),
                                     ('attisdropped', True, 'LEDGER_COLUMN_BEHAVIOR'),
                                     ('attnotnull', False, 'LEDGER_COLUMN_BEHAVIOR')):
            contract = synthetic_contract()
            contract['catalog']['pg_attribute'][0][field] = value
            self.reject(contract, reason)
        for field in ('relispartition', 'relrowsecurity', 'relforcerowsecurity', 'relhasrules', 'relhastriggers'):
            contract = synthetic_contract()
            contract['catalog']['pg_class'][0][field] = True
            self.reject(contract, 'LEDGER_SHAPE')

    def test_deferred_trigger_policy_rule_and_inheritance_reject(self):
        for key, row in (('pg_trigger', dict(tgrelid='97030', tgdeferrable=True, tginitdeferred=True)),
                         ('pg_rewrite', dict(ev_class='97030')),
                         ('pg_policy', dict(polrelid='97030')),
                         ('pg_inherits', dict(inhrelid='97030', inhparent='97099'))):
            contract = synthetic_contract()
            contract['catalog'][key].append(row)
            self.reject(contract, 'LEDGER_BEHAVIOR')

    def test_constraint_and_index_behavior_reject(self):
        for key, field, value, reason in (('pg_constraint', 'condeferrable', True, 'LEDGER_CONSTRAINTS'),
                                          ('pg_constraint', 'contype', 'c', 'LEDGER_CONSTRAINTS'),
                                          ('pg_index', 'indexprs', 'TEST_ONLY_EXPRESSION', 'LEDGER_INDEXES'),
                                          ('pg_index', 'indpred', 'TEST_ONLY_PREDICATE', 'LEDGER_INDEXES'),
                                          ('pg_index', 'indisvalid', False, 'LEDGER_INDEXES')):
            contract = synthetic_contract()
            contract['catalog'][key][0][field] = value
            self.reject(contract, reason)

    def test_serial_convention_and_owned_by_reject(self):
        for field, value in (('seqcache', 2), ('seqincrement', 2), ('seqcycle', True), ('seqtypid', '20')):
            contract = synthetic_contract()
            contract['catalog']['pg_sequence'][0][field] = value
            self.reject(contract, 'SEQUENCE_CONVENTION')
        contract = synthetic_contract()
        contract['catalog']['pg_depend'] = []
        self.reject(contract, 'SEQUENCE_OWNED_BY')
        contract = synthetic_contract()
        contract['catalog']['pg_class'][1]['relowner'] = '97099'
        self.reject(contract, 'SEQUENCE_OWNER')

    def test_sequence_behind_or_exhausted_fails_and_real_gaps_are_accepted(self):
        for state in (dict(last_value=968, is_called=True), dict(last_value=969, is_called=False),
                      dict(last_value=2147483647, is_called=True)):
            contract = synthetic_contract()
            contract['sequence_state'] = state
            self.reject(contract, 'SEQUENCE_BEHIND_HISTORY')
        for state, expected in ((dict(last_value=980, is_called=True), 981),
                                 (dict(last_value=980, is_called=False), 980)):
            contract = synthetic_contract()
            contract['sequence_state'] = state
            self.assertEqual(wrapper.validate_contract(contract)[0], expected)
        for state in (dict(last_value=True, is_called=True), dict(last_value=970, is_called=1),
                      dict(last_value=970, is_called=True, log_cnt=0)):
            contract = synthetic_contract()
            contract['sequence_state'] = state
            self.reject(contract, 'SEQUENCE_STATE')

    def test_history_full_rows_duplicates_order_and_future_reject(self):
        for mutate, reason in (
                (lambda rows: rows[0].update(id=True), 'HISTORY_SHAPE'),
                (lambda rows: rows[0].update(created_at=wrapper.WHEN), 'HISTORY_SHAPE'),
                (lambda rows: rows[0].update(hash=wrapper.SHA), 'HISTORY_SHAPE'),
                (lambda rows: rows[0].update(extra='TEST_ONLY'), 'HISTORY_SHAPE'),
                (lambda rows: rows.append(copy.deepcopy(rows[0])), 'DUPLICATE_HISTORY')):
            contract = synthetic_contract()
            mutate(contract['drizzle'])
            self.reject(contract, reason)
        contract = synthetic_contract()
        contract['drizzle'].append(dict(id=968, hash='a' * 64, created_at=2))
        self.reject(contract, 'HISTORY_ORDER')

    def test_normalization_removes_only_named_helper_acl_and_service_dependencies(self):
        contract = synthetic_contract()
        cat = contract['catalog']
        exact = copy.deepcopy(cat)
        for probe in (dict(dbid='97060', classid='1255', objid='97001', objsubid=0, refclassid='1260', refobjid='97099', deptype='a'),
                      dict(dbid='97060', classid='1255', objid='97001', objsubid=0, refclassid='1260', refobjid='97011', deptype='o'),
                      dict(dbid='97060', classid='1255', objid='97099', objsubid=0, refclassid='1260', refobjid='97011', deptype='a')):
            cat['pg_shdepend'].append(probe)
        cat['pg_proc'].append(dict(oid='97099', proname='TEST_ONLY_OTHER', proacl=['service_role=X/postgres']))
        output = wrapper.normalized(cat)
        self.assertEqual(len(output['pg_shdepend']), 3)
        self.assertEqual(output['pg_proc'][-1], cat['pg_proc'][-1])
        self.assertTrue(all('proacl' not in p for p in output['pg_proc'][:-1]))
        self.assertIn('proacl', cat['pg_proc'][0], 'normalization mutated the reviewed input')
        self.assertEqual(exact['pg_shdepend'], cat['pg_shdepend'][:2])

    def test_serial_registration_has_no_explicit_ids_or_sequence_mutations(self):
        sql = wrapper.render(synthetic_contract(), CANDIDATE)
        executable = re.sub(r'--[^\n]*', '', sql)
        self.assertIn('INSERT INTO drizzle.__drizzle_migrations(hash,created_at)', executable)
        self.assertNotRegex(executable, r'(?i)\bINSERT\s+INTO\s+drizzle\.__drizzle_migrations\s*\(\s*id\b')
        self.assertNotRegex(executable, r'(?i)\b(?:setval|nextval)\s*\(')
        self.assertNotRegex(executable, r'(?i)\bALTER\s+SEQUENCE\b|\bRESTART\b')
        self.assertIn('RETURNING pg_catalog.jsonb_build_object', executable)
        self.assertEqual(executable.count('INSERT INTO '), 1)
        self.assertNotRegex(executable, r'(?i)\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO\s+|FROM\s+)?supabase_migrations\.')
        self.assertLess(executable.index('SHARE ROW EXCLUSIVE MODE NOWAIT'), executable.index('SHARE MODE NOWAIT'))
        self.assertLess(executable.index('SHARE MODE NOWAIT'), executable.index('SHARE UPDATE EXCLUSIVE MODE NOWAIT'))

    def test_readonly_capture_retains_histories_default_context_and_semantic_catalog(self):
        sql = wrapper.capture_sql()
        self.assertEqual(sql.count(';'), 1)
        self.assertTrue(sql.strip().startswith('SELECT '))
        self.assertNotRegex(sql, r'(?i)\b(?:INSERT|UPDATE|DELETE|GRANT|REVOKE|ALTER|CREATE|DROP)\s+(?:INTO|FROM|TABLE|FUNCTION|SCHEMA|ROLE|EXECUTE)\b')
        for item in ('ledger_default', 'pg_get_expr', 'pg_sequence', 'pg_roles', 'pg_auth_members',
                     'event_functions', 'pg_shdepend', 'pg_depend', 'drizzle.__drizzle_migrations',
                     'supabase_migrations.schema_migrations', 'ORDER BY d.id', 'ORDER BY s.version'):
            self.assertIn(item, sql)
        self.assertNotRegex(sql, r'(?i)\b(?:setval|nextval)\s*\(')

    def test_renderer_is_inert_and_validation_is_not_assert_based(self):
        source = (ROOT / 'direct_wrapper.py').read_text(encoding='utf8')
        parsed = ast.parse(source)
        self.assertFalse(any(isinstance(node, ast.Assert) for node in ast.walk(parsed)))
        imports = [node for node in ast.walk(parsed) if isinstance(node, (ast.Import, ast.ImportFrom))]
        text = '\n'.join(ast.unparse(node) for node in imports)
        self.assertNotRegex(text, r'\b(?:subprocess|socket|requests|psycopg|psycopg2|asyncpg|urllib)\b')
        self.assertNotIn('def main(', source)
        self.assertNotIn('write_text(', source)
        self.assertNotIn('write_bytes(', source)

    def test_lab_fault_is_explicit_and_operational_proposal_remains_fenced(self):
        sql = wrapper.render(synthetic_contract(), CANDIDATE, fault='after-insert')
        self.assertIn("RAISE EXCEPTION 'CRM_DIRECT_INJECTED_AFTER_INSERT';", sql)
        self.assertLess(sql.index('INSERT INTO drizzle.'), sql.index("RAISE EXCEPTION 'CRM_DIRECT_INJECTED_AFTER_INSERT';"))
        self.assertNotIn('CRM_DIRECT_INJECTED_AFTER_INSERT', wrapper.render(synthetic_contract(), CANDIDATE))
        with self.assertRaisesRegex(ValueError, 'CRM_DIRECT_FAULT_MODE'):
            wrapper.render(synthetic_contract(), CANDIDATE, fault='production-bypass')
        fence = (ROOT / 'PROPOSAL_direct_ledger_wrapper.sql').read_text(encoding='utf8')
        self.assertIn("RAISE EXCEPTION 'CRM_DIRECT_WRAPPER_NOT_ADMITTED:", fence)
        self.assertNotIn('INSERT INTO', fence)


if __name__ == '__main__':
    unittest.main()
