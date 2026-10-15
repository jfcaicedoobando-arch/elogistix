"""Inert, exact supplied-preimage delta review. This is never target admission.

compare() validates both complete evidence bundles through evidence.ingest and a
trusted offline Draft 2020-12 callback. It performs no IO, SQL, rendering, lock,
transaction or registration. Equality authenticates neither capture provenance,
catalog completeness nor independently reviewed semantics. In particular, a
stable default hash/dependency graph is NOT proof of a simple builtin default.

The only declared transitions are applied, registered_read_only and
rolled_back_after_insert. returned_row is the actual three-scalar PostgreSQL
INSERT RETURNING JSON object (integer id/timestamp), not a requested ID. The
supported sequence arithmetic checks measured observations; it does not reserve
an ID or authenticate the default's execution. Rollback may retain its sequence
gap and never claims that a sequence rolled back transactionally.
An exhausted supported sequence can be compared only by registered_read_only;
an attempted new allocation past its maximum always fails the transition check.

Arrays retain order and multiplicity; object keys are unordered but scalar
types are exact. No JSON serialization substitutes for server commitments.
Captures and live activity remain individually validated observations, not a
single snapshot or an exclusion of external writers. Errors and summaries
contain only static codes/statuses, never private input values.
"""
import copy
import hashlib

import evidence


PAYLOAD_SHA256 = '32173fdde2d456d6d9da8f46b54e38f4535b699b3ca36d921f93f444105fecc6'
JOURNAL_WHEN = 1792093404000
# These are immutable PUBLIC helper-source commitments, also independently
# pinned in the inherited lab harness. They are not observed instance values.
HELPER_SOURCE_SHA256 = {
    '_crm_empresa_no_borrar_cliente': '035a8b240ef8c12fcb21136c15a238635b6ed051a7007da34d60c64f8bb494af',
    '_crm_empresa_no_delete_fisico': '1b094604d2ce83060257fdbfaf4e49440ce7c38dbf833b3fec1f5f69fe4c788c',
}
# Public PostgreSQL 17 catalog class identities, never target object identities.
PG_PROC, PG_AUTHID, PG_CLASS, PG_ATTRDEF = '1255', '1260', '1259', '2604'
OUTCOMES = frozenset(('applied', 'registered_read_only', 'rolled_back_after_insert'))


class ComparisonError(ValueError):
    """A static reason code without private input representations."""


def require(ok, code):
    if not ok:
        raise ComparisonError('CRM_COMPARATOR_' + code)


def _same(left, right):
    """JSON equality with ordered arrays and no bool/integer coercion."""
    if type(left) is not type(right):
        return False
    if type(left) is dict:
        return left.keys() == right.keys() and all(_same(left[key], right[key]) for key in left)
    if type(left) is list:
        return len(left) == len(right) and all(_same(a, b) for a, b in zip(left, right))
    return left == right


def _one(rows, predicate, code):
    found = [row for row in rows if predicate(row)]
    require(len(found) == 1, code)
    return found[0]


def _sha(text):
    return hashlib.sha256(text.encode('utf8')).hexdigest()


def _identity(bundle):
    return tuple(bundle['discovery']['capture'][key]
                 for key in ('database', 'database_oid', 'user', 'session_user'))


def _role(catalog, name):
    return _one(catalog['roles'], lambda role: role['name'] == name, 'ROLE_IDENTITY')


