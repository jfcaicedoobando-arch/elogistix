"""Offline SQL scope and derivation regressions; native SQL remains NOT_RUN.

The small resolver intentionally accepts only the snapshot helper's grammar.
It models PostgreSQL's nearest-alias rule using columns from authentic DDL;
it does not pretend to parse or execute arbitrary PostgreSQL.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import re
import sys
import unittest


HERE = Path(__file__).resolve().parent
UPSTREAM = HERE.parent / "demo-financial-compile-recovery" / "upstream"
RECEIPT_REFS = ("a.identity_receipt_id", "v.receipt_id")
SNAPSHOT_KEYS = {
    "prepared_receipt", "preparation_run", "preparation_admission", "preparation_bindings",
}


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def tokens(sql):
    """Keep quoted literals separate so their text cannot declare SQL aliases."""
    result = []
    pattern = r"--[^\n]*|/\*[\s\S]*?\*/|'(?:[^']|'')*'|[A-Za-z_][A-Za-z_0-9]*|\S"
    for match in re.finditer(pattern, sql):
        value = match.group()
        if value.startswith(("--", "/*")):
            continue
        result.append(value if value.startswith("'") else value.lower())
    return result


def table_columns(source, relation):
    """Read top-level column declarations; nested type/check commas stay nested."""
    match = re.search(r"CREATE\s+TABLE\s+" + re.escape(relation) + r"\s*\(", source, re.I)
    if match is None:
        raise AssertionError("Authentic CREATE TABLE missing: " + relation)
    depth, declarations, declaration = 1, [], []
    for token in tokens(source[match.end():]):
        if token == "(":
            depth += 1
        elif token == ")":
            depth -= 1
            if depth == 0:
                declarations.append(declaration)
                break
        if token == "," and depth == 1:
            declarations.append(declaration)
            declaration = []
        else:
            declaration.append(token)
    else:
        raise AssertionError("Unclosed authentic table: " + relation)
    constraints = {"constraint", "primary", "foreign", "unique", "check", "exclude"}
    columns = {d[0] for d in declarations if d and d[0] not in constraints}
    if not columns:
        raise AssertionError("No authentic columns: " + relation)
    return columns


class NameResolutionError(ValueError):
    def __init__(self, sqlstate, reference):
        self.sqlstate = sqlstate
        super().__init__(sqlstate + " " + reference)


class SnapshotResolver:
    """A bounded parser/binder for the helper's four correlated scalar SELECTs."""

    def __init__(self, expression, catalog, outer_scope):
        self.stream, self.index = tokens(expression), 0
        self.catalog, self.outer_scope = catalog, outer_scope

    def take(self, expected=None):
        if self.index == len(self.stream):
            raise ValueError("Unexpected end of snapshot expression")
        value = self.stream[self.index]
        self.index += 1
        if expected is not None and value != expected:
            raise ValueError("Unsupported snapshot grammar: expected " + expected + ", got " + value)
        return value

    def identifier(self):
        value = self.take()
        if not re.fullmatch(r"[a-z_][a-z_0-9]*", value):
            raise ValueError("Expected unquoted identifier")
        return value

    def qualified(self):
        alias = self.identifier()
        self.take(".")
        return alias, self.identifier()

    def relation(self, scope):
        relation = ".".join(self.qualified())
        if relation not in self.catalog:
            raise ValueError("Unexpected snapshot relation: " + relation)
        alias = self.identifier()
        if alias in scope:
            raise ValueError("Duplicate local alias: " + alias)
        scope[alias] = self.catalog[relation]
        return relation, alias

    def resolve(self, reference, local_scope):
        alias, column = reference
        # A local alias hides the entire outer relation; an absent local
        # column MUST NOT cause a fallback to the outer relation's columns.
        if alias in local_scope:
            columns = local_scope[alias]
        elif alias in self.outer_scope:
            columns = self.outer_scope[alias]
        else:
            raise NameResolutionError("42P01", alias + "." + column)
        if column not in columns:
            raise NameResolutionError("42703", alias + "." + column)

    def scalar(self):
        self.take("(")
        self.take("select")
        aggregate = self.stream[self.index] == "jsonb_agg"
        if aggregate:
            self.take("jsonb_agg")
            self.take("(")
        self.take("to_jsonb")
        self.take("(")
        row_alias = self.identifier()
        self.take(")")
        order = None
        if aggregate:
            self.take("order")
            self.take("by")
            order = self.qualified()
            self.take(")")
        self.take("from")
        scope = {}
        relations = [self.relation(scope)]
        joins = []
        while self.stream[self.index] == "join":
            self.take("join")
            relations.append(self.relation(scope))
            self.take("on")
            left = self.qualified()
            self.take("=")
            joins.append((left, self.qualified()))
        self.take("where")
        left = self.qualified()
        self.take("=")
        where = (left, self.qualified())
        self.take(")")
        if row_alias not in scope:
            raise NameResolutionError("42P01", row_alias)
        references = list(where) + [ref for pair in joins for ref in pair]
        if order is not None:
            references.append(order)
        for ref in references:
            self.resolve(ref, scope)
        return {"aggregate": aggregate, "row_alias": row_alias, "relations": relations,
                "joins": joins, "where": where, "order": order}

    def parse(self):
        self.take("jsonb_build_object")
        self.take("(")
        result = {}
        while True:
            key = self.take()
            if not re.fullmatch(r"'[a-z_]+'", key):
                raise ValueError("Expected snapshot key literal")
            key = key[1:-1]
            if key in result:
                raise ValueError("Duplicate snapshot key: " + key)
            self.take(",")
            result[key] = self.scalar()
            separator = self.take()
            if separator == ")":
                break
            if separator != ",":
                raise ValueError("Expected snapshot pair separator")
        if self.index != len(self.stream):
            raise ValueError("Unexpected trailing snapshot SQL")
        return result


