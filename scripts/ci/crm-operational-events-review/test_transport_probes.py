"""Static public transport-probe boundaries; never contacts a database."""
import hashlib
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parent / 'transport-probes'
EXPECTED = {
    '01-literal.sql': (1178, 'c0681591a3bae00cf2da43295507eabd9b023247998098d7d55aec15f0a6d069'),
    '02-read-only-transaction.sql': (2986, '810f9d048e7665f0b03cd2ebe12aeaca74c81d8d9991cc7021bd35d9d4ea1f6e'),
    '03-error-stop.sql': (693, '5c67de7cc398108493903c4a3980a4b74d156ac92c84d99d50fff2c66fbf34c2'),
}
LITERAL = (
    "CRM transport v1\n"
    "semicolon ; quote ' double \" backslash \\\n"
    "-- literal, not a comment\n"
    "/* literal ; $body$ BEGIN END; $body$ */\n"
    "acentos: \u00e1 \u00f1 \u03a9\n"
    "END\n"
)
FUNCTIONS = {
    'pg_catalog.jsonb_build_object', 'pg_catalog.current_setting',
    'pg_catalog.octet_length', 'pg_catalog.convert_to', 'pg_catalog.encode',
    'pg_catalog.sha256', 'pg_catalog.current_query', 'pg_catalog.current_database',
    'pg_catalog.pg_backend_pid', 'pg_catalog.jsonb_agg',
}


def lexical_statements(text):
    """Discard SQL literals/comments before examining executable statement tokens.

    This deliberately small lexer covers the checked corpus; it is not a SQL
    execution/validation API. A naive semicolon split would treat the public
    dollar-quoted challenge as executable statements.
    """
    statements, current = [], []
    i = 0
    while i < len(text):
        if text.startswith('--', i):
            end = text.find('\n', i + 2)
            i = len(text) if end < 0 else end + 1
            current.append(' ')
            continue
        if text.startswith('/*', i):
            depth = 1
            i += 2
            while i < len(text) and depth:
                if text.startswith('/*', i):
                    depth += 1
                    i += 2
                elif text.startswith('*/', i):
                    depth -= 1
                    i += 2
                else:
                    i += 1
            if depth:
                raise ValueError('unterminated comment')
            current.append(' ')
            continue
        if text[i] in "'\"":
            quote = text[i]
            i += 1
            while i < len(text):
                if text[i] == quote:
                    i += 1
                    if i < len(text) and text[i] == quote:
                        i += 1
                        continue
                    break
                i += 1
            else:
                raise ValueError('unterminated quote')
            current.append(' ')
            continue
        tag = re.match(r'\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$', text[i:])
        if tag:
            delimiter = tag.group()
            end = text.find(delimiter, i + len(delimiter))
            if end < 0:
                raise ValueError('unterminated dollar quote')
            i = end + len(delimiter)
            current.append(' ')
            continue
        if text[i] == ';':
            if ''.join(current).strip():
                statements.append(''.join(current).strip())
            current = []
        else:
            current.append(text[i])
        i += 1
    if ''.join(current).strip():
        raise ValueError('missing terminal semicolon')
    return statements


