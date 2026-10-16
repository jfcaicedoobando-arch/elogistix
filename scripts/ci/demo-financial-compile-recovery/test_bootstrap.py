"""Offline structural refusal tests only; no SQL parser, PostgreSQL, network or subprocess.

Mutation controls show that the checks reject identity-success shortcuts and weaker
verification. Passing these tests does not establish PostgreSQL compilation.
"""
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parent
BOOTSTRAP = (ROOT / 'sql/bootstrap.sql').read_text(encoding='utf-8')
VERIFY = (ROOT / 'sql/verify-install.sql').read_text(encoding='utf-8')
HELPER = re.compile(
    r'CREATE\s+FUNCTION\s+(?P<name>auth\.[a-z_]+)\(\)\s+RETURNS\s+(?P<type>[a-z]+)\s+'
    r'(?P<header>.*?)\s+AS\s+(?P<tag>\$[a-z_]*\$)(?P<body>.*?)(?P=tag)\s*;', re.I | re.S)


def code(text):
    return re.sub(r'--[^\n]*', '', text)


def compact(text):
    return ' '.join(code(text).split()).lower()


def require(ok, reason):
    if not ok:
        raise ValueError(reason)


def bootstrap_contract(text):
    source = code(text)
    folded = compact(text)
    require(not re.search(r'\b(INSERT|UPDATE|DELETE|TRUNCATE|COPY|GRANT)\b', source, re.I), 'fixture DML/grant')
    require(not re.search(r'\b(?:CREATE|ALTER)\s+ROLE\b|\bSET\s+ROLE\b', source, re.I), 'role authority')
    require(not re.search(r'CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.', source, re.I), 'canonical replacement')
    for guard in ["current_database() <> 'demo_financial_compile_recovery_lab'",
                  "current_setting('server_version_num') <> '170006'", "current_user <> 'postgres'",
                  "session_user <> 'postgres'", 'and not rolsuper and rolbypassrls and not rolinherit',
                  'and not rolcreatedb and not rolcreaterole and not rolreplication',
                  "pg_has_role(current_user,'supabase_admin','member')", 'and not rolcanlogin',
                  'financial_compile_fresh_database_required']:
        require(guard in folded, 'candidate/freshness guard')
    require(re.findall(r'CREATE\s+SCHEMA\s+([a-z_]+)\s*;', source, re.I)
            == ['auth', 'financial_compile_fixture', 'extensions'], 'schema scope')
    require(set(re.findall(r'CREATE\s+TABLE\s+([a-z_.]+)\s*\(', source, re.I))
            == {'auth.users', 'financial_compile_fixture.auth_context'}, 'table scope')
    helpers = {m['name'].lower(): m for m in HELPER.finditer(source)}
    require(set(helpers) == {'auth.uid', 'auth.role', 'auth.jwt'}, 'helper inventory')
    for name, output, column in [('auth.uid', 'uuid', 'subject_user_id'),
                                 ('auth.role', 'text', 'role_name'), ('auth.jwt', 'jsonb', 'jwt_claims')]:
        helper = helpers[name]
        header, body = compact(helper['header']), compact(helper['body'])
        require(helper['type'].lower() == output and 'language sql stable security invoker' in header
                and 'set search_path=pg_catalog' in header, 'helper metadata')
        require('financial_compile_fixture.auth_context where singleton' in body and column in body,
                'helper must read the empty fixture table')
        require(not re.search(r'current_setting|current_user|session_user|service_role|authenticated|union|\btrue\b', body),
                'identity shortcut')
    require("'{}'::jsonb" in helpers['auth.jwt']['body'], 'empty JWT object')
    require(re.findall(r'CREATE\s+EXTENSION\s+([^;]+);', source, re.I)
            == ['pg_trgm WITH SCHEMA extensions'], 'candidate trusted extension only')
    require("d.deptype='e'" in folded and "a.amname='gin'" in folded
            and "o.opcname='gin_trgm_ops'" in folded and 'e.extowner=current_user::regrole::oid' in folded,
            'extension provenance')
    require('or auth.uid() is not null or auth.role() is not null' in folded
            and "auth.jwt() is distinct from '{}'::jsonb" in folded, 'empty auth assertion')
    require(text.count("SELECT 'FINANCIAL_COMPILE_BOOTSTRAP_EMPTY_AUTH_COMPLETE';") == 1,
            'bootstrap completion marker')
    return helpers


