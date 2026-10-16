"""Read-only sequence observations for an owned synthetic PG17 invocation.

The observer creates one session-local function, reads sequences, and prints
framed JSON on stdout. It never advances or resets a sequence. Separate optional
TEMP-probe helpers deliberately advance only their dedicated calibration object.
All SQL is PREPARED / NOT_RUN here. Parsing logs does not establish ownership,
native execution, cleanup, transactional sequence rollback, or crash durability.

PG17 references:
https://www.postgresql.org/docs/17/view-pg-sequences.html
https://www.postgresql.org/docs/17/functions-sequence.html
https://www.postgresql.org/docs/17/sql-createsequence.html
"""
from __future__ import annotations

import json
import re


SCHEMAS = ("public", "auth", "demo_flow_writer", "demo_fixture_identity", "financial_compile_fixture")
LABELS = ("baseline_after_prep", "after_positive", "before_denial", "after_denial", "after_outer_rollback")
PROBE_LABELS = ("probe_before", "probe_after_advance", "probe_after_outer_rollback")
PREFIX = "RETRY_SEQUENCE_OBSERVATION "
PROBE_NAME = "retry_negative_review_sequence_probe"
_META_KEYS = frozenset(("sequenceowner", "data_type", "start_value", "min_value", "max_value",
                        "increment_by", "cycle", "cache_size", "last_value"))
LIMITS = (
    "Sequence observations do not establish transactional rollback or absence of nextval calls.",
    "Cached consumption can leave observed last_value/is_called unchanged.",
    "Catalog metadata and sequence state are separate, non-atomic reads; changes are not attributed to an RPC.",
    "Qualified names identify observations; same-name replacement is not excluded and OIDs are not emitted.",
    "The calling runner must establish ownership, native execution, source pins and cleanup.",
)


_SETUP = r"""
DO $retry_sequence_setup_guard$
BEGIN
 IF current_database()<>'demo_financial_compile_recovery_lab'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('listen_addresses')<>'' OR inet_server_addr() IS NOT NULL
 OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('role')<>'none'
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user
   AND NOT rolsuper AND rolbypassrls AND NOT rolinherit AND NOT rolcreatedb
   AND NOT rolcreaterole AND NOT rolreplication)
 OR pg_catalog.pg_has_role(current_user,'supabase_admin','MEMBER') THEN
  RAISE EXCEPTION 'RETRY_SEQUENCE_SYNTHETIC_CANDIDATE_REQUIRED';
 END IF;
 IF pg_catalog.to_regprocedure('pg_temp.retry_negative_review_sequence_snapshot(boolean)') IS NOT NULL THEN
  RAISE EXCEPTION 'RETRY_SEQUENCE_OBSERVER_ALREADY_EXISTS';
 END IF;
END $retry_sequence_setup_guard$;
CREATE FUNCTION pg_temp.retry_negative_review_sequence_snapshot(p_probe boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog AS $retry_sequence_observer$
DECLARE
 seq record; v_last bigint; v_called boolean; v_state jsonb; v_status text; v_sqlstate text;
 v_rows jsonb:='[]'::jsonb; v_complete boolean:=true;
 v_schemas text[]:=ARRAY['public','auth','demo_flow_writer','demo_fixture_identity','financial_compile_fixture'];
BEGIN
 IF p_probe IS NULL OR current_database()<>'demo_financial_compile_recovery_lab'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('listen_addresses')<>'' OR inet_server_addr() IS NOT NULL
 OR current_user<>'postgres' OR session_user<>'postgres' OR current_setting('role')<>'none' THEN
  RAISE EXCEPTION 'RETRY_SEQUENCE_OBSERVATION_CONTEXT_REQUIRED';
 END IF;
 IF NOT p_probe AND (SELECT count(*) FROM pg_catalog.pg_namespace WHERE nspname=ANY(v_schemas))<>5 THEN
  RAISE EXCEPTION 'RETRY_SEQUENCE_SCHEMA_SET_REQUIRED';
 END IF;
 FOR seq IN
  SELECT n.nspname AS physical_schema,c.relname AS sequence_name,
   CASE WHEN p_probe THEN 'pg_temp' ELSE n.nspname::text END AS observed_schema,
   CASE WHEN s.sequencename IS NULL THEN NULL
    ELSE pg_catalog.to_jsonb(s)-ARRAY['schemaname','sequencename'] END AS metadata
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  LEFT JOIN pg_catalog.pg_sequences s ON s.schemaname=n.nspname AND s.sequencename=c.relname
  WHERE c.relkind='S' AND
   ((NOT p_probe AND n.nspname=ANY(v_schemas))
    OR (p_probe AND c.relnamespace=pg_catalog.pg_my_temp_schema()
      AND c.relname='retry_negative_review_sequence_probe'))
  ORDER BY n.nspname COLLATE pg_catalog."C",c.relname COLLATE pg_catalog."C"
 LOOP
  v_state:=NULL; v_sqlstate:=NULL; v_status:='observed';
  IF seq.metadata IS NULL THEN
   v_status:='metadata_missing'; v_complete:=false;
  ELSE
   BEGIN
    EXECUTE pg_catalog.format('SELECT last_value,is_called FROM %I.%I',seq.physical_schema,seq.sequence_name)
     INTO STRICT v_last,v_called;
    v_state:=pg_catalog.jsonb_build_object('last_value',v_last,'is_called',v_called);
   EXCEPTION WHEN OTHERS THEN
    v_status:='read_error'; v_sqlstate:=SQLSTATE; v_complete:=false;
   END;
  END IF;
  v_rows:=v_rows||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
   'schema',seq.observed_schema,'name',seq.sequence_name,'metadata',seq.metadata,
   'state',v_state,'status',v_status,'sqlstate',v_sqlstate));
 END LOOP;
 RETURN pg_catalog.jsonb_build_object('scope',CASE WHEN p_probe THEN 'temp_probe' ELSE 'fixture_schemas' END,
  'schemas',CASE WHEN p_probe THEN ARRAY['pg_temp'] ELSE v_schemas END,
  'sequence_count',pg_catalog.jsonb_array_length(v_rows),'complete',v_complete,'sequences',v_rows);
END $retry_sequence_observer$;
"""


