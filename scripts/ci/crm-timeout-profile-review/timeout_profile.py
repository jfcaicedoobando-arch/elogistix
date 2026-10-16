"""Separate 120s profile experiment. Original program and payload stay unchanged.

Public output always fails before local settings, constants, locks or effects.
The TEST_ONLY builder is limited to the owned fixture and cannot connect.
The immutable window is candidate validity, never authorization or an adapter
contract. An effective 120s deadline must be armed before the outer statement;
the canonical nested DO's visible 20s GUC does not re-arm that running deadline.
"""
import hashlib
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / 'crm-operational-events-review'))
import transaction_envelope as original
from transaction_envelope import (require, _prepared, _json_hex, _identity_check,
    _context_check, _catalog_check, _capture, _supa_check, _bindings_select,
    _sequence_capture, CANONICAL_SHA256, JOURNAL_WHEN)
import copy

PROFILE = 'CRM_120S_LOCAL_LOCK_3S_V1'
SYNTHETIC_DATABASE = re.compile(r'crm_acl_fixture_timeout_[a-z0-9_]+\Z')


@dataclass(frozen=True)
class CandidateWindow:
    not_before: str
    expires_at: str


def _checked_window(window):
    require(type(window) is CandidateWindow, 'TIMEOUT_WINDOW_TYPE')
    parsed = []
    for value in (window.not_before, window.expires_at):
        require(type(value) is str and re.fullmatch(
            r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z', value) is not None,
            'TIMEOUT_WINDOW_FORMAT')
        try:
            parsed.append(datetime.fromisoformat(value.replace('Z', '+00:00')))
        except ValueError:
            require(False, 'TIMEOUT_WINDOW_FORMAT')
    require(0 < (parsed[1] - parsed[0]).total_seconds() <= 600, 'TIMEOUT_WINDOW_DURATION')
    return window


def _window_check():
    return """v_now := pg_catalog.jsonb_build_object('now',pg_catalog.clock_timestamp());
  IF (v_now->>'now')::pg_catalog.timestamptz < (v_contract->'window'->>'not_before')::pg_catalog.timestamptz
     OR (v_now->>'now')::pg_catalog.timestamptz >= (v_contract->'window'->>'expires_at')::pg_catalog.timestamptz THEN
    RAISE EXCEPTION 'CRM_TIMEOUT_CANDIDATE_EXPIRED_OR_NOT_YET_VALID';
  END IF;
"""


def _stage(name, statement, lock):
    return ("IF pg_catalog.current_setting('statement_timeout') <> '" + statement
        + "' OR pg_catalog.current_setting('lock_timeout') <> '" + lock + "' THEN\n"
        "    RAISE EXCEPTION 'CRM_TIMEOUT_STAGE_PROFILE';\n  END IF;\n"
        "  RAISE NOTICE 'TEST_ONLY_TIMEOUT_STAGE:" + name + ":" + statement + "/" + lock + "';\n")


def _core(candidate, prepared, window, fault=None):
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
    discovery['context']['statement_timeout'] = '2min'
    discovery['context']['lock_timeout'] = '3s'
    contract = dict(identity={key: value['discovery']['capture'][key]
                              for key in ('database', 'database_oid', 'user', 'session_user')},
        discovery=discovery, entry_search_path=value['discovery']['result']['context']['search_path'],
        catalog=value['catalog']['result'], target_catalog=target, sequence=sequence,
        sequence_state=value['sequence_state']['result']['sequence_state'],
        drizzle=value['drizzle_history']['result'], supabase=value['supabase_manifest_before']['result'],
        format_settings=value['supabase_manifest_before']['capture']['format_settings'], auxiliary=auxiliary, window=dict(not_before=window.not_before, expires_at=window.expires_at))
    core = """IF pg_catalog.current_setting('statement_timeout') <> '2min'
     OR pg_catalog.current_setting('lock_timeout') <> '0' THEN
    RAISE EXCEPTION 'CRM_TIMEOUT_ENTRY_PROFILE';
  END IF;
  v_contract := pg_catalog.convert_from(pg_catalog.decode('__CONTRACT_HEX__','hex'),'UTF8')::pg_catalog.jsonb;
  IF pg_catalog.current_setting('search_path') IS DISTINCT FROM v_contract->>'entry_search_path' THEN
    RAISE EXCEPTION 'CRM_TIMEOUT_ENTRY_SEARCH_PATH';
  END IF;
  PERFORM pg_catalog.set_config('lock_timeout','3s',true);
  PERFORM pg_catalog.set_config('search_path','pg_catalog',true);
  v_sequence := v_contract->'sequence';
  __IDENTITY__
  IF pg_catalog.current_setting('server_version_num') <> '170006'
     OR pg_catalog.current_setting('transaction_isolation') <> 'read committed'
     OR pg_catalog.current_setting('transaction_read_only') <> 'off'
     OR pg_catalog.current_setting('statement_timeout') <> '2min'
     OR pg_catalog.current_setting('lock_timeout') <> '3s'
     OR CURRENT_USER <> 'postgres' OR SESSION_USER <> 'postgres'
     OR (SELECT rolsuper FROM pg_catalog.pg_roles WHERE rolname=CURRENT_USER)
     OR pg_catalog.current_setting('search_path') <> 'pg_catalog' THEN
    RAISE EXCEPTION 'CRM_TRANSACTION_EXECUTION_PROFILE';
  END IF;
  __WINDOW__
  __STAGE_PRE__

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

  __EXPIRY_FAULT__
  __WINDOW__
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
  __STAGE_PAYLOAD__
  __DEADLINE_FAULT__
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

  __WINDOW__
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
        '__FAULT__': "RAISE EXCEPTION 'CRM_TRANSACTION_TEST_ONLY_AFTER_INSERT';" if fault == 'after_insert' else '',
        '__WINDOW__': _window_check(),
        '__STAGE_PRE__': _stage('preimage', '2min', '3s'),
        '__STAGE_PAYLOAD__': _stage('payload', '20s', '3s'),
        '__EXPIRY_FAULT__': "PERFORM pg_catalog.pg_sleep(4);" if fault == 'expire_before_payload' else '',
        '__DEADLINE_FAULT__': "PERFORM pg_catalog.pg_sleep(125);" if fault == 'deadline_after_payload' else ''}
    for key, replacement_value in replacement.items():
        core = core.replace(key, replacement_value)
    require(re.search(r'__[A-Z_]+__', core) is None, 'INTERNAL_TEMPLATE')
    return core


def _wrap(core, fence):
    digest = hashlib.sha256(core.encode('utf8')).hexdigest()
    return ("-- NOT_ADMITTED 120s timeout profile experiment; no application mode.\n"
            "-- CRM_TIMEOUT_CORE_SHA256:" + digest + "\nDO $crm_timeout_review$\nDECLARE\n"
            "  v_contract pg_catalog.jsonb; v_sequence pg_catalog.jsonb;\n"
            "  v_now pg_catalog.jsonb; v_capture pg_catalog.jsonb; v_sequence_now pg_catalog.jsonb;\n"
            "  v_returned pg_catalog.jsonb; v_expected_history pg_catalog.jsonb;\n"
            "  v_rows pg_catalog.jsonb; v_scalars pg_catalog.jsonb;\n"
            "  v_payload pg_catalog.bytea; v_sql pg_catalog.text; v_matches pg_catalog.int8; v_next pg_catalog.int8;\n"
            "BEGIN\n  " + fence + "\n-- CRM_TIMEOUT_CORE_BEGIN\n" + core
            + "-- CRM_TIMEOUT_CORE_END\nEND\n$crm_timeout_review$;\n")


def _prepare(candidate, bundle, validate_projection, semantic_witness, window):
    window = _checked_window(window)
    prepared = _prepared(candidate, bundle, validate_projection, semantic_witness)
    context = prepared[0]['discovery']['result']['context']
    require(context['statement_timeout'] == '2min' and context['lock_timeout'] == '0',
            'TIMEOUT_CAPTURE_PROFILE')
    return prepared, window


def render_timeout_proposal(candidate, bundle, *, validate_projection, semantic_witness, window):
    """Always fenced; returned private evidence must never be uploaded."""
    prepared, window = _prepare(candidate, bundle, validate_projection, semantic_witness, window)
    return _wrap(_core(candidate, prepared, window), "RAISE EXCEPTION 'CRM_TIMEOUT_NOT_ADMITTED';")


def timeout_core_sha256(candidate, bundle, *, validate_projection, semantic_witness, window):
    prepared, window = _prepare(candidate, bundle, validate_projection, semantic_witness, window)
    return hashlib.sha256(_core(candidate, prepared, window).encode('utf8')).hexdigest()


def render_TEST_ONLY_timeout(candidate, bundle, *, scope, validate_projection, semantic_witness,
                             window, fault=None):
    """Owned-fixture experiment only, never an operational endpoint adapter."""
    require(type(scope) is str and scope == 'synthetic-ci', 'TIMEOUT_SYNTHETIC_SCOPE')
    require(fault is None or type(fault) is str and fault in
            ('after_insert', 'deadline_after_payload', 'expire_before_payload'), 'TIMEOUT_SYNTHETIC_FAULT')
    prepared, window = _prepare(candidate, bundle, validate_projection, semantic_witness, window)
    require(SYNTHETIC_DATABASE.fullmatch(prepared[0]['discovery']['capture']['database']) is not None,
            'TIMEOUT_SYNTHETIC_DATABASE')
    fence = """IF pg_catalog.current_database() !~ '^crm_acl_fixture_timeout_[a-z0-9_]+$'
     OR CURRENT_USER <> 'postgres' OR SESSION_USER <> 'postgres'
     OR pg_catalog.current_setting('server_version_num') <> '170006' THEN
    RAISE EXCEPTION 'CRM_TIMEOUT_SYNTHETIC_CONTEXT';
  END IF;"""
    # The non-superuser catalog check is in the core AFTER local lock setup.
    # Two completed top-level SETs precede DO. No arbitrary timeout or DSN.
    return ("SET statement_timeout='120s'; SET lock_timeout='0';\n"
            + _wrap(_core(candidate, prepared, window, fault), fence))
