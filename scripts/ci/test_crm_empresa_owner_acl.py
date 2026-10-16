#!/usr/bin/env python3
"""0017 harness regression: python3 scripts/ci/test_crm_empresa_owner_acl.py -v.

Static checks need only Python. Runtime checks own a new, disposable PostgreSQL
17+ cluster via initdb/pg_ctl/psql on PATH; they never accept connection settings
or connect to an existing database. No replay, baseline or seed is rewritten.
The default CRM_EMPRESA_FIXTURE_MODE=synthetic uses an explicit 0016 overlay.
Set CRM_EMPRESA_FIXTURE_MODE=integrated to require the real catalog entry and
execute the unmodified harness; synthetic success is not integrated coverage.
"""
from pathlib import Path
import hashlib
import json
import os
import re
import shlex
import shutil
import socket
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
POST = ROOT / 'supabase/tests/rls/_ci_post_migrate.sql'
SQL = POST.read_text(encoding='utf-8')
CALL = 'SELECT pg_temp._ci_check_crm_empresa_owner_acl();'
GRANT = 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;'
NAMES = ['_crm_empresa_no_borrar_cliente', '_crm_empresa_no_delete_fisico']
HISTORY = ROOT / 'drizzle/migrations'
ERROR = 'CI_CRM_EMPRESA_OWNER_ACL:'
FIXTURE_MODE = os.environ.get('CRM_EMPRESA_FIXTURE_MODE', 'synthetic')


def expand(path):
    """Feed the real harness and its real includes to psql in one transaction."""
    path = path.resolve()
    path.relative_to(ROOT)
    return ''.join(expand(path.parent / match[1]) if (match := re.fullmatch(
        r'\\ir\s+(\S+)\s*', line.strip())) else line + '\n'
        for line in path.read_text(encoding='utf-8').splitlines())


def harness_for_0016_fixture(harness, catalog, mode):
    if mode not in {'synthetic', 'integrated'}:
        raise AssertionError('CRM0016 fixture mode must be synthetic or integrated')
    if harness.count(catalog) != 1:
        raise AssertionError('CRM0016 fixture requires exactly one real catalog include')
    if mode == 'integrated':
        catalog_sql = re.sub(r'/\*.*?\*/|--[^\n]*', '', catalog, flags=re.S)
        if not re.search(r"\(\s*'public\._crm_empresa_desde_cliente\(\)'\s*\)", catalog_sql):
            raise AssertionError('CRM0016 integrated mode: missing real catalog entry')
        return harness  # No overlay, repair, insertion or replacement in this mode.
    synthetic_catalog = catalog + """
-- SYNTHETIC fixture only; this is not validation of the integrated catalog.
INSERT INTO pg_temp._ci_service_role_only (fn)
SELECT 'public._crm_empresa_desde_cliente()'
WHERE NOT EXISTS (SELECT 1 FROM pg_temp._ci_service_role_only
                  WHERE fn='public._crm_empresa_desde_cliente()');
"""
    return harness.replace(catalog, synthetic_catalog, 1)


