"""Offline renderer for disposable CI databases. No connection or application API.

The operational proposal stays fenced: synthetic facts are never private evidence.
The same single-DO protocol exercises exact canonical bytes and a real serial ledger.
"""
import copy
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SHA = '32173fdde2d456d6d9da8f46b54e38f4535b699b3ca36d921f93f444105fecc6'
WHEN = 1792093404000
NAMES = ('_crm_empresa_no_borrar_cliente', '_crm_empresa_no_delete_fisico')
BODY_HASHES = dict(zip(NAMES, (
    '035a8b240ef8c12fcb21136c15a238635b6ed051a7007da34d60c64f8bb494af',
    '1b094604d2ce83060257fdbfaf4e49440ce7c38dbf833b3fec1f5f69fe4c788c')))


def require(ok, message):
    if not ok:
        raise ValueError('CRM_DIRECT_' + message)


def json_sql(value):
    # Hex avoids SQL quoting/dollar-tag injection, including in catalog source text.
    raw = json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('utf8')
    return "pg_catalog.convert_from(pg_catalog.decode('" + raw.hex() + "','hex'),'UTF8')::jsonb"


def sequence_state_sql(name):
    # A measured qualified name, never an invented ID, next value or sequence name.
    require(isinstance(name, str) and re.fullmatch(r'[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*', name), 'SEQUENCE_NAME')
    schema, sequence = name.split('.')
    return ('SELECT pg_catalog.jsonb_build_object(\'last_value\',last_value,\'is_called\',is_called) '
            'FROM "' + schema + '"."' + sequence + '";')


def capture_sql():
    """Read-only capture query; caller must keep its independent DDL/ACL window.

    Sequence state is read separately with sequence_state_sql(measured_name).
    This query is not an authorization or a transport/commit proof.
    """
    catalog = (ROOT / 'snapshot.sql').read_text(encoding='utf8').strip().removesuffix(';')
    catalog = catalog.replace("('public','auth')", "('public','auth','drizzle','supabase_migrations')")
    extras = """
UNION ALL SELECT 'pg_sequence',coalesce(jsonb_agg(to_jsonb(x) ORDER BY seqrelid),'[]') FROM pg_catalog.pg_sequence x
UNION ALL SELECT 'pg_roles',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_catalog.pg_roles x
UNION ALL SELECT 'pg_language',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_catalog.pg_language x
UNION ALL SELECT 'pg_auth_members',coalesce(jsonb_agg(to_jsonb(x) ORDER BY roleid,member,grantor),'[]') FROM pg_catalog.pg_auth_members x
UNION ALL SELECT 'event_functions',coalesce(jsonb_agg(to_jsonb(x) ORDER BY oid),'[]') FROM pg_catalog.pg_proc x WHERE oid IN(SELECT evtfoid FROM pg_catalog.pg_event_trigger)
"""
    catalog = catalog.replace('\n) q', extras + ') q')
    catalog = catalog.replace("'relallvisible','relfrozenxid'", "'relallvisible','relallfrozen','relfrozenxid'")
    return """SELECT pg_catalog.jsonb_build_object(
 'context',pg_catalog.jsonb_build_object('database',current_database(),'user',current_user,
   'session_user',session_user,'superuser',(SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=current_user),
   'version',current_setting('server_version_num'),'isolation',current_setting('transaction_isolation')),
 'catalog',(""" + catalog + """),
 'drizzle',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.id),'[]') FROM drizzle.__drizzle_migrations d),
 'supabase',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.version),'[]') FROM supabase_migrations.schema_migrations s),
 'sequence_name',pg_catalog.pg_get_serial_sequence('drizzle.__drizzle_migrations','id'),
 'ledger_default',(SELECT pg_catalog.pg_get_expr(adbin,adrelid) FROM pg_catalog.pg_attrdef
   WHERE adrelid='drizzle.__drizzle_migrations'::regclass AND adnum=1));
"""