def _helper_postimage(bundle):
    """Derive only the two canonical helper ACL deltas and exact shared edges."""
    catalog = copy.deepcopy(bundle['catalog']['result'])
    public = _one(catalog['namespaces'], lambda node: node['nspname'] == 'public', 'PUBLIC_NAMESPACE')
    language = _one(catalog['languages'], lambda node: node['lanname'] == 'plpgsql', 'HELPER_LANGUAGE')
    owner = _role(catalog, 'postgres')
    require(bundle['discovery']['capture']['user'] == 'postgres'
            and bundle['discovery']['result']['context']['isolation'] == 'read committed', 'EXECUTION_CONTEXT')
    checked_roles = {name: _role(catalog, name) for name in ('postgres', 'anon', 'authenticated', 'service_role')}
    require(len({node['oid'] for node in checked_roles.values()}) == 4, 'ROLE_IDENTITY')
    require(not any(role['superuser'] for name, role in checked_roles.items() if name != 'postgres'), 'DENIED_ROLE_SUPERUSER')
    service = checked_roles['service_role']['oid']
    # The pinned capture observes these four effective privileges. A different
    # owner cannot silently inherit that observation; its profile is unsupported.
    helpers = []
    for node in catalog['functions']:
        named = (node['metadata']['pronamespace'] == public['oid']
                 and node['metadata']['proname'] in HELPER_SOURCE_SHA256)
        require(node['is_named_helper'] is named, 'HELPER_FLAG_INCONSISTENT')
        if named:
            helpers.append(node)
    require(len(helpers) == 2 and {node['metadata']['proname'] for node in helpers} == set(HELPER_SOURCE_SHA256), 'HELPER_SET')
    role_ids = {role['oid'] for role in catalog['roles']}
    memberships = catalog['memberships']
    require(all(edge[key] in role_ids for edge in memberships for key in ('roleid', 'member', 'grantor')), 'ROLE_CLOSURE_REFERENCE')
    def reaches(start, target, option):
        options = (option,) if type(option) is str else option
        visited, pending = set(), [start]
        while pending:
            current = pending.pop()
            if current == target:
                return True
            if current not in visited:
                visited.add(current)
                pending.extend(edge['roleid'] for edge in memberships
                               if edge['member'] == current and any(edge[key] is True for key in options))
        return False
    for name in ('anon', 'authenticated', 'service_role'):
        # Conservative supported profile: mixed SET/INHERIT/admin-capability
        # paths also block. This is not a complete role-privilege decision model.
        dangerous = [owner['oid']] + [role['oid'] for role in catalog['roles'] if role['superuser']]
        require(not any(reaches(checked_roles[name]['oid'], target, ('inherit_option', 'set_option', 'admin_option'))
                        for target in dangerous), 'DENIED_ROLE_OWNER_OR_SUPERUSER_PATH')
    expected = dict(pronamespace=public['oid'], proowner=owner['oid'], prolang=language['oid'],
        provariadic='0', prorettype='2279', prokind='f', provolatile='v', proparallel='u',
        prosecdef=False, proleakproof=False, proisstrict=False, proretset=False,
        pronargs=0, pronargdefaults=0, procost=100, prorows=0, proargtypes=[],
        proallargtypes=None, proargmodes=None, proargnames=None, protrftypes=None, prosupport='-')
    missing = _sha('<NULL>')
    removed = []
    database_oid = bundle['discovery']['capture']['database_oid']
    crm = _one(catalog['relations'], lambda node: node['qualified_name'] == 'public.crm_empresas', 'CRM_ROOT')
    require(crm['metadata']['relkind'] == 'r' and crm['metadata']['relispartition'] is False
            and crm['metadata']['relowner'] == owner['oid']
            and not any(edge['inhrelid'] == crm['metadata']['oid'] or edge['inhparent'] == crm['metadata']['oid']
                        for edge in catalog['inheritance']), 'CRM_ROOT')
    deleted = _one(catalog['attributes'], lambda node: node['metadata']['attrelid'] == crm['metadata']['oid']
                   and node['metadata']['attname'] == 'deleted_at'
                   and node['metadata']['attisdropped'] is False, 'CRM_DELETED_COLUMN')
    links = [node for node in catalog['triggers'] if node['metadata']['tgfoid'] in {helper['metadata']['oid'] for helper in helpers}]
    require(len(links) == 2, 'HELPER_TRIGGER_LINKS')
    for node in helpers:
        row = node['metadata']
        require(all(_same(row[key], value) for key, value in expected.items()), 'HELPER_SOURCE_CONTRACT')
        require(node['source_sha256'] == HELPER_SOURCE_SHA256[row['proname']]
                and node['binary_is_null'] is True and node['binary_sha256'] == missing
                and node['sql_body_is_null'] is True and node['sql_body_sha256'] == missing
                and node['argument_defaults_is_null'] is True and node['argument_defaults_sha256'] == missing
                and node['config_is_null'] is False and node['config_is_expected_helper_value'] is True
                and node['config_sha256'] == _sha('{search_path=public}'), 'HELPER_SOURCE_CONTRACT')
        trigger = _one(links, lambda link: link['metadata']['tgfoid'] == row['oid'], 'HELPER_TRIGGER_LINKS')
        first = row['proname'] == '_crm_empresa_no_borrar_cliente'
        expected_trigger = dict(tgrelid=crm['metadata']['oid'], tgparentid='0', tgfoid=row['oid'],
            tgconstrrelid='0', tgconstrindid='0', tgconstraint='0', tgname='trg' + row['proname'],
            tgenabled='O', tgtype=19 if first else 11, tgnargs=0, tgisinternal=False,
            tgdeferrable=False, tginitdeferred=False, tgattr=[deleted['metadata']['attnum']] if first else [],
            tgoldtable=None, tgnewtable=None)
        require(all(_same(trigger['metadata'][key], value) for key, value in expected_trigger.items())
                and type(trigger['args_octets']) is int and trigger['args_octets'] == 0
                and trigger['args_sha256'] == _sha('') and trigger['when_is_null'] is True
                and trigger['when_sha256'] == missing, 'HELPER_TRIGGER_CONTRACT')
        raw = row['proacl']
        require(type(raw) is list and raw.count('postgres=X/postgres') == 1
                and raw.count('service_role=X/postgres') <= 1
                and all(item in ('postgres=X/postgres', 'service_role=X/postgres') for item in raw), 'HELPER_RAW_ACL')
        has_service = 'service_role=X/postgres' in raw
        if has_service:
            require(not any(reaches(checked_roles[name]['oid'], service, 'inherit_option')
                            for name in ('anon', 'authenticated')), 'DENIED_ROLE_SERVICE_PATH')
        expanded = [dict(grantor=owner['oid'], grantee=owner['oid'], privilege_type='EXECUTE', is_grantable=False)]
        if has_service:
            expanded.append(dict(grantor=owner['oid'], grantee=service, privilege_type='EXECUTE', is_grantable=False))
        expanded.sort(key=lambda item: (int(item['grantor']), int(item['grantee']), item['privilege_type'], item['is_grantable']))
        require(_same(node['acl_entries'], expanded), 'HELPER_EXPANDED_ACL')
        effective = node['effective_execute']
        expected_effective = [dict(role_oid=role['oid'], role_name=name,
                                   execute=(name == 'postgres' or (name == 'service_role' and has_service)))
                              for name, role in checked_roles.items()]
        expected_effective.sort(key=lambda item: int(item['role_oid']))
        require(_same(effective, expected_effective), 'HELPER_EFFECTIVE_ACL')
        for observed in effective:
            if observed['role_oid'] == service:
                observed['execute'] = False
        row['proacl'] = [item for item in raw if item != 'service_role=X/postgres']
        node['acl_entries'] = [item for item in expanded if item['grantee'] != service]
        owner_edge = dict(dbid=database_oid, classid=PG_PROC, objid=row['oid'], objsubid=0,
                          refclassid=PG_AUTHID, refobjid=owner['oid'], deptype='o')
        require(sum(_same(edge, owner_edge) for edge in catalog['shared_dependencies']) == 1, 'HELPER_OWNER_DEPENDENCY')
        service_edge = dict(dbid=database_oid, classid=PG_PROC, objid=row['oid'], objsubid=0,
                            refclassid=PG_AUTHID, refobjid=service, deptype='a')
        require(sum(_same(edge, service_edge) for edge in catalog['shared_dependencies']) == int(has_service), 'HELPER_SERVICE_DEPENDENCY')
        # Unknown helper-to-role edges cannot masquerade as a coherent ACL.
        # Unrelated object edges remain untouched by exact catalog equality.
        role_edges = [edge for edge in catalog['shared_dependencies']
                      if edge['classid'] == PG_PROC and edge['objid'] == row['oid']
                      and edge['refclassid'] == PG_AUTHID and edge['deptype'] in ('a', 'o')]
        require(all(_same(edge, owner_edge) or (has_service and _same(edge, service_edge))
                    for edge in role_edges), 'HELPER_UNEXPECTED_ROLE_DEPENDENCY')
        if has_service:
            removed.append(service_edge)
    catalog['shared_dependencies'] = [edge for edge in catalog['shared_dependencies']
        if not any(_same(edge, target) for target in removed)]
    return catalog, len(removed)


