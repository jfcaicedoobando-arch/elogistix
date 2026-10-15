"""TEST_ONLY file assembly and semantic doubles, never target metadata.

Reduced comparator fixtures deliberately do not claim Draft validity. Native
schema rejection is separately exercised when pwsh is installed; full owned
runtime projections are rehearsed independently with the real validator.
"""
import contextlib
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import comparator
import evidence
import offline_review as offline
from test_comparator import applied, fixture, history, registration
from test_evidence import trusted_test_only_projection as semantic_double


def save(directory, bundle, *, wrapped=False):
    """TEST_ONLY write invented fixtures into one explicitly owned temp dir."""
    manifest = {'kind': evidence.BUNDLE_KIND}
    for key, envelope in bundle.items():
        if key in ('kind', 'claims'):
            continue
        if key == 'supabase_pages':
            manifest[key] = []
            for index, page in enumerate(envelope):
                name = 'TEST_ONLY_page_' + str(index) + '.json'
                manifest[key].append(name)
                value = {'rows': [{'crm_evidence': page}]} if wrapped else page
                (directory / name).write_text(json.dumps(value), encoding='utf8')
        else:
            name = 'TEST_ONLY_' + key + '.json'
            manifest[key] = name
            value = {'rows': [{'crm_evidence': envelope}]} if wrapped else envelope
            (directory / name).write_text(json.dumps(value), encoding='utf8')
    filename = directory / 'TEST_ONLY_manifest.json'
    filename.write_text(json.dumps(manifest), encoding='utf8')
    return manifest, filename


