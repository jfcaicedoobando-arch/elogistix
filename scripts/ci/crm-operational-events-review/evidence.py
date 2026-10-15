"""Strict, inert review of crm-operational-evidence-v1 captures.

ingest(bundle, validate_projection=...) requires the following bundle keys:
kind='crm-operational-review-bundle-v1', discovery, catalog, drizzle_history,
supabase_manifest_before, supabase_pages (a nonempty list),
supabase_manifest_after, sequence_state, activity. Optional claims contains only
transport_verified and ddl_acl_window_open booleans; neither can admit anything.

The trusted caller must supply a real, offline Draft 2020-12 validator for the
existing projection schema. The callback receives each complete envelope and
must return exactly True after validation; a flag in input is not a validator.
This module is not a JSON Schema implementation, runner, or operational gate.
Use load_bundle for strict JSON decoding before dict keys can be discarded.

Only the fixed three-scalar Drizzle projection is reconstructed as PG JSONB
text. Supabase aggregate checks authenticate membership of supplied commitments,
not their hidden row preimages or stored SQL. Captures have no authenticated
catalog manifest or endpoint identity proof. Different calls/snapshots are not
one transaction, and matching captures do not exclude omitted objects or ABA.
No callback, coherent history, transport claim or window claim changes the
unconditional NOT_ADMITTED result. No input values appear in error messages.
"""
import copy
import hashlib
import json
import math
import re
from datetime import datetime
from pathlib import Path


PROJECTION_SCHEMA = (Path(__file__).resolve().parents[1] / 'crm-canonical-review'
                     / 'operational-capture' / 'evidence.schema.json')
BUNDLE_KIND = 'crm-operational-review-bundle-v1'
BUNDLE_KEYS = frozenset(('kind', 'discovery', 'catalog', 'drizzle_history',
                         'supabase_manifest_before', 'supabase_pages',
                         'supabase_manifest_after', 'sequence_state', 'activity'))
FORBIDDEN = frozenset(('prosrc', 'probin', 'prosqlbody', 'proargdefaults',
    'proconfig', 'rolconfig', 'rolpassword', 'attmissingval', 'attoptions',
    'attfdwoptions', 'adbin', 'conbin', 'indexprs', 'indpred', 'tgargs', 'tgqual',
    'ev_action', 'ev_qual', 'polqual', 'polwithcheck', 'relpartbound',
    'reloptions', 'typdefault', 'typdefaultbin', 'statements', 'description',
    'query', 'application_name', 'client_addr', 'client_hostname', 'gid',
    'subconninfo'))


class EvidenceError(ValueError):
    """A stable reason code, never a representation of private input."""


def require(ok, code):
    if not ok:
        raise EvidenceError('CRM_EVIDENCE_' + code)


def _pairs(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, 'DUPLICATE_JSON_KEY')
        out[key] = value
    return out


def load_bundle(raw):
    """Decode UTF8 JSON without duplicate keys, NaN or Infinity; no file IO."""
    try:
        require(type(raw) in (str, bytes), 'JSON_INPUT')
        if type(raw) is bytes:
            raw = raw.decode('utf8', errors='strict')
        return json.loads(raw, object_pairs_hook=_pairs,
                          parse_constant=lambda _: require(False, 'NONFINITE_JSON'))
    except EvidenceError:
        raise
    except (ValueError, UnicodeError, RecursionError):
        raise EvidenceError('CRM_EVIDENCE_JSON_INPUT') from None


def _scan(value, ancestors=None):
    ancestors = set() if ancestors is None else ancestors
    require(type(value) in (dict, list, str, int, float, bool, type(None)), 'JSON_TYPE')
    if type(value) in (dict, list):
        require(id(value) not in ancestors, 'CYCLIC_INPUT')
        ancestors.add(id(value))
        if type(value) is dict:
            for key, item in value.items():
                require(type(key) is str, 'JSON_KEY_TYPE')
                require(key not in FORBIDDEN, 'RAW_FIELD_FORBIDDEN')
                key.encode('utf8', errors='strict')
                _scan(item, ancestors)
        else:
            for item in value:
                _scan(item, ancestors)
        ancestors.remove(id(value))
    elif type(value) is str:
        value.encode('utf8', errors='strict')
    elif type(value) is float:
        require(math.isfinite(value), 'NONFINITE_JSON')


