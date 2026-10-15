"""Offline safety checks for generic metadata queries; no database connection."""
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parent
PACKAGE = ROOT / 'operational-capture'


def sql_code(sql):
    # Queries use standard quoted strings with doubled quote escapes, no dollar
    # strings or backslash-escaped literals. Generated SELECT text is data here.
    if '$$' in sql or re.search(r'\$[A-Za-z_][A-Za-z0-9_]*\$', sql):
        raise ValueError('Unexpected dollar-quoted SQL')
    return re.sub(r"'(?:''|[^'])*'|--[^\n]*", ' ', sql)


def require_readonly_query(sql):
    code = sql_code(sql)
    if not re.match(r'^\s*(WITH|SELECT)\b', code, re.I) or code.count(';') != 1:
        raise ValueError('One SELECT statement required')
    if re.search(r'\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE|COPY|CALL|DO|BEGIN|COMMIT|ROLLBACK|SET|RESET|INTO)\b', code, re.I):
        raise ValueError('Non-SELECT operation rejected')
    if re.search(r'\b(nextval|setval|pg_advisory\w*|pg_terminate_backend|pg_cancel_backend|pg_current_xact_id|txid_current|set_config|dblink\w*)\s*\(', code, re.I):
        raise ValueError('Mutating or external function rejected')
    return code


class OperationalCapture(unittest.TestCase):
    def test_each_file_is_one_select_without_mutating_calls(self):
        files = sorted(PACKAGE.glob('*.sql'))
        self.assertEqual(len(files), 6)
        for file in files:
            with self.subTest(file=file.name):
                require_readonly_query(file.read_text(encoding='utf8'))

    def test_a_synthetic_mutation_cannot_hide_in_cte_or_function(self):
        for sql in ["WITH x AS (DELETE FROM public.x RETURNING *) SELECT * FROM x;",
                    "SELECT pg_catalog.nextval('x');", "SELECT pg_catalog.set_config('x','x',false);",
                    "SELECT 1; SELECT 2;", "SELECT * INTO public.x FROM pg_catalog.pg_class;"]:
            with self.subTest(sql=sql):
                with self.assertRaises(ValueError):
                    require_readonly_query(sql)

    def test_application_rows_are_not_query_sources(self):
        for file in PACKAGE.glob('*.sql'):
            code = require_readonly_query(file.read_text(encoding='utf8'))
            qualified = re.findall(r'\b(?:FROM|JOIN)\s+([a-z_][\w]*\.[a-z_][\w]*)', code, re.I)
            for name in qualified:
                self.assertTrue(name.startswith('pg_catalog.') or name in (
                    'drizzle.__drizzle_migrations', 'supabase_migrations.schema_migrations'), name)
            self.assertNotRegex(code, r'\b(?:public|auth)\.[a-z_][a-z0-9_]*\s*\(')

    def test_source_and_private_activity_are_not_returned(self):
        activity = (PACKAGE / '06_activity.sql').read_text(encoding='utf8')
        self.assertNotRegex(sql_code(activity), r'\b(?:a\.query|a\.application_name|a\.client_addr|a\.client_hostname|s\.subconninfo)\b')
        self.assertIn("pg_catalog.convert_to(p.gid,'UTF8')", activity)
        self.assertNotIn("'gid',", activity)
        catalog = (PACKAGE / '02_scoped_catalog.sql').read_text(encoding='utf8')
        self.assertIn("-'adbin'", catalog)
        self.assertIn("ARRAY['prosrc','probin','prosqlbody','proargdefaults','proconfig']", catalog)
        self.assertIn("'relpartbound'", catalog)
        self.assertNotIn('pg_catalog.pg_get_functiondef', catalog)

    def test_history_integrity_and_paging_are_explicit(self):
        manifest = (PACKAGE / '04_supabase_manifest.sql').read_text(encoding='utf8')
        page = (PACKAGE / '05_supabase_page.sql').read_text(encoding='utf8')
        for sql in (manifest, page):
            self.assertIn('pg_catalog.to_jsonb(s)::text', sql)
            self.assertIn('FROM pg_catalog.pg_attribute', sql)
            self.assertIn("'history_sha256'", sql)
            self.assertIn("'duplicate_versions'", sql)
        self.assertIn('0::bigint AS offset_value,100::bigint AS page_size', page)
        self.assertIn("'next_offset'", page)
        self.assertNotIn("'statements',", page)

    def test_schema_and_protocol_do_not_masquerade_as_lab_contract(self):
        schema = json.loads((PACKAGE / 'evidence.schema.json').read_text(encoding='utf8'))
        self.assertEqual(schema['properties']['admission']['const'], 'NOT_ADMITTED')
        self.assertEqual(len(schema['properties']['section']['enum']), 7)
        readme = (PACKAGE / 'README.md').read_text(encoding='utf8')
        for term in ['no operational mode', 'not input accepted', 'UNKNOWN', 'No SET', 'not a cluster']:
            self.assertIn(term, readme)
        for file in PACKAGE.glob('*'):
            if file.is_file():
                value = file.read_text(encoding='utf8')
                self.assertNotRegex(value, r'(?i)C:[\\/]Users[\\/]|/Users/|file_[a-f0-9]{20,}|oai-library://|Library.?ID')


if __name__ == '__main__':
    unittest.main()
