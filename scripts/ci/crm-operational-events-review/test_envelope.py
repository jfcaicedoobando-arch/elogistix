"""Offline public-source tests. No database, subprocess or private input is used."""
import ast
import contextlib
import copy
import hashlib
import inspect
import io
from pathlib import Path
import re
import unittest

import envelope


ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
CANDIDATE = (REPO / 'drizzle/migrations/0021_crm_helpers_owner_only.sql').read_bytes()


def summary():
    return {'kind': 'crm-operational-evidence-v1', 'admission': 'NOT_ADMITTED'}


class ReviewProposalTests(unittest.TestCase):
    def test_public_canonical_bytes_match_the_reviewed_source_and_mirror(self):
        self.assertEqual(hashlib.sha256(CANDIDATE).hexdigest(), envelope.CANONICAL_SHA256)
        mirror = REPO / 'supabase/migrations/20261015194324_crm_helpers_owner_only.sql'
        self.assertEqual(CANDIDATE, mirror.read_bytes())
        self.assertEqual(CANDIDATE.decode('utf8').encode('utf8'), CANDIDATE)

    def test_proposal_has_one_top_level_do_and_an_unconditional_first_failure(self):
        sql = envelope.render_review_proposal(CANDIDATE, summary())
        self.assertEqual(sql.count('DO $crm_operational_review$'), 1)
        self.assertEqual(sql.count('$crm_operational_review$;'), 1)
        executable = re.sub(r'--[^\n]*', '', sql)
        body = executable.split('BEGIN\n', 1)[1]
        self.assertEqual(body.split(';', 1)[0].strip(),
                         "RAISE EXCEPTION 'CRM_OPERATIONAL_NOT_ADMITTED'")
        self.assertNotRegex(executable.split('BEGIN\n', 1)[0], r'(?i)\b(?:EXECUTE|INSERT|PERFORM)\b')
        self.assertEqual(len(re.findall(r'\bEXECUTE\b', executable)), 1)
        self.assertLess(executable.index('CRM_OPERATIONAL_NOT_ADMITTED'), executable.index('EXECUTE v_sql'))
        self.assertNotRegex(executable, r'(?i)\bEXCEPTION\s+WHEN\b')
        self.assertNotIn('COMMIT;', executable)
        self.assertNotIn('BEGIN;', executable)

    def test_unreachable_payload_is_byte_exact_and_verified_before_execute(self):
        sql = envelope.render_review_proposal(CANDIDATE, summary())
        match = re.search(r"v_payload := pg_catalog.decode\('([0-9a-f]+)','hex'\);", sql)
        self.assertIsNotNone(match)
        self.assertEqual(bytes.fromhex(match[1]), CANDIDATE)
        fence = sql.index("RAISE EXCEPTION 'CRM_OPERATIONAL_NOT_ADMITTED';")
        self.assertLess(fence, match.start())
        self.assertLess(sql.index('pg_catalog.sha256(v_payload)'), sql.index('EXECUTE v_sql;'))
        self.assertLess(sql.index('pg_catalog.convert_to(v_sql'), sql.index('EXECUTE v_sql;'))
        self.assertNotIn(CANDIDATE.decode('utf8'), sql)

    def test_changed_or_noncanonical_utf8_payloads_are_rejected(self):
        variants = (CANDIDATE + b'\n', b'\xef\xbb\xbf' + CANDIDATE,
                    CANDIDATE.replace(b'\n', b'\r\n'), CANDIDATE.replace(b'REVOKE', b'--VOKE', 1))
        for candidate in variants:
            with self.subTest(length=len(candidate)):
                with self.assertRaisesRegex(ValueError, '^CRM_OPERATIONAL_CANONICAL_SHA256$'):
                    envelope.render_review_proposal(candidate, summary())

    def test_invalid_utf8_and_non_bytes_fail_without_echoing_input(self):
        with self.assertRaisesRegex(ValueError, '^CRM_OPERATIONAL_CANONICAL_UTF8$'):
            envelope.render_review_proposal(b'\xffTEST_ONLY_INVALID_UTF8', summary())
        for candidate in (CANDIDATE.decode('utf8'), bytearray(CANDIDATE), memoryview(CANDIDATE), None):
            with self.subTest(kind=type(candidate).__name__):
                with self.assertRaisesRegex(ValueError, '^CRM_OPERATIONAL_CANONICAL_BYTES_REQUIRED$'):
                    envelope.render_review_proposal(candidate, summary())

    def test_protocol_and_not_admitted_marker_are_exact(self):
        bad = (None, [], {}, {'kind': envelope.PROTOCOL}, {'admission': 'NOT_ADMITTED'},
               {'kind': 'synthetic-ci', 'admission': 'NOT_ADMITTED'},
               {'kind': envelope.PROTOCOL, 'admission': 'ADMITTED'},
               {'kind': envelope.PROTOCOL, 'admission': True},
               {'kind': envelope.PROTOCOL, 'admission': 'NOT_ADMITTED '})
        for value in bad:
            with self.subTest(shape=type(value).__name__):
                with self.assertRaisesRegex(ValueError, '^CRM_OPERATIONAL_SUMMARY_PROTOCOL$'):
                    envelope.render_review_proposal(CANDIDATE, value)

    def test_admission_toggles_and_private_capture_fields_are_not_accepted(self):
        for field in ('admit', 'force_apply', 'apply', 'operational', 'scope', 'credentials',
                      'context', 'catalog', 'drizzle', 'supabase', 'transport', 'window'):
            value = summary()
            value[field] = True
            with self.subTest(field=field):
                with self.assertRaisesRegex(ValueError, '^CRM_OPERATIONAL_SUMMARY_PROTOCOL$'):
                    envelope.render_review_proposal(CANDIDATE, value)
        self.assertEqual(list(inspect.signature(envelope.render_review_proposal).parameters),
                         ['candidate', 'evidence_summary'])
        with self.assertRaises(TypeError):
            envelope.render_review_proposal(CANDIDATE, summary(), force_apply=True)

    def test_summary_injection_is_rejected_and_never_echoed(self):
        probe = "TEST_ONLY_DO_NOT_ECHO'; END; $$ $crm_operational_review$\n"
        for field in ('kind', 'admission', 'notes'):
            value = summary()
            value[field] = probe
            with self.subTest(field=field):
                with self.assertRaises(ValueError) as caught:
                    envelope.render_review_proposal(CANDIDATE, value)
                self.assertNotIn(probe, str(caught.exception))
                self.assertEqual(str(caught.exception), 'CRM_OPERATIONAL_SUMMARY_PROTOCOL')

    def test_renderer_is_deterministic_silent_and_does_not_mutate_summary(self):
        value = summary()
        before = copy.deepcopy(value)
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            first = envelope.render_review_proposal(CANDIDATE, value)
            second = envelope.render_review_proposal(CANDIDATE, value)
        self.assertEqual(first, second)
        self.assertEqual(value, before)
        self.assertEqual(stdout.getvalue(), '')
        self.assertEqual(stderr.getvalue(), '')

    def test_missing_protocol_is_explicit_and_no_ledger_or_access_changes_exist(self):
        sql = envelope.render_review_proposal(CANDIDATE, summary())
        self.assertIn('LEDGER PROTOCOL OMITTED', sql)
        self.assertIn('commitment comparator, closed event policy and execution profile', sql)
        self.assertIn('verified transport/commit/reconciliation semantics', sql)
        self.assertIn('DDL/ACL window', sql)
        executable = re.sub(r'--[^\n]*', '', sql)
        self.assertNotRegex(executable, r'(?i)\b(?:INSERT|UPDATE|DELETE|GRANT|REVOKE|ALTER|CREATE|DROP|LOCK)\b')
        self.assertNotRegex(executable, r'(?i)\b(?:nextval|setval)\s*\(')

    def test_module_has_no_assert_gates_application_api_or_external_io(self):
        source = (ROOT / 'envelope.py').read_text(encoding='utf8')
        parsed = ast.parse(source)
        self.assertFalse(any(isinstance(node, ast.Assert) for node in ast.walk(parsed)))
        imports = [ast.unparse(node) for node in ast.walk(parsed)
                   if isinstance(node, (ast.Import, ast.ImportFrom))]
        self.assertEqual(imports, ['import hashlib'])
        self.assertNotRegex(source, r'\b(?:print|open|write_text|write_bytes|connect|main)\s*\(')
        self.assertNotIn('if __name__', source)
        self.assertIn('NOT a complete operational renderer', source)
        self.assertIn('not compare operational commitments', source)


if __name__ == '__main__':
    unittest.main()