def _integer(value, *, nullable=False, nonnegative=False):
    if nullable and value is None:
        return None
    require(type(value) is str and re.fullmatch(r'0|-?[1-9][0-9]*', value) is not None,
            'DECIMAL_STRING')
    number = int(value)
    require(not nonnegative or number >= 0, 'NEGATIVE_COUNT_OR_IDENTITY')
    return number


def _digest(value):
    require(type(value) is str and re.fullmatch(r'[0-9a-f]{64}', value) is not None, 'DIGEST')
    return value


def _sha(text):
    return hashlib.sha256(text.encode('utf8')).hexdigest()


def _json_scalars(value):
    # Deliberately only called with the fixed ASCII/scalar history projections.
    # PG JSONB uses these spaces, numeric scalars and id/hash/created_at key order.
    return json.dumps(value, ensure_ascii=False, separators=(', ', ': '), allow_nan=False)


def _timestamp(value):
    require(type(value) is str, 'TIMESTAMP')
    result = datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(result.tzinfo is not None and result.utcoffset() is not None, 'TIMESTAMP_ZONE')
    return result


# This is a list of protocol identity fields, not a Draft schema interpreter.
# Regproc display strings (prosupport, type IO routines, etc.) are not OIDs.
_CATALOG_DECIMALS = {
    'relations': 'oid relnamespace reltype reloftype relowner relam relfilenode reltablespace reltoastrelid relrewrite',
    'namespaces': 'oid nspowner', 'attributes': 'attrelid atttypid attcollation',
    'functions': 'oid pronamespace proowner prolang provariadic prorettype',
    'triggers': 'oid tgrelid tgparentid tgfoid tgconstrrelid tgconstrindid tgconstraint',
    'defaults': 'oid adrelid',
    'constraints': 'oid connamespace conrelid contypid conindid conparentid confrelid',
    'indexes': 'indexrelid indrelid', 'policies': 'oid polrelid', 'rules': 'oid ev_class',
    'inheritance': 'inhrelid inhparent',
    'types': 'oid typnamespace typowner typrelid typelem typarray typbasetype typcollation',
    'languages': 'oid lanowner lanplcallfoid laninline lanvalidator',
    'sequences': 'seqrelid seqtypid seqstart seqincrement seqmax seqmin seqcache',
    'operator_classes': 'oid opcmethod opcnamespace opcowner opcfamily opcintype opckeytype',
    'operator_families': 'oid opfmethod opfnamespace opfowner', 'access_methods': 'oid',
    'dependencies': 'classid objid refclassid refobjid',
    'shared_dependencies': 'dbid classid objid refclassid refobjid',
    'comments': 'objoid classoid', 'security_labels': 'objoid classoid',
    'event_triggers': 'oid evtowner evtfoid', 'roles': 'oid',
    'memberships': 'oid roleid member grantor',
}
_CATALOG_ARRAYS = {
    'functions': 'proargtypes proallargtypes protrftypes',
    'constraints': 'conpfeqop conppeqop conffeqop conexclop',
    'indexes': 'indcollation indclass', 'policies': 'polroles',
}


def _catalog_numbers(catalog):
    for category, fields in _CATALOG_DECIMALS.items():
        for node in catalog[category]:
            row = node.get('metadata', node)
            for field in fields.split():
                _integer(row[field], nonnegative=category != 'sequences')
            for field in _CATALOG_ARRAYS.get(category, '').split():
                if row[field] is not None:
                    for value in row[field]:
                        _integer(value, nonnegative=True)
    for node in catalog['functions']:
        for acl in node['acl_entries']:
            _integer(acl['grantor'], nonnegative=True)
            _integer(acl['grantee'], nonnegative=True)
        for role in node['effective_execute']:
            _integer(role['role_oid'], nonnegative=True)
    for node in catalog['defaults']:
        for edge in node['references']:
            for field in ('classid', 'objid', 'refclassid', 'refobjid'):
                _integer(edge[field], nonnegative=True)


def _by_oid(rows, *, metadata=False):
    result = {}
    for node in rows:
        row = node['metadata'] if metadata else node
        require(row['oid'] not in result, 'DUPLICATE_CATALOG_IDENTITY')
        result[row['oid']] = node
    return result


