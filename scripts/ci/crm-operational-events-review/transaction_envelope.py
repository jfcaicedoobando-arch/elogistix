"""Transaction-bound comparison experiment; public SQL is always fenced.

No application mode, connection, transport, admission receipt or CLI exists.
Private bundles are kept in memory and embedded as UTF8 hex only after the
unconditional public RAISE. Only fixed, hash-pinned public files are read.
The separately named TEST_ONLY builder admits only an independently invented
owned-fixture database name and retains its own runtime guard. It is not an
operational application API. Matching observations still leave semantic review,
event policy, transport and the external DDL/ACL/sequence-writer window pending.
"""
import copy
import hashlib
import json
from pathlib import Path
import re

import comparator
import evidence
import gate
import offline_review
from public_source import BODY_SHA256


ROOT = Path(__file__).resolve().parent
REPOSITORY = ROOT.parents[2]
CAPTURE = ROOT.parent / 'crm-canonical-review' / 'operational-capture'
CANONICAL_SHA256 = comparator.PAYLOAD_SHA256
JOURNAL_WHEN = comparator.JOURNAL_WHEN
SYNTHETIC_DATABASE = re.compile(r'crm_acl_fixture_[a-z0-9_]+\Z')


class TransactionError(ValueError):
    """A static diagnostic; never retain private values or exception text."""


def require(condition, code):
    if not condition:
        raise TransactionError('CRM_TRANSACTION_' + code)


def _one(nodes, predicate, code):
    selected = [node for node in nodes if predicate(node)]
    require(len(selected) == 1, code)
    return selected[0]


def _ledger_read_profile(bundle):
    """Conservative supported ledger reader shape, not semantic approval.

    Exact catalog equality alone cannot make a malicious expected definition
    safe to SELECT. This structural gate rejects RLS, rules, triggers, custom
    column types, expressions and unsupported constraints before SQL rendering.
    Actual default-tree/binding semantics require independent private review.
    """
    catalog = bundle['catalog']['result']
    owner = _one(catalog['roles'], lambda node: node['name'] == 'postgres', 'OWNER_PROFILE')
    require(owner['superuser'] is False, 'OWNER_PROFILE')
    pg = _one(catalog['namespaces'], lambda node: node['nspname'] == 'pg_catalog', 'BUILTIN_NAMESPACE')
    heap = _one(catalog['access_methods'], lambda node: node['amname'] == 'heap', 'LEDGER_ACCESS_METHOD')
    tree = _one(catalog['access_methods'], lambda node: node['amname'] == 'btree', 'LEDGER_ACCESS_METHOD')
    require(heap == {'oid': '2', 'amname': 'heap', 'amhandler': 'heap_tableam_handler', 'amtype': 't'}
            and tree == {'oid': '403', 'amname': 'btree', 'amhandler': 'bthandler', 'amtype': 'i'},
            'LEDGER_ACCESS_METHOD')
    allowed = {'16', '17', '18', '19', '20', '21', '23', '25', '26', '700', '701',
               '1042', '1043', '1082', '1083', '1114', '1184', '1186', '1266',
               '1700', '2950', '114', '3802', '1009'}
    for name in ('drizzle.__drizzle_migrations', 'supabase_migrations.schema_migrations'):
        relation = _one(catalog['relations'], lambda node: node['qualified_name'] == name, 'LEDGER_ROOT')
        meta = relation['metadata']
        require(meta['relkind'] == 'r' and meta['relam'] == heap['oid']
                and meta['relowner'] == owner['oid'] and meta['relpersistence'] == 'p'
                and not any(meta[key] for key in ('relrowsecurity', 'relforcerowsecurity', 'relhasrules',
                                                  'relhastriggers', 'relispartition', 'relhassubclass'))
                and meta['reloftype'] == '0' and meta['relrewrite'] == '0' and meta['relchecks'] == 0,
                'LEDGER_ROOT')
        require(not any(node['inhrelid'] == meta['oid'] or node['inhparent'] == meta['oid']
                        for node in catalog['inheritance']), 'LEDGER_INHERITANCE')
        require(not any(node['metadata']['tgrelid'] == meta['oid'] for node in catalog['triggers'])
                and not any(node['metadata']['ev_class'] == meta['oid'] for node in catalog['rules'])
                and not any(node['metadata']['polrelid'] == meta['oid'] for node in catalog['policies']),
                'LEDGER_BEHAVIOR')
        attrs = [node['metadata'] for node in catalog['attributes']
                 if node['metadata']['attrelid'] == meta['oid'] and node['metadata']['attnum'] > 0]
        require(len(attrs) == meta['relnatts'] and all(not node['attisdropped']
                and node['attidentity'] == '' and node['attgenerated'] == ''
                and node['attinhcount'] == 0 and node['attislocal'] is True
                and node['atttypid'] in allowed and node['atttypmod'] == -1 for node in attrs), 'LEDGER_COLUMNS')
        for attr in attrs:
            typ = _one(catalog['types'], lambda node: node['metadata']['oid'] == attr['atttypid'], 'LEDGER_BUILTIN_TYPE')
            require(typ['metadata']['typnamespace'] == pg['oid'] and typ['metadata']['typtype'] == 'b'
                    and typ['metadata']['typbasetype'] == '0', 'LEDGER_BUILTIN_TYPE')
        constraints = [node['metadata'] for node in catalog['constraints']
                       if node['metadata']['conrelid'] == meta['oid'] or node['metadata']['confrelid'] == meta['oid']]
        require(all(node['conrelid'] == meta['oid'] and node['confrelid'] == '0'
                    and node['contype'] in ('p', 'u') and not node['condeferrable']
                    and not node['condeferred'] and node['convalidated'] and node['conparentid'] == '0'
                    for node in constraints), 'LEDGER_CONSTRAINTS')
        indexes = [node for node in catalog['indexes'] if node['metadata']['indrelid'] == meta['oid']]
        require(indexes, 'LEDGER_INDEXES')
        for idx in indexes:
            im = idx['metadata']
            ir = _one(catalog['relations'], lambda node: node['metadata']['oid'] == im['indexrelid'], 'LEDGER_INDEXES')
            require(ir['metadata']['relkind'] == 'i' and ir['metadata']['relam'] == tree['oid']
                    and idx['expressions_is_null'] and idx['predicate_is_null']
                    and all(im[key] for key in ('indisvalid', 'indisready', 'indislive', 'indimmediate'))
                    and not im['indisexclusion'] and im['indnatts'] == im['indnkeyatts']
                    and len(im['indkey']) == len(im['indclass']) == len(im['indcollation']) == im['indnatts']
                    and all(type(number) is int and number > 0 for number in im['indkey']), 'LEDGER_INDEXES')
            for number, class_oid in zip(im['indkey'], im['indclass']):
                attr = _one(attrs, lambda node: node['attnum'] == number, 'LEDGER_INDEX_COLUMN')
                op = _one(catalog['operator_classes'], lambda node: node['oid'] == class_oid, 'LEDGER_OPERATOR_CLASS')
                family = _one(catalog['operator_families'], lambda node: node['oid'] == op['opcfamily'], 'LEDGER_OPERATOR_FAMILY')
                require(op['opcnamespace'] == pg['oid'] and op['opcmethod'] == tree['oid']
                        and op['opcintype'] == attr['atttypid'] and op['opckeytype'] == '0'
                        and family['opfnamespace'] == pg['oid'] and family['opfmethod'] == tree['oid'],
                        'LEDGER_OPERATOR_CLASS')
        if name.startswith('drizzle.'):
            require([(node['attname'], node['atttypid'], node['attnotnull'], node['atthasdef']) for node in attrs]
                    == [('id', '23', True, True), ('hash', '25', True, False), ('created_at', '20', False, False)],
                    'DRIZZLE_COLUMNS')
            require(len(constraints) == 1 and constraints[0]['contype'] == 'p'
                    and constraints[0]['conkey'] == [1] and len(indexes) == 1
                    and indexes[0]['metadata']['indisprimary'] and indexes[0]['metadata']['indkey'] == [1],
                    'DRIZZLE_PRIMARY_KEY')
        else:
            require(sum(node['attname'] == 'version' and node['atttypid'] == '25'
                        and node['attnotnull'] for node in attrs) == 1, 'SUPABASE_VERSION_COLUMN')


