"""Syntax, redaction and preservation witnesses in the owned synthetic PG17 DB."""
import hashlib
import json
from pathlib import Path

from cases import database
from direct_wrapper import sequence_state_sql
from test_operational_capture import require_readonly_query
from wrapper_cases import _setup

ROOT = Path(__file__).resolve().parent
PACKAGE = ROOT / 'operational-capture'
MARKER = 'TEST_ONLY_CAPTURE_REDACTION_SENTINEL'


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def run_capture_cases(r):
    with database(r, 'operational_capture_syntax') as db:
        _setup(r, db, 'capture-selects')
        # This is a deliberately synthetic fixture, never an operational query.
        # A metadata reader must neither execute this trigger nor export its
        # body/config/comment/policy text or the Supabase stored statement.
        r.query("CREATE FUNCTION public.test_only_capture_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '" + MARKER + "'; END $$;"
                "ALTER FUNCTION public.test_only_capture_trigger() SET search_path='" + MARKER + "';"
                "COMMENT ON FUNCTION public.test_only_capture_trigger() IS '" + MARKER + "';"
                "CREATE TRIGGER test_only_capture BEFORE INSERT ON drizzle.__drizzle_migrations FOR EACH ROW EXECUTE FUNCTION public.test_only_capture_trigger();"
                "CREATE POLICY test_only_capture ON drizzle.__drizzle_migrations USING (hash<>'" + MARKER + "');"
                "UPDATE supabase_migrations.schema_migrations SET statements=ARRAY['" + MARKER + "'];",
                'capture-synthetic-redaction-fixture', db)
        before = r.snapshot(db, 'capture-before')
        sequence_name = r.query("SELECT pg_catalog.pg_get_serial_sequence('drizzle.__drizzle_migrations','id');", 'capture-sequence-name', db).stdout.strip()
        sequence_before = r.query(sequence_state_sql(sequence_name), 'capture-sequence-before', db).stdout
        ledger_before = r.query("SELECT pg_catalog.jsonb_build_object('drizzle',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) ORDER BY id) FROM drizzle.__drizzle_migrations d),'supabase',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) ORDER BY version) FROM supabase_migrations.schema_migrations s));", 'capture-rows-before', db).stdout
        results = {}
        schema = json.loads((PACKAGE / 'evidence.schema.json').read_text())
        for file in sorted(PACKAGE.glob('*.sql')):
            sql = file.read_text(encoding='utf8')
            require_readonly_query(sql)
            # PG17 itself parses/types/checks the exact SELECT. Read-only txn is
            # a harness control only; no transaction command is in the package.
            response = r.query('BEGIN READ ONLY;' + sql + 'COMMIT;', 'capture-' + file.stem, db)
            result = json.loads(response.stdout)
            require(result['kind'] == 'crm-operational-evidence-v1' and result['admission'] == 'NOT_ADMITTED', 'Invalid capture envelope')
            require(set(schema['required']).issubset(result), 'Capture/schema top-level mismatch')
            require(set(schema['$defs']['capture']['required']).issubset(result['capture']), 'Capture identity fields missing')
            require(MARKER not in response.stdout, 'Metadata query exported a synthetic secret marker')
            results[result['section']] = result
            (r.output / ('capture-' + file.stem + '.json')).write_text(json.dumps(result, indent=2) + '\n')
        discovery = results['discovery']['result']
        require(discovery['sequence']['select'] is True, 'Synthetic sequence SELECT capability missing')
        generated = discovery['sequence']['state_select']
        require_readonly_query(generated)
        sequence = json.loads(r.query('BEGIN READ ONLY;' + generated + 'COMMIT;', 'capture-generated-sequence-read', db).stdout)
        require(sequence['result']['identity_matches'] is True, 'Generated sequence read lost its measured identity')
        require(sequence['result']['sequence_state']['last_value'] == str(json.loads(sequence_before)['last_value']), 'Sequence state read differs')
        require(results['drizzle_history']['result']['shape_supported'] is True, 'Builtin Drizzle shape rejected')
        require(results['supabase_manifest']['result']['history_sha256'] == results['supabase_page']['result']['history_sha256'], 'Full manifest/page commitments differ')
        require(results['supabase_page']['result']['row_count'] == '1'
                and results['supabase_page']['result']['page_rows'][0]['version'] is None
                and results['supabase_page']['result']['page_rows'][0]['version_sha256'] == hashlib.sha256(b'TEST_ONLY_PRIOR').hexdigest(), 'Version redaction witness failed')
        catalog = results['catalog']['result']
        probe = next(p for p in catalog['functions'] if p['metadata']['proname'] == 'test_only_capture_trigger')
        require('prosrc' not in probe['metadata'] and 'proconfig' not in probe['metadata'], 'Raw function text leaked')
        require(probe['source_sha256'] and probe['config_sha256'] and catalog['comments'], 'Missing code/config/comment commitments')
        require(results['activity']['result']['external_queues_pre_readers_owner_ddl_acl_window'] == 'UNKNOWN_REQUIRES_EXTERNAL_COORDINATION', 'Activity overclaimed readiness')
        require(r.snapshot(db, 'capture-after') == before, 'SELECT package changed catalog')
        require(r.query(sequence_state_sql(sequence_name), 'capture-sequence-after', db).stdout == sequence_before, 'SELECT package advanced sequence')
        require(r.query("SELECT pg_catalog.jsonb_build_object('drizzle',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) ORDER BY id) FROM drizzle.__drizzle_migrations d),'supabase',(SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(s) ORDER BY version) FROM supabase_migrations.schema_migrations s));", 'capture-rows-after', db).stdout == ledger_before, 'SELECT package changed a ledger')
        r.check('capture-selects-syntax-redaction-preservation', select_files=6, generated_sequence_select=True,
                read_only_transactions=True, synthetic_marker_redacted=True, both_ledgers_and_sequence_unchanged=True,
                real_database_actions=0, operational_admission='NOT_ADMITTED')