def _identities(discovery, catalog, sequence):
    _catalog_numbers(catalog)
    relations = _by_oid(catalog['relations'], metadata=True)
    namespaces = _by_oid(catalog['namespaces'])
    functions = _by_oid(catalog['functions'], metadata=True)
    roles = _by_oid(catalog['roles'])
    for role in discovery['roles']:
        _integer(role['oid'], nonnegative=True)
        require(roles.get(role['oid']) == role, 'ROLE_CAPTURE_DRIFT')
    requested = {'crm': 'public.crm_empresas', 'drizzle': 'drizzle.__drizzle_migrations',
                 'supabase': 'supabase_migrations.schema_migrations'}
    require(len(discovery['relations']) == len(requested), 'ROOT_RELATIONS')
    labels = set()
    for observed in discovery['relations']:
        label = observed['label']
        require(label in requested and label not in labels, 'ROOT_RELATIONS')
        labels.add(label)
        oid = observed['oid']
        _integer(oid, nonnegative=True)
        require(observed['requested_name'] == requested[label] and oid in relations, 'ROOT_IDENTITY')
        node = relations[oid]
        row = node['metadata']
        namespace = namespaces[row['relnamespace']]
        require(node['qualified_name'] == requested[label]
                and namespace['nspname'] + '.' + row['relname'] == requested[label], 'ROOT_IDENTITY')
        for left, right in (('owner', 'relowner'), ('relkind', 'relkind'), ('access_method_oid', 'relam'),
                            ('is_partition', 'relispartition'), ('row_security', 'relrowsecurity'),
                            ('force_row_security', 'relforcerowsecurity'), ('has_rules', 'relhasrules'),
                            ('has_triggers', 'relhastriggers')):
            require(observed[left] == row[right], 'RELATION_CAPTURE_DRIFT')
        attrs = [x['metadata'] for x in catalog['attributes']
                 if x['metadata']['attrelid'] == oid and x['metadata']['attnum'] > 0]
        attrs.sort(key=lambda x: x['attnum'])
        require(type(observed['columns']) is list and len(attrs) == len(observed['columns']), 'COLUMN_CAPTURE_DRIFT')
        for column, attr in zip(observed['columns'], attrs):
            for left, right in (('number', 'attnum'), ('name', 'attname'), ('type_oid', 'atttypid'),
                                ('dropped', 'attisdropped'), ('not_null', 'attnotnull'),
                                ('identity', 'attidentity'), ('generated', 'attgenerated'),
                                ('has_default', 'atthasdef'), ('has_missing', 'atthasmissing')):
                require(column[left] == attr[right], 'COLUMN_CAPTURE_DRIFT')
            _integer(column['type_oid'], nonnegative=True)
        links = sum(x['inhparent'] == oid or x['inhrelid'] == oid for x in catalog['inheritance'])
        require(_integer(observed['inheritance_links'], nonnegative=True) == links, 'INHERITANCE_CAPTURE_DRIFT')
    require(type(discovery['helpers']) is list and discovery['helpers'], 'HELPERS_MISSING')
    observed_helpers = {}
    for helper in discovery['helpers']:
        require(helper['oid'] not in observed_helpers, 'DUPLICATE_HELPER')
        observed_helpers[helper['oid']] = helper
        for key in ('oid', 'namespace', 'owner', 'return_type_oid'):
            _integer(helper[key], nonnegative=True)
        for value in helper['argument_type_oids']:
            _integer(value, nonnegative=True)
        require(helper['oid'] in functions, 'HELPER_IDENTITY')
        row = functions[helper['oid']]['metadata']
        for left, right in (('name', 'proname'), ('namespace', 'pronamespace'), ('owner', 'proowner'),
                            ('kind', 'prokind'), ('argument_count', 'pronargs'),
                            ('argument_type_oids', 'proargtypes'), ('return_type_oid', 'prorettype')):
            require(helper[left] == row[right], 'HELPER_CAPTURE_DRIFT')
    require(set(observed_helpers) == {oid for oid, node in functions.items() if node['is_named_helper']}, 'HELPER_IDENTITIES')
    for trigger in catalog['triggers']:
        row = trigger['metadata']
        require(row['tgrelid'] in relations and row['tgfoid'] in functions, 'TRIGGER_REFERENCE')
    for event in catalog['event_triggers']:
        require(event['evtfoid'] in functions, 'EVENT_FUNCTION_REFERENCE')
    measured = discovery['sequence']
    require(type(measured) is dict, 'SEQUENCE_MISSING')
    for key in ('oid', 'owner'):
        _integer(measured[key], nonnegative=True)
    require(sequence['identity_matches'] is True and sequence['expected_sequence_oid'] == measured['oid']
            and sequence['sequence_name'] == measured['name'], 'SEQUENCE_IDENTITY')
    require(measured['oid'] in relations, 'SEQUENCE_IDENTITY')
    node = relations[measured['oid']]
    require(node['qualified_name'] == measured['name'] and node['metadata']['relkind'] == 'S'
            and node['metadata']['relowner'] == measured['owner'], 'SEQUENCE_CAPTURE_DRIFT')
    require(sum(x['seqrelid'] == measured['oid'] for x in catalog['sequences']) == 1, 'SEQUENCE_METADATA')
    _integer(sequence['sequence_state']['last_value'])


