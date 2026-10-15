"""TEST_ONLY semantic doubles, never instance contracts or Draft validation.

All 990xx identities are invented. The explicitly trusted callback below stands
in for the caller's separate offline schema validator; these unit tests do not
claim that the reduced metadata doubles satisfy the full capture JSON Schema.
No fixture is copied from private metadata or a downloaded instance capture.
"""
import ast
import copy
import hashlib
import json
from pathlib import Path
import unittest

import evidence


def sha(value):
    return hashlib.sha256(value.encode('utf8')).hexdigest()


def trusted_test_only_projection(_envelope):
    """TEST_ONLY trusted semantic-test boundary, not a runtime validator."""
    return True


def fixture():
    owner = '99001'
    namespaces = {'public': '99010', 'drizzle': '99011', 'supabase_migrations': '99012'}
    roots = {'crm': ('99020', 'public.crm_empresas'),
             'drizzle': ('99021', 'drizzle.__drizzle_migrations'),
             'supabase': ('99022', 'supabase_migrations.schema_migrations')}
    role = dict(oid=owner, name='TEST_ONLY_ROLE', superuser=False, inherit=True,
                create_role=False, create_db=False, can_login=True, replication=False,
                bypass_rls=False, current_member=True, current_usage=True, current_can_set=True)
    catalog = {key: [] for key in evidence._CATALOG_DECIMALS}
    catalog['custom_or_unreviewed_behavior'] = 'NOT_ADMITTED_REQUIRES_INDEPENDENT_REVIEW'
    catalog['namespaces'] = [dict(oid=oid, nspowner=owner, nspname=name, nspacl=None)
                             for name, oid in namespaces.items()]
    catalog['roles'] = [copy.deepcopy(role)]
    discovery = dict(context=dict(server_version_num='170006', read_all_stats_effective=False),
                     roles=[copy.deepcopy(role)], relations=[], helpers=[], sequence=None)
    columns = {'crm': [('deleted_at', '1184')],
               'drizzle': [('id', '23'), ('hash', '25'), ('created_at', '20')],
               'supabase': [('version', '25')]}
    for label, (oid, qualified) in roots.items():
        schema, name = qualified.split('.')
        row = dict.fromkeys(evidence._CATALOG_DECIMALS['relations'].split(), '0')
        row.update(oid=oid, relnamespace=namespaces[schema], relowner=owner, relname=name,
                   relkind='r', relam='2', relispartition=False, relrowsecurity=False,
                   relforcerowsecurity=False, relhasrules=False, relhastriggers=label == 'crm')
        catalog['relations'].append(dict(metadata=row, qualified_name=qualified))
        observed = dict(label=label, requested_name=qualified, oid=oid, owner=owner,
                        relkind='r', access_method_oid='2', is_partition=False, row_security=False,
                        force_row_security=False, has_rules=False, has_triggers=label == 'crm',
                        inheritance_links='0', columns=[])
        for number, (column_name, type_oid) in enumerate(columns[label], 1):
            attr = dict(attrelid=oid, attnum=number, attname=column_name, atttypid=type_oid,
                        attcollation='0', attisdropped=False, attnotnull=True, attidentity='',
                        attgenerated='', atthasdef=False, atthasmissing=False)
            catalog['attributes'].append(dict(metadata=attr))
            observed['columns'].append(dict(number=number, name=column_name, type_oid=type_oid,
                dropped=False, not_null=True, identity='', generated='', has_default=False, has_missing=False))
        discovery['relations'].append(observed)
    for index, name in enumerate(('_crm_empresa_no_borrar_cliente', '_crm_empresa_no_delete_fisico')):
        oid = str(99040 + index)
        meta = dict(oid=oid, pronamespace=namespaces['public'], proowner=owner, prolang='0',
                    provariadic='0', prorettype='2279', proname=name, prokind='f', pronargs=0,
                    proargtypes=[], proallargtypes=None, protrftypes=None)
        catalog['functions'].append(dict(metadata=meta, is_named_helper=True,
                                         acl_entries=[], effective_execute=[]))
        discovery['helpers'].append(dict(oid=oid, name=name, namespace=namespaces['public'],
                                         owner=owner, kind='f', argument_count=0,
                                         argument_type_oids=[], return_type_oid='2279'))
    sequence_oid, sequence_name = '99030', 'drizzle.TEST_ONLY_SEQUENCE'
    meta = dict.fromkeys(evidence._CATALOG_DECIMALS['relations'].split(), '0')
    meta.update(oid=sequence_oid, relnamespace=namespaces['drizzle'], relowner=owner,
                relname='TEST_ONLY_SEQUENCE', relkind='S')
    catalog['relations'].append(dict(metadata=meta, qualified_name=sequence_name))
    catalog['sequences'] = [dict(seqrelid=sequence_oid, seqtypid='23', seqstart='1',
                                seqincrement='1', seqmin='1', seqmax='2147483647', seqcache='1')]
    discovery['sequence'] = dict(oid=sequence_oid, name=sequence_name, owner=owner)
    sequence = dict(sequence_name=sequence_name, expected_sequence_oid=sequence_oid,
                    identity_matches=True, sequence_state=dict(last_value='8', is_called=False))
    drizzle_rows, drizzle_raw = [], []
    for identifier, when in ((1, 1000), (3, 2000)):
        digest = sha('TEST_ONLY_HISTORY_' + str(identifier))
        raw = '{"id": ' + str(identifier) + ', "hash": "' + digest + '", "created_at": ' + str(when) + '}'
        drizzle_raw.append(raw)
        drizzle_rows.append(dict(id=str(identifier), hash=digest, created_at=str(when),
                                 hash_is_canonical_format=True, hash_value_sha256=sha(digest), row_sha256=sha(raw)))
    drizzle = dict(shape_supported=True, row_count='2', rows=drizzle_rows,
                   history_sha256=sha('[' + ', '.join(drizzle_raw) + ']'), null_id_count='0',
                   null_hash_count='0', null_created_at_count='0', duplicate_ids='0',
                   duplicate_hashes='0', duplicate_timestamps='0')
    versions = ('10', '2', '3')  # Deliberately C text order, not integer order.
    hashes = [sha('TEST_ONLY_SUPABASE_ROW_' + version) for version in versions]
    manifest_text = '[' + ', '.join('["' + version + '", "' + digest + '"]'
                                   for version, digest in zip(versions, hashes)) + ']'
    manifest = dict(shape_supported=True, status='CAPTURE_ONLY', row_count='3',
                    null_versions='0', duplicate_versions='0', history_sha256=sha(manifest_text))
    pages = []
    for offset in (0, 2):
        page = copy.deepcopy(manifest)
        page.update(offset=str(offset), page_size='2', has_more=offset == 0,
                    next_offset='2' if offset == 0 else None,
                    page_rows=[dict(row_number=str(index + 1), version=versions[index],
                                    version_is_numeric=True, version_sha256=sha(versions[index]),
                                    row_sha256=hashes[index]) for index in range(offset, min(offset + 2, 3))])
        pages.append(page)
    formats = dict(TimeZone='UTC', DateStyle='ISO, MDY', IntervalStyle='postgres',
                   bytea_output='hex', extra_float_digits='1')
    def envelope(section, result, number, formatted=False):
        capture = dict(database='TEST_ONLY_DATABASE', database_oid='99000', user='TEST_ONLY_ROLE',
                       session_user='TEST_ONLY_ROLE', backend_pid=100 + number,
                       snapshot='TEST_ONLY_SNAPSHOT_' + str(number), xid_if_assigned=None,
                       statement_at='2000-01-01T00:00:' + str(number).zfill(2) + '+00:00',
                       captured_at='2000-01-01T00:00:' + str(number).zfill(2) + '+00:00')
        if formatted:
            capture['format_settings'] = copy.deepcopy(formats)
        return dict(kind='crm-operational-evidence-v1', section=section, admission='NOT_ADMITTED',
                    capture=capture, result=result)
    activity = dict(read_all_stats_effective=False, statistics_visibility='RESTRICTED_OR_ROLE_SCOPED',
                    details_available_for_all_observed_sessions=True, track_activities='on',
                    max_prepared_transactions='0', other_session_count='0', prepared_count='0',
                    prepared=[], locks=[], subscriptions=[], subscription_workers=[],
                    sessions=[dict(pid=109, role_oid=owner, is_capture_backend=True, backend_type='client backend',
                                   role_visibility_verified=True, state='active', backend_xid=None, backend_xmin=None)])
    return dict(kind=evidence.BUNDLE_KIND, discovery=envelope('discovery', discovery, 1),
                catalog=envelope('catalog', catalog, 2), drizzle_history=envelope('drizzle_history', drizzle, 3),
                supabase_manifest_before=envelope('supabase_manifest', copy.deepcopy(manifest), 4, True),
                supabase_pages=[envelope('supabase_page', page, 5 + index, True) for index, page in enumerate(pages)],
                supabase_manifest_after=envelope('supabase_manifest', copy.deepcopy(manifest), 7, True),
                sequence_state=envelope('sequence_state', sequence, 8), activity=envelope('activity', activity, 9))