subject = load("origin_materialization_v2_test_subject", HERE / "origin_materialization_cases_v2.py")


class OriginMaterializationV2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        bridge = (UPSTREAM / "authentic/bridge.sql").read_text(encoding="utf-8")
        producer = (UPSTREAM / "authentic/producer.sql").read_text(encoding="utf-8")
        issuer = (UPSTREAM / "flow/issuer/16-owner-registry.sql").read_text(encoding="utf-8")
        cls.catalog = {
            "demo_fixture_identity." + name: table_columns(
                bridge if name == "prepared_receipts" else producer, "demo_fixture_identity." + name)
            for name in ("prepared_receipts", "preparation_runs", "preparation_admissions", "preparation_bindings")
        }
        cls.server_columns = table_columns(issuer, "demo_flow_writer.server_admissions")

    def bind(self, expression, ref):
        outer = {"a": self.server_columns} if ref == RECEIPT_REFS[0] else {"v": {"receipt_id"}}
        return SnapshotResolver(expression, self.catalog, outer).parse()

    def test_authentic_columnsets_explain_the_legacy_native_error(self):
        self.assertIn("identity_receipt_id", self.server_columns)
        self.assertNotIn("identity_receipt_id", self.catalog["demo_fixture_identity.preparation_admissions"])
        with self.assertRaises(NameResolutionError) as caught:
            self.bind(subject.ORIGINAL._origin_snapshot(RECEIPT_REFS[0]), RECEIPT_REFS[0])
        self.assertEqual("42703", caught.exception.sqlstate)
        self.assertIn("a.identity_receipt_id", str(caught.exception))
        self.assertEqual(SNAPSHOT_KEYS, set(self.bind(subject.ORIGINAL._origin_snapshot(RECEIPT_REFS[1]), RECEIPT_REFS[1])))

    def test_corrected_both_external_references_bind_against_real_columns(self):
        for ref in RECEIPT_REFS:
            with self.subTest(ref=ref):
                parsed = self.bind(subject.origin_snapshot(ref), ref)
                self.assertEqual(SNAPSHOT_KEYS, set(parsed))
                self.assertEqual(subject.origin_snapshot(ref), subject._origin_snapshot(ref))
                for scalar in parsed.values():
                    self.assertEqual(tuple(ref.split(".")), scalar["where"][1])
                    self.assertNotIn(ref.split(".")[0], {alias for _, alias in scalar["relations"]})

    def test_snapshot_selects_complete_chain_and_ordered_bindings(self):
        for ref in RECEIPT_REFS:
            parsed = self.bind(subject.origin_snapshot(ref), ref)
            for key, table in (("prepared_receipt", "prepared_receipts"), ("preparation_run", "preparation_runs")):
                scalar = parsed[key]
                self.assertFalse(scalar["aggregate"])
                self.assertEqual([("demo_fixture_identity." + table, scalar["row_alias"])], scalar["relations"])
                self.assertEqual((scalar["row_alias"], "receipt_id"), scalar["where"][0])
                self.assertEqual([], scalar["joins"])
            for key, table, join_column in (("preparation_admission", "preparation_admissions", "id"),
                                             ("preparation_bindings", "preparation_bindings", "admission_id")):
                scalar = parsed[key]
                self.assertEqual("demo_fixture_identity.preparation_runs", scalar["relations"][0][0])
                run_alias = scalar["relations"][0][1]
                self.assertEqual(("demo_fixture_identity." + table, scalar["row_alias"]), scalar["relations"][1])
                self.assertEqual([((scalar["row_alias"], join_column), (run_alias, "admission_id"))], scalar["joins"])
                self.assertEqual((run_alias, "receipt_id"), scalar["where"][0])
            self.assertFalse(parsed["preparation_admission"]["aggregate"])
            binding = parsed["preparation_bindings"]
            self.assertTrue(binding["aggregate"])
            self.assertEqual((binding["row_alias"], "fixture_id"), binding["order"])

    def test_binder_rejects_real_unknown_columns_and_alias_capture_mutant(self):
        for ref in RECEIPT_REFS:
            expression = subject.origin_snapshot(ref)
            parsed = self.bind(expression, ref)
            run_alias = parsed["preparation_run"]["row_alias"]
            mutants = [expression.replace(run_alias + ".receipt_id", run_alias + ".missing_receipt_id", 1)]
            if ref == RECEIPT_REFS[0]:
                alias = parsed["preparation_admission"]["row_alias"]
                mutants.append(re.sub(r"\b" + re.escape(alias) + r"\b", "a", expression))
            for mutant in mutants:
                with self.subTest(ref=ref, mutant=mutant):
                    self.assertNotEqual(expression, mutant)
                    with self.assertRaises(NameResolutionError) as caught:
                        self.bind(mutant, ref)
                    self.assertEqual("42703", caught.exception.sqlstate)

    def test_binder_fails_closed_for_unsupported_sql(self):
        with self.assertRaises(ValueError):
            self.bind(subject.origin_snapshot(RECEIPT_REFS[0]) + "; SELECT 1", RECEIPT_REFS[0])
        with self.assertRaises(ValueError):
            self.bind(subject.origin_snapshot(RECEIPT_REFS[0]).replace(" WHERE ", " HAVING "), RECEIPT_REFS[0])

    def test_only_the_two_reviewed_external_references_are_accepted(self):
        for ref in ("p.receipt_id", "r.receipt_id", "a.missing", "v.receipt_id; SELECT 1", "NULL", ""):
            with self.subTest(ref=ref):
                with self.assertRaises((ValueError, TypeError)):
                    subject.origin_snapshot(ref)

    def test_case_metadata_and_sql_are_exact_alias_only_derivations(self):
        self.assertEqual(len(subject.ORIGINAL.CASES), len(subject.CASES))
        for original, corrected in zip(subject.ORIGINAL.CASES, subject.CASES):
            with self.subTest(case=original["id"]):
                self.assertEqual({k: v for k, v in original.items() if k not in ("mutation_sql", "proof_sql")},
                                 {k: v for k, v in corrected.items() if k not in ("mutation_sql", "proof_sql")})
                for field, counts in (("mutation_sql", (1, 1)), ("proof_sql", (0, 1))):
                    restored = corrected[field]
                    for ref, count in zip(RECEIPT_REFS, counts):
                        old, new = subject.ORIGINAL._origin_snapshot(ref), subject.origin_snapshot(ref)
                        self.assertEqual(count, original[field].count(old))
                        self.assertEqual(count, corrected[field].count(new))
                        restored = restored.replace(new, old)
                    self.assertEqual(original[field], restored)

    def test_delivery_pins_are_checked_without_original_rewrites(self):
        # The production verifier reads the v2 contract's nine original pins.
        # Successful verification is an offline byte check, not native SQL.
        subject.verify_original_delivery()

    def test_probe_evaluates_both_corrected_expressions_in_one_receipt_chain(self):
        probe = subject.source_sql_probe()
        sql = re.sub(r"--[^\n]*", "", probe)
        for ref in RECEIPT_REFS:
            self.assertIn(subject.origin_snapshot(ref), probe)
        self.assertRegex(sql, r"(?i)\bFROM\s+pg_temp\.financial_context\s+c\b")
        self.assertRegex(sql, r"(?i)\bJOIN\s+demo_flow_writer\.server_admissions\s+a\b")
        self.assertRegex(sql, r"(?i)\ba\.context_id\s*=\s*c\.context_id\b")
        self.assertRegex(sql, r"(?i)\bINTO\s+STRICT\s+v\b")
        self.assertIn("IS DISTINCT FROM", sql)

    def test_probe_checks_completeness_and_relationships_using_read_only_sql(self):
        probe = subject.source_sql_probe()
        sql_tokens = tokens(probe)
        identifiers = {token for token in sql_tokens if re.fullmatch(r"[a-z_][a-z_0-9]*", token)}
        self.assertTrue({"jsonb_typeof", "jsonb_array_length", "jsonb_object_keys"} <= identifiers)
        for key in SNAPSHOT_KEYS:
            self.assertIn("'" + key + "'", sql_tokens)
        for column in ("receipt_id", "admission_id", "source_run_id", "fixture_id"):
            self.assertIn("'" + column + "'", sql_tokens)
        self.assertIn("scheduler_approval_id", identifiers)
        for fixture in ("aap-vencida", "ofc-parcial", "ttn-vigente"):
            self.assertIn("'" + fixture + "'", sql_tokens)
        self.assertTrue({"raise", "exception"} <= identifiers)
        forbidden = {"insert", "update", "delete", "merge", "truncate", "create", "alter", "drop", "grant", "revoke", "set_config", "execute"}
        self.assertFalse(forbidden & identifiers)
        self.assertFalse({"verify_preparation_origin", "verify_identity_receipt"} & identifiers)
        calls = {token for token, following in zip(sql_tokens, sql_tokens[1:])
                 if following == "(" and re.fullmatch(r"[a-z_][a-z_0-9]*", token)}
        self.assertTrue(calls <= {
            "count", "jsonb_agg", "to_jsonb", "jsonb_build_object", "jsonb_object_keys",
            "array_agg", "jsonb_typeof", "jsonb_array_length", "jsonb_array_elements",
            "if", "or", "where", "exists",
        }, "Unexpected probe function or unreviewed grammar: " + repr(calls))
        self.assertNotRegex(re.sub(r"--[^\n]*", "", probe), r"(?i)\bFOR\s+(?:SHARE|UPDATE|NO\s+KEY\s+UPDATE|KEY\s+SHARE)\b")
        self.assertRegex(re.sub(r"--[^\n]*", "", probe), r"(?is)^\s*DO\s+\$[a-z_0-9]+\$\s+DECLARE\s+v\s+record\b")
        for table in ("prepared_receipts", "preparation_runs", "preparation_admissions"):
            self.assertRegex(probe, r"(?i)\bactual_[a-z_]+\s+demo_fixture_identity\." + table + r"\s*;")

    def test_probe_compares_independent_actual_rows_and_chain_relationships(self):
        # Pairwise equality alone can accept two identically empty correlated
        # reads.  Keep the independent typed-row oracle and its link checks.
        probe = re.sub(r"\s+", " ", subject.source_sql_probe())
        for left, right in (
            ("v.origin_snapshot", "record_snapshot"),
            ("v.origin_snapshot", "expected_snapshot"),
            ("actual_prepared.receipt_id", "v.receipt_id"),
            ("actual_run.receipt_id", "v.receipt_id"),
            ("actual_run.admission_id", "actual_admission.id"),
            ("actual_run.scheduler_approval_id", "actual_admission.scheduler_approval_id"),
            ("actual_run.scheduler_approval_id", "v.scheduler_approval_id"),
            ("actual_prepared.client_bindings", "actual_admission.client_bindings"),
            ("prepared_mapping", "admitted_mapping"),
        ):
            self.assertIn(left + " IS DISTINCT FROM " + right, probe)
        for left, right in (
            ("(actual_prepared.payload->>'receipt_id')::uuid", "v.receipt_id"),
            ("(actual_prepared.payload->>'source_run_id')::uuid", "actual_run.id"),
            ("(actual_prepared.payload->>'category_id')::uuid", "actual_admission.category_id"),
            ("(binding->>'admission_id')::uuid", "actual_admission.id"),
        ):
            self.assertIn(left + " IS DISTINCT FROM " + right, probe)
        self.assertRegex(probe, r"jsonb_array_length\(actual_bindings\)\s+IS DISTINCT FROM 3\b")
        self.assertIn("v.receipt_id IS NULL", probe)
        self.assertIn("jsonb_typeof(actual_bindings) IS DISTINCT FROM 'array'", probe)


if __name__ == "__main__":
    unittest.main()