def verifier_contract(text):
    source, folded = code(text), compact(text)
    require(not re.search(r'\b(INSERT|UPDATE|DELETE|TRUNCATE|COPY|GRANT)\b', source, re.I), 'verification must not populate data')
    require(not re.search(r'\bPERFORM\s+demo_(?:flow_writer|fixture_identity)\.', source, re.I), 'business/issuer execution')
    for required in ['pg_temp.financial_compile_expected_functions', 'pg_temp.financial_compile_expected_objects',
                     'financial_compile_expected_manifest_required', 'financial_compile_invalid_expected_manifest',
                     "encode(sha256(convert_to(p.prosrc,'utf8')),'hex')", 'p.oid<>core_oid',
                     'select * from expected except select * from actual',
                     'select * from actual except select * from expected',
                     'count(*) as copies', 'l.lanname::text as language',
                     'financial_compile_canonical_function_multiset_mismatch',
                     'financial_compile_function_owner_mismatch',
                     'financial_compile_final_registry_replacement_required',
                     'financial_compile_private_boundary_not_closed',
                     'financial_compile_data_must_remain_empty',
                     "auth.jwt() is distinct from '{}'::jsonb", 'demo_flow_writer.enabled() is distinct from false']:
        require(required in folded, 'incomplete installation verification')
    for schema in ['public', 'demo_flow_writer', 'demo_fixture_identity', 'auth', 'financial_compile_fixture']:
        require("'" + schema + "'" in folded, 'empty data scope')
    for wrapper in ['prepare_authorized_run(uuid)', 'execute_and_checkpoint(uuid,bigint)',
                    'prepare_execute_checkpoint(uuid,bigint)', 'issue_scheduler_context(uuid,uuid,integer)',
                    'reconcile_context(uuid)', 'verify_preparation_origin(uuid)', 'prepare_identity_receipt(uuid)']:
        require(wrapper in folded, 'upstream wrapper inventory')
    for limit in ["'pass_compile_only'", "'real_identity','not_run'", "'financial_business','not_run'",
                  "'deferred_runtime','not_run'", "'operational_transport','unbound'", "'demo','disabled'"]:
        require(limit in folded, 'compile-only classification')
    require(text.count("SELECT 'FINANCIAL_COMPILE_INSTALL_VERIFIED';") == 1, 'installation completion marker')


