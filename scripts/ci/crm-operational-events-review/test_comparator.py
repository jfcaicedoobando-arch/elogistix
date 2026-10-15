"""TEST_ONLY independently invented semantic doubles; no private captures.

These deliberately reduced doubles use the existing evidence test boundary.
They do NOT claim full Draft validity. Separate owned-runtime tests capture
complete projections and supply real offline Draft validation to compare().
"""
import ast
import copy
import json
from pathlib import Path
import unittest

import comparator
import evidence
from test_evidence import fixture as evidence_fixture, trusted_test_only_projection


def history(result, rows):
    result['rows'] = copy.deepcopy(rows)
    result['row_count'] = str(len(rows))
    scalars = [dict(id=int(row['id']), hash=row['hash'], created_at=int(row['created_at'])) for row in rows]
    result['history_sha256'] = evidence._sha(evidence._json_scalars(scalars))


def registration(identifier=8):
    returned = dict(id=identifier, hash=comparator.PAYLOAD_SHA256, created_at=comparator.JOURNAL_WHEN)
    row = dict(id=str(identifier), hash=returned['hash'], created_at=str(returned['created_at']),
               hash_is_canonical_format=True, hash_value_sha256=evidence._sha(returned['hash']),
               row_sha256=evidence._sha(evidence._json_scalars(returned)))
    return returned, row


def fixture():
    bundle = evidence_fixture()
    catalog, discovery = bundle['catalog']['result'], bundle['discovery']['result']
    owner = catalog['roles'][0]
    owner['name'] = 'postgres'
    roles = [copy.deepcopy(owner)]
    for number, name in enumerate(('anon', 'authenticated', 'service_role'), 2):
        role = copy.deepcopy(owner)
        role.update(oid=str(99000 + number), name=name, can_login=False,
                    current_member=False, current_usage=False, current_can_set=False)
        roles.append(role)
    catalog['roles'] = roles
    discovery['roles'] = copy.deepcopy(roles)
    discovery['context']['isolation'] = 'read committed'
    for value in bundle.values():
        if type(value) is dict and 'capture' in value:
            value['capture']['user'] = 'postgres'
    for value in bundle['supabase_pages']:
        value['capture']['user'] = 'postgres'
    catalog['languages'] = [dict(oid='99570', lanname='plpgsql', lanowner=owner['oid'],
        lanispl=True, lanpltrusted=True, lanplcallfoid='0', laninline='0', lanvalidator='0', lanacl=None)]
    null_hash = evidence._sha('<NULL>')
    for index, node in enumerate(catalog['functions']):
        meta = node['metadata']
        meta.update(prolang='99570', proowner=owner['oid'], proargmodes=None, proargnames=None,
            pronargdefaults=0, prosupport='-', prosecdef=False, proleakproof=False,
            proisstrict=False, proretset=False, provolatile='v', proparallel='u',
            procost=100, prorows=0, proacl=['postgres=X/postgres', 'service_role=X/postgres'])
        node.update(binary_is_null=True, binary_sha256=null_hash, sql_body_is_null=True,
            sql_body_sha256=null_hash, argument_defaults_is_null=True, argument_defaults_sha256=null_hash,
            config_is_null=False, config_is_expected_helper_value=True,
            config_sha256=evidence._sha('{search_path=public}'),
            source_sha256=comparator.HELPER_SOURCE_SHA256[meta['proname']],
            acl_entries=[dict(grantor=owner['oid'], grantee=role['oid'], privilege_type='EXECUTE', is_grantable=False)
                         for role in (roles[0], roles[3])],
            effective_execute=[dict(role_oid=role['oid'], role_name=role['name'], execute=role['name'] in ('postgres', 'service_role'))
                               for role in roles])
        trigger_meta = dict(oid=str(99580 + index), tgrelid='99020', tgparentid='0', tgfoid=meta['oid'],
            tgconstrrelid='0', tgconstrindid='0', tgconstraint='0', tgname='trg' + meta['proname'],
            tgenabled='O', tgtype=19 if index == 0 else 11, tgnargs=0, tgisinternal=False,
            tgdeferrable=False, tginitdeferred=False, tgattr=[1] if index == 0 else [],
            tgoldtable=None, tgnewtable=None)
        catalog['triggers'].append(dict(metadata=trigger_meta, args_octets=0,
            args_sha256=evidence._sha(''), when_is_null=True, when_sha256=null_hash))
        for role, kind in ((roles[0], 'o'), (roles[3], 'a')):
            catalog['shared_dependencies'].append(dict(dbid='99000', classid='1255', objid=meta['oid'],
                objsubid=0, refclassid='1260', refobjid=role['oid'], deptype=kind))
    ledger = discovery['relations'][1]
    ledger['columns'][0]['has_default'] = True
    next(node for node in catalog['attributes'] if node['metadata']['attrelid'] == ledger['oid']
         and node['metadata']['attnum'] == 1)['metadata']['atthasdef'] = True
    default_reference = dict(classid='2604', objid='99551', objsubid=0,
        refclassid='1259', refobjid='99030', refobjsubid=0, deptype='n')
    default_column = dict(classid='2604', objid='99551', objsubid=0,
        refclassid='1259', refobjid=ledger['oid'], refobjsubid=1, deptype='a')
    catalog['defaults'] = [dict(metadata=dict(oid='99551', adrelid=ledger['oid'], adnum=1),
                               references=[default_reference, default_column],
                               tree_sha256=evidence._sha('TEST_ONLY_UNAPPROVED_DEFAULT_TREE'))]
    catalog['dependencies'] = [dict(classid='1259', objid='99030', objsubid=0,
        refclassid='1259', refobjid=ledger['oid'], refobjsubid=1, deptype='a')]
    catalog['sequences'][0]['seqcycle'] = False
    return bundle