class TransportProbeTests(unittest.TestCase):
    def test_manifest_bytes_are_exact_utf8_without_newline_translation(self):
        manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(manifest['kind'], 'crm-public-transport-probes-v1')
        self.assertEqual(manifest['admission'], 'NOT_ADMITTED')
        self.assertEqual({p.name for p in ROOT.glob('*.sql')}, set(EXPECTED))
        observed = {}
        for entry in manifest['probes']:
            raw = (ROOT / entry['file']).read_bytes()
            self.assertNotIn(b'\r', raw)
            self.assertFalse(raw.startswith(b'\xef\xbb\xbf'))
            self.assertTrue(raw.endswith(b'\n'))
            raw.decode('utf-8', errors='strict')
            observed[entry['file']] = (len(raw), hashlib.sha256(raw).hexdigest())
            self.assertEqual(observed[entry['file']], (entry['utf8_octets'], entry['sha256']))
        self.assertEqual(observed, EXPECTED)
        self.assertEqual((ROOT / '.gitattributes').read_text().strip(), '*.sql -text')

    def test_challenge_is_literal_not_extra_statements_and_has_public_oracle(self):
        source = (ROOT / '01-literal.sql').read_text(encoding='utf-8')
        parts = source.split('$crm_transport_literal$')
        self.assertEqual(len(parts), 3)
        self.assertEqual(parts[1], LITERAL)
        literal = LITERAL.encode('utf-8')
        oracle = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))['literal']
        self.assertEqual(oracle, {
            'utf8_octets': 147,
            'sha256': '550296df79ea363e4898ec0f81acfab776a0a00ea6163840d22e63544fb1cbcb',
            'utf8_hex': literal.hex(),
        })
        self.assertEqual(hashlib.sha256(literal).hexdigest(), oracle['sha256'])
        statements = lexical_statements(source)
        self.assertEqual(len(statements), 1)
        self.assertTrue(statements[0].startswith('SELECT '))
        self.assertNotIn('BEGIN END', statements[0])

    def test_executable_statements_and_functions_are_read_only_allowlisted(self):
        expected_heads = {
            '01-literal.sql': ['SELECT'],
            '02-read-only-transaction.sql': ['BEGIN', 'SELECT', 'SELECT', 'COMMIT', 'SELECT'],
            '03-error-stop.sql': ['SELECT', 'SELECT', 'SELECT'],
        }
        for filename, heads in expected_heads.items():
            with self.subTest(filename=filename):
                statements = lexical_statements((ROOT / filename).read_text(encoding='utf-8'))
                self.assertEqual([s.split()[0] for s in statements], heads)
                code = '\n'.join(statements)
                self.assertIsNone(re.search(
                    r'\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|'
                    r'COPY|CALL|DO|EXECUTE|SET|RESET|PREPARE|SAVEPOINT|ROLLBACK|NOTIFY|LISTEN)\b',
                    code, re.IGNORECASE))
                routine_code = re.sub(r'\bAS p\s*\(\s*value\s*\)', '', code)
                names = set(re.findall(r'\b([a-z_][a-z0-9_.]*)\s*\(', routine_code.lower()))
                names -= {'from', 'values', 'operator'}  # SQL constructs, never routines.
                self.assertTrue(names <= FUNCTIONS, names - FUNCTIONS)
                self.assertNotRegex(code, r'\b(?:pg_stat_activity|pg_prepared_xacts|pg_subscription)\b')

    def test_explicit_transaction_has_no_failure_and_observes_only_own_virtualxid(self):
        source = (ROOT / '02-read-only-transaction.sql').read_text(encoding='utf-8')
        statements = lexical_statements(source)
        self.assertEqual(statements[0], 'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
        self.assertEqual(statements[3], 'COMMIT')
        self.assertEqual(source.count("'A_INSIDE'"), 1)
        self.assertEqual(source.count("'B_INSIDE'"), 1)
        self.assertEqual(source.count("'C_AFTER_COMMIT'"), 1)
        for index in (1, 2, 4):
            statement = statements[index]
            self.assertEqual(statement.count('FROM pg_catalog.pg_locks AS l'), 1)
            self.assertEqual(statement.count('l.pid OPERATOR(pg_catalog.=) pg_catalog.pg_backend_pid()'), 1)
            self.assertIn('AND l.locktype OPERATOR(pg_catalog.=)', statement)
            self.assertIn('AND l.mode OPERATOR(pg_catalog.=)', statement)
            self.assertIn('AND l.granted', statement)
            self.assertNotIn('1 / 0', statement)
        self.assertNotIn('pg_current_xact_id(', source)
        self.assertNotIn('txid_current(', source)

    def test_intentional_error_opens_no_explicit_transaction_or_recovery_call(self):
        source = (ROOT / '03-error-stop.sql').read_text(encoding='utf-8')
        statements = lexical_statements(source)
        self.assertEqual(len(statements), 3)
        self.assertEqual(statements[1], 'SELECT 1 OPERATOR(pg_catalog./) 0 AS')
        self.assertEqual(source.count('CRM_TRANSPORT_AFTER_ERROR_MUST_NOT_RUN'), 1)
        self.assertLess(source.index('CRM_TRANSPORT_BEFORE_ERROR'), source.index('SELECT 1 OPERATOR(pg_catalog./) 0'))
        self.assertLess(source.index('SELECT 1 OPERATOR(pg_catalog./) 0'), source.index('CRM_TRANSPORT_AFTER_ERROR_MUST_NOT_RUN'))
        self.assertNotRegex('\n'.join(statements), r'\b(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|SET)\b')

    def test_lexer_does_not_mistake_comments_or_quoted_semicolons_for_statements(self):
        self.assertEqual(lexical_statements("/* a /* b */ c */ SELECT 'a;''b'; --tail\n"), ['SELECT'])
        self.assertEqual(lexical_statements('SELECT $tag$; /* ; */ \' \"$tag$;'), ['SELECT'])
        for value in ("SELECT 'broken;", 'SELECT $tag$broken;', '/* broken', 'SELECT 1'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                lexical_statements(value)


if __name__ == '__main__':
    unittest.main()