class OfflineReviewTests(unittest.TestCase):
    def test_direct_and_exact_wrapped_files_assemble_without_mutation(self):
        for wrapped in (False, True):
            with self.subTest(wrapped=wrapped), tempfile.TemporaryDirectory() as name:
                directory = Path(name)
                bundle = fixture()
                manifest, _ = save(directory, bundle, wrapped=wrapped)
                original = copy.deepcopy(manifest)
                manifest['supabase_pages'].reverse()
                assembled = offline.assemble(manifest, directory, validate_projection=semantic_double)
                self.assertEqual(assembled, bundle)
                self.assertEqual(manifest['supabase_pages'], list(reversed(original['supabase_pages'])))

    def test_only_file_map_with_exact_keys_and_literal_kind(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            manifest, _ = save(directory, fixture())
            for mutate in (lambda m: m.update(claims={}), lambda m: m.pop('activity'),
                           lambda m: m.update(kind='TEST_ONLY'), lambda m: m.update(supabase_pages=[]),
                           lambda m: m.update(catalog=fixture()['catalog'])):
                value = copy.deepcopy(manifest)
                mutate(value)
                with self.subTest(mutate=mutate.__code__.co_firstlineno):
                    with self.assertRaises(offline.OfflineError):
                        offline.assemble(value, directory, validate_projection=semantic_double)

    def test_wrapper_must_have_exactly_one_row_one_field_and_object_envelope(self):
        envelope = fixture()['discovery']
        invalid = ({'rows': []}, {'rows': [{'crm_evidence': envelope}, {'crm_evidence': envelope}]},
            {'rows': [{'crm_evidence': envelope, 'TEST_ONLY': True}]},
            {'rows': [{'crm_evidence': json.dumps(envelope)}]},
            {'rows': [{'crm_evidence': envelope}], 'TEST_ONLY': True}, [envelope],
            dict(envelope, TEST_ONLY=True))
        for value in invalid:
            with self.subTest(value_type=type(value).__name__):
                with self.assertRaises(offline.OfflineError):
                    offline._unwrap(value)

    def test_duplicate_json_keys_nonfinite_and_invalid_utf8_rejected_before_unwrap(self):
        with tempfile.TemporaryDirectory() as name:
            path = Path(name) / 'TEST_ONLY.json'
            for raw in (b'{"kind":1,"kind":2}', b'{"TEST_ONLY":NaN}', b'\xff'):
                path.write_bytes(raw)
                with self.assertRaisesRegex(offline.OfflineError, '^CRM_OFFLINE_JSON_REJECTED$'):
                    offline._read(path)

    def test_remote_device_stream_and_directory_inputs_rejected_before_resolve(self):
        values = ('https://TEST_ONLY/private.json', 'file:///TEST_ONLY.json',
                  '//TEST_ONLY/share.json', '\\\\TEST_ONLY\\share.json', '\\\\?\\C:\\TEST_ONLY.json',
                  '\\\\.\\NUL', 'NUL', 'CON.json', 'C:relative.json', 'test.json:private', 'bad\x00.json')
        with patch('offline_review.Path.resolve') as resolve:
            for value in values:
                with self.subTest(value=value):
                    with self.assertRaises(offline.OfflineError):
                        offline._local_path(value, Path.cwd())
            resolve.assert_not_called()
        with tempfile.TemporaryDirectory() as name:
            with self.assertRaises(offline.OfflineError):
                offline._local_path(name, Path.cwd())

    def test_page_offset_gap_repeat_missing_row_and_wrong_section_rejected(self):
        for mutate in (lambda b: b['supabase_pages'][1]['result'].update(offset='0'),
                       lambda b: b['supabase_pages'][1]['result'].update(offset='9'),
                       lambda b: b['supabase_pages'].pop(),
                       lambda b: b['supabase_pages'][0]['result']['page_rows'].reverse(),
                       lambda b: b['activity'].update(section='catalog')):
            with tempfile.TemporaryDirectory() as name:
                bundle = fixture()
                mutate(bundle)
                manifest, _ = save(Path(name), bundle)
                with self.subTest(mutate=mutate.__code__.co_firstlineno):
                    with self.assertRaises(offline.OfflineError):
                        offline.assemble(manifest, Path(name), validate_projection=semantic_double)

    def test_actual_schema_callback_required_before_page_offset_read(self):
        with tempfile.TemporaryDirectory() as name:
            manifest, _ = save(Path(name), fixture())
            for validator in (None, lambda _: False, lambda _: 1):
                with self.assertRaises(offline.OfflineError):
                    offline.assemble(manifest, name, validate_projection=validator)
            def raises(_):
                raise RuntimeError('TEST_ONLY_PRIVATE_CALLBACK')
            with self.assertRaises(offline.OfflineError) as caught:
                offline.assemble(manifest, name, validate_projection=raises)
            self.assertNotIn('TEST_ONLY', str(caught.exception))

    def test_review_absent_and_exact_registered_never_invent_ids_or_admit(self):
        before = fixture()
        saved = copy.deepcopy(before)
        summary = offline.review(before, validate_projection=semantic_double)
        self.assertEqual(before, saved)
        self.assertEqual(summary['registration'], 'ABSENT_NO_ROW_OR_ID_INVENTED')
        self.assertEqual(summary['admission'], 'NOT_ADMITTED')
        self.assertTrue(summary['catalog_postimage_derived_in_memory'])
        self.assertNotIn('990', json.dumps(summary))
        self.assertNotIn('rows', summary)
        _, registered, _ = applied()
        summary = offline.review(registered, validate_projection=semantic_double)
        self.assertEqual(summary['registration'], 'EXACT_REGISTERED_READ_ONLY_REVIEW')
        self.assertEqual(summary['default_expression_semantics'], 'UNKNOWN_REQUIRES_INDEPENDENT_REVIEW')

    def test_registration_conflict_future_timestamp_or_registered_acl_blocks(self):
        for mode in ('conflict', 'future', 'registered_acl'):
            before = fixture()
            _, row = registration()
            if mode == 'conflict':
                row['created_at'] = str(comparator.JOURNAL_WHEN - 1)
                raw = dict(id=int(row['id']), hash=row['hash'], created_at=int(row['created_at']))
                row['row_sha256'] = evidence._sha(evidence._json_scalars(raw))
            elif mode == 'future':
                row['created_at'] = str(comparator.JOURNAL_WHEN + 1)
                row['hash'] = evidence._sha('TEST_ONLY_OTHER_HASH')
                row['hash_value_sha256'] = evidence._sha(row['hash'])
                raw = dict(id=int(row['id']), hash=row['hash'], created_at=int(row['created_at']))
                row['row_sha256'] = evidence._sha(evidence._json_scalars(raw))
            history(before['drizzle_history']['result'], before['drizzle_history']['result']['rows'] + [row])
            before['sequence_state']['result']['sequence_state'].update(last_value='8', is_called=True)
            with self.subTest(mode=mode):
                with self.assertRaises(offline.OfflineError):
                    offline.review(before, validate_projection=semantic_double)

    def test_schema_pin_and_local_refs_before_validator_and_private_input(self):
        with patch('offline_review.gate.verify_inputs', side_effect=RuntimeError('TEST_ONLY_PATH')):
            with self.assertRaisesRegex(offline.OfflineError, '^CRM_OFFLINE_PUBLIC_INPUT_PIN_MISMATCH$'):
                offline.make_validator()
        with patch.object(evidence.PROJECTION_SCHEMA.__class__, 'read_bytes', return_value=b'{}'):
            with self.assertRaisesRegex(offline.OfflineError, '^CRM_OFFLINE_SCHEMA_PIN_MISMATCH$'):
                offline._schema()
        for key in ('$ref', '$dynamicRef', '$recursiveRef'):
            with self.assertRaisesRegex(offline.OfflineError, '^CRM_OFFLINE_NONLOCAL_SCHEMA_REFERENCE$'):
                offline._local_refs({'allOf': [{key: 'https://TEST_ONLY/schema'}]})
        offline._local_refs({'allOf': [{'$ref': '#/$defs/TEST_ONLY'}]})

    def test_missing_optional_engines_block_without_install_or_fallback_claim(self):
        with patch('offline_review.shutil.which', return_value=None):
            with patch('offline_review.importlib.import_module', side_effect=ImportError('TEST_ONLY')):
                for engine in ('auto', 'python', 'pwsh'):
                    with self.subTest(engine=engine):
                        with self.assertRaisesRegex(offline.OfflineError, '^CRM_OFFLINE_VALIDATOR_UNAVAILABLE$'):
                            offline.make_validator(engine)

    def test_returning_accepts_only_actual_three_scalar_row_or_exact_rows_wrapper(self):
        with tempfile.TemporaryDirectory() as name:
            path = Path(name) / 'TEST_ONLY_returning.json'
            row = registration()[0]
            for value in (row, {'rows': [row]}):
                path.write_text(json.dumps(value), encoding='utf8')
                self.assertEqual(offline._returning(str(path)), row)
            for value in ({'rows': []}, {'rows': [row, row]}, {'rows': [row], 'TEST_ONLY': True},
                          {'rows': [{'crm_evidence': row}]}, dict(row, TEST_ONLY=True)):
                path.write_text(json.dumps(value), encoding='utf8')
                with self.assertRaises(offline.OfflineError):
                    offline._returning(str(path))

    def run_cli(self, argv, *, validator=semantic_double):
        stdout, stderr = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
            with patch('offline_review.make_validator', return_value=validator):
                code = offline.main(argv)
        self.assertEqual(stderr.getvalue(), '')
        self.assertEqual(len(stdout.getvalue().splitlines()), 1)
        self.assertNotIn('TEST_ONLY', stdout.getvalue())
        return code, json.loads(stdout.getvalue())

    def test_cli_review_and_compare_success_print_only_static_statuses(self):
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            _, manifest = save(directory, fixture())
            code, summary = self.run_cli(['review', '--manifest', str(manifest)])
            self.assertEqual(code, 0)
            self.assertEqual(summary['admission'], 'NOT_ADMITTED')
            before, after, returned = applied()
            (directory / 'before').mkdir()
            (directory / 'after').mkdir()
            _, first = save(directory / 'before', before)
            _, second = save(directory / 'after', after)
            rowpath = directory / 'TEST_ONLY_returning.json'
            rowpath.write_text(json.dumps(returned), encoding='utf8')
            code, summary = self.run_cli(['compare', '--before-manifest', str(first),
                '--after-manifest', str(second), '--outcome', 'applied', '--returning', str(rowpath)])
            self.assertEqual(code, 0)
            self.assertEqual(summary['comparison'], 'MATCHED_DECLARED_DELTA_REVIEW_ONLY')
            self.assertNotIn('drizzle_rows', summary)

    def test_cli_argument_path_and_runtime_failures_never_echo_values_or_traceback(self):
        for argv in ([], ['TEST_ONLY'], ['review', '--manifest', 'TEST_ONLY_MISSING.json'],
                     ['review', '--manifest', 'TEST_ONLY', '--password', 'TEST_ONLY_SECRET'],
                     ['compare', '--before-manifest', 'TEST_ONLY', '--after-manifest', 'TEST_ONLY',
                      '--outcome', 'registered_read_only', '--returning', 'TEST_ONLY']):
            with self.subTest(argv_count=len(argv)):
                code, summary = self.run_cli(argv)
                self.assertEqual(code, 2)
                self.assertEqual(summary['status'], 'BLOCKED')
                self.assertEqual(summary['admission'], 'NOT_ADMITTED')
        with patch('offline_review.make_validator', side_effect=RuntimeError('TEST_ONLY_SECRET')):
            stdout, stderr = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                self.assertEqual(offline.main(['review', '--manifest', 'TEST_ONLY']), 2)
            self.assertNotIn('TEST_ONLY', stdout.getvalue())
            self.assertEqual(stderr.getvalue(), '')

    def test_only_allowlisted_offline_codes_and_static_public_detail_codes_are_exposed(self):
        for error in (offline.OfflineError('CRM_OFFLINE_TEST_ONLY_PRIVATE'),
                      RuntimeError('TEST_ONLY_PRIVATE')):
            stdout, stderr = io.StringIO(), io.StringIO()
            with patch('offline_review.make_validator', side_effect=error):
                with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
                    self.assertEqual(offline.main(['review', '--manifest', 'TEST_ONLY']), 2)
            self.assertNotIn('TEST_ONLY', stdout.getvalue())
            self.assertEqual(stderr.getvalue(), '')
        self.assertEqual(offline._safe_detail(evidence.EvidenceError('CRM_EVIDENCE_DRIZZLE_ROW_COMMITMENT')),
                         'CRM_EVIDENCE_DRIZZLE_ROW_COMMITMENT')
        self.assertEqual(offline._safe_detail(comparator.ComparisonError('CRM_COMPARATOR_CATALOG_POSTIMAGE_DRIFT')),
                         'CRM_COMPARATOR_CATALOG_POSTIMAGE_DRIFT')
        self.assertIsNone(offline._safe_detail(evidence.EvidenceError('CRM_EVIDENCE_TEST_ONLY_PRIVATE')))
        with tempfile.TemporaryDirectory() as name:
            bundle = fixture()
            bundle['drizzle_history']['result']['rows'][0]['row_sha256'] = '0' * 64
            _, manifest = save(Path(name), bundle)
            code, summary = self.run_cli(['review', '--manifest', str(manifest)])
            self.assertEqual(code, 2)
            self.assertEqual(summary['detail_code'], 'CRM_EVIDENCE_DRIZZLE_ROW_COMMITMENT')

    @unittest.skipUnless(offline.shutil.which('pwsh'), 'Native schema engine not installed')
    def test_real_native_draft_validator_rejects_invalid_projection(self):
        validator = offline.make_validator('pwsh')
        with self.assertRaises(Exception):
            validator({'kind': 'TEST_ONLY_INVALID_PROJECTION'})


if __name__ == '__main__':
    unittest.main()