def applied():
    before = fixture()
    after = copy.deepcopy(before)
    catalog = after['catalog']['result']
    for node in catalog['functions']:
        node['metadata']['proacl'] = ['postgres=X/postgres']
        node['acl_entries'] = node['acl_entries'][:1]
        node['effective_execute'][3]['execute'] = False
    catalog['shared_dependencies'] = [edge for edge in catalog['shared_dependencies'] if edge['deptype'] == 'o']
    returned, row = registration()
    history(after['drizzle_history']['result'], before['drizzle_history']['result']['rows'] + [row])
    after['sequence_state']['result']['sequence_state']['is_called'] = True
    return before, after, returned


class ComparatorTests(unittest.TestCase):
    def compare(self, before, after, outcome='applied', returned=None, callback=trusted_test_only_projection):
        return comparator.compare(before, after, outcome=outcome, returned_row=returned, validate_projection=callback)

    def rejects(self, before, after, returned=None, *, outcome='applied', code='^CRM_COMPARATOR_'):
        with self.assertRaisesRegex(comparator.ComparisonError, code):
            self.compare(before, after, outcome, returned)

    def test_applied_matches_exact_declared_delta_without_mutation_or_admission(self):
        before, after, returned = applied()
        saved = copy.deepcopy((before, after, returned))
        calls = []
        def callback(envelope):
            calls.append(envelope['section'])
            return trusted_test_only_projection(envelope)
        summary = self.compare(before, after, returned=returned, callback=callback)
        self.assertEqual((before, after, returned), saved)
        self.assertEqual(len(calls), 18)
        self.assertEqual(summary['admission'], 'NOT_ADMITTED')
        self.assertEqual(summary['comparison'], 'MATCHED_DECLARED_DELTA_REVIEW_ONLY')
        self.assertEqual(summary['sequence_effect'], 'MEASURED_DEFAULT_TRANSITION')
        self.assertEqual(summary['default_expression_semantics'], 'UNKNOWN_REQUIRES_INDEPENDENT_REVIEW')
        self.assertNotIn('TEST_ONLY', json.dumps(summary))
        self.assertNotIn('990', json.dumps(summary))

    def test_registered_is_owner_only_read_only_with_no_allocation(self):
        _, baseline, _ = applied()
        result = self.compare(baseline, copy.deepcopy(baseline), 'registered_read_only')
        self.assertEqual(result['sequence_effect'], 'NO_ALLOCATION_OBSERVED')
        self.assertEqual(result['admission'], 'NOT_ADMITTED')
        self.rejects(baseline, copy.deepcopy(baseline), registration()[0],
                     outcome='registered_read_only', code='REGISTERED_RETURNING_FORBIDDEN')

    def test_rollback_requires_transactional_equality_but_measured_sequence_gap(self):
        before = fixture()
        after = copy.deepcopy(before)
        after['sequence_state']['result']['sequence_state']['is_called'] = True
        returned, _ = registration()
        result = self.compare(before, after, 'rolled_back_after_insert', returned)
        self.assertEqual(result['transactional_state'], 'ROLLED_BACK_OBSERVED')
        self.assertEqual(result['sequence_effect'], 'NONTRANSACTIONAL_GAP_OBSERVED')
        self.rejects(before, copy.deepcopy(before), returned, outcome='rolled_back_after_insert', code='SEQUENCE_TRANSITION')
        after['catalog']['result']['functions'][0]['metadata']['proacl'] = ['postgres=X/postgres']
        self.rejects(before, after, returned, outcome='rolled_back_after_insert')

    def test_exactly_one_real_schema_callback_required_for_every_full_projection(self):
        before, after, returned = applied()
        for callback in (None, True, False, lambda _: False, lambda _: 1, lambda _: None):
            with self.subTest(callback=type(callback).__name__):
                with self.assertRaises(comparator.ComparisonError):
                    self.compare(before, after, returned=returned, callback=callback)
        def fails(_):
            raise RuntimeError('TEST_ONLY_PRIVATE_DIAGNOSTIC')
        with self.assertRaises(comparator.ComparisonError) as caught:
            self.compare(before, after, returned=returned, callback=fails)
        self.assertEqual(str(caught.exception), 'CRM_COMPARATOR_EVIDENCE_REJECTED')
        self.assertTrue(caught.exception.__suppress_context__)

    def test_json_input_duplicate_keys_nonfinite_and_raw_fields_rejected(self):
        before, after, returned = applied()
        self.assertEqual(self.compare(json.dumps(before), json.dumps(after).encode('utf8'), returned=returned)['admission'], 'NOT_ADMITTED')
        for raw in ('{"a":1,"a":2}', '{"a":NaN}', b'\xff'):
            self.rejects(raw, after, returned)
        before['catalog']['result']['functions'][0]['prosrc'] = 'TEST_ONLY_PRIVATE_SQL'
        self.rejects(before, after, returned)

    def test_arbitrary_catalog_node_field_drift_is_never_normalized(self):
        mutators = (
            lambda c: c['relations'][1]['metadata'].update(relfilenode='99599'),
            lambda c: c['attributes'][0]['metadata'].update(attname='TEST_ONLY_REBOUND'),
            lambda c: c['defaults'][0].update(tree_sha256=evidence._sha('TEST_ONLY_OTHER_DEFAULT')),
            lambda c: c['languages'][0].update(lanpltrusted=False),
            lambda c: c['triggers'][0]['metadata'].update(tgenabled='D'),
            lambda c: c['roles'][0].update(bypass_rls=True),
            lambda c: c['dependencies'].append(copy.deepcopy(c['dependencies'][0])),
            lambda c: c['shared_dependencies'].pop(),
        )
        for mutate in mutators:
            before, after, returned = applied()
            mutate(after['catalog']['result'])
            with self.subTest(mutate=mutate.__code__.co_firstlineno):
                self.rejects(before, after, returned)

    def test_array_order_and_multiplicity_are_preserved(self):
        for key in ('functions', 'triggers', 'roles', 'attributes', 'shared_dependencies'):
            before, after, returned = applied()
            after['catalog']['result'][key].reverse()
            with self.subTest(key=key):
                self.rejects(before, after, returned)
        before, after, returned = applied()
        node = dict(objoid='99592', classoid='1259', objsubid=0, sha256=evidence._sha('TEST_ONLY_COMMENT'))
        before['catalog']['result']['comments'] = [copy.deepcopy(node), copy.deepcopy(node)]
        after['catalog']['result']['comments'] = [copy.deepcopy(node)]
        self.rejects(before, after, returned, code='CATALOG_POSTIMAGE_DRIFT')

    def test_typed_equality_distinguishes_bool_int_and_float_int(self):
        self.assertFalse(comparator._same(False, 0))
        self.assertFalse(comparator._same(100.0, 100))
        self.assertFalse(comparator._same([False], [0]))
        self.assertTrue(comparator._same({'a': 1, 'b': True}, {'b': True, 'a': 1}))
        before, after, returned = applied()
        after['catalog']['result']['functions'][0]['metadata']['procost'] = 100.0
        self.rejects(before, after, returned)

    def test_source_or_configuration_drift_cannot_be_blessed_as_baseline(self):
        for key, value in (('source_sha256', evidence._sha('TEST_ONLY_OTHER_SOURCE')),
                           ('config_is_expected_helper_value', False),
                           ('config_sha256', evidence._sha('TEST_ONLY_OTHER_CONFIG')),
                           ('binary_is_null', False)):
            before, after, returned = applied()
            before['catalog']['result']['functions'][0][key] = value
            after['catalog']['result']['functions'][0][key] = value
            self.rejects(before, after, returned, code='HELPER_SOURCE_CONTRACT')

    def test_extra_overload_cannot_hide_behind_input_named_helper_flag(self):
        before, after, returned = applied()
        for value in (before, after):
            extra = copy.deepcopy(value['catalog']['result']['functions'][0])
            extra['metadata'].update(oid='99599', pronargs=1, proargtypes=['23'])
            extra['is_named_helper'] = False
            value['catalog']['result']['functions'].append(extra)
        self.rejects(before, after, returned, code='HELPER_FLAG_INCONSISTENT')

    def test_acl_raw_expanded_effective_and_grantor_are_all_enforced(self):
        for mutate in (
            lambda n: n['metadata']['proacl'].append('anon=X/postgres'),
            lambda n: n['metadata']['proacl'].__setitem__(1, 'service_role=X*/postgres'),
            lambda n: n['acl_entries'][1].update(grantor='99002'),
            lambda n: n['acl_entries'][1].update(is_grantable=True),
            lambda n: n['effective_execute'][1].update(execute=True),
            lambda n: n['effective_execute'][3].update(execute=False),
        ):
            before, after, returned = applied()
            mutate(before['catalog']['result']['functions'][0])
            self.rejects(before, after, returned)
        before, after, returned = applied()
        after['catalog']['result']['functions'][0]['effective_execute'][3]['execute'] = True
        self.rejects(before, after, returned, code='HELPER_EFFECTIVE_ACL')

    def test_only_exact_service_dependency_edges_can_disappear(self):
        for field, value in (('dbid', '99590'), ('objsubid', 1), ('deptype', 'x'), ('refobjid', '99002')):
            before, after, returned = applied()
            edge = copy.deepcopy(before['catalog']['result']['shared_dependencies'][1])
            edge[field] = value
            before['catalog']['result']['shared_dependencies'].append(edge)
            self.rejects(before, after, returned)
        before, after, returned = applied()
        unrelated = dict(dbid='99000', classid='1259', objid='99595', objsubid=0,
                         refclassid='1260', refobjid='99004', deptype='a')
        before['catalog']['result']['shared_dependencies'].append(copy.deepcopy(unrelated))
        after['catalog']['result']['shared_dependencies'].append(copy.deepcopy(unrelated))
        self.assertEqual(self.compare(before, after, returned=returned)['admission'], 'NOT_ADMITTED')
        after['catalog']['result']['shared_dependencies'].pop()
        self.rejects(before, after, returned, code='CATALOG_POSTIMAGE_DRIFT')

    def test_denied_role_membership_cannot_contradict_owner_only_privileges(self):
        for option in ('inherit_option', 'set_option', 'admin_option'):
            before, after, returned = applied()
            edge = dict(oid='99596', member='99004', roleid='99001', grantor='99001',
                        admin_option=False, inherit_option=False, set_option=False)
            edge[option] = True
            for value in (before, after):
                value['catalog']['result']['memberships'].append(copy.deepcopy(edge))
            self.rejects(before, after, returned, code='DENIED_ROLE_OWNER_OR_SUPERUSER_PATH')

    def test_mixed_set_inherit_paths_and_other_superuser_profiles_block(self):
        for target in ('owner', 'superuser'):
            before, after, returned = applied()
            for bundle in (before, after):
                catalog = bundle['catalog']['result']
                bridge = copy.deepcopy(catalog['roles'][0])
                bridge.update(oid='99597', name='TEST_ONLY_BRIDGE', superuser=target == 'superuser')
                catalog['roles'].append(bridge)
                catalog['memberships'].append(dict(oid='99596', member='99004', roleid='99597',
                    grantor='99001', admin_option=False, inherit_option=False, set_option=True))
                if target == 'owner':
                    catalog['memberships'].append(dict(oid='99598', member='99597', roleid='99001',
                        grantor='99001', admin_option=False, inherit_option=True, set_option=False))
            self.rejects(before, after, returned, code='DENIED_ROLE_OWNER_OR_SUPERUSER_PATH')

    def test_non_json_input_rejected_before_custom_deepcopy_can_run(self):
        class PrivateObject:
            def __deepcopy__(self, memo):
                raise RuntimeError('TEST_ONLY_PRIVATE_VALUE_MUST_NOT_ESCAPE')
        before, after, returned = applied()
        before['claims'] = PrivateObject()
        self.rejects(before, after, returned, code='EVIDENCE_REJECTED')

    def test_registered_cannot_repair_acl_history_or_sequence(self):
        before, after, returned = applied()
        baseline = copy.deepcopy(after)
        for value in (baseline, after):
            value['catalog']['result'] = copy.deepcopy(before['catalog']['result'])
        self.rejects(baseline, after, outcome='registered_read_only', code='REGISTERED_ACL_DRIFT')
        _, baseline, _ = applied()
        changed = copy.deepcopy(baseline)
        changed['sequence_state']['result']['sequence_state']['last_value'] = '9'
        self.rejects(baseline, changed, outcome='registered_read_only', code='REGISTERED_SEQUENCE_DRIFT')
        before = fixture()
        self.rejects(before, copy.deepcopy(before), outcome='registered_read_only')

    def test_sequence_cannot_be_behind_history_including_registered_and_rollback(self):
        _, registered, _ = applied()
        for state in (dict(last_value='7', is_called=True), dict(last_value='8', is_called=False)):
            baseline = copy.deepcopy(registered)
            baseline['sequence_state']['result']['sequence_state'] = state
            self.rejects(baseline, copy.deepcopy(baseline), outcome='registered_read_only', code='SEQUENCE_BEHIND_HISTORY')
        before = fixture()
        before['sequence_state']['result']['sequence_state'].update(last_value='2', is_called=False)
        after = copy.deepcopy(before)
        after['sequence_state']['result']['sequence_state']['is_called'] = True
        returned, _ = registration(2)
        self.rejects(before, after, returned, outcome='rolled_back_after_insert', code='SEQUENCE_BEHIND_HISTORY')

    def test_returning_native_scalar_identity_and_exact_one_row_delta(self):
        for returned in (None, dict(id='8', hash=comparator.PAYLOAD_SHA256, created_at=comparator.JOURNAL_WHEN),
                         dict(id=True, hash=comparator.PAYLOAD_SHA256, created_at=comparator.JOURNAL_WHEN),
                         dict(id=8, hash='f' * 64, created_at=comparator.JOURNAL_WHEN),
                         dict(id=8, hash=comparator.PAYLOAD_SHA256, created_at=str(comparator.JOURNAL_WHEN)),
                         dict(id=8, hash=comparator.PAYLOAD_SHA256, created_at=comparator.JOURNAL_WHEN, extra=True)):
            before, after, _ = applied()
            self.rejects(before, after, returned)
        before, after, returned = applied()
        returned['id'] = 9
        self.rejects(before, after, returned, code='RETURNING_ROW_MISMATCH')
        before, after, returned = applied()
        history(after['drizzle_history']['result'], after['drizzle_history']['result']['rows'][1:])
        self.rejects(before, after, returned, code='PRIOR_HISTORY_DRIFT')

    def test_sequence_profiles_default_references_and_ownership_fail_closed(self):
        for key, value in (('seqcache', '2'), ('seqincrement', '-1'), ('seqcycle', True), ('seqtypid', '20')):
            before, after, returned = applied()
            for bundle in (before, after):
                bundle['catalog']['result']['sequences'][0][key] = value
            self.rejects(before, after, returned, code='SEQUENCE_PROFILE')
        for path in ('references', 'ownership'):
            before, after, returned = applied()
            for bundle in (before, after):
                if path == 'references':
                    bundle['catalog']['result']['defaults'][0]['references'].pop()
                else:
                    bundle['catalog']['result']['dependencies'].clear()
            self.rejects(before, after, returned)

    def test_only_measured_sequence_transition_and_returned_id_supported(self):
        for mutate in (
            lambda b: b['sequence_state']['result']['sequence_state'].update(last_value='9'),
            lambda b: b['sequence_state']['result']['sequence_state'].update(is_called=False),
        ):
            before, after, returned = applied()
            mutate(after)
            self.rejects(before, after, returned)
        # Non-contiguous existing IDs and a pre-existing sequence gap are valid;
        # the measured nextval result need not be max(id)+1.
        before, after, returned = applied()
        self.assertEqual(returned['id'], 8)
        self.assertEqual([row['id'] for row in before['drizzle_history']['result']['rows']], ['1', '3'])
        self.assertEqual(self.compare(before, after, returned=returned)['admission'], 'NOT_ADMITTED')

    def test_exhausted_sequence_allows_only_registered_read_only_observation(self):
        _, registered, _ = applied()
        registered['sequence_state']['result']['sequence_state'].update(last_value='2147483647', is_called=True)
        self.assertEqual(self.compare(registered, copy.deepcopy(registered), 'registered_read_only')['admission'], 'NOT_ADMITTED')
        before, after, returned = applied()
        before['sequence_state']['result']['sequence_state'].update(last_value='2147483647', is_called=True)
        self.rejects(before, after, returned, code='SEQUENCE_TRANSITION')

    def test_supabase_commitments_and_formatting_remain_exact(self):
        before, after, returned = applied()
        for envelope in (after['supabase_manifest_before'], after['supabase_manifest_after'], *after['supabase_pages']):
            envelope['capture']['format_settings']['TimeZone'] = 'TEST_ONLY_OTHER_TIMEZONE'
        self.rejects(before, after, returned, code='SUPABASE_DRIFT')
        before, after, returned = applied()
        replacement = evidence._sha('TEST_ONLY_OTHER_SUPABASE_ROW')
        after['supabase_pages'][0]['result']['page_rows'][0]['row_sha256'] = replacement
        pairs = [[row['version'], row['row_sha256']] for envelope in after['supabase_pages'] for row in envelope['result']['page_rows']]
        digest = evidence._sha(evidence._json_scalars(pairs))
        for envelope in (after['supabase_manifest_before'], after['supabase_manifest_after'], *after['supabase_pages']):
            envelope['result']['history_sha256'] = digest
        self.rejects(before, after, returned, code='SUPABASE_DRIFT')

    def test_activity_and_capture_timestamps_are_not_semantic_admission(self):
        before, after, returned = applied()
        before['claims'] = after['claims'] = dict(transport_verified=True, ddl_acl_window_open=True)
        after['activity']['result']['sessions'][0]['state'] = 'idle'
        result = self.compare(before, after, returned=returned)
        self.assertEqual(result['admission'], 'NOT_ADMITTED')
        self.assertEqual(result['single_transaction_snapshot'], 'NOT_ESTABLISHED')
        self.assertEqual(result['transport_and_ddl_acl_window'], 'UNKNOWN_REQUIRES_PARENT_VERIFICATION')

    def test_inert_module_has_no_process_database_network_or_output(self):
        source = Path(comparator.__file__).read_text(encoding='utf8')
        tree = ast.parse(source)
        imports = '\n'.join(ast.unparse(node) for node in ast.walk(tree) if isinstance(node, (ast.Import, ast.ImportFrom)))
        self.assertNotRegex(imports, r'\b(subprocess|socket|requests|psycopg|asyncpg|urllib|pathlib)\b')
        self.assertNotRegex(source, r'\b(print|write_text|write_bytes|exec|eval|open)\s*\(')


if __name__ == '__main__':
    unittest.main()