def _sequence_profile(bundle):
    catalog = bundle['catalog']['result']
    sequence_oid = bundle['discovery']['result']['sequence']['oid']
    sequence = _one(catalog['sequences'], lambda node: node['seqrelid'] == sequence_oid, 'SEQUENCE_PROFILE')
    require(sequence['seqtypid'] == '23' and sequence['seqincrement'] == '1'
            and sequence['seqcache'] == '1' and sequence['seqcycle'] is False
            and sequence['seqmin'] == '1' and sequence['seqmax'] == '2147483647'
            and sequence['seqstart'] == '1', 'SEQUENCE_PROFILE')
    discovery = bundle['discovery']['result']
    ledger = _one(discovery['relations'], lambda node: node['label'] == 'drizzle', 'DRIZZLE_ROOT')
    identifier = _one(ledger['columns'], lambda node: node['name'] == 'id', 'DRIZZLE_ID_COLUMN')
    require(identifier['type_oid'] == '23' and identifier['has_default'] is True
            and identifier['identity'] == '' and identifier['generated'] == ''
            and identifier['not_null'] is True, 'DRIZZLE_ID_COLUMN')
    default = _one(catalog['defaults'], lambda node: node['metadata']['adrelid'] == ledger['oid']
                   and node['metadata']['adnum'] == identifier['number'], 'DRIZZLE_ID_DEFAULT')
    reference = dict(classid=PG_ATTRDEF, objid=default['metadata']['oid'], objsubid=0,
                     refclassid=PG_CLASS, refobjid=sequence_oid, refobjsubid=0, deptype='n')
    own_column = dict(classid=PG_ATTRDEF, objid=default['metadata']['oid'], objsubid=0,
                     refclassid=PG_CLASS, refobjid=ledger['oid'], refobjsubid=identifier['number'], deptype='a')
    require(len(default['references']) == 2 and sum(_same(edge, reference) for edge in default['references']) == 1
            and sum(_same(edge, own_column) for edge in default['references']) == 1, 'DRIZZLE_DEFAULT_REFERENCES')
    ownership = dict(classid=PG_CLASS, objid=sequence_oid, objsubid=0,
                     refclassid=PG_CLASS, refobjid=ledger['oid'], refobjsubid=identifier['number'], deptype='a')
    ownership_edges = [edge for edge in catalog['dependencies']
                       if edge['classid'] == PG_CLASS and edge['objid'] == sequence_oid
                       and edge['refclassid'] == PG_CLASS and edge['deptype'] in ('a', 'i')]
    require(len(ownership_edges) == 1 and _same(ownership_edges[0], ownership), 'SEQUENCE_OWNERSHIP')
    state = bundle['sequence_state']['result']['sequence_state']
    value = evidence._integer(state['last_value'])
    require(1 <= value <= 2147483647 and type(state['is_called']) is bool, 'SEQUENCE_STATE_RANGE')
    existing = bundle['drizzle_history']['result']['rows']
    maximum = max((int(row['id']) for row in existing), default=0)
    require(value >= maximum if state['is_called'] else value > maximum, 'SEQUENCE_BEHIND_HISTORY')
    return value, state['is_called']