def setup_sql() -> str:
    """Run once after exact fixtures, before the suite BEGIN; no business DML."""
    return _SETUP


def capture_sql(label: str) -> str:
    """Print one JSON frame with psql -X -q -A -t; no journal can roll back."""
    if label not in LABELS + PROBE_LABELS:
        raise ValueError("Unknown sequence observation label")
    probe = "true" if label in PROBE_LABELS else "false"
    return ("SELECT '" + PREFIX + "'||pg_catalog.jsonb_build_object('version',1,'label','"
            + label + "','snapshot',pg_temp.retry_negative_review_sequence_snapshot(" + probe + "))::text;\n")


def probe_setup_sql() -> str:
    """Optional calibration, before BEGIN. A TEMP object survives later rollback.

    Call setup_sql first. This helper creates only the new session-local probe;
    it must be invoked by the same fresh, owned runner as the normal suite.
    """
    return r"""
DO $retry_sequence_probe_guard$ BEGIN
 IF current_database()<>'demo_financial_compile_recovery_lab'
 OR current_user<>'postgres' OR session_user<>'postgres' OR current_setting('role')<>'none'
 OR current_setting('server_version_num')<>'170006'
 OR current_setting('listen_addresses')<>'' OR inet_server_addr() IS NOT NULL
 OR pg_catalog.to_regprocedure('pg_temp.retry_negative_review_sequence_snapshot(boolean)') IS NULL
 OR pg_catalog.to_regclass('pg_temp.retry_negative_review_sequence_probe') IS NOT NULL THEN
  RAISE EXCEPTION 'RETRY_SEQUENCE_FRESH_TEMP_PROBE_REQUIRED';
 END IF;
END $retry_sequence_probe_guard$;
CREATE TEMP SEQUENCE retry_negative_review_sequence_probe START WITH 17 INCREMENT BY 7 CACHE 1 NO CYCLE;
""" + capture_sql("probe_before")


def probe_advance_sql() -> str:
    """Inside the suite transaction, only AFTER its real positive retry control.

    This is the sole deliberate sequence consumer in this module. It advances
    only the dedicated TEMP probe, never a discovered fixture sequence.
    """
    return r"""
DO $retry_sequence_probe_advance$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR current_setting('role')<>'none'
 OR pg_catalog.to_regclass('pg_temp.retry_negative_positive') IS NULL
 OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c
   WHERE c.relnamespace=pg_catalog.pg_my_temp_schema() AND c.relkind='S'
     AND c.relname='retry_negative_review_sequence_probe') THEN
  RAISE EXCEPTION 'RETRY_SEQUENCE_NATIVE_POSITIVE_CONTROL_REQUIRED';
 END IF;
 IF (SELECT count(*) FROM pg_temp.retry_negative_positive)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_temp.retry_negative_positive
   WHERE result->>'status'='materialized' AND result->>'materialization'='executed'
     AND result->>'run_id' IS NOT NULL AND result->>'lineage_id' IS NOT NULL
     AND result->>'checkpoint_id' IS NOT NULL) THEN
  RAISE EXCEPTION 'RETRY_SEQUENCE_NATIVE_POSITIVE_CONTROL_REQUIRED';
 END IF;
 PERFORM pg_catalog.nextval('pg_temp.retry_negative_review_sequence_probe'::pg_catalog.regclass);
 PERFORM pg_catalog.nextval('pg_temp.retry_negative_review_sequence_probe'::pg_catalog.regclass);
END $retry_sequence_probe_advance$;
""" + capture_sql("probe_after_advance")