class BootstrapContracts(unittest.TestCase):
    def test_candidate_bootstrap_and_empty_helpers_have_explicit_scope(self):
        self.assertEqual(len(bootstrap_contract(BOOTSTRAP)), 3)

    def test_fixture_population_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'fixture DML'):
            bootstrap_contract(BOOTSTRAP + "\nINSERT INTO auth.users(id) VALUES(gen_random_uuid());\n")

    def test_successful_uid_literal_is_not_an_auth_model(self):
        mutant = BOOTSTRAP.replace('SELECT subject_user_id FROM financial_compile_fixture.auth_context WHERE singleton',
                                   "SELECT '10000000-0000-4000-8000-000000000001'::uuid")
        with self.assertRaisesRegex(ValueError, 'empty fixture table'):
            bootstrap_contract(mutant)

    def test_role_fallback_cannot_create_service_authority(self):
        mutant = BOOTSTRAP.replace('SELECT role_name FROM', "SELECT COALESCE(role_name,'service_role') FROM")
        with self.assertRaisesRegex(ValueError, 'identity shortcut'):
            bootstrap_contract(mutant)

    def test_ambient_claims_cannot_replace_the_empty_fixture(self):
        mutant = BOOTSTRAP.replace('SELECT jwt_claims FROM financial_compile_fixture.auth_context WHERE singleton',
                                   "SELECT current_setting('request.jwt.claims')::jsonb")
        with self.assertRaises(ValueError):
            bootstrap_contract(mutant)

    def test_helper_definer_escalation_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'helper metadata'):
            bootstrap_contract(BOOTSTRAP.replace('SECURITY INVOKER', 'SECURITY DEFINER', 1))

    def test_wrong_candidate_database_and_privilege_guards_are_rejected(self):
        for mutant in [BOOTSTRAP.replace('demo_financial_compile_recovery_lab', 'postgres'),
                       BOOTSTRAP.replace('AND NOT rolsuper AND rolbypassrls', 'AND rolsuper AND rolbypassrls')]:
            with self.subTest(mutant=mutant[:0]), self.assertRaisesRegex(ValueError, 'candidate/freshness guard'):
                bootstrap_contract(mutant)

    def test_extension_redirection_and_fake_operator_class_are_rejected(self):
        for replacement in ['CREATE EXTENSION pg_trgm WITH SCHEMA public;',
                            'CREATE OPERATOR CLASS extensions.gin_trgm_ops DEFAULT FOR TYPE text USING gin AS STORAGE integer;']:
            with self.subTest(replacement=replacement), self.assertRaisesRegex(ValueError, 'extension'):
                bootstrap_contract(BOOTSTRAP.replace('CREATE EXTENSION pg_trgm WITH SCHEMA extensions;', replacement))

    def test_canonical_functions_and_roles_cannot_be_replaced_by_bootstrap(self):
        for addition in ['CREATE ROLE new_login LOGIN;', 'GRANT service_role TO postgres;',
                         'CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;']:
            with self.subTest(addition=addition), self.assertRaises(ValueError):
                bootstrap_contract(BOOTSTRAP + '\n' + addition)

    def test_install_verifier_requires_manifest_multiset_empty_data_and_scope(self):
        verifier_contract(VERIFY)

    def test_one_way_or_trimmed_body_hash_verification_is_rejected(self):
        for mutant in [VERIFY.replace('SELECT * FROM actual EXCEPT SELECT * FROM expected', 'SELECT * FROM actual'),
                       VERIFY.replace("convert_to(p.prosrc,'UTF8')", "convert_to(btrim(p.prosrc),'UTF8')")]:
            with self.subTest(mutant=mutant[:0]), self.assertRaisesRegex(ValueError, 'installation verification'):
                verifier_contract(mutant)

    def test_verifier_cannot_execute_an_issuer_or_hide_data_population(self):
        for addition in ['INSERT INTO demo_flow_writer.control VALUES(true,true);',
                         'DO $$ BEGIN PERFORM demo_flow_writer.execute_and_checkpoint(NULL,0); END $$;']:
            with self.subTest(addition=addition), self.assertRaises(ValueError):
                verifier_contract(VERIFY + '\n' + addition)

    def test_no_compile_pass_can_claim_operational_identity_or_business(self):
        for field in ['real_identity', 'financial_business', 'deferred_runtime']:
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, 'classification'):
                verifier_contract(VERIFY.replace("'" + field + "','NOT_RUN'", "'" + field + "','PASS'"))

    def test_completion_markers_are_not_duplicated(self):
        for checker, text, marker in [(bootstrap_contract, BOOTSTRAP, 'FINANCIAL_COMPILE_BOOTSTRAP_EMPTY_AUTH_COMPLETE'),
                                      (verifier_contract, VERIFY, 'FINANCIAL_COMPILE_INSTALL_VERIFIED')]:
            with self.subTest(marker=marker), self.assertRaisesRegex(ValueError, 'completion marker'):
                checker(text + "\nSELECT '" + marker + "';\n")


if __name__ == '__main__':
    unittest.main()
