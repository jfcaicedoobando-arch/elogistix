"""Offline protocol/state tests. SQL and sequence calibration remain NOT_RUN."""
import copy
import importlib.util
import json
from pathlib import Path
import re
import unittest


HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("retry_sequence_subject", HERE / "sequence_observation.py")
sequences = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sequences)


def entry(*, schema="public", name="synthetic sequence \"quoted\"", last=17, called=False, cache=1):
    return {"schema": schema, "name": name, "status": "observed", "sqlstate": None,
            "state": {"last_value": last, "is_called": called},
            "metadata": {"sequenceowner": "postgres", "data_type": "bigint", "start_value": 17,
                         "min_value": 1, "max_value": 9223372036854775807, "increment_by": 7,
                         "cycle": False, "cache_size": cache, "last_value": last if called else None}}


def snapshot(rows=(), *, scope="fixture_schemas"):
    rows = copy.deepcopy(list(rows))
    return {"scope": scope, "schemas": ["pg_temp"] if scope == "temp_probe" else list(sequences.SCHEMAS),
            "sequence_count": len(rows), "complete": all(row["status"] == "observed" for row in rows),
            "sequences": rows}


def frame(label, value):
    return sequences.PREFIX + json.dumps({"version": 1, "label": label, "snapshot": value})


def stream(captures):
    return "\n".join(frame(label, value) for label, value in captures) + "\n"