def normalized(catalog):
    value = copy.deepcopy(catalog)
    helpers = [p for p in value['pg_proc'] if p['proname'] in NAMES]
    oids = {str(p['oid']) for p in helpers}
    service = str(next(r['oid'] for r in value['pg_roles'] if r['rolname'] == 'service_role'))
    for p in helpers:
        p.pop('proacl')
    # Only the two service-role ACL dependencies may disappear, not other roles.
    value['pg_shdepend'] = [d for d in value['pg_shdepend'] if not (
        str(d['classid']) == '1255' and str(d['objid']) in oids and d['objsubid'] == 0
        and str(d['refclassid']) == '1260' and str(d['refobjid']) == service and d['deptype'] == 'a')]
    return value


def validate_contract(c):
    # Deliberate lab admission fence; no private or real target mode exists.
    require(c.get('scope') == 'synthetic-ci', 'SYNTHETIC_SCOPE_REQUIRED')
    ctx = c['context']
    require(re.fullmatch(r'crm_acl_fixture_[a-z0-9_]+', ctx['database']), 'DISPOSABLE_DATABASE_REQUIRED')
    require(ctx['user'] == ctx['session_user'] == 'postgres' and ctx['superuser'] is False
            and ctx['version'] == '170006' and ctx['isolation'] == 'read committed', 'CONTEXT')
    cat = c['catalog']
    postgres = next(x for x in cat['pg_roles'] if x['rolname'] == 'postgres')
    relations = {str(x['oid']): x for x in cat['pg_class']}
    dns = next(x for x in cat['pg_namespace'] if x['nspname'] == 'drizzle')
    ledger = next(x for x in relations.values() if x['relname'] == '__drizzle_migrations'
                  and str(x['relnamespace']) == str(dns['oid']))
    lid = str(ledger['oid'])
    require(str(ledger['relowner']) == str(dns['nspowner']) == str(postgres['oid']), 'LEDGER_OWNER')
    require(not cat['pg_event_trigger'], 'EVENT_TRIGGERS_UNSUPPORTED_IN_LAB')
    require(ledger['relkind'] == 'r' and not ledger['relispartition'] and not ledger['relrowsecurity']
            and not ledger['relforcerowsecurity'] and not ledger['relhasrules'] and not ledger['relhastriggers'], 'LEDGER_SHAPE')
    attrs = [a for a in cat['pg_attribute'] if str(a['attrelid']) == lid and a['attnum'] > 0]
    require([(a['attname'], str(a['atttypid'])) for a in attrs] == [('id', '23'), ('hash', '25'), ('created_at', '20')], 'LEDGER_COLUMNS')
    require(all(not a['attisdropped'] and not a['attidentity'] and not a['attgenerated'] for a in attrs)
            and attrs[0]['attnotnull'] and attrs[1]['attnotnull'], 'LEDGER_COLUMN_BEHAVIOR')
    require(not any(str(x['tgrelid']) == lid for x in cat['pg_trigger'])
            and not any(str(x['ev_class']) == lid for x in cat['pg_rewrite'])
            and not any(str(x['polrelid']) == lid for x in cat['pg_policy'])
            and not any(lid in (str(x['inhparent']), str(x['inhrelid'])) for x in cat['pg_inherits']), 'LEDGER_BEHAVIOR')
    constraints = [x for x in cat['pg_constraint'] if lid in (str(x['conrelid']), str(x['confrelid']))]
    require(len(constraints) == 1 and constraints[0]['contype'] == 'p' and constraints[0]['conkey'] == [1]
            and not constraints[0]['condeferrable'], 'LEDGER_CONSTRAINTS')
    indexes = [x for x in cat['pg_index'] if str(x['indrelid']) == lid]
    require(len(indexes) == 1 and indexes[0]['indisprimary'] and indexes[0]['indisvalid']
            and indexes[0]['indisready'] and indexes[0]['indislive'] and indexes[0]['indkey'] == [1]
            and indexes[0]['indexprs'] is None and indexes[0]['indpred'] is None, 'LEDGER_INDEXES')
    sequence_state_sql(c['sequence_name'])
    schema, name = c['sequence_name'].split('.')
    ns = next(x for x in cat['pg_namespace'] if x['nspname'] == schema)
    seq = next(x for x in relations.values() if x['relname'] == name and str(x['relnamespace']) == str(ns['oid']))
    sid = str(seq['oid'])
    require(seq['relkind'] == 'S' and seq['relowner'] == ledger['relowner'], 'SEQUENCE_OWNER')
    sm = next(x for x in cat['pg_sequence'] if str(x['seqrelid']) == sid)
    require(sm['seqcache'] == 1 and sm['seqincrement'] == 1 and sm['seqcycle'] is False
            and str(sm['seqtypid']) == '23', 'SEQUENCE_CONVENTION')
    require(any(str(d['classid']) == '1259' and str(d['objid']) == sid
                and str(d['refclassid']) == '1259' and str(d['refobjid']) == lid
                and d['refobjsubid'] == 1 and d['deptype'] == 'a' for d in cat['pg_depend']), 'SEQUENCE_OWNED_BY')
    defaults = [x for x in cat['pg_attrdef'] if str(x['adrelid']) == lid]
    require(len(defaults) == 1 and defaults[0]['adnum'] == 1, 'LEDGER_DEFAULTS')
    require(c['ledger_default'] == "nextval('" + c['sequence_name'] + "'::regclass)", 'BUILTIN_NEXTVAL_REQUIRED')
    rows = c['drizzle']
    require(all(set(x) == {'id', 'hash', 'created_at'} and type(x['id']) is int and x['id'] > 0
                and isinstance(x['hash'], str) and re.fullmatch('[0-9a-f]{64}', x['hash'])
                and type(x['created_at']) is int and 0 < x['created_at'] < WHEN and x['hash'] != SHA for x in rows), 'HISTORY_SHAPE')
    for key in ('id', 'hash', 'created_at'):
        require(len({x[key] for x in rows}) == len(rows), 'DUPLICATE_HISTORY')
    require(rows == sorted(rows, key=lambda x: x['id'])
            and [x['created_at'] for x in rows] == sorted(x['created_at'] for x in rows), 'HISTORY_ORDER')
    state = c['sequence_state']
    require(set(state) == {'last_value', 'is_called'} and type(state['last_value']) is int
            and type(state['is_called']) is bool, 'SEQUENCE_STATE')
    next_value = state['last_value'] + int(state['is_called'])
    require(sm['seqmin'] <= next_value <= sm['seqmax']
            and next_value > max([x['id'] for x in rows], default=0), 'SEQUENCE_BEHIND_HISTORY')
    helpers = [p for p in cat['pg_proc'] if p['proname'] in NAMES]
    require(len(helpers) == 2 and {p['proname'] for p in helpers} == set(NAMES), 'TARGET_IDENTITIES')
    public = next(x for x in cat['pg_namespace'] if x['nspname'] == 'public')
    language = next(x for x in cat['pg_language'] if x['lanname'] == 'plpgsql')
    expected = dict(prokind='f', pronargs=0, pronargdefaults=0, proargtypes=[],
                    proallargtypes=None, proargmodes=None, proargnames=None, proargdefaults=None,
                    protrftypes=None, prosupport='-', prosecdef=False, proleakproof=False,
                    proisstrict=False, proretset=False, provolatile='v', proparallel='u',
                    procost=100, prorows=0, proconfig=['search_path=public'], probin=None, prosqlbody=None)
    for p in helpers:
        require(all(p.get(k) == v for k, v in expected.items())
                and str(p['pronamespace']) == str(public['oid']) and str(p['proowner']) == str(postgres['oid'])
                and str(p['prolang']) == str(language['oid']) and str(p['prorettype']) == '2279'
                and str(p['provariadic']) == '0'
                and hashlib.sha256(p['prosrc'].encode('utf8')).hexdigest() == BODY_HASHES[p['proname']], 'TARGET_SOURCE_CONTRACT')
        require(p['proacl'] is not None and sorted(p['proacl']) in (
            ['postgres=X/postgres'], ['postgres=X/postgres', 'service_role=X/postgres']), 'TARGET_ACL_CONTRACT')
    crm = next(x for x in relations.values() if x['relname'] == 'crm_empresas'
               and str(x['relnamespace']) == str(public['oid']))
    cid = str(crm['oid'])
    require(crm['relkind'] == 'r' and not crm['relispartition'] and str(crm['relowner']) == str(postgres['oid'])
            and not any(cid in (str(x['inhparent']), str(x['inhrelid'])) for x in cat['pg_inherits']), 'TARGET_RELATION')
    deleted = next(x['attnum'] for x in cat['pg_attribute'] if str(x['attrelid']) == cid
                   and x['attname'] == 'deleted_at' and not x['attisdropped'])
    links = [x for x in cat['pg_trigger'] if str(x['tgfoid']) in {str(p['oid']) for p in helpers}]
    require(len(links) == 2, 'TARGET_LINKS')
    for p in helpers:
        ts = [t for t in links if str(t['tgfoid']) == str(p['oid'])]
        require(len(ts) == 1, 'TARGET_LINKS')
        t = ts[0]
        require(str(t['tgrelid']) == cid and t['tgname'] == 'trg' + p['proname']
                and t['tgtype'] == (19 if p['proname'] == NAMES[0] else 11)
                and t['tgattr'] == ([deleted] if p['proname'] == NAMES[0] else [])
                and t['tgenabled'] == 'O' and not t['tgisinternal'] and not t['tgdeferrable']
                and not t['tginitdeferred'] and t['tgnargs'] == 0 and t['tgargs'] == chr(92) + 'x'
                and all(str(t[k]) == '0' for k in ('tgconstraint', 'tgconstrrelid', 'tgconstrindid', 'tgparentid'))
                and all(t[k] is None for k in ('tgqual', 'tgoldtable', 'tgnewtable')), 'TARGET_LINK_CONTRACT')
    return next_value, helpers