class EvidenceTests(unittest.TestCase):
    def ingest(self, bundle, callback=trusted_test_only_projection):
        return evidence.ingest(bundle, validate_projection=callback)

    def rejects(self, bundle, code=None):
        with self.assertRaisesRegex(evidence.EvidenceError, code or '^CRM_EVIDENCE_'):
            self.ingest(bundle)

    def test_fixed_projection_and_callback_each_envelope_without_input_mutation(self):
        bundle = fixture()
        before = copy.deepcopy(bundle)
        calls = []
        def callback(envelope):
            calls.append(envelope['section'])
            return trusted_test_only_projection(envelope)
        summary = self.ingest(bundle, callback)
        self.assertEqual(bundle, before)
        self.assertEqual(len(calls), 9)
        self.assertEqual(summary['drizzle_rows'], 2)
        self.assertEqual(summary['supabase_rows'], 3)
        self.assertEqual(summary['admission'], 'NOT_ADMITTED')
        self.assertNotIn('TEST_ONLY', json.dumps(summary))
        self.assertNotIn('990', json.dumps(summary))

    def test_no_input_claim_can_replace_real_projection_callback(self):
        for callback in (None, True, False, lambda _: False, lambda _: 1, lambda _: None):
            with self.subTest(callback=type(callback).__name__):
                with self.assertRaises(evidence.EvidenceError):
                    self.ingest(fixture(), callback)

    def test_callback_exception_is_sanitized(self):
        def callback(_):
            raise RuntimeError('TEST_ONLY_PRIVATE_ERROR')
        with self.assertRaises(evidence.EvidenceError) as caught:
            self.ingest(fixture(), callback)
        self.assertNotIn('TEST_ONLY_PRIVATE', str(caught.exception))
        self.assertTrue(caught.exception.__suppress_context__)

    def test_strict_json_decoder_and_native_nonjson_reject(self):
        for raw in ('{"x":1,"x":2}', '{"x":NaN}', '{"x":Infinity}', b'\xff', '{bad', '\ufeff{}'):
            with self.subTest(raw_type=type(raw).__name__):
                with self.assertRaises(evidence.EvidenceError):
                    evidence.load_bundle(raw)
        for bad in (float('nan'), object(), '\ud800'):
            bundle = fixture()
            bundle['claims'] = bad
            self.rejects(bundle)
        cycle = fixture()
        cycle['claims'] = cycle
        self.rejects(cycle, 'CYCLIC_INPUT')
        self.assertEqual(self.ingest(json.dumps(fixture()).encode('utf8'))['admission'], 'NOT_ADMITTED')

    def test_raw_sources_and_unknown_bundle_fields_fail_before_validator(self):
        for field in ('prosrc', 'statements', 'rolpassword', 'query', 'subconninfo', 'gid'):
            bundle = fixture()
            bundle['catalog']['result']['functions'][0][field] = 'TEST_ONLY_PRIVATE_MARKER'
            self.rejects(bundle, 'RAW_FIELD_FORBIDDEN')
        bundle = fixture()
        bundle['historical_window_authorization'] = True
        self.rejects(bundle, 'BUNDLE_KEYS')

    def test_sections_and_base_identity_cannot_be_rebound(self):
        for field in ('database', 'database_oid', 'user', 'session_user'):
            bundle = fixture()
            bundle['sequence_state']['capture'][field] = '99099' if field.endswith('_oid') else 'TEST_ONLY_OTHER'
            self.rejects(bundle, 'BASE_IDENTITY_DRIFT')
        bundle = fixture()
        bundle['catalog']['section'] = 'discovery'
        self.rejects(bundle, 'SECTION_OR_ADMISSION')
        bundle = fixture()
        bundle['activity']['admission'] = 'ADMITTED'
        self.rejects(bundle, 'SECTION_OR_ADMISSION')

    def test_decimal_strings_are_exact_not_numeric_coercions(self):
        for bad in ('01', '+1', '-0', ' 1', '1\n', '1.0', 1, True, '١'):
            bundle = fixture()
            bundle['drizzle_history']['result']['rows'][0]['id'] = bad
            self.rejects(bundle, 'DECIMAL_STRING')
        for path in ('catalog', 'capture', 'sequence'):
            bundle = fixture()
            if path == 'catalog':
                bundle['catalog']['result']['roles'][0]['oid'] = '099001'
            elif path == 'capture':
                bundle['discovery']['capture']['database_oid'] = '099000'
            else:
                bundle['sequence_state']['result']['sequence_state']['last_value'] = '+8'
            self.rejects(bundle, 'DECIMAL_STRING')
        bundle = fixture()
        bundle['activity']['capture']['backend_pid'] = True
        self.rejects(bundle, 'BACKEND_PID')

    def test_catalog_identity_and_role_drift(self):
        bundle = fixture()
        bundle['discovery']['result']['relations'][0]['oid'] = '99099'
        self.rejects(bundle, 'ROOT_IDENTITY')
        bundle = fixture()
        bundle['catalog']['result']['roles'][0]['bypass_rls'] = True
        self.rejects(bundle, 'ROLE_CAPTURE_DRIFT')
        bundle = fixture()
        bundle['catalog']['result']['functions'][0]['metadata']['proowner'] = '99099'
        self.rejects(bundle, 'HELPER_CAPTURE_DRIFT')
        bundle = fixture()
        bundle['catalog']['result']['relations'].append(copy.deepcopy(bundle['catalog']['result']['relations'][0]))
        self.rejects(bundle, 'DUPLICATE_CATALOG_IDENTITY')

    def test_columns_helpers_triggers_and_sequence_crossreferences(self):
        bundle = fixture()
        bundle['discovery']['result']['relations'][0]['columns'][0]['type_oid'] = '23'
        self.rejects(bundle, 'COLUMN_CAPTURE_DRIFT')
        bundle = fixture()
        bundle['discovery']['result']['helpers'] = None
        self.rejects(bundle, 'HELPERS_MISSING')
        bundle = fixture()
        bundle['catalog']['result']['triggers'] = [dict(metadata=dict(oid='99060', tgrelid='99099',
            tgparentid='0', tgfoid='99040', tgconstrrelid='0', tgconstrindid='0', tgconstraint='0'))]
        self.rejects(bundle, 'TRIGGER_REFERENCE')
        bundle = fixture()
        bundle['catalog']['result']['event_triggers'] = [dict(oid='99070', evtowner='99001', evtfoid='99099')]
        self.rejects(bundle, 'EVENT_FUNCTION_REFERENCE')
        for field, value in (('identity_matches', False), ('expected_sequence_oid', '99099'), ('sequence_name', 'TEST_ONLY_OTHER')):
            bundle = fixture()
            bundle['sequence_state']['result'][field] = value
            self.rejects(bundle, 'SEQUENCE_IDENTITY')

    def test_drizzle_rows_and_history_hashes_are_both_verified(self):
        for key in ('hash_value_sha256', 'row_sha256'):
            bundle = fixture()
            bundle['drizzle_history']['result']['rows'][0][key] = '0' * 64
            self.rejects(bundle, 'DRIZZLE_')
        bundle = fixture()
        bundle['drizzle_history']['result']['history_sha256'] = '0' * 64
        self.rejects(bundle, 'DRIZZLE_HISTORY_COMMITMENT')
        bundle = fixture()
        bundle['drizzle_history']['result']['row_count'] = '1'
        self.rejects(bundle, 'DRIZZLE_COUNT')

    def test_drizzle_order_duplicates_redaction_and_unsupported_fail_closed(self):
        bundle = fixture()
        bundle['drizzle_history']['result']['rows'].reverse()
        self.rejects(bundle, 'DRIZZLE_ORDER')
        bundle = fixture()
        result = bundle['drizzle_history']['result']
        result['rows'].append(copy.deepcopy(result['rows'][0]))
        result['row_count'] = '3'
        self.rejects(bundle, 'DRIZZLE_DUPLICATE')
        for key in ('null_id_count', 'duplicate_hashes'):
            bundle = fixture()
            bundle['drizzle_history']['result'][key] = '1'
            self.rejects(bundle, 'DRIZZLE_ANOMALY')
        bundle = fixture()
        bundle['drizzle_history']['result']['rows'][0]['hash_is_canonical_format'] = False
        self.rejects(bundle, 'DRIZZLE_REDACTED_HASH')
        bundle = fixture()
        bundle['drizzle_history']['result'] = dict(shape_supported=False, status='BLOCKED_UNSUPPORTED_LEDGER_COLUMNS')
        self.rejects(bundle, 'DRIZZLE_UNSUPPORTED')

    def test_paging_gaps_repeats_exhaustion_and_wrong_counts(self):
        for mutate in (
            lambda b: b['supabase_pages'].pop(),
            lambda b: b['supabase_pages'].append(copy.deepcopy(b['supabase_pages'][-1])),
            lambda b: b['supabase_pages'][0]['result'].update(offset='1'),
            lambda b: b['supabase_pages'][0]['result'].update(has_more=False),
            lambda b: b['supabase_pages'][0]['result'].update(next_offset='1'),
            lambda b: b['supabase_pages'][1]['result'].update(page_size='1'),
            lambda b: b['supabase_pages'][0]['result']['page_rows'].pop(),
            lambda b: b['supabase_pages'][0]['result']['page_rows'][0].update(row_number='2'),
        ):
            bundle = fixture()
            mutate(bundle)
            self.rejects(bundle, 'SUPABASE_')
        bundle = fixture()
        bundle['supabase_pages'] = []
        self.rejects(bundle, 'SUPABASE_PAGES_REQUIRED')

    def test_manifests_formatting_and_capture_bookends(self):
        bundle = fixture()
        bundle['supabase_manifest_after']['result']['row_count'] = '4'
        self.rejects(bundle, 'SUPABASE_MANIFEST_DRIFT')
        for section in ('supabase_pages', 'supabase_manifest_after'):
            bundle = fixture()
            envelope = bundle[section][0] if section == 'supabase_pages' else bundle[section]
            envelope['capture']['format_settings']['TimeZone'] = 'TEST_ONLY_OTHER_FORMAT'
            self.rejects(bundle, 'SUPABASE_FORMAT_DRIFT')
        bundle = fixture()
        bundle['supabase_manifest_after']['capture']['statement_at'] = '1999-01-01T00:00:00Z'
        self.rejects(bundle, 'SUPABASE_CAPTURE_ORDER')
        bundle = fixture()
        bundle['discovery']['capture']['statement_at'] = '2001-01-01T00:00:00Z'
        self.rejects(bundle, 'CAPTURE_TIME')

    def test_supabase_commitments_not_hidden_preimages(self):
        for field in ('version_sha256', 'row_sha256'):
            bundle = fixture()
            bundle['supabase_pages'][0]['result']['page_rows'][0][field] = '0' * 64
            self.rejects(bundle, 'SUPABASE_')
        bundle = fixture()
        row = bundle['supabase_pages'][0]['result']['page_rows'][0]
        row.update(version=None, version_is_numeric=False)
        self.rejects(bundle, 'SUPABASE_REDACTED_VERSION')
        summary = self.ingest(fixture())
        self.assertEqual(summary['supabase_row_preimages'], 'NOT_VERIFIED_COMMITMENTS_ONLY')

    def test_empty_histories_require_an_exhausted_empty_page(self):
        bundle = fixture()
        bundle['drizzle_history']['result'].update(rows=[], row_count='0', history_sha256=sha('[]'))
        for envelope in (bundle['supabase_manifest_before'], bundle['supabase_manifest_after'], *bundle['supabase_pages']):
            envelope['result'].update(row_count='0', history_sha256=sha('[]'))
        bundle['supabase_pages'] = bundle['supabase_pages'][:1]
        bundle['supabase_pages'][0]['result'].update(page_rows=[], has_more=False, next_offset=None)
        summary = self.ingest(bundle)
        self.assertEqual((summary['drizzle_rows'], summary['supabase_rows']), (0, 0))

    def test_internal_state_null_retains_uncertainty_without_hiding_clients(self):
        bundle = fixture()
        bundle['discovery']['result']['context']['read_all_stats_effective'] = True
        activity = bundle['activity']['result']
        activity.update(read_all_stats_effective=True, statistics_visibility='PRIVILEGE_PRESENT_DETAILS_MUST_BE_CHECKED',
                        details_available_for_all_observed_sessions=False, other_session_count='1')
        worker = dict(pid=200, role_oid=None, is_capture_backend=False, backend_type='background worker',
                      role_visibility_verified=True, state=None, backend_xid=None, backend_xmin=None)
        activity['sessions'].append(worker)
        summary = self.ingest(bundle)
        self.assertEqual(summary['visibility']['client_backends'], 'COMPLETE')
        self.assertEqual(summary['visibility']['nonclient_backends'], 'UNKNOWN')
        self.assertEqual(summary['visibility']['overall_observed_visibility'], 'UNKNOWN')
        self.assertEqual(summary['visibility']['nonclient_count'], 1)
        self.assertEqual(summary['admission'], 'NOT_ADMITTED')

    def test_visibility_flags_and_session_counts_cannot_be_relabelled(self):
        for key, value in (('details_available_for_all_observed_sessions', False),
                           ('statistics_visibility', 'PRIVILEGE_PRESENT_DETAILS_MUST_BE_CHECKED'),
                           ('other_session_count', '1'), ('prepared_count', '1')):
            bundle = fixture()
            bundle['activity']['result'][key] = value
            self.rejects(bundle)
        bundle = fixture()
        activity = bundle['activity']['result']
        activity['sessions'][0]['state'] = None
        activity['details_available_for_all_observed_sessions'] = False
        self.assertEqual(self.ingest(bundle)['visibility']['client_backends'], 'UNKNOWN')
        bundle = fixture()
        bundle['activity']['result']['sessions'][0]['backend_type'] = None
        self.assertEqual(self.ingest(bundle)['visibility']['overall_observed_visibility'], 'UNKNOWN')

    def test_unknown_backend_can_be_an_unobserved_client(self):
        bundle = fixture()
        activity = bundle['activity']['result']
        activity.update(other_session_count='1', details_available_for_all_observed_sessions=False)
        activity['sessions'].append(dict(pid=200, role_oid=None, is_capture_backend=False,
            backend_type=None, role_visibility_verified=False, state=None,
            backend_xid=None, backend_xmin=None))
        visibility = self.ingest(bundle)['visibility']
        self.assertEqual(visibility['client_count'], 1)
        self.assertEqual(visibility['unclassified_count'], 1)
        self.assertEqual(visibility['client_backends'], 'UNKNOWN')
        self.assertEqual(visibility['overall_observed_visibility'], 'UNKNOWN')

    def test_operational_booleans_never_admit_and_no_private_data_is_returned(self):
        bundle = fixture()
        bundle['claims'] = dict(transport_verified=True, ddl_acl_window_open=True)
        summary = self.ingest(bundle)
        self.assertEqual(summary['admission'], 'NOT_ADMITTED')
        self.assertTrue(summary['external_queues_and_ddl_acl_window'].startswith('UNKNOWN'))
        self.assertTrue(summary['transport_commit_registration_retry'].startswith('UNKNOWN'))
        for value in ('TEST_ONLY_DATABASE', 'TEST_ONLY_ROLE', '99000', 'TEST_ONLY_SEQUENCE'):
            self.assertNotIn(value, json.dumps(summary))
        bundle['claims']['transport_verified'] = 1
        self.rejects(bundle, 'CLAIMS_FORMAT')

    def test_inert_implementation_no_process_database_network_or_output(self):
        source = Path(evidence.__file__).read_text(encoding='utf8')
        tree = ast.parse(source)
        imports = '\n'.join(ast.unparse(n) for n in ast.walk(tree) if isinstance(n, (ast.Import, ast.ImportFrom)))
        self.assertNotRegex(imports, r'\b(subprocess|socket|requests|psycopg|asyncpg|urllib)\b')
        self.assertNotRegex(source, r'\b(print|write_text|write_bytes|exec|eval)\s*\(')


if __name__ == '__main__':
    unittest.main()