class ObservationTests(unittest.TestCase):
    def test_complete_empty_scope_is_absent_not_missing_output(self):
        value = snapshot()
        self.assertEqual("absent", sequences.compare_snapshots(value, value)["classification"])
        labels = ("before_denial", "after_denial")
        result = sequences.inspect_output(stream((label, value) for label in labels), expected_labels=labels)
        self.assertEqual("COMPLETE", result["status"])
        self.assertEqual("absent", result["comparisons"]["denial"]["classification"])
        self.assertEqual("INCOMPLETE", sequences.inspect_output("", expected_labels=labels)["status"])

    def test_uncalled_sequence_with_null_view_value_is_valid(self):
        value = snapshot([entry(last=17, called=False)])
        result = sequences.inspect_output(frame("before_denial", value), expected_labels=["before_denial"])
        self.assertEqual("COMPLETE", result["status"])
        self.assertIsNone(result["captures"]["before_denial"]["sequences"][0]["metadata"]["last_value"])

    def test_state_flag_and_64bit_values_are_compared_exactly(self):
        before = snapshot([entry(last=9223372036854775805, called=False)])
        after = snapshot([entry(last=9223372036854775806, called=True)])
        result = sequences.compare_snapshots(before, after)
        self.assertEqual("changed", result["classification"])
        self.assertEqual(["metadata", "state"], result["changes"][0]["fields"])
        self.assertEqual("NOT_ASSERTED", result["sequence_rollback"])
        called_only = copy.deepcopy(before)
        called_only["sequences"][0]["state"]["is_called"] = True
        self.assertEqual("changed", sequences.compare_snapshots(before, called_only)["classification"])

    def test_cached_no_change_does_not_assert_no_consumption_or_rollback(self):
        value = snapshot([entry(last=100, called=True, cache=32)])
        result = sequences.compare_snapshots(value, value)
        self.assertEqual("no_change", result["classification"])
        self.assertEqual("NOT_ASSERTED", result["sequence_rollback"])
        self.assertTrue(any("Cached consumption" in limit for limit in sequences.LIMITS))

    def test_metadata_change_and_inventory_add_remove_are_data(self):
        before = snapshot([entry()])
        changed_meta = copy.deepcopy(before)
        changed_meta["sequences"][0]["metadata"]["cache_size"] = 4
        self.assertEqual(["metadata"], sequences.compare_snapshots(before, changed_meta)["changes"][0]["fields"])
        added = sequences.compare_snapshots(snapshot(), before)
        removed = sequences.compare_snapshots(before, snapshot())
        self.assertEqual(["inventory_added"], added["changes"][0]["fields"])
        self.assertEqual(["inventory_removed"], removed["changes"][0]["fields"])
        result = sequences.inspect_output(stream((("before_denial", before), ("after_denial", changed_meta))),
                                          expected_labels=["before_denial", "after_denial"])
        self.assertEqual("COMPLETE", result["status"])
        self.assertEqual("changed", result["comparisons"]["denial"]["classification"])

    def test_inaccessible_and_missing_metadata_never_become_absent(self):
        unreadable = entry()
        unreadable.update(status="read_error", sqlstate="42501", state=None)
        missing = entry()
        missing.update(status="metadata_missing", metadata=None, state=None)
        for row in (unreadable, missing):
            value = snapshot([row])
            self.assertEqual("incomplete", sequences.compare_snapshots(value, snapshot())["classification"])
            self.assertEqual("INCOMPLETE", sequences.inspect_output(frame("before_denial", value),
                                                                   expected_labels=["before_denial"])["status"])

    def test_protocol_rejects_missing_duplicate_reordered_or_foreign_frames(self):
        labels = ("before_denial", "after_denial")
        good = [(label, snapshot()) for label in labels]
        cases = (good[:1], good + good[-1:], list(reversed(good)), good + [("after_positive", snapshot())])
        for captures in cases:
            with self.subTest(captures=captures):
                self.assertEqual("INCOMPLETE", sequences.inspect_output(stream(captures), expected_labels=labels)["status"])
        for invalid in ([], ["before_denial", "before_denial"], ["bad"], [None]):
            self.assertEqual("INCOMPLETE", sequences.inspect_output("", expected_labels=invalid)["status"])

    def test_malformed_json_duplicate_keys_nonfinite_and_native_errors_fail(self):
        labels = ["before_denial"]
        valid = frame("before_denial", snapshot())
        bad = (sequences.PREFIX + "{", sequences.PREFIX.rstrip(),
               valid.replace('"version": 1', '"version": 1, "version": 1'),
               valid.replace('"sequence_count": 0', '"sequence_count": NaN'),
               valid + "\nERROR: SQL failed")
        for output in bad:
            with self.subTest(output=output):
                self.assertEqual("INCOMPLETE", sequences.inspect_output(output, expected_labels=labels)["status"])

    def test_scope_counts_types_identity_and_completeness_fail_closed(self):
        good = snapshot([entry()])
        bad = []
        for key, value in (("schemas", ["public"]), ("sequence_count", True), ("sequence_count", 0), ("complete", False)):
            item = copy.deepcopy(good)
            item[key] = value
            bad.append(item)
        duplicate = copy.deepcopy(good)
        duplicate["sequences"] *= 2
        duplicate["sequence_count"] = 2
        bad.append(duplicate)
        for key, value in (("last_value", True), ("is_called", 0), ("last_value", 2**63)):
            item = copy.deepcopy(good)
            item["sequences"][0]["state"][key] = value
            bad.append(item)
        foreign = copy.deepcopy(good)
        foreign["sequences"][0]["schema"] = "another_schema"
        bad.append(foreign)
        for value in bad:
            with self.subTest(value=value):
                self.assertEqual("INCOMPLETE", sequences.inspect_output(frame("before_denial", value),
                                                                       expected_labels=["before_denial"])["status"])

    def test_same_name_replacement_is_explicitly_unestablished(self):
        self.assertTrue(any("same-name replacement" in limit and "OIDs are not emitted" in limit
                            for limit in sequences.LIMITS))

    def test_observer_reads_all_sequences_and_quotes_discovered_identifiers(self):
        sql = sequences.setup_sql()
        self.assertIn("c.relkind='S'", sql)
        self.assertIn("LEFT JOIN pg_catalog.pg_sequences", sql)
        self.assertIn("pg_catalog.format('SELECT last_value,is_called FROM %I.%I'", sql)
        self.assertIn("INTO STRICT v_last,v_called", sql)
        self.assertNotIn("has_sequence_privilege", sql)
        self.assertNotRegex(sql, r"(?i)\b(?:nextval|setval|currval|lastval)\s*\(")
        self.assertNotRegex(sql, r"(?i)\b(?:INSERT|UPDATE|DELETE|GRANT|REVOKE|COMMIT|ALTER)\b")
        functions = re.findall(r"CREATE FUNCTION\s+([^\s(]+)", sql)
        self.assertEqual(["pg_temp.retry_negative_review_sequence_snapshot"], functions)
        self.assertIn("SECURITY INVOKER", sql)

    def test_capture_labels_cannot_inject_sql_or_consume_sequence(self):
        for label in sequences.LABELS + sequences.PROBE_LABELS:
            sql = sequences.capture_sql(label)
            self.assertTrue(sql.startswith("SELECT '" + sequences.PREFIX))
            self.assertEqual(1, sql.count(";"))
            self.assertNotRegex(sql, r"(?i)\b(?:nextval|setval)\s*\(")
        for invalid in (None, "before_denial'; DROP SCHEMA public;--", "before"):
            with self.assertRaises(ValueError):
                sequences.capture_sql(invalid)