def render(contract, candidate, *, fault=None):
    require(isinstance(candidate, bytes) and hashlib.sha256(candidate).hexdigest() == SHA, 'CANONICAL_BYTES')
    require(candidate.decode('utf8').encode('utf8') == candidate and b'\r' not in candidate, 'CANONICAL_ENCODING')
    require(fault in (None, 'after-insert'), 'FAULT_MODE')
    next_value, helpers = validate_contract(contract)
    capture = capture_sql().strip().removesuffix(';')
    state = sequence_state_sql(contract['sequence_name']).strip().removesuffix(';')
    oids = ','.join(str(int(p['oid'])) for p in helpers)
    service = int(next(x['oid'] for x in contract['catalog']['pg_roles'] if x['rolname'] == 'service_role'))
    norm = """SELECT pg_catalog.jsonb_set(pg_catalog.jsonb_set(v_now->'catalog','{pg_proc}',
 (SELECT jsonb_agg(CASE WHEN (value->>'oid')::oid=ANY(ARRAY[""" + oids + """]::oid[]) THEN value-'proacl' ELSE value END ORDER BY (value->>'oid')::oid)
  FROM pg_catalog.jsonb_array_elements(v_now->'catalog'->'pg_proc'))),'{pg_shdepend}',
 (SELECT coalesce(jsonb_agg(value ORDER BY (value->>'dbid')::oid,(value->>'classid')::oid,(value->>'objid')::oid,(value->>'objsubid')::integer,(value->>'refclassid')::oid,(value->>'refobjid')::oid,value->>'deptype'),'[]')
  FROM pg_catalog.jsonb_array_elements(v_now->'catalog'->'pg_shdepend')
  WHERE NOT ((value->>'classid')::oid=1255 AND (value->>'objid')::oid=ANY(ARRAY[""" + oids + """]::oid[])
    AND (value->>'objsubid')::integer=0 AND (value->>'refclassid')::oid=1260
    AND (value->>'refobjid')::oid=""" + str(service) + """ AND value->>'deptype'='a'))) INTO v_normal;
"""
    owner_check = """IF (SELECT count(*) FROM pg_catalog.pg_proc p WHERE p.oid=ANY(ARRAY[""" + oids + """]::oid[])
 AND p.proacl=ARRAY['postgres=X/postgres']::aclitem[]
 AND NOT pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
 AND NOT pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
 AND NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE'))<>2 THEN
 RAISE EXCEPTION 'CRM_DIRECT_OWNER_ONLY_POSTCONDITION'; END IF;
"""
    return """-- DISPOSABLE CI ONLY; operational proposal remains unadmitted.
DO $crm_direct_lab$
DECLARE
 v_expected constant jsonb := """ + json_sql(contract) + ";\n v_normal_expected constant jsonb := " + json_sql(normalized(contract['catalog'])) + ";\n" + """
 v_payload constant bytea := pg_catalog.decode('""" + candidate.hex() + """','hex');
 v_sql text; v_now jsonb; v_normal jsonb; v_before jsonb; v_rows jsonb;
 v_registered boolean; v_inserted jsonb; v_state jsonb; v_final_state jsonb; v_default text;
BEGIN
 IF current_database()<>v_expected->'context'->>'database'
    OR current_user<>'postgres' OR session_user<>'postgres'
    OR current_setting('transaction_isolation')<>'read committed'
    OR current_setting('server_encoding')<>'UTF8' OR current_setting('client_encoding')<>'UTF8'
    OR current_database() !~ '^crm_acl_fixture_[a-z0-9_]+$'
    OR current_setting('statement_timeout')::interval<=interval '0'
    OR current_setting('statement_timeout')::interval>interval '20 seconds' THEN
   RAISE EXCEPTION 'CRM_DIRECT_CONTEXT_OR_PREEXISTING_TIMEOUT'; END IF;
 PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
 LOCK TABLE ONLY drizzle.__drizzle_migrations IN SHARE ROW EXCLUSIVE MODE NOWAIT;
 LOCK TABLE ONLY supabase_migrations.schema_migrations IN SHARE MODE NOWAIT;
 LOCK TABLE ONLY public.crm_empresas IN SHARE UPDATE EXCLUSIVE MODE NOWAIT;
 """ + capture + " INTO v_now;\n" + state + " INTO v_state;\n" + """
 IF v_now->'context' IS DISTINCT FROM v_expected->'context'
   OR v_now->>'sequence_name' IS DISTINCT FROM v_expected->>'sequence_name'
   OR v_state IS DISTINCT FROM v_expected->'sequence_state'
   OR v_now->'supabase' IS DISTINCT FROM v_expected->'supabase' THEN
   RAISE EXCEPTION 'CRM_DIRECT_PREIMAGE'; END IF;
 SELECT pg_catalog.pg_get_expr(adbin,adrelid) INTO STRICT v_default FROM pg_catalog.pg_attrdef
 WHERE adrelid='drizzle.__drizzle_migrations'::regclass AND adnum=1;
 IF v_default IS DISTINCT FROM v_expected->>'ledger_default' THEN RAISE EXCEPTION 'CRM_DIRECT_DEFAULT'; END IF;
 v_before:=v_now->'drizzle';
 SELECT coalesce(jsonb_agg(value ORDER BY (value->>'id')::integer),'[]') INTO v_rows
 FROM pg_catalog.jsonb_array_elements(v_before) WHERE value->>'hash'<>'""" + SHA + "' AND (value->>'created_at')::bigint<>" + str(WHEN) + ";\n" + """
 IF v_rows IS DISTINCT FROM v_expected->'drizzle' THEN RAISE EXCEPTION 'CRM_DIRECT_HISTORY'; END IF;
 v_registered:=jsonb_array_length(v_before)=jsonb_array_length(v_rows)+1;
 IF v_registered THEN
   IF (SELECT count(*) FROM pg_catalog.jsonb_array_elements(v_before) WHERE value->>'hash'='""" + SHA + "' AND (value->>'created_at')::bigint=" + str(WHEN) + """
       AND (value->>'id')::integer>coalesce((SELECT max((r->>'id')::integer) FROM pg_catalog.jsonb_array_elements(v_rows) r),0)
       AND (value->>'id')::integer<=""" + str(next_value) + """ )<>1 THEN RAISE EXCEPTION 'CRM_DIRECT_CONFLICT'; END IF;
 """ + norm + """
   IF v_normal IS DISTINCT FROM v_normal_expected THEN RAISE EXCEPTION 'CRM_DIRECT_REGISTERED_METADATA'; END IF;
 """ + owner_check + """
 ELSE
   IF v_before IS DISTINCT FROM v_rows OR v_now->'catalog' IS DISTINCT FROM v_expected->'catalog' THEN
     RAISE EXCEPTION 'CRM_DIRECT_UNREGISTERED_PREIMAGE'; END IF;
   IF pg_catalog.encode(pg_catalog.sha256(v_payload),'hex')<>'""" + SHA + """' THEN RAISE EXCEPTION 'CRM_DIRECT_HASH'; END IF;
   v_sql:=pg_catalog.convert_from(v_payload,'UTF8');
   IF pg_catalog.convert_to(v_sql,'UTF8') IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'CRM_DIRECT_ROUNDTRIP'; END IF;
   EXECUTE v_sql;
 """ + capture + " INTO v_now;\n" + norm + """
   IF v_normal IS DISTINCT FROM v_normal_expected OR v_now->'drizzle' IS DISTINCT FROM v_before
      OR v_now->'supabase' IS DISTINCT FROM v_expected->'supabase' THEN RAISE EXCEPTION 'CRM_DIRECT_PREINSERT'; END IF;
 """ + owner_check + """
   INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES('""" + SHA + "'," + str(WHEN) + """
   ) RETURNING pg_catalog.jsonb_build_object('id',id,'hash',hash,'created_at',created_at) INTO v_inserted;
   IF v_inserted IS NULL OR (v_inserted->>'id')::integer<>""" + str(next_value) + """ THEN RAISE EXCEPTION 'CRM_DIRECT_INSERT_RESULT'; END IF;
 """ + ("RAISE EXCEPTION 'CRM_DIRECT_INJECTED_AFTER_INSERT';\n" if fault else '') + """
 END IF;
 """ + capture + " INTO v_now;\n" + state + " INTO v_final_state;\n" + norm + """
 IF v_normal IS DISTINCT FROM v_normal_expected OR v_now->'context' IS DISTINCT FROM v_expected->'context'
    OR v_now->'supabase' IS DISTINCT FROM v_expected->'supabase'
    OR v_now->'drizzle' IS DISTINCT FROM (CASE WHEN v_registered THEN v_before ELSE v_before||jsonb_build_array(v_inserted) END)
    OR v_final_state IS DISTINCT FROM (CASE WHEN v_registered THEN v_state ELSE jsonb_build_object('last_value',""" + str(next_value) + """,'is_called',true) END) THEN
   RAISE EXCEPTION 'CRM_DIRECT_FINAL'; END IF;
 """ + owner_check + """
 -- The enclosing transport must prove commit. DO success alone is insufficient.
 -- Never auto-register this envelope or write a Supabase ledger entry.
END
$crm_direct_lab$;
"""