def _json_hex(value):
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode('utf8').hex()


def _capture_sql(number):
    name = ('01_discovery.sql', '02_scoped_catalog.sql', '03_drizzle_history.sql', '04_supabase_manifest.sql')[number - 1]
    raw = (CAPTURE / name).read_bytes()
    key = 'scripts/ci/crm-canonical-review/operational-capture/' + name
    require(hashlib.sha256(raw).hexdigest() == gate.INPUT_SHA256[key], 'PUBLIC_CAPTURE_PIN')
    sql = raw.decode('utf8').strip()
    require(sql.endswith(';'), 'PUBLIC_CAPTURE_SHAPE')
    # Discovery contains a generated SQL *string*, hence internal semicolons;
    # only the final terminator is removed. It is never executed from input.
    return sql[:-1]


def _capture(number, target, capture='v_capture'):
    return ('SELECT q.crm_evidence->\'result\',q.crm_evidence->\'capture\' INTO ' + target + ',' + capture
            + ' FROM (\n' + _capture_sql(number) + '\n) AS q;\n')


def _handler(bundle):
    catalog = bundle['catalog']['result']
    namespace = _one(catalog['namespaces'], lambda node: node['nspname'] == 'extensions', 'HANDLER_NAMESPACE')
    node = _one(catalog['functions'], lambda node: node['metadata']['pronamespace'] == namespace['oid']
                and node['metadata']['proname'] == 'pgrst_ddl_watch', 'HANDLER_BINDING')
    require(node['source_sha256'] == BODY_SHA256 and node['metadata']['pronargs'] == 0
            and node['metadata']['proargtypes'] == [] and not node['metadata']['prosecdef'], 'HANDLER_BINDING')
    require(any(event['evtfoid'] == node['metadata']['oid'] and event['evtevent'] == 'ddl_command_end'
                and event['evtenabled'] == 'O' and event['evttags'] is None
                for event in catalog['event_triggers']), 'HANDLER_EVENT')
    return node