def _drizzle(result):
    require(result['shape_supported'] is True, 'DRIZZLE_UNSUPPORTED')
    rows = result['rows']
    require(_integer(result['row_count'], nonnegative=True) == len(rows), 'DRIZZLE_COUNT')
    for key in ('null_id_count', 'null_hash_count', 'null_created_at_count',
                'duplicate_ids', 'duplicate_hashes', 'duplicate_timestamps'):
        require(_integer(result[key], nonnegative=True) == 0, 'DRIZZLE_ANOMALY')
    preimages = []
    for row in rows:
        identifier = _integer(row['id'])
        when = _integer(row['created_at'])
        require(0 < identifier <= 2147483647 and 0 < when <= 9223372036854775807, 'DRIZZLE_SCALAR_RANGE')
        require(row['hash_is_canonical_format'] is True, 'DRIZZLE_REDACTED_HASH')
        digest = _digest(row['hash'])
        require(_digest(row['hash_value_sha256']) == _sha(digest), 'DRIZZLE_HASH_VALUE')
        raw = {'id': identifier, 'hash': digest, 'created_at': when}
        require(_digest(row['row_sha256']) == _sha(_json_scalars(raw)), 'DRIZZLE_ROW_COMMITMENT')
        preimages.append(raw)
    for key in ('id', 'hash', 'created_at'):
        require(len({row[key] for row in preimages}) == len(preimages), 'DRIZZLE_DUPLICATE')
    require([x['id'] for x in preimages] == sorted(x['id'] for x in preimages)
            and [x['created_at'] for x in preimages] == sorted(x['created_at'] for x in preimages), 'DRIZZLE_ORDER')
    require(_digest(result['history_sha256']) == _sha(_json_scalars(preimages)), 'DRIZZLE_HISTORY_COMMITMENT')
    return len(rows)


def _supabase(before, pages, after):
    manifest = before['result']
    require(manifest == after['result'], 'SUPABASE_MANIFEST_DRIFT')
    require(manifest['shape_supported'] is True and manifest['status'] == 'CAPTURE_ONLY', 'SUPABASE_UNSUPPORTED')
    count = _integer(manifest['row_count'], nonnegative=True)
    require(_integer(manifest['null_versions'], nonnegative=True) == 0
            and _integer(manifest['duplicate_versions'], nonnegative=True) == 0, 'SUPABASE_ANOMALY')
    digest = _digest(manifest['history_sha256'])
    formats = before['capture']['format_settings']
    require(formats == after['capture']['format_settings'], 'SUPABASE_FORMAT_DRIFT')
    expected_offset, page_size, pairs = 0, None, []
    last_time = _timestamp(before['capture']['statement_at'])
    for index, envelope in enumerate(pages):
        result = envelope['result']
        require(envelope['capture']['format_settings'] == formats, 'SUPABASE_FORMAT_DRIFT')
        now = _timestamp(envelope['capture']['statement_at'])
        require(last_time <= now <= _timestamp(after['capture']['statement_at']), 'SUPABASE_CAPTURE_ORDER')
        last_time = now
        require(all(result[key] == manifest[key] for key in manifest), 'SUPABASE_MANIFEST_DRIFT')
        offset = _integer(result['offset'], nonnegative=True)
        size = _integer(result['page_size'], nonnegative=True)
        require(size > 0 and (page_size is None or size == page_size), 'SUPABASE_PAGE_SIZE')
        page_size = size
        require(offset == expected_offset, 'SUPABASE_PAGE_GAP_OR_REPEAT')
        page = result['page_rows']
        require(len(page) == min(size, max(0, count - offset)), 'SUPABASE_PAGE_COUNT')
        more = count > offset + size
        require(result['has_more'] is more, 'SUPABASE_HAS_MORE')
        require(result['next_offset'] == (str(offset + size) if more else None), 'SUPABASE_NEXT_OFFSET')
        require((index < len(pages) - 1) is more, 'SUPABASE_PAGE_EXHAUSTION')
        for number, row in enumerate(page, offset + 1):
            require(_integer(row['row_number'], nonnegative=True) == number, 'SUPABASE_ROW_NUMBER')
            version = row['version']
            require(row['version_is_numeric'] is True and type(version) is str
                    and re.fullmatch(r'[0-9]{1,32}', version) is not None, 'SUPABASE_REDACTED_VERSION')
            require(_digest(row['version_sha256']) == _sha(version), 'SUPABASE_VERSION_COMMITMENT')
            pairs.append([version, _digest(row['row_sha256'])])
        expected_offset = offset + size
    require(len(pairs) == count and len({pair[0] for pair in pairs}) == count, 'SUPABASE_COMPLETE_MULTISET')
    require(pairs == sorted(pairs, key=lambda p: (p[0].encode('ascii'), p[1])), 'SUPABASE_C_ORDER')
    require(_sha(_json_scalars(pairs)) == digest, 'SUPABASE_HISTORY_COMMITMENT')
    return count