def _returned(row):
    require(type(row) is dict and row.keys() == {'id', 'hash', 'created_at'}, 'RETURNING_SHAPE')
    require(type(row['id']) is int and 0 < row['id'] <= 2147483647
            and type(row['created_at']) is int and row['created_at'] == JOURNAL_WHEN
            and type(row['hash']) is str and row['hash'] == PAYLOAD_SHA256, 'RETURNING_IDENTITY')


def _histories(before, after, outcome, returned):
    old = before['drizzle_history']['result']['rows']
    new = after['drizzle_history']['result']['rows']
    matches = [row for row in old if row['hash'] == PAYLOAD_SHA256 or int(row['created_at']) == JOURNAL_WHEN]
    if outcome == 'registered_read_only':
        require(len(matches) == 1 and matches[0]['hash'] == PAYLOAD_SHA256
                and int(matches[0]['created_at']) == JOURNAL_WHEN
                and _same(matches[0], old[-1]), 'REGISTRATION_NOT_EXACT')
        require(_same(before['drizzle_history']['result'], after['drizzle_history']['result']), 'REGISTERED_HISTORY_DRIFT')
    else:
        require(not matches and all(int(row['created_at']) < JOURNAL_WHEN for row in old), 'REGISTRATION_CONFLICT_OR_FUTURE')
        _returned(returned)
        require(str(returned['id']) not in {row['id'] for row in old}, 'RETURNING_ID_COLLISION')
        if outcome == 'rolled_back_after_insert':
            require(_same(before['drizzle_history']['result'], after['drizzle_history']['result']), 'ROLLBACK_HISTORY_DRIFT')
        else:
            require(len(new) == len(old) + 1 and _same(new[:-1], old), 'PRIOR_HISTORY_DRIFT')
            row = new[-1]
            require(row['id'] == str(returned['id']) and row['hash'] == returned['hash']
                    and row['created_at'] == str(returned['created_at']), 'RETURNING_ROW_MISMATCH')
    for key in ('supabase_manifest_before', 'supabase_manifest_after'):
        require(_same(before[key]['result'], after[key]['result'])
                and _same(before[key]['capture']['format_settings'], after[key]['capture']['format_settings']), 'SUPABASE_DRIFT')
    require(len(before['supabase_pages']) == len(after['supabase_pages'])
            and all(_same(left['result'], right['result'])
                    and _same(left['capture']['format_settings'], right['capture']['format_settings'])
                    for left, right in zip(before['supabase_pages'], after['supabase_pages'])), 'SUPABASE_DRIFT')