def probe_report_sql() -> str:
    """After the caller's outer ROLLBACK; observations do not assert cleanup."""
    return capture_sql("probe_after_outer_rollback")


def _object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _integer(value):
    return type(value) is int and -(2**63) <= value < 2**63


def _snapshot(snapshot, *, scope=None):
    keys = {"scope", "schemas", "sequence_count", "complete", "sequences"}
    if not isinstance(snapshot, dict) or set(snapshot) != keys:
        raise ValueError("Malformed sequence snapshot")
    observed_scope = snapshot["scope"]
    if observed_scope not in ("fixture_schemas", "temp_probe") or (scope is not None and observed_scope != scope):
        raise ValueError("Sequence scope mismatch")
    schemas = ["pg_temp"] if observed_scope == "temp_probe" else list(SCHEMAS)
    rows = snapshot["sequences"]
    if snapshot["schemas"] != schemas or type(snapshot["complete"]) is not bool or not isinstance(rows, list):
        raise ValueError("Incomplete schema inventory contract")
    if type(snapshot["sequence_count"]) is not int or snapshot["sequence_count"] != len(rows):
        raise ValueError("Sequence count mismatch")
    found = {}
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"schema", "name", "metadata", "state", "status", "sqlstate"}:
            raise ValueError("Malformed sequence entry")
        if row["schema"] not in schemas or not isinstance(row["name"], str) or not row["name"] or "\0" in row["name"]:
            raise ValueError("Invalid sequence identity")
        if observed_scope == "temp_probe" and row["name"] != PROBE_NAME:
            raise ValueError("Foreign calibration sequence")
        identity = (row["schema"], row["name"])
        if identity in found:
            raise ValueError("Duplicate sequence identity")
        found[identity] = row
        meta = row["metadata"]
        if meta is not None:
            if not isinstance(meta, dict) or set(meta) != _META_KEYS:
                raise ValueError("Malformed pg_sequences metadata")
            if (not isinstance(meta["sequenceowner"], str) or not meta["sequenceowner"]
                    or meta["data_type"] not in ("smallint", "integer", "bigint")
                    or type(meta["cycle"]) is not bool):
                raise ValueError("Invalid sequence metadata types")
            for key in ("start_value", "min_value", "max_value", "increment_by", "cache_size"):
                if not _integer(meta[key]):
                    raise ValueError("Invalid numeric sequence metadata")
            if meta["last_value"] is not None and not _integer(meta["last_value"]):
                raise ValueError("Invalid metadata last_value")
        if row["status"] == "observed":
            state = row["state"]
            if (meta is None or row["sqlstate"] is not None or not isinstance(state, dict)
                    or set(state) != {"last_value", "is_called"}
                    or not _integer(state["last_value"]) or type(state["is_called"]) is not bool):
                raise ValueError("Invalid direct sequence state")
        elif row["status"] == "read_error":
            if (meta is None or row["state"] is not None or not isinstance(row["sqlstate"], str)
                    or not re.fullmatch(r"[0-9A-Z]{5}", row["sqlstate"])):
                raise ValueError("Invalid sequence read error")
        elif row["status"] == "metadata_missing":
            if meta is not None or row["state"] is not None or row["sqlstate"] is not None:
                raise ValueError("Invalid missing metadata observation")
        else:
            raise ValueError("Unknown sequence read status")
    if list(found) != sorted(found):
        raise ValueError("Unordered sequence inventory")
    if snapshot["complete"] != all(row["status"] == "observed" for row in rows):
        raise ValueError("Sequence completeness disagrees with read status")
    return found


def compare_snapshots(before, after):
    """Compare observed fields, never infer rollback, causation, or consumption."""
    left = _snapshot(before)
    right = _snapshot(after, scope=before["scope"])
    if not before["complete"] or not after["complete"]:
        return {"classification": "incomplete", "changes": [], "sequence_rollback": "NOT_ASSERTED"}
    changes = []
    for identity in sorted(left.keys() | right.keys()):
        if identity not in left:
            fields = ["inventory_added"]
        elif identity not in right:
            fields = ["inventory_removed"]
        else:
            fields = [key for key in ("metadata", "state") if left[identity][key] != right[identity][key]]
        if fields:
            changes.append({"schema": identity[0], "name": identity[1], "fields": fields})
    classification = "changed" if changes else "no_change" if left or right else "absent"
    return {"classification": classification, "changes": changes, "sequence_rollback": "NOT_ASSERTED"}