def _bindings_select(handler_oid):
    require(type(handler_oid) is str and re.fullmatch(r'[1-9][0-9]*', handler_oid) is not None, 'HANDLER_IDENTITY')
    # Resolve the PUBLIC qualified signature anew. Its measured identity in the
    # expected auxiliary result catches replacement. No private OID, expression,
    # deparse, captured query or state_select is interpolated into this SELECT.
    # Explicit types avoid any pg_proc/pg_type row-to-JSON implementation
    # ambiguity. These static lists cover all 30/32 PostgreSQL 17 fields.
    function_fields = ('oid proowner pronamespace prolang provariadic prorettype').split()
    function_plain = ('proname prokind prosecdef proleakproof proisstrict proretset provolatile proparallel '
        'pronargs pronargdefaults procost prorows proargmodes proargnames proconfig proacl prosrc probin').split()
    function_parts = ["'" + name + "',p." + name + '::pg_catalog.text' for name in function_fields]
    function_parts += ["'" + name + "',p." + name for name in function_plain]
    function_parts += ["'prosupport',p.prosupport::pg_catalog.text",
        "'proargdefaults',p.proargdefaults::pg_catalog.text", "'prosqlbody',p.prosqlbody::pg_catalog.text"]
    for name in ('proargtypes', 'proallargtypes', 'protrftypes'):
        array = ('p.' + name + '::pg_catalog.oid[]')
        aggregate = ("(SELECT COALESCE(pg_catalog.jsonb_agg(x.value::pg_catalog.text ORDER BY x.n),'[]'::pg_catalog.jsonb) "
                     'FROM pg_catalog.unnest(' + array + ') WITH ORDINALITY AS x(value,n))')
        if name != 'proargtypes':
            aggregate = 'CASE WHEN p.' + name + ' IS NULL THEN NULL ELSE ' + aggregate + ' END'
        function_parts.append("'" + name + "'," + aggregate)
    function_object = 'pg_catalog.jsonb_build_object(' + ','.join(function_parts) + ')'
    type_oids = ('oid typnamespace typowner typrelid typelem typarray typbasetype typcollation').split()
    type_routines = ('typsubscript typinput typoutput typreceive typsend typmodin typmodout typanalyze').split()
    type_plain = ('typname typlen typbyval typtype typcategory typispreferred typisdefined typdelim '
        'typalign typstorage typnotnull typtypmod typndims typdefault typacl').split()
    type_parts = ["'" + name + "',t." + name + '::pg_catalog.text' for name in type_oids + type_routines]
    type_parts += ["'" + name + "',t." + name for name in type_plain]
    type_parts.append("'typdefaultbin',t.typdefaultbin::pg_catalog.text")
    type_object = 'pg_catalog.jsonb_build_object(' + ','.join(type_parts) + ')'
    return """SELECT pg_catalog.jsonb_build_object(
 'kind','crm-transaction-bindings-v1','admission','NOT_ADMITTED',
 'capture',pg_catalog.jsonb_build_object(
  'captured_at',pg_catalog.clock_timestamp(),'statement_at',pg_catalog.statement_timestamp(),
  'database',pg_catalog.current_database(),'database_oid',(SELECT oid::pg_catalog.text FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database()),
  'backend_pid',pg_catalog.pg_backend_pid(),'snapshot',pg_catalog.pg_current_snapshot()::pg_catalog.text,
  'xid_if_assigned',pg_catalog.pg_current_xact_id_if_assigned()::pg_catalog.text,'user',CURRENT_USER,'session_user',SESSION_USER),
 'result',pg_catalog.jsonb_build_object(
  'functions',(SELECT pg_catalog.jsonb_agg(__FUNCTION_OBJECT__ ORDER BY p.oid) FROM pg_catalog.pg_proc p
   WHERE p.oid IN (pg_catalog.to_regprocedure('pg_catalog.nextval(pg_catalog.regclass)'),
                  pg_catalog.to_regprocedure('pg_catalog.int4(pg_catalog.int8)'),
                  pg_catalog.to_regprocedure('pg_catalog.pg_event_trigger_ddl_commands()'))),
  'regclass',(SELECT __TYPE_OBJECT__ FROM pg_catalog.pg_type t WHERE t.oid=pg_catalog.to_regtype('pg_catalog.regclass')),
  'handler',(SELECT pg_catalog.jsonb_build_object('oid',p.oid::pg_catalog.text,'config',p.proconfig)
    FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure('extensions.pgrst_ddl_watch()')))) AS crm_bindings""".replace('__FUNCTION_OBJECT__', function_object).replace('__TYPE_OBJECT__', type_object)


def semantic_witness_sql(bundle):
    """A generic SELECT for a separate private auxiliary binding observation.

    This performs no SQL or IO and supplies no approval. The parent can run it
    in its existing read-only capture workflow; actual results remain private.
    It returns a fresh own capture record instead of inventing missing fields
    for older preparation snippets. It never scans stored application data.
    """
    try:
        return _bindings_select(_handler(bundle)['metadata']['oid']) + ';\n'
    except TransactionError:
        raise
    except Exception:
        raise TransactionError('CRM_TRANSACTION_BINDINGS_INPUT') from None