def compare(before, after, *, outcome, returned_row=None, validate_projection=None):
    """Check one declared supplied delta; always return NOT_ADMITTED.

    A trusted caller MUST provide real offline Draft validation. Unit semantic
    doubles cannot establish full projection validity. No baseline or callback
    becomes semantic approval, operational authority or a transport/window.
    """
    try:
        require(type(outcome) is str and outcome in OUTCOMES, 'OUTCOME')
        require(callable(validate_projection), 'PROJECTION_VALIDATOR_REQUIRED')
        values = []
        for bundle in (before, after):
            value = evidence.load_bundle(bundle) if type(bundle) in (str, bytes) else bundle
            evidence._scan(value)
            value = copy.deepcopy(value)
            evidence.ingest(value, validate_projection=validate_projection)
            values.append(value)
        before, after = values
        require(_identity(before) == _identity(after), 'CAPTURE_IDENTITY_DRIFT')
        require(_same(before['discovery']['result'], after['discovery']['result']), 'DISCOVERY_DRIFT')
        old_catalog = before['catalog']['result']
        target_catalog, removed = _helper_postimage(before)
        # Validate the postimage's source and all three ACL representations too.
        post_target, post_removed = _helper_postimage(after)
        if outcome == 'applied':
            require(post_removed == 0 and _same(target_catalog, after['catalog']['result']), 'CATALOG_POSTIMAGE_DRIFT')
        else:
            require(_same(old_catalog, after['catalog']['result']), 'CATALOG_PERSISTENT_DRIFT')
            if outcome == 'registered_read_only':
                require(removed == 0 and post_removed == 0, 'REGISTERED_ACL_DRIFT')
        _histories(before, after, outcome, returned_row)
        old_value, old_called = _sequence_profile(before)
        new_value, new_called = _sequence_profile(after)
        if outcome == 'registered_read_only':
            require(returned_row is None, 'REGISTERED_RETURNING_FORBIDDEN')
            require(_same(before['sequence_state']['result'], after['sequence_state']['result']), 'REGISTERED_SEQUENCE_DRIFT')
        else:
            expected = old_value + 1 if old_called else old_value
            require(expected <= 2147483647 and new_value == expected and new_called is True
                    and returned_row['id'] == new_value, 'SEQUENCE_TRANSITION')
        # Preserve all sequence result identity fields, not merely last_value.
        old_sequence = copy.deepcopy(before['sequence_state']['result'])
        new_sequence = copy.deepcopy(after['sequence_state']['result'])
        old_sequence.pop('sequence_state')
        new_sequence.pop('sequence_state')
        require(_same(old_sequence, new_sequence), 'SEQUENCE_IDENTITY_DRIFT')
        return {'kind': 'crm-operational-delta-review-v1', 'admission': 'NOT_ADMITTED',
                'comparison': 'MATCHED_DECLARED_DELTA_REVIEW_ONLY', 'outcome': outcome,
                'transactional_state': 'ROLLED_BACK_OBSERVED' if outcome == 'rolled_back_after_insert' else 'MATCHED_DECLARED_OBSERVATIONS',
                'sequence_effect': 'NONTRANSACTIONAL_GAP_OBSERVED' if outcome == 'rolled_back_after_insert' else 'NO_ALLOCATION_OBSERVED' if outcome == 'registered_read_only' else 'MEASURED_DEFAULT_TRANSITION',
                'preimage_semantic_review': 'UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
                'default_expression_semantics': 'UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
                'complete_role_capabilities': 'UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
                'capture_provenance_and_catalog_completeness': 'UNKNOWN',
                'supabase_row_preimages': 'NOT_VERIFIED_COMMITMENTS_ONLY',
                'single_transaction_snapshot': 'NOT_ESTABLISHED',
                'event_policy_and_external_consumers': 'UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
                'transport_and_ddl_acl_window': 'UNKNOWN_REQUIRES_PARENT_VERIFICATION'}
    except ComparisonError:
        raise
    except evidence.EvidenceError:
        raise ComparisonError('CRM_COMPARATOR_EVIDENCE_REJECTED') from None
    except (KeyError, TypeError, ValueError, OverflowError, RecursionError, UnicodeError):
        raise ComparisonError('CRM_COMPARATOR_MALFORMED_PROJECTION') from None