def _activity(envelope, discovery):
    result = envelope['result']
    require(result['read_all_stats_effective'] is discovery['context']['read_all_stats_effective'], 'STATISTICS_CAPTURE_DRIFT')
    all_stats = result['read_all_stats_effective']
    expected = 'PRIVILEGE_PRESENT_DETAILS_MUST_BE_CHECKED' if all_stats else 'RESTRICTED_OR_ROLE_SCOPED'
    require(result['statistics_visibility'] == expected, 'STATISTICS_FLAG')
    sessions = result['sessions']
    pids = [row['pid'] for row in sessions]
    require(all(type(pid) is int and pid > 0 for pid in pids) and len(set(pids)) == len(pids), 'SESSION_IDENTITIES')
    capture_pid = envelope['capture']['backend_pid']
    require(sum(row['is_capture_backend'] is True for row in sessions) == 1, 'CAPTURE_BACKEND')
    require(all(row['is_capture_backend'] is (row['pid'] == capture_pid) for row in sessions), 'CAPTURE_BACKEND')
    require(_integer(result['other_session_count'], nonnegative=True) == sum(pid != capture_pid for pid in pids), 'SESSION_COUNT')
    _integer(result['max_prepared_transactions'], nonnegative=True)
    for row in sessions:
        for key in ('role_oid', 'backend_xid', 'backend_xmin'):
            _integer(row[key], nullable=True, nonnegative=True)
    for row in result['prepared']:
        _integer(row['transaction'], nonnegative=True)
        _digest(row['gid_sha256'])
    require(_integer(result['prepared_count'], nonnegative=True) == len(result['prepared']), 'PREPARED_COUNT')
    for row in result['locks']:
        for key in ('database', 'relation', 'classid', 'objid', 'transactionid'):
            _integer(row[key], nullable=True, nonnegative=True)
    for row in result['subscriptions']:
        _integer(row['oid'], nonnegative=True)
        _integer(row['owner_oid'], nonnegative=True)
    for row in result['subscription_workers']:
        _integer(row['subscription_oid'], nonnegative=True)
        _integer(row['relation_oid'], nullable=True, nonnegative=True)
    visible = lambda row: row['role_visibility_verified'] is True and row['state'] not in (None, 'disabled')
    require(result['details_available_for_all_observed_sessions'] is (bool(sessions) and all(visible(row) for row in sessions)), 'DETAILS_FLAG')
    clients = [row for row in sessions if row['backend_type'] == 'client backend']
    workers = [row for row in sessions if row['backend_type'] not in (None, 'client backend')]
    unknown = [row for row in sessions if row['backend_type'] is None]
    client_known = (result['track_activities'] == 'on' and bool(clients) and not unknown
                    and all(visible(row) for row in clients))
    worker_known = all(visible(row) for row in workers)
    return {'client_backends': 'COMPLETE' if client_known else 'UNKNOWN',
            'nonclient_backends': ('NONE_OBSERVED' if not workers else 'COMPLETE' if worker_known else 'UNKNOWN'),
            'overall_observed_visibility': 'COMPLETE' if client_known and worker_known and not unknown else 'UNKNOWN',
            'client_count': len(clients), 'nonclient_count': len(workers), 'unclassified_count': len(unknown)}