def _pg_text_array(values):
    if values is None:
        return '<NULL>'
    require(type(values) is list and all(type(value) is str and '\x00' not in value for value in values), 'HANDLER_CONFIG')
    def encode(value):
        if not value or value.upper() == 'NULL' or re.search(r'[\s{},"\\]', value):
            return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'
        return value
    return '{' + ','.join(encode(value) for value in values) + '}'


def _bindings(witness, bundle):
    """Strict auxiliary shape and public builtin semantics, with exact types.

    No schema-validation claim is made for this separate protocol. Every field
    of these fixed PostgreSQL 17 builtin records is compared to an explicit
    public semantic profile; the full raw result is then rechecked in SQL.
    """
    if type(witness) in (str, bytes):
        witness = evidence.load_bundle(witness)
    else:
        witness = copy.deepcopy(witness)
    require(type(witness) is dict and witness.keys() == {'kind', 'admission', 'capture', 'result'}
            and witness['kind'] == 'crm-transaction-bindings-v1' and witness['admission'] == 'NOT_ADMITTED', 'BINDINGS_SHAPE')
    capture = witness['capture']
    require(type(capture) is dict and capture.keys() == bundle['discovery']['capture'].keys(), 'BINDINGS_CAPTURE')
    # Retain each capture's own timestamp/PID/snapshot. Matching identity never
    # asserts that this later observation shares the catalog capture snapshot.
    for key in ('database', 'database_oid', 'user', 'session_user'):
        require(type(capture[key]) is str and capture[key] == bundle['discovery']['capture'][key], 'BINDINGS_CAPTURE')
    require(type(capture['backend_pid']) is int and 0 < capture['backend_pid'] <= 2147483647
            and type(capture['snapshot']) is str and re.fullmatch(r'[0-9]+:[0-9]+:[0-9,]*', capture['snapshot']) is not None
            and capture['xid_if_assigned'] is None, 'BINDINGS_CAPTURE')
    for key in ('captured_at', 'statement_at'):
        require(type(capture[key]) is str and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)', capture[key]) is not None,
                'BINDINGS_CAPTURE')
    require(evidence._timestamp(capture['statement_at']) <= evidence._timestamp(capture['captured_at']),
            'BINDINGS_CAPTURE')
    parts = capture['snapshot'].split(':')
    numbers = parts[:2] + (parts[2].split(',') if parts[2] else [])
    require(all(re.fullmatch(r'0|[1-9][0-9]*', number) is not None and int(number) <= 18446744073709551615
                for number in numbers), 'BINDINGS_CAPTURE')
    xmin, xmax = map(int, parts[:2])
    active = [int(number) for number in parts[2].split(',')] if parts[2] else []
    require(xmin <= xmax and active == sorted(set(active))
            and all(xmin <= number < xmax for number in active), 'BINDINGS_CAPTURE')
    result = witness['result']
    require(type(result) is dict and result.keys() == {'functions', 'regclass', 'handler'}, 'BINDINGS_SHAPE')
    catalog = bundle['catalog']['result']
    pg = _one(catalog['namespaces'], lambda node: node['nspname'] == 'pg_catalog', 'BUILTIN_NAMESPACE')
    common = dict(proacl=None, proallargtypes=None, proargdefaults=None, proargmodes=None,
        proargnames=None, probin=None, proconfig=None, procost=1, proisstrict=True, prokind='f',
        prolang='12', proleakproof=False, pronamespace=pg['oid'], pronargdefaults=0,
        proowner=pg['nspowner'], proretset=False, prorows=0, prosecdef=False, prosqlbody=None,
        prosupport='-', protrftypes=None, provariadic='0')
    profiles = {
        'int4': dict(proargtypes=['20'], pronargs=1, proparallel='s', prorettype='23', prosrc='int84', provolatile='i'),
        'nextval': dict(proargtypes=['2205'], pronargs=1, proparallel='u', prorettype='20', prosrc='nextval_oid', provolatile='v'),
        'pg_event_trigger_ddl_commands': dict(proargtypes=[], pronargs=0, proparallel='r', prorettype='2249',
            prosrc='pg_event_trigger_ddl_commands', provolatile='s', procost=10, proretset=True, prorows=100,
            proallargtypes=['26','26','23','25','25','25','25','16','32'],
            proargmodes=['o'] * 9,
            proargnames=['classid','objid','objsubid','command_tag','object_type','schema_name','object_identity','in_extension','command']),
    }
    require(type(result['functions']) is list and len(result['functions']) == 3, 'BUILTIN_FUNCTIONS')
    require([int(row['oid']) for row in result['functions']] == sorted({int(row['oid']) for row in result['functions']}), 'BUILTIN_FUNCTIONS')
    for name, profile in profiles.items():
        row = _one(result['functions'], lambda node: node.get('proname') == name, 'BUILTIN_FUNCTIONS')
        expected = {**common, **profile, 'proname': name, 'oid': row['oid']}
        require(type(row['oid']) is str and re.fullmatch(r'[1-9][0-9]*', row['oid']) is not None
                and comparator._same(row, expected), 'BUILTIN_FUNCTION_PROFILE')
    expected_type = dict(oid='2205', typacl=None, typalign='i', typanalyze='-', typarray='2210', typbasetype='0',
        typbyval=True, typcategory='N', typcollation='0', typdefault=None, typdefaultbin=None, typdelim=',',
        typelem='0', typinput='regclassin', typisdefined=True, typispreferred=False, typlen=4, typmodin='-',
        typmodout='-', typname='regclass', typnamespace=pg['oid'], typndims=0, typnotnull=False,
        typoutput='regclassout', typowner=pg['nspowner'], typreceive='regclassrecv', typrelid='0',
        typsend='regclasssend', typstorage='p', typsubscript='-', typtype='b', typtypmod=-1)
    require(comparator._same(result['regclass'], expected_type), 'BUILTIN_REGCLASS_PROFILE')
    handler = _handler(bundle)
    observed = result['handler']
    require(type(observed) is dict and observed.keys() == {'oid', 'config'}
            and observed['oid'] == handler['metadata']['oid'], 'HANDLER_CONFIG')
    config = observed['config']
    require((config is None) is handler['config_is_null']
            and hashlib.sha256(_pg_text_array(config).encode('utf8')).hexdigest() == handler['config_sha256'], 'HANDLER_CONFIG')
    return result, handler['metadata']['oid']