class SourceContract(unittest.TestCase):
    def test_selected_0016_fixture_mode(self):
        # Integrated mode must fail here even without PostgreSQL if the actual
        # repository catalog lost 0016. Never silently fall back to synthetic.
        catalog = expand(POST.parent / '_ci_service_role_only.sql')
        harness = expand(POST)
        selected = harness_for_0016_fixture(harness, catalog, FIXTURE_MODE)
        if FIXTURE_MODE == 'integrated':
            self.assertIs(selected, harness)
        else:
            self.assertIn('-- SYNTHETIC fixture only;', selected)

    def test_integrated_mode_rejects_deliberate_catalog_entry_removal(self):
        # In-memory mutation control only; no repository catalog is edited.
        entry = "('public._crm_empresa_desde_cliente()')"
        catalog = 'INSERT INTO _ci_service_role_only (fn) VALUES ' + entry + ';\n'
        harness = catalog + 'SELECT 1;\n'
        self.assertIs(harness_for_0016_fixture(harness, catalog, 'integrated'), harness)
        missing = catalog.replace(entry, "('public.unrelated_fixture()')")
        for mutation in [missing, missing + '-- ' + entry + '\n']:
            with self.subTest(catalog=mutation):
                with self.assertRaisesRegex(AssertionError, 'missing real catalog entry'):
                    harness_for_0016_fixture(mutation + 'SELECT 1;\n', mutation, 'integrated')

    def test_precheck_precedes_every_harness_grant_and_final_check_is_last(self):
        first = SQL.index(CALL)
        self.assertLess(first, SQL.index('GRANT USAGE ON SCHEMA public'))
        restore = SQL.index('DO $crm_empresa_owner_restore$')
        self.assertLess(SQL.index(GRANT), restore)
        self.assertLess(restore, SQL.rindex(CALL))
        self.assertEqual(SQL.count(CALL), 2)
        self.assertEqual(SQL[SQL.rindex(CALL):].strip(), CALL + '\n'
                         'DROP FUNCTION pg_temp._ci_check_crm_empresa_owner_acl();')

    def test_checker_is_read_only_and_restoration_only_undoes_ci_grants(self):
        check = SQL.split('AS $crm_empresa_owner_acl$', 1)[1].split(
            '$crm_empresa_owner_acl$;', 1)[0]
        self.assertNotRegex(check, r'\b(GRANT|REVOKE|ALTER|INSERT|UPDATE|DELETE|DROP)\b')
        restore = SQL.split('DO $crm_empresa_owner_restore$', 1)[1].split(
            '$crm_empresa_owner_restore$;', 1)[0]
        self.assertEqual(re.findall(r"'REVOKE[^']+'", restore), [
            "'REVOKE EXECUTE ON FUNCTION %s FROM authenticated, service_role'"])
        catalog = (POST.parent / '_ci_service_role_only.sql').read_text(encoding='utf-8')
        for name in NAMES:
            self.assertIn('public.' + name + '()', check)
            self.assertIn('public.' + name + '()', restore)
            self.assertNotIn(name, catalog)
        self.assertNotIn('_crm_empresa_desde_cliente()', check + restore)

    def test_literal_historical_fixtures_are_unchanged(self):
        expected = {
            # Pinned to main cf4af5c; fixtures below execute these files verbatim.
            '0016_crm_empresa_desde_cliente.sql': '9a1092ca7e9a59a2166140c19a182f05c562284e10db489e998cdb098d14a629',
            '0017_crm_empresa_no_borrar_cliente.sql': '548be2b88fde30174ce4b90fdc333cd6f745f0948bf331907de879ee5c95bcdb',
        }
        for name, digest in expected.items():
            with self.subTest(file=name):
                self.assertEqual(hashlib.sha256((HISTORY / name).read_bytes()).hexdigest(), digest)


FIXTURE = """
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE ROLE ci_crm_inherited NOLOGIN;
CREATE ROLE ci_crm_unrelated NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
CREATE TABLE public.clientes (id uuid PRIMARY KEY, organization_id uuid,
  nombre text, deleted_at timestamptz);
CREATE TABLE public.crm_empresas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid, nombre text, cliente_id uuid, created_by uuid,
  created_at timestamptz DEFAULT now(), deleted_at timestamptz,
  estado_crm text DEFAULT 'Prospecto');
-- Minimal unrelated harness dependencies, all synthetic, without production data.
CREATE TABLE public.tracking_externo (id integer);
CREATE FUNCTION public.has_role(text) RETURNS boolean LANGUAGE sql AS 'SELECT false';
CREATE TABLE public.planes (activo boolean);
CREATE POLICY "Authenticated read planes" ON public.planes FOR SELECT
  TO authenticated USING (activo IS TRUE);
CREATE POLICY "Super admin CRUD planes" ON public.planes FOR ALL
  TO authenticated USING (public.has_role('super_admin'))
  WITH CHECK (public.has_role('super_admin'));
CREATE TABLE public.navieras (id integer);
CREATE TABLE public.puertos (id integer);
CREATE TABLE public.tipos_contenedor (id integer);
CREATE TABLE public.tipos_cambio_dof (id integer);
ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navieras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puertos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_contenedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_cambio_dof ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.planes, public.navieras, public.puertos,
  public.tipos_contenedor, public.tipos_cambio_dof TO authenticated;
CREATE FUNCTION public.tc_dof_upsert_manual(date,numeric,numeric)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS 'BEGIN NULL; END;';
CREATE FUNCTION public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)
  RETURNS void LANGUAGE plpgsql AS 'BEGIN NULL; END;';
CREATE FUNCTION public.guard_cotizacion_origen_pricing()
  RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RETURN NEW; END;';
REVOKE ALL ON FUNCTION public.crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_cotizacion_origen_pricing()
  FROM PUBLIC, anon, authenticated, service_role;
"""