class ProbeTests(unittest.TestCase):
    def captures(self):
        return [(label, snapshot([entry(schema="pg_temp", name=sequences.PROBE_NAME, last=last, called=called)],
                                 scope="temp_probe"))
                for label, last, called in zip(sequences.PROBE_LABELS, (17, 24, 24), (False, True, True))]

    def test_calibration_requires_native_advance_and_advanced_postrollback_state(self):
        result = sequences.inspect_probe_output(stream(self.captures()))
        self.assertEqual("COMPLETE", result["status"])
        self.assertEqual("TEMP_PROBE_ADVANCE_OBSERVED_AFTER_OUTER_ROLLBACK", result["calibration"])
        self.assertEqual("NOT_ASSERTED", result["sequence_rollback"])
        unchanged = self.captures()
        unchanged[1] = (unchanged[1][0], copy.deepcopy(unchanged[0][1]))
        self.assertEqual("INCOMPLETE", sequences.inspect_probe_output(stream(unchanged))["status"])
        reverted = self.captures()
        reverted[2] = (reverted[2][0], copy.deepcopy(reverted[0][1]))
        self.assertEqual("INCOMPLETE", sequences.inspect_probe_output(stream(reverted))["status"])

    def test_probe_is_temp_only_and_consumption_follows_positive_guard(self):
        setup = sequences.probe_setup_sql()
        advance = sequences.probe_advance_sql()
        report = sequences.probe_report_sql()
        self.assertIn("CREATE TEMP SEQUENCE " + sequences.PROBE_NAME, setup)
        self.assertIn("CACHE 1 NO CYCLE", setup)
        self.assertNotRegex(setup + report, r"(?i)\b(?:nextval|setval)\s*\(")
        self.assertEqual(2, advance.count("pg_catalog.nextval('pg_temp." + sequences.PROBE_NAME))
        self.assertLess(advance.index("FROM pg_temp.retry_negative_positive"), advance.index("pg_catalog.nextval"))
        self.assertNotRegex(advance, r"(?i)\bsetval\s*\(")
        self.assertNotRegex(setup + advance + report, r"(?i)\b(?:GRANT|REVOKE|COMMIT|TRUNCATE)\b")

    def test_correct_direct_values_cannot_mask_wrong_probe_descriptor(self):
        for field, wrong in (("start_value", 1), ("increment_by", 1), ("cache_size", 32),
                             ("cycle", True), ("sequenceowner", "different_owner"),
                             ("data_type", "integer"), ("min_value", -1), ("max_value", 2147483647)):
            values = self.captures()
            for _, value in values:
                value["sequences"][0]["metadata"][field] = wrong
            with self.subTest(field=field):
                result = sequences.inspect_probe_output(stream(values))
                self.assertEqual("INCOMPLETE", result["status"])
                self.assertEqual("NOT_ESTABLISHED", result["calibration"])
                self.assertIn("descriptor", result["reason"])
        values = self.captures()
        values[0][1]["sequences"][0]["metadata"]["last_value"] = 17
        self.assertEqual("INCOMPLETE", sequences.inspect_probe_output(stream(values))["status"])

    def test_no_probe_sequence_or_unreadable_probe_cannot_calibrate(self):
        values = [(label, snapshot(scope="temp_probe")) for label in sequences.PROBE_LABELS]
        result = sequences.inspect_probe_output(stream(values))
        self.assertEqual("INCOMPLETE", result["status"])
        self.assertEqual("NOT_ESTABLISHED", result["calibration"])
        foreign = self.captures()
        foreign[0][1]["sequences"][0]["name"] = "foreign_probe"
        self.assertEqual("INCOMPLETE", sequences.inspect_probe_output(stream(foreign))["status"])


if __name__ == "__main__":
    unittest.main()