def inspect_output(stdout, *, expected_labels=LABELS):
    """Parse stdout frames from one native invocation; caller verifies logs/exit.

    COMPLETE means complete, readable observations, including an empty scope.
    A changed observation is data, not a failing denial test. Sample strings in
    offline tests are parser fixtures and are never native execution evidence.
    """
    result = {"status": "INCOMPLETE", "captures": {}, "comparisons": {},
              "sequence_rollback": "NOT_ASSERTED", "limits": list(LIMITS)}
    try:
        labels = tuple(expected_labels)
        if not labels or len(set(labels)) != len(labels) or any(label not in LABELS + PROBE_LABELS for label in labels):
            raise ValueError("Invalid expected sequence labels")
        if not isinstance(stdout, str) or re.search(r"\b(?:ERROR|FATAL|PANIC):", stdout):
            raise ValueError("Invalid or failed native stdout")
        observed = []
        for line in stdout.splitlines():
            line = line.strip()
            if not line.startswith(PREFIX.rstrip()):
                continue
            if not line.startswith(PREFIX):
                raise ValueError("Malformed sequence frame prefix")
            frame = json.loads(line[len(PREFIX):], object_pairs_hook=_object,
                               parse_constant=lambda _: (_ for _ in ()).throw(ValueError("Nonfinite JSON")))
            if (not isinstance(frame, dict) or set(frame) != {"version", "label", "snapshot"}
                    or type(frame["version"]) is not int or frame["version"] != 1
                    or frame["label"] not in labels or frame["label"] in observed):
                raise ValueError("Unexpected sequence frame")
            label = frame["label"]
            _snapshot(frame["snapshot"], scope="temp_probe" if label in PROBE_LABELS else "fixture_schemas")
            result["captures"][label] = frame["snapshot"]
            observed.append(label)
        if tuple(observed) != labels:
            raise ValueError("Missing or reordered sequence frames")
        pairs = (("denial", "before_denial", "after_denial"),
                 ("outer_rollback_window", "baseline_after_prep", "after_outer_rollback"),
                 ("positive_window", "baseline_after_prep", "after_positive"))
        for name, before, after in pairs:
            if before in result["captures"] and after in result["captures"]:
                result["comparisons"][name] = compare_snapshots(result["captures"][before], result["captures"][after])
        if not all(snapshot["complete"] for snapshot in result["captures"].values()):
            raise ValueError("Unreadable sequence evidence")
        result["status"] = "COMPLETE"
    except (ValueError, TypeError, KeyError) as exc:
        result["reason"] = str(exc)
    return result


def inspect_probe_output(stdout):
    """Require observed probe advance and unchanged advanced state after rollback."""
    result = inspect_output(stdout, expected_labels=PROBE_LABELS)
    result["calibration"] = "NOT_ESTABLISHED"
    if result["status"] != "COMPLETE":
        return result
    captures = result["captures"]
    rows = [captures[label]["sequences"] for label in PROBE_LABELS]
    expected = ({"last_value": 17, "is_called": False}, {"last_value": 24, "is_called": True},
                {"last_value": 24, "is_called": True})
    if any(len(row) != 1 or row[0]["state"] != state for row, state in zip(rows, expected)):
        result["status"] = "INCOMPLETE"
        result["reason"] = "Dedicated TEMP probe did not show its expected native transition"
        return result
    # The numeric transition alone cannot certify the intended no-cache probe.
    # Require the CREATE TEMP SEQUENCE descriptor at every observed phase too.
    expected_descriptor = {"sequenceowner": "postgres", "data_type": "bigint", "start_value": 17,
                           "min_value": 1, "max_value": 9223372036854775807,
                           "increment_by": 7, "cycle": False, "cache_size": 1}
    for row, state in zip(rows, expected):
        metadata = row[0]["metadata"]
        expected_metadata = dict(expected_descriptor,
                                 last_value=state["last_value"] if state["is_called"] else None)
        if metadata != expected_metadata:
            result["status"] = "INCOMPLETE"
            result["reason"] = "Dedicated TEMP probe descriptor differs from its exact calibration contract"
            return result
    comparisons = {"advance": compare_snapshots(captures[PROBE_LABELS[0]], captures[PROBE_LABELS[1]]),
                   "after_outer_rollback": compare_snapshots(captures[PROBE_LABELS[1]], captures[PROBE_LABELS[2]])}
    result["comparisons"] = comparisons
    if comparisons["advance"]["classification"] != "changed" or comparisons["after_outer_rollback"]["classification"] != "no_change":
        result["status"] = "INCOMPLETE"
        result["reason"] = "Dedicated TEMP probe metadata/state transition mismatch"
        return result
    result["calibration"] = "TEMP_PROBE_ADVANCE_OBSERVED_AFTER_OUTER_ROLLBACK"
    return result