def _prepared(candidate, bundle, validate_projection, semantic_witness):
    try:
        require(type(candidate) is bytes and hashlib.sha256(candidate).hexdigest() == CANONICAL_SHA256,
                'CANONICAL_BYTES')
        require(candidate.decode('utf8').encode('utf8') == candidate, 'CANONICAL_UTF8')
        require(callable(validate_projection), 'VALIDATOR_REQUIRED')
        gate.verify_inputs()
        value = evidence.load_bundle(bundle) if type(bundle) in (str, bytes) else copy.deepcopy(bundle)
        result = offline_review.review(value, validate_projection=validate_projection)
        require(result['status'] == 'PASS_REVIEW_ONLY' and result['admission'] == 'NOT_ADMITTED', 'BASELINE_REVIEW')
        _ledger_read_profile(value)
        context = value['discovery']['result']['context']
        require(context['server_version_num'] == '170006' and context['server_encoding'] == 'UTF8'
                and context['client_encoding'] == 'UTF8' and context['isolation'] == 'read committed'
                and context['transaction_read_only'] in ('on', 'off') and context['row_security'] == 'on'
                and context['session_replication_role'] == 'origin' and context['in_recovery'] is False,
                'EXECUTION_PROFILE')
        require(value['discovery']['capture']['user'] == value['discovery']['capture']['session_user'] == 'postgres',
                'EXECUTION_PROFILE')
        auxiliary, handler_oid = _bindings(semantic_witness, value)
        target, _ = comparator._helper_postimage(value)
        sequence = _one(value['catalog']['result']['relations'], lambda node:
                        node['metadata']['oid'] == value['discovery']['result']['sequence']['oid'], 'SEQUENCE_RELATION')
        namespace = _one(value['catalog']['result']['namespaces'], lambda node:
                         node['oid'] == sequence['metadata']['relnamespace'], 'SEQUENCE_NAMESPACE')
        old_value, called = comparator._sequence_profile(value)
        return value, target, dict(namespace=namespace['nspname'], name=sequence['metadata']['relname'],
                                   oid=sequence['metadata']['oid']), old_value, called, auxiliary, handler_oid
    except TransactionError:
        raise
    except Exception:
        raise TransactionError('CRM_TRANSACTION_BASELINE_REJECTED') from None


def _sequence_capture():
    # The relation identifier is freshly quoted from validated catalog nodes;
    # never concatenate or execute discovery.sequence.state_select.
    return """IF pg_catalog.to_regclass(pg_catalog.format('%I.%I',v_sequence->>'namespace',v_sequence->>'name'))::pg_catalog.oid
         IS DISTINCT FROM (v_sequence->>'oid')::pg_catalog.oid
     OR (SELECT oid::pg_catalog.text FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())
         IS DISTINCT FROM v_contract->'identity'->>'database_oid' THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_SEQUENCE_IDENTITY';
  END IF;
  EXECUTE pg_catalog.format('SELECT pg_catalog.jsonb_build_object(''last_value'',last_value::pg_catalog.text,''is_called'',is_called) FROM %I.%I',
          v_sequence->>'namespace',v_sequence->>'name') INTO v_sequence_now;
"""


def _identity_check():
    return """IF pg_catalog.current_database() IS DISTINCT FROM v_contract->'identity'->>'database'
     OR CURRENT_USER IS DISTINCT FROM v_contract->'identity'->>'user'
     OR SESSION_USER IS DISTINCT FROM v_contract->'identity'->>'session_user'
     OR (SELECT oid::pg_catalog.text FROM pg_catalog.pg_database WHERE datname=pg_catalog.current_database())
         IS DISTINCT FROM v_contract->'identity'->>'database_oid' THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_CAPTURE_IDENTITY';
  END IF;
"""


def _context_check(post=False):
    expected = "v_contract->'discovery'"
    if post:
        expected = "pg_catalog.jsonb_set(pg_catalog.jsonb_set(v_contract->'discovery','{context,lock_timeout}','\"3s\"'::pg_catalog.jsonb),'{context,statement_timeout}','\"20s\"'::pg_catalog.jsonb)"
    return (_capture(1, 'v_now') + 'IF v_now IS DISTINCT FROM ' + expected + " THEN\n"
            "    RAISE EXCEPTION 'CRM_TRANSACTION_PREIMAGE_CONTEXT';\n  END IF;\n")