SNAPSHOT = """
SELECT 'SNAPSHOT:' || jsonb_object_agg(p.proname, jsonb_build_object(
  'oid', p.oid, 'owner', p.proowner::regrole::text, 'acl', p.proacl::text,
  'definition', pg_get_functiondef(p.oid),
  'anon', has_function_privilege('anon',p.oid,'EXECUTE'),
  'authenticated', has_function_privilege('authenticated',p.oid,'EXECUTE'),
  'service_role', has_function_privilege('service_role',p.oid,'EXECUTE')))::text
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
  ('_crm_empresa_no_borrar_cliente','_crm_empresa_no_delete_fisico');
"""


class DisposablePostgres(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        binaries = {name: shutil.which(name) for name in ['initdb', 'pg_ctl', 'psql']}
        missing = [name for name, path in binaries.items() if path is None]
        if missing:
            raise unittest.SkipTest('Runtime requires PostgreSQL 17+ binaries on PATH: ' + ', '.join(missing))
        cls.bin = binaries
        cls.env = {k: v for k, v in os.environ.items() if not k.upper().startswith('PG')
                   and k.upper() not in {'DATABASE_URL', 'SUPABASE_DB_URL'}}
        version = subprocess.run([cls.bin['initdb'], '--version'], env=cls.env,
                                 text=True, capture_output=True, check=True).stdout
        if int(re.search(r'PostgreSQL\) (\d+)', version)[1]) < 17:
            raise unittest.SkipTest('The full main harness requires PostgreSQL 17+ (MAINTAIN)')
        cls.tmp = tempfile.TemporaryDirectory(prefix='elogistix-crm-owner-')
        cls.addClassCleanup(cls.tmp.cleanup)
        cls.data = str(Path(cls.tmp.name) / 'data')
        subprocess.run([cls.bin['initdb'], '-D', cls.data, '-U', 'postgres',
                        '--auth=trust', '--no-locale', '--encoding=UTF8'],
                       env=cls.env, capture_output=True, text=True, check=True, timeout=30)
        # No caller PG settings are used; pg_ctl must start OUR data directory
        # before the first connection. On Unix expose only our private socket.
        if os.name == 'nt':
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            host = '127.0.0.1'
            options = f"-h 127.0.0.1 -p {port} -F -c unix_socket_directories=''"
        else:
            host, port = cls.tmp.name, 5432
            options = f"-h '' -k {shlex.quote(host)} -p {port} -F"
        cls.env.update(PGHOST=host, PGPORT=str(port), PGUSER='postgres', PGDATABASE='postgres',
                       PGCONNECT_TIMEOUT='3')
        cls.addClassCleanup(cls.stop)
        subprocess.run([cls.bin['pg_ctl'], '-D', cls.data, '-l',
                        str(Path(cls.tmp.name) / 'postgres.log'), '-o', options,
                        '-w', '-t', '20', 'start'], env=cls.env,
                       capture_output=True, text=True, check=True, timeout=30)
        fixture = FIXTURE + '\n' + '\n'.join((HISTORY / name).read_text(encoding='utf-8')
            for name in ['0016_crm_empresa_desde_cliente.sql', '0017_crm_empresa_no_borrar_cliente.sql'])
        cls.run_sql(fixture, check=True)
        cls.harness = expand(POST)

    @classmethod
    def stop(cls):
        if not (Path(cls.data) / 'postmaster.pid').exists():
            return
        subprocess.run([cls.bin['pg_ctl'], '-D', cls.data, '-m', 'immediate', '-w',
                        '-t', '20', 'stop'], env=cls.env, capture_output=True,
                       text=True, check=True, timeout=30)

    @classmethod
    def run_sql(cls, sql, check=False):
        return subprocess.run([cls.bin['psql'], '-X', '-qAt', '--no-password',
                               '-v', 'ON_ERROR_STOP=1'], input=sql, env=cls.env,
                              capture_output=True, text=True, check=check, timeout=30)

    def reject(self, mutation, harness=None, expected=ERROR):
        result = self.run_sql('BEGIN;\n' + mutation + '\n' +
                              (self.harness if harness is None else harness) + '\nROLLBACK;')
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(expected, result.stderr)

    def test_direct_execute_grants_are_rejected_before_repair(self):
        for name in NAMES:
            for role in ['PUBLIC', 'anon', 'authenticated', 'service_role', 'ci_crm_unrelated']:
                with self.subTest(function=name, role=role):
                    self.reject(f'GRANT EXECUTE ON FUNCTION public.{name}() TO {role};')

    def test_inherited_owner_privileges_without_acl_changes_are_rejected(self):
        for role in ['anon', 'authenticated', 'service_role']:
            with self.subTest(role=role):
                mutation = f"""
GRANT postgres TO ci_crm_inherited;
GRANT ci_crm_inherited TO {role};
DO $$ BEGIN
  IF NOT has_function_privilege('{role}', 'public.{NAMES[0]}()', 'EXECUTE') THEN
    RAISE EXCEPTION 'fixture did not establish inherited EXECUTE';
  END IF;
END $$;
"""
                # Owner membership also trips unrelated global-table preflights.
                # Exercise this exact read-only guard independently to prove it
                # detects effective inheritance even with an unchanged proacl.
                check = SQL[SQL.index('CREATE FUNCTION pg_temp._ci_check_crm_empresa_owner_acl()'):
                            SQL.index(CALL) + len(CALL)]
                self.reject(mutation, harness=check,
                            expected=ERROR + ' unexpected EXECUTE for ' + role)

    def test_invoker_owner_and_grant_option_drift_are_rejected(self):
        for name in NAMES:
            for mutation in [f'ALTER FUNCTION public.{name}() SECURITY DEFINER;',
                             f'ALTER FUNCTION public.{name}() OWNER TO ci_crm_unrelated;',
                             f'GRANT EXECUTE ON FUNCTION public.{name}() TO postgres WITH GRANT OPTION;']:
                with self.subTest(mutation=mutation):
                    self.reject(mutation)

    def test_null_acl_and_wrong_return_type_are_rejected(self):
        for name in NAMES:
            for returns, body, revoke in [
                ('trigger', 'RETURN NEW;', ''),
                ('integer', 'RETURN 1;', f'REVOKE ALL ON FUNCTION public.{name}() FROM PUBLIC;'),
            ]:
                with self.subTest(function=name, returns=returns):
                    self.reject(f"DROP FUNCTION public.{name}() CASCADE;\n"
                                f"CREATE FUNCTION public.{name}() RETURNS {returns} LANGUAGE plpgsql "
                                f"AS 'BEGIN {body} END;';\n" + revoke)

    def test_partial_replays_fail_but_both_absent_supports_pre_replay_main(self):
        for name in NAMES:
            with self.subTest(missing=name):
                self.reject(f'DROP FUNCTION public.{name}() CASCADE;',
                            expected=ERROR + ' incomplete Drizzle 0017 replay')
        drops = '\n'.join(f'DROP FUNCTION public.{name}() CASCADE;' for name in NAMES)
        self.run_sql('BEGIN;\n' + drops + '\n' + self.harness + '\nROLLBACK;', check=True)

    def test_final_check_detects_direct_and_inherited_leaks_after_restoration(self):
        head, tail = self.harness.rsplit(CALL, 1)
        for mutation in [f'GRANT EXECUTE ON FUNCTION public.{NAMES[1]}() TO service_role;',
                         'GRANT postgres TO authenticated;']:
            with self.subTest(mutation=mutation):
                self.reject('', harness=head + mutation + '\n' + CALL + tail)

    def test_full_harness_preserves_exact_snapshot_and_0016_service_role(self):
        # The caller explicitly selects synthetic or integrated coverage.
        # Chain 6b912446 must use integrated mode: a missing real entry fails.
        catalog = expand(POST.parent / '_ci_service_role_only.sql')
        selected_harness = harness_for_0016_fixture(self.harness, catalog, FIXTURE_MODE)
        snapshot_0016 = SNAPSHOT.replace('SNAPSHOT:', 'SNAPSHOT0016:').replace(
            "('_crm_empresa_no_borrar_cliente','_crm_empresa_no_delete_fisico')",
            "('_crm_empresa_desde_cliente')")
        result = self.run_sql('BEGIN;\n' + SNAPSHOT + snapshot_0016
                              + selected_harness + selected_harness + SNAPSHOT + snapshot_0016
                              + '\nROLLBACK;', check=True)
        snapshots = [json.loads(line.removeprefix('SNAPSHOT:'))
                     for line in result.stdout.splitlines() if line.startswith('SNAPSHOT:')]
        self.assertEqual(len(snapshots), 2, result.stdout)
        self.assertEqual(snapshots[0], snapshots[1])
        self.assertEqual(set(snapshots[1]), set(NAMES))
        for state in snapshots[1].values():
            self.assertEqual(state['owner'], 'postgres')
            self.assertEqual(state['acl'], '{postgres=X/postgres}')
            for role in ['anon', 'authenticated', 'service_role']:
                self.assertIs(state[role], False)
        snapshots_0016 = [json.loads(line.removeprefix('SNAPSHOT0016:'))
                          for line in result.stdout.splitlines() if line.startswith('SNAPSHOT0016:')]
        self.assertEqual(len(snapshots_0016), 2, result.stdout)
        # Includes the complete definition, owner, ACL, OID and effective roles;
        # a pre-existing leak repaired by the harness must fail this comparison.
        self.assertEqual(snapshots_0016[0], snapshots_0016[1])
        self.assertEqual(set(snapshots_0016[1]), {'_crm_empresa_desde_cliente'})
        state_0016 = snapshots_0016[1]['_crm_empresa_desde_cliente']
        self.assertEqual(state_0016['owner'], 'postgres')
        self.assertIn('SECURITY DEFINER', state_0016['definition'])
        # Exactly these two entries also excludes PUBLIC and any other grantee,
        # grantor or grant option; inherited client EXECUTE is checked below.
        self.assertEqual(state_0016['acl'], '{postgres=X/postgres,service_role=X/postgres}')
        self.assertIs(state_0016['anon'], False)
        self.assertIs(state_0016['authenticated'], False)
        self.assertIs(state_0016['service_role'], True)

    def test_invoker_triggers_still_protect_client_companies_and_allow_prospects(self):
        rows = """
INSERT INTO public.crm_empresas (id, nombre, cliente_id, estado_crm) VALUES
 ('00000000-0000-4000-8000-000000000001', 'linked', '00000000-0000-4000-8000-000000000099', 'Prospecto'),
 ('00000000-0000-4000-8000-000000000002', 'state only', NULL, 'Cliente'),
 ('00000000-0000-4000-8000-000000000003', 'soft-delete prospect', NULL, 'Prospecto'),
 ('00000000-0000-4000-8000-000000000004', 'physical-delete prospect', NULL, 'Prospecto');
"""
        checks = """
DO $trigger_tests$
DECLARE company text; command text; name text;
BEGIN
  FOREACH company IN ARRAY ARRAY['linked', 'state only'] LOOP
    FOREACH command IN ARRAY ARRAY[
      format('UPDATE public.crm_empresas SET deleted_at=now() WHERE nombre=%L',company),
      format('DELETE FROM public.crm_empresas WHERE nombre=%L',company)
    ] LOOP
      BEGIN
        EXECUTE command;
        RAISE EXCEPTION 'trigger accepted forbidden deletion: %', command;
      EXCEPTION WHEN check_violation THEN
        IF SQLERRM NOT LIKE 'LC_CRM_EMPRESA_ES_CLIENTE:%' THEN RAISE; END IF;
      END;
    END LOOP;
  END LOOP;
  UPDATE public.crm_empresas SET deleted_at=now() WHERE nombre='soft-delete prospect';
  DELETE FROM public.crm_empresas WHERE nombre='physical-delete prospect';
  IF (SELECT deleted_at IS NULL FROM public.crm_empresas WHERE nombre='soft-delete prospect')
     OR EXISTS (SELECT 1 FROM public.crm_empresas WHERE nombre='physical-delete prospect')
     OR (SELECT count(*) FROM public.crm_empresas WHERE nombre IN ('linked','state only') AND deleted_at IS NULL) <> 2
  THEN RAISE EXCEPTION 'trigger outcome differs from 0017 contract'; END IF;
  FOREACH name IN ARRAY ARRAY['_crm_empresa_no_borrar_cliente','_crm_empresa_no_delete_fisico'] LOOP
    BEGIN
      EXECUTE format('SELECT public.%I()',name);
      RAISE EXCEPTION 'direct trigger EXECUTE was accepted';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
  END LOOP;
END
$trigger_tests$;
"""
        for role in ['authenticated', 'service_role']:
            with self.subTest(role=role):
                self.run_sql('BEGIN;\n' + self.harness + rows + f'\nSET ROLE {role};\n'
                              + checks + '\nRESET ROLE;\nROLLBACK;', check=True)

    def test_rejected_transactions_leave_the_initial_catalog_intact(self):
        result = self.run_sql(SNAPSHOT + 'BEGIN;\n' + self.harness + '\nROLLBACK;\n'
                              + SNAPSHOT, check=True)
        snapshots = [json.loads(line.removeprefix('SNAPSHOT:'))
                     for line in result.stdout.splitlines() if line.startswith('SNAPSHOT:')]
        self.assertEqual(len(snapshots), 2, result.stdout)
        self.assertEqual(set(snapshots[0]), set(NAMES))
        self.assertEqual(snapshots[0], snapshots[1])


if __name__ == '__main__':
    unittest.main()