def ingest(bundle, *, validate_projection=None):
    """Return only review counts/statuses, with no identity/source data or IO.

    Projection validation is a trusted caller boundary, never an input claim.
    A dict already decoded elsewhere cannot reveal discarded duplicate keys.
    Unsupported/ambiguous histories fail closed; valid unknown visibility does
    not reject the evidence or become a no-writers/window assertion.
    """
    try:
        require(callable(validate_projection), 'PROJECTION_VALIDATOR_REQUIRED')
        if type(bundle) in (str, bytes):
            bundle = load_bundle(bundle)
        _scan(bundle)
        require(type(bundle) is dict and BUNDLE_KEYS <= bundle.keys()
                and bundle.keys() <= BUNDLE_KEYS | {'claims'}, 'BUNDLE_KEYS')
        bundle = copy.deepcopy(bundle)
        require(bundle['kind'] == BUNDLE_KIND, 'BUNDLE_KIND')
        if 'claims' in bundle:
            claims = bundle['claims']
            require(type(claims) is dict and claims.keys() <= {'transport_verified', 'ddl_acl_window_open'}
                    and all(type(value) is bool for value in claims.values()), 'CLAIMS_FORMAT')
        pages = bundle['supabase_pages']
        require(type(pages) is list and pages, 'SUPABASE_PAGES_REQUIRED')
        named = [(key, bundle[key]) for key in ('discovery', 'catalog', 'drizzle_history', 'supabase_manifest_before')]
        named += [('supabase_page', page) for page in pages]
        named += [(key, bundle[key]) for key in ('supabase_manifest_after', 'sequence_state', 'activity')]
        identity = None
        for name, envelope in named:
            try:
                accepted = validate_projection(copy.deepcopy(envelope))
            except Exception:
                raise EvidenceError('CRM_EVIDENCE_PROJECTION_REJECTED') from None
            require(accepted is True, 'PROJECTION_REJECTED')
            section = 'supabase_manifest' if name.startswith('supabase_manifest_') else name
            require(envelope['kind'] == 'crm-operational-evidence-v1' and envelope['admission'] == 'NOT_ADMITTED'
                    and envelope['section'] == section, 'SECTION_OR_ADMISSION')
            capture = envelope['capture']
            _integer(capture['database_oid'], nonnegative=True)
            _integer(capture['xid_if_assigned'], nullable=True, nonnegative=True)
            require(type(capture['backend_pid']) is int and capture['backend_pid'] > 0, 'BACKEND_PID')
            require(_timestamp(capture['statement_at']) <= _timestamp(capture['captured_at']), 'CAPTURE_TIME')
            observed = tuple(capture[key] for key in ('database', 'database_oid', 'user', 'session_user'))
            identity = observed if identity is None else identity
            require(observed == identity, 'BASE_IDENTITY_DRIFT')
        discovery, catalog = bundle['discovery']['result'], bundle['catalog']['result']
        version = _integer(discovery['context']['server_version_num'], nonnegative=True)
        require(170000 <= version < 180000, 'CATALOG_MAJOR_UNSUPPORTED')
        _identities(discovery, catalog, bundle['sequence_state']['result'])
        drizzle_count = _drizzle(bundle['drizzle_history']['result'])
        supabase_count = _supabase(bundle['supabase_manifest_before'], pages, bundle['supabase_manifest_after'])
        visibility = _activity(bundle['activity'], discovery)
        return {'kind': 'crm-operational-review-summary-v1', 'admission': 'NOT_ADMITTED',
                'integrity': 'COHERENT_REVIEW_ONLY', 'envelopes_reviewed': len(named),
                'drizzle_rows': drizzle_count, 'supabase_rows': supabase_count, 'visibility': visibility,
                'supabase_row_preimages': 'NOT_VERIFIED_COMMITMENTS_ONLY',
                'capture_provenance_and_catalog_completeness': 'UNKNOWN',
                'single_transaction_snapshot': 'NOT_ESTABLISHED',
                'external_queues_and_ddl_acl_window': 'UNKNOWN_REQUIRES_EXTERNAL_COORDINATION',
                'transport_commit_registration_retry': 'UNKNOWN_REQUIRES_PARENT_VERIFICATION'}
    except EvidenceError:
        raise
    except (KeyError, TypeError, ValueError, OverflowError, RecursionError):
        raise EvidenceError('CRM_EVIDENCE_MALFORMED_PROJECTION') from None