def _catalog_check(target):
    return (_capture(2, 'v_now') + "IF v_now IS DISTINCT FROM v_contract->'" + target + "' THEN\n"
            "    RAISE EXCEPTION 'CRM_TRANSACTION_PREIMAGE_CATALOG';\n  END IF;\n")


def _supa_check():
    return (_capture(4, 'v_now') + """IF v_now IS DISTINCT FROM v_contract->'supabase'
     OR v_capture->'format_settings' IS DISTINCT FROM v_contract->'format_settings' THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_PREIMAGE_SUPABASE';
  END IF;
""")


def _core(candidate, prepared, fault=None):
    value, target, sequence, old_value, called, auxiliary, handler_oid = prepared
    discovery = copy.deepcopy(value['discovery']['result'])
    # Explicit supported execution profile, not silent normalization: captured
    # READ ONLY may be on; a mutation transaction must be off. Entry search_path
    # is checked exactly first, then locally bound to pg_catalog for safe type
    # and function resolution. Every other captured context field is preserved.
    discovery['context']['transaction_read_only'] = 'off'
    discovery['context']['search_path'] = 'pg_catalog'
    # A statement deadline must already be set by the transport BEFORE this
    # outer DO. set_config inside the canonical nested DO cannot establish the
    # deadline for its enclosing running query. This tested profile is explicit;
    # observed preparation timeout values are not silently called approval.
    discovery['context']['statement_timeout'] = '20s'
    discovery['context']['lock_timeout'] = '3s'
    contract = dict(identity={key: value['discovery']['capture'][key]
                              for key in ('database', 'database_oid', 'user', 'session_user')},
        discovery=discovery, entry_search_path=value['discovery']['result']['context']['search_path'],
        catalog=value['catalog']['result'], target_catalog=target, sequence=sequence,
        sequence_state=value['sequence_state']['result']['sequence_state'],
        drizzle=value['drizzle_history']['result'], supabase=value['supabase_manifest_before']['result'],
        format_settings=value['supabase_manifest_before']['capture']['format_settings'], auxiliary=auxiliary)
    core = """v_contract := pg_catalog.convert_from(pg_catalog.decode('__CONTRACT_HEX__','hex'),'UTF8')::pg_catalog.jsonb;
  v_sequence := v_contract->'sequence';
  __IDENTITY__
  IF pg_catalog.current_setting('server_version_num') <> '170006'
     OR pg_catalog.current_setting('transaction_isolation') <> 'read committed'
     OR pg_catalog.current_setting('transaction_read_only') <> 'off'
     OR pg_catalog.current_setting('statement_timeout') <> '20s'
     OR pg_catalog.current_setting('lock_timeout') <> '3s'
     OR CURRENT_USER <> 'postgres' OR SESSION_USER <> 'postgres'
     OR (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
     OR pg_catalog.current_setting('search_path') IS DISTINCT FROM v_contract->>'entry_search_path' THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_EXECUTION_PROFILE';
  END IF;
  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);

  -- Ordered locks fence ledgers and the CRM relation; NOWAIT fails on contention.
  -- They do not exclude an independent owner ACL writer or direct nextval caller.
  LOCK TABLE ONLY drizzle.__drizzle_migrations IN SHARE ROW EXCLUSIVE MODE NOWAIT;
  LOCK TABLE ONLY supabase_migrations.schema_migrations IN SHARE MODE NOWAIT;
  LOCK TABLE ONLY public.crm_empresas IN SHARE UPDATE EXCLUSIVE MODE NOWAIT;
  __IDENTITY__
  __CONTEXT_PRE__
  -- Metadata equality comes BEFORE every ledger data read. A stale unsafe
  -- relation/default/trigger/policy never becomes a recaptured baseline.
  __CATALOG_PRE__
  __BINDINGS__
  __DRIZZLE_PRE_CAPTURE__
  IF v_now IS DISTINCT FROM v_contract->'drizzle' THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_PREIMAGE_DRIZZLE';
  END IF;
  __SUPA__
  __SEQUENCE__
  IF v_sequence_now IS DISTINCT FROM v_contract->'sequence_state' THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_PREIMAGE_SEQUENCE';
  END IF;
  v_next := (v_sequence_now->>'last_value')::pg_catalog.int8 +
    CASE WHEN (v_sequence_now->>'is_called')::pg_catalog.bool THEN 1 ELSE 0 END;
  SELECT pg_catalog.count(*) INTO v_matches
    FROM pg_catalog.jsonb_array_elements(v_contract->'drizzle'->'rows') AS x(row)
    WHERE row->>'hash'='__PAYLOAD_SHA__' OR (row->>'created_at')::pg_catalog.int8=__WHEN__;
  IF v_matches > 0 THEN
    IF v_matches <> 1 OR v_contract->'catalog' IS DISTINCT FROM v_contract->'target_catalog'
       OR NOT EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_contract->'drizzle'->'rows') WITH ORDINALITY AS x(row,n)
          WHERE row->>'hash'='__PAYLOAD_SHA__' AND (row->>'created_at')::pg_catalog.int8=__WHEN__
            AND n=pg_catalog.jsonb_array_length(v_contract->'drizzle'->'rows')) THEN
      RAISE EXCEPTION 'CRM_TRANSACTION_REGISTRATION_CONFLICT';
    END IF;
    -- Registered replay validates terminal state and returns before payload
    -- decoding, either REVOKE, INSERT or sequence allocation. No repair exists.
    __CATALOG_PRE__
    __BINDINGS__
    __DRIZZLE_PRE_CAPTURE__
    IF v_now IS DISTINCT FROM v_contract->'drizzle' THEN
      RAISE EXCEPTION 'CRM_TRANSACTION_PREIMAGE_DRIZZLE';
    END IF;
    __SUPA__
    __SEQUENCE__
    IF v_sequence_now IS DISTINCT FROM v_contract->'sequence_state' THEN
      RAISE EXCEPTION 'CRM_TRANSACTION_PREIMAGE_SEQUENCE';
    END IF;
    __CONTEXT_PRE__
    RAISE NOTICE 'TEST_ONLY_TRANSACTION_REGISTERED_READ_ONLY';
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_contract->'drizzle'->'rows') AS x(row)
             WHERE (row->>'created_at')::pg_catalog.int8 >= __WHEN__) THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_REGISTRATION_CONFLICT';
  END IF;
  IF v_next > 2147483647 THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_SEQUENCE_EXHAUSTED';
  END IF;

  v_payload := pg_catalog.decode('__PAYLOAD_HEX__','hex');
  IF pg_catalog.encode(pg_catalog.sha256(v_payload),'hex') <> '__PAYLOAD_SHA__' THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_CANONICAL_SHA256';
  END IF;
  v_sql := pg_catalog.convert_from(v_payload,'UTF8');
  IF pg_catalog.convert_to(v_sql,'UTF8') IS DISTINCT FROM v_payload THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_CANONICAL_UTF8';
  END IF;
  -- Execute exact canonical bytes as an unchanged nested atomic DO.
  EXECUTE v_sql;
  __CATALOG_POST__
  __BINDINGS__
  __CONTEXT_POST__
  __SUPA__
  __DRIZZLE_PRE_CAPTURE__
  IF v_now IS DISTINCT FROM v_contract->'drizzle' THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_PREIMAGE_DRIZZLE';
  END IF;
  __SEQUENCE__
  IF v_sequence_now IS DISTINCT FROM v_contract->'sequence_state' THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_PREIMAGE_SEQUENCE';
  END IF;

  -- ID is OMITTED. Only the existing reviewed default allocates it.
  INSERT INTO drizzle.__drizzle_migrations(hash,created_at)
    VALUES ('__PAYLOAD_SHA__',__WHEN__)
    RETURNING pg_catalog.jsonb_build_object('id',id,'hash',hash,'created_at',created_at) INTO v_returned;
  RAISE NOTICE 'TEST_ONLY_DEFAULT_INSERT:%',v_returned;
  __FAULT__
  IF v_returned->>'hash' <> '__PAYLOAD_SHA__' OR (v_returned->>'created_at')::pg_catalog.int8 <> __WHEN__
     OR (v_returned->>'id')::pg_catalog.int8 <> v_next THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_RETURNING_MISMATCH';
  END IF;
  -- Recompute row and whole-history commitments with PostgreSQL JSONB text,
  -- matching the pinned server projection; Python JSON hashes are never used.
  v_rows := (v_contract->'drizzle'->'rows') || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
    'id',v_returned->>'id','hash',v_returned->>'hash','created_at',v_returned->>'created_at',
    'hash_is_canonical_format',true,
    'hash_value_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_returned->>'hash','UTF8')),'hex'),
    'row_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_returned::pg_catalog.text,'UTF8')),'hex')));
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
       'id',(row->>'id')::pg_catalog.int4,'hash',row->>'hash',
       'created_at',(row->>'created_at')::pg_catalog.int8) ORDER BY (row->>'id')::pg_catalog.int4),'[]'::pg_catalog.jsonb)
    INTO v_scalars FROM pg_catalog.jsonb_array_elements(v_rows) AS x(row);
  v_expected_history := pg_catalog.jsonb_set(pg_catalog.jsonb_set(pg_catalog.jsonb_set(v_contract->'drizzle',
    '{rows}',v_rows),'{row_count}',pg_catalog.to_jsonb((pg_catalog.jsonb_array_length(v_rows))::pg_catalog.text)),
    '{history_sha256}',pg_catalog.to_jsonb(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_scalars::pg_catalog.text,'UTF8')),'hex')));

  __CATALOG_POST__
  __BINDINGS__
  __DRIZZLE_PRE_CAPTURE__
  IF v_now IS DISTINCT FROM v_expected_history THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_POSTIMAGE_DRIZZLE';
  END IF;
  __SUPA__
  __SEQUENCE__
  IF v_sequence_now IS DISTINCT FROM pg_catalog.jsonb_build_object('last_value',v_next::pg_catalog.text,'is_called',true) THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_POSTIMAGE_SEQUENCE';
  END IF;
  __CONTEXT_POST__
  __IDENTITY__
"""
    replacement = {'__CONTRACT_HEX__': _json_hex(contract), '__IDENTITY__': _identity_check(),
        '__CONTEXT_PRE__': _context_check(), '__CONTEXT_POST__': _context_check(post=True),
        '__CATALOG_PRE__': _catalog_check('catalog'), '__CATALOG_POST__': _catalog_check('target_catalog'),
        '__DRIZZLE_PRE_CAPTURE__': _capture(3, 'v_now'), '__SUPA__': _supa_check(),
        '__BINDINGS__': ('SELECT q.crm_bindings->\'result\' INTO v_now FROM (' + _bindings_select(handler_oid) + ') AS q;\n'
                         "  IF v_now IS DISTINCT FROM v_contract->'auxiliary' THEN\n"
                         "    RAISE EXCEPTION 'CRM_TRANSACTION_PREIMAGE_BINDINGS';\n  END IF;\n"),
        '__SEQUENCE__': _sequence_capture(), '__PAYLOAD_SHA__': CANONICAL_SHA256,
        '__PAYLOAD_HEX__': candidate.hex(), '__WHEN__': str(JOURNAL_WHEN),
        '__FAULT__': "RAISE EXCEPTION 'CRM_TRANSACTION_TEST_ONLY_AFTER_INSERT';" if fault else ''}
    for key, replacement_value in replacement.items():
        core = core.replace(key, replacement_value)
    require(re.search(r'__[A-Z_]+__', core) is None, 'INTERNAL_TEMPLATE')
    return core


def _wrap(core, fence):
    digest = hashlib.sha256(core.encode('utf8')).hexdigest()
    return ("-- NOT_ADMITTED transaction comparison experiment; no application mode.\n"
            "-- CRM_TRANSACTION_CORE_SHA256:" + digest + "\nDO $crm_transaction_review$\nDECLARE\n"
            "  v_contract pg_catalog.jsonb; v_sequence pg_catalog.jsonb;\n"
            "  v_now pg_catalog.jsonb; v_capture pg_catalog.jsonb; v_sequence_now pg_catalog.jsonb;\n"
            "  v_returned pg_catalog.jsonb; v_expected_history pg_catalog.jsonb;\n"
            "  v_rows pg_catalog.jsonb; v_scalars pg_catalog.jsonb;\n"
            "  v_payload pg_catalog.bytea; v_sql pg_catalog.text; v_matches pg_catalog.int8; v_next pg_catalog.int8;\n"
            "BEGIN\n  " + fence + "\n-- CRM_TRANSACTION_CORE_BEGIN\n" + core
            + "-- CRM_TRANSACTION_CORE_END\nEND\n$crm_transaction_review$;\n")


def render_transaction_proposal(candidate, bundle, *, validate_projection, semantic_witness):
    """Return private review SQL that ALWAYS raises before decoding constants.

    This adds no application flag. It is never an operational artifact. The
    return value contains private evidence and must stay out of Git/Actions.
    The caller alone owns its private storage; this function writes nothing.
    """
    prepared = _prepared(candidate, bundle, validate_projection, semantic_witness)
    return _wrap(_core(candidate, prepared), "RAISE EXCEPTION 'CRM_TRANSACTION_NOT_ADMITTED';")


def transaction_core_sha256(candidate, bundle, *, validate_projection, semantic_witness):
    """Witness identical normal-path core in fenced and synthetic experiments."""
    prepared = _prepared(candidate, bundle, validate_projection, semantic_witness)
    return hashlib.sha256(_core(candidate, prepared).encode('utf8')).hexdigest()


def render_synthetic_transaction(candidate, bundle, *, scope, validate_projection, semantic_witness, fault=None):
    """TEST_ONLY: same core, separately guarded for an owned synthetic fixture.

    The inherited owned runner must create/destroy that fixture; this function
    cannot connect to it. A synthetic-looking name is not target admission.
    This test-only API has no role-grant, event-disable or real endpoint mode.
    """
    require(type(scope) is str and scope == 'synthetic-ci', 'SYNTHETIC_SCOPE')
    require(fault is None or (type(fault) is str and fault == 'after_insert'), 'SYNTHETIC_FAULT')
    prepared = _prepared(candidate, bundle, validate_projection, semantic_witness)
    require(SYNTHETIC_DATABASE.fullmatch(prepared[0]['discovery']['capture']['database']) is not None,
            'SYNTHETIC_DATABASE')
    fence = """IF pg_catalog.current_database() !~ '^crm_acl_fixture_[a-z0-9_]+$'
     OR CURRENT_USER <> 'postgres' OR SESSION_USER <> 'postgres'
     OR pg_catalog.current_setting('server_version_num') <> '170006'
     OR (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER) THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_SYNTHETIC_CONTEXT';
  END IF;"""
    # The fixed TEST_ONLY prelude sets the deadline before the running DO.
    # The public renderer has no prelude and retains its unconditional RAISE.
    return ("SET statement_timeout='20s'; SET lock_timeout='3s';\n"
            + _wrap(_core(candidate, prepared, fault), fence))
