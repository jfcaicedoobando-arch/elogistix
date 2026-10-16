#!/usr/bin/env python3
"""Inventory an exact public-baseline slice; never execute SQL or contact a DB.

The dependency scan is deliberately conservative and is NOT a PostgreSQL parser.
Dynamic SQL and non-public dependencies remain review gates. A successful scan
proves source integrity and reproducibility, not executable schema equivalence.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
from dataclasses import dataclass
import hashlib
import json
from pathlib import Path
import re

REPOSITORY = "jfcaicedoobando-arch/elogistix"
COMMIT = "5d1f00d27628100a58ab166367a067ea90068b84"
BASELINE_PATH = "supabase/schema/baseline.sql"
BASELINE_BLOB = "0d45d45881096808d8dcf1ca3831559d8759f477"
BASELINE_BYTES = 2340163
BASELINE_SHA256 = "a8be935dd3839a7cc0bb94873ef5dd84c452d1f7405d7b050a995dadc514d0d2"
ROOT_TABLES = frozenset({
    "anticipos_aplicaciones", "bbva_movimientos", "embarques", "pagos_proveedor",
    "presupuesto_categorias", "proveedor_facturas", "proveedor_facturas_conceptos",
    "proveedor_notas_credito", "proveedores",
})
ROOT_FUNCTIONS = frozenset({
    "aprobar_factura_proveedor", "_cxp_validar_aprobacion",
    "_cxp_desvincular_por_rechazo", "fecha_negocio_mx", "cierre_periodo_fecha",
    "_normalizar_razon_social",
})
SUPPLEMENTAL_TABLES = frozenset({"demo_seed_state", "organizations"})
ADDITIONAL_WRITE_ROOTS = frozenset({"clientes", "contactos_cliente", "crm_empresas"})
EXCLUDED_FUNCTIONS = frozenset({
    "_seed_demo_limpiar_financiero", "seed_demo_organization_core",
    "seed_demo_organization", "seed_demo_organization_guarded",
})
IDENT = r"[a-z_][a-z_0-9]*"


class CatalogError(ValueError):
    pass


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_blob(data: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def split_sql(text: str) -> list[str]:
    """Split outer semicolons, rejecting unterminated lexical constructs.

    Handles ordinary/E strings, quoted identifiers, tagged dollar strings, line
    comments and nested block comments. Whitespace is kept in each source span.
    psql metacommands are rejected; this accepts the pinned normalized baseline.
    """
    statements, start, i, n = [], 0, 0, len(text)
    state, tag, depth, escape_string = "normal", "", 0, False
    while i < n:
        c, nxt = text[i], text[i + 1:i + 2]
        if state == "line":
            if c == "\n":
                state = "normal"
        elif state == "block":
            if c == "/" and nxt == "*":
                depth += 1
                i += 1
            elif c == "*" and nxt == "/":
                depth -= 1
                i += 1
                if depth == 0:
                    state = "normal"
        elif state == "single":
            if c == "\\" and escape_string:
                i += 1
            elif c == "'":
                if nxt == "'":
                    i += 1
                else:
                    state = "normal"
        elif state == "double":
            if c == '"':
                if nxt == '"':
                    i += 1
                else:
                    state = "normal"
        elif state == "dollar":
            if text.startswith(tag, i):
                i += len(tag) - 1
                state = "normal"
        elif c == "-" and nxt == "-":
            state = "line"
            i += 1
        elif c == "/" and nxt == "*":
            state, depth = "block", 1
            i += 1
        elif c == "'":
            escape_string = i > 0 and text[i - 1] in "eE" and (i < 2 or not (text[i - 2].isalnum() or text[i - 2] == "_"))
            state = "single"
        elif c == '"':
            state = "double"
        elif c == "$":
            match = re.match(r"\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$", text[i:])
            if match:
                tag = match.group()
                state = "dollar"
                i += len(tag) - 1
        elif c == ";":
            statements.append(text[start:i + 1])
            start = i + 1
        elif c == "\\" and not text[text.rfind("\n", 0, i) + 1:i].strip():
            raise CatalogError("psql metacommand in canonical SQL input")
        i += 1
    if state not in {"normal", "line"}:
        raise CatalogError("unterminated SQL lexical construct: " + state)
    if dependency_text(text[start:]).strip():
        raise CatalogError("nonempty unterminated outer SQL statement")
    if statements and text[start:]:
        statements[-1] += text[start:]
    return statements


def dependency_text(text: str) -> str:
    """Remove comments without discarding dynamic SQL string contents.

    Dollar function bodies are inspected as code. This is for conservative
    inventory only, never rewriting canonical statement bytes.
    """
    out, i, n = [], 0, len(text)
    while i < n:
        if text.startswith("--", i):
            end = text.find("\n", i + 2)
            if end == -1:
                break
            out.append("\n")
            i = end + 1
        elif text.startswith("/*", i):
            depth, i = 1, i + 2
            while i < n and depth:
                if text.startswith("/*", i):
                    depth, i = depth + 1, i + 2
                elif text.startswith("*/", i):
                    depth, i = depth - 1, i + 2
                else:
                    i += 1
            if depth:
                raise CatalogError("unterminated block comment in dependency scan")
            out.append(" ")
        elif text[i] == "'":
            start, i = i, i + 1
            escape = start > 0 and text[start - 1] in "eE" and (start < 2 or not text[start - 2].isalnum())
            while i < n:
                if escape and text[i] == "\\":
                    i += 2
                elif text[i] == "'":
                    i += 1
                    if i < n and text[i] == "'":
                        i += 1
                    else:
                        break
                else:
                    i += 1
            out.append(text[start:i])
        else:
            out.append(text[i])
            i += 1
    return re.sub(r'"([a-z_][a-z_0-9]*)"', r"\1", "".join(out))


@dataclass(frozen=True)
class Statement:
    ordinal: int
    kind: str
    name: str
    parent: str | None
    sql: str

    @property
    def body(self) -> str:
        return dependency_text(self.sql)

    @property
    def key(self) -> str:
        return f"{self.kind}:{self.name}:{self.ordinal}"


def classify(ordinal: int, sql: str) -> Statement:
    body = dependency_text(sql).strip()
    for kind, pattern in (
        ("function", rf"CREATE (?:OR REPLACE )?FUNCTION public\.({IDENT})\s*\("),
        ("table", rf"CREATE TABLE public\.({IDENT})\s*\("),
        ("type", rf"CREATE TYPE public\.({IDENT})\s"),
        ("view", rf"CREATE (?:OR REPLACE )?VIEW public\.({IDENT})\s"),
        ("sequence", rf"CREATE SEQUENCE public\.({IDENT})\s"),
        ("collation", rf"CREATE COLLATION public\.({IDENT})\s"),
    ):
        match = re.match(pattern, body)
        if match:
            return Statement(ordinal, kind, match[1], None, sql)
    match = re.match(rf"CREATE (?:CONSTRAINT )?TRIGGER ({IDENT}) .*? ON public\.({IDENT})\s", body, re.S)
    if match:
        return Statement(ordinal, "trigger", match[1], match[2], sql)
    match = re.match(rf"CREATE (?:UNIQUE )?INDEX ({IDENT}) ON public\.({IDENT})\s", body, re.S)
    if match:
        return Statement(ordinal, "index", match[1], match[2], sql)
    match = re.match(rf"ALTER TABLE (?:ONLY )?public\.({IDENT})\s+ADD CONSTRAINT ({IDENT})\s", body)
    if match:
        return Statement(ordinal, "constraint", match[2], match[1], sql)
    return Statement(ordinal, "other", str(ordinal), None, sql)


def references(statement: Statement, objects: dict[str, list[Statement]]) -> set[str]:
    text = statement.body
    result = set(re.findall(rf"\bpublic\.({IDENT})\b", text)) & objects.keys()
    # Known unqualified calls, relation clauses and rowtype declarations.
    for name in re.findall(rf"(?<![a-z_0-9.])({IDENT})\s*\(", text, re.I):
        if any(s.kind == "function" for s in objects.get(name, [])):
            result.add(name)
    for name in re.findall(rf"\b(?:FROM|JOIN|UPDATE|INTO|REFERENCES|TABLE)\s+(?:ONLY\s+)?(?:public\.)?({IDENT})\b", text, re.I):
        if any(s.kind in {"table", "view"} for s in objects.get(name, [])):
            result.add(name)
    for name in re.findall(rf"\b({IDENT})%ROWTYPE", text, re.I):
        if name in objects:
            result.add(name)
    for name in re.findall(rf"\bCOLLATE\s+(?:public\.)?({IDENT})\b", text, re.I):
        if any(s.kind == "collation" for s in objects.get(name, [])):
            result.add(name)
    if statement.kind == "trigger":
        # Canonical generic organization-parent trigger uses TG_ARGV[1].
        for name in re.findall(r"'([a-z_][a-z_0-9]*)'", text):
            if any(s.kind == "table" for s in objects.get(name, [])):
                result.add(name)
    return result


def write_targets(statement: Statement, table_names: set[str]) -> set[str]:
    if statement.kind != "function":
        return set()
    # Do not interpret a PL/pgSQL SELECT ... INTO local_variable as table DML.
    matches = re.findall(rf"\b(?:INSERT\s+INTO|DELETE\s+FROM|UPDATE)\s+(?:ONLY\s+)?(?:public\.)?({IDENT})\b", statement.body, re.I)
    return set(matches) & table_names


def inventory(source: bytes, enforce_pin: bool = True) -> tuple[dict, list[Statement]]:
    if enforce_pin and (len(source) != BASELINE_BYTES or git_blob(source) != BASELINE_BLOB or sha256(source) != BASELINE_SHA256):
        raise CatalogError("baseline integrity mismatch: exact byte count, SHA-256 and Git blob required")
    text = source.decode("utf-8", errors="strict")
    statements = [classify(i, sql) for i, sql in enumerate(split_sql(text), 1)]
    objects: dict[str, list[Statement]] = defaultdict(list)
    children: dict[str, list[Statement]] = defaultdict(list)
    for s in statements:
        if s.kind in {"function", "table", "type", "view", "sequence", "collation"}:
            objects[s.name].append(s)
        elif s.parent:
            children[s.parent].append(s)
    required = ROOT_TABLES | ROOT_FUNCTIONS | SUPPLEMENTAL_TABLES | ADDITIONAL_WRITE_ROOTS
    missing = sorted(required - objects.keys())
    if enforce_pin and missing:
        raise CatalogError("missing canonical roots: " + ", ".join(missing))
    table_names = {s.name for s in statements if s.kind == "table"}
    names = set(required) & objects.keys()
    writes = set(ROOT_TABLES | ADDITIONAL_WRITE_ROOTS) & table_names
    chosen: dict[str, Statement] = {}
    reasons: dict[str, set[str]] = defaultdict(set)
    for name in names:
        reasons[name].add("explicit root")
    while True:
        before = len(chosen), len(names), len(writes)
        for name in sorted(names):
            for s in objects[name]:
                chosen[s.key] = s
            for s in children[name]:
                if s.kind in {"constraint", "index"} or (s.kind == "trigger" and name in writes):
                    chosen[s.key] = s
        for s in list(chosen.values()):
            for ref in references(s, objects):
                names.add(ref)
                reasons[ref].add(s.key)
            writes.update(write_targets(s, table_names))
        if before == (len(chosen), len(names), len(writes)):
            break
    selected = sorted(chosen.values(), key=lambda s: s.ordinal)
    forbidden = sorted(names & EXCLUDED_FUNCTIONS)
    dynamic, external, unknown_public = [], set(), set()
    for s in selected:
        if s.kind == "function" and re.search(r"\bEXECUTE\s+(?:format\s*\(|[a-z_])", s.body, re.I):
            dynamic.append({"statement": s.key, "name": s.name, "resolution": "REVIEW_REQUIRED"})
        for schema, name in re.findall(rf"\b({IDENT})\.({IDENT})\s*(?:\(|\b)", s.body):
            if schema in {"auth", "extensions", "vault", "storage", "net", "cron"}:
                external.add(schema + "." + name)
        unknown_public.update(set(re.findall(rf"\bpublic\.({IDENT})\b", s.body)) - objects.keys())
    root_triggers = [s for s in selected if s.kind == "trigger" and s.parent in ROOT_TABLES]
    all_triggers = [s for s in selected if s.kind == "trigger"]
    if enforce_pin and len(root_triggers) != 85:
        raise CatalogError("canonical root trigger inventory changed: expected 85")
    counts = {kind: sum(s.kind == kind for s in selected) for kind in sorted({s.kind for s in selected})}
    gates = [
        {"gate": "dynamic_sql_review", "status": "BLOCKED" if dynamic else "PASS", "items": dynamic},
        {"gate": "external_dependency_fixture_review", "status": "BLOCKED" if external else "PASS", "items": sorted(external)},
        {"gate": "unresolved_public_references", "status": "BLOCKED" if unknown_public else "PASS", "items": sorted(unknown_public)},
        {"gate": "historical_demo_functions_excluded", "status": "FAIL" if forbidden else "PASS", "items": forbidden},
        {"gate": "postgresql_17_6_install_and_behavior", "status": "NOT_RUN"},
        {"gate": "sql_role_acl_rls_and_external_identity", "status": "NOT_RUN"},
    ]
    report = {
        "schema_version": 1,
        "status": "SOURCE_INVENTORY_ONLY",
        "complete": False,
        "repository": REPOSITORY,
        "commit": COMMIT,
        "source": {"path": BASELINE_PATH, "git_blob_sha1": git_blob(source), "sha256": sha256(source), "bytes": len(source), "integrity": "PASS" if enforce_pin else "TEST_FIXTURE"},
        "root_tables": sorted(ROOT_TABLES),
        "additional_write_roots": sorted(ADDITIONAL_WRITE_ROOTS),
        "root_functions": sorted(ROOT_FUNCTIONS),
        "counts": counts,
        "root_triggers": len(root_triggers),
        "transitive_triggers": len(all_triggers) - len(root_triggers),
        "write_tables_requiring_triggers": sorted(writes),
        "support_tables_without_insert_trigger_certification": sorted((names & table_names) - writes),
        "excluded_historical_demo_function_names": sorted(EXCLUDED_FUNCTIONS),
        "gates": gates,
        "objects": [{"statement": s.key, "kind": s.kind, "name": s.name, "parent": s.parent, "bytes": len(s.sql.encode("utf-8")), "sha256": sha256(s.sql.encode("utf-8")), "reasons": sorted(reasons.get(s.name, {"child of " + str(s.parent)}))} for s in selected],
        "limitations": [
            "Conservative lexical closure is not a PostgreSQL semantic dependency proof.",
            "All canonical root triggers and triggers on discovered public DML targets are inventoried.",
            "Support-table bootstrap INSERT paths, application policies/ACLs and RLS are not certified.",
            "No historical seed body, candidate SQL, database, container or network was executed.",
            "No claim reproducing the unavailable 276-definition Library proposal is made.",
        ],
    }
    return report, selected


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--diagnostic", action="store_true", help="explicit nonexecuting mode; always complete:false")
    parser.add_argument("--emit-candidate", action="store_true", help="emit exact selected source spans for review only")
    args = parser.parse_args()
    source = args.baseline.read_bytes()
    report, selected = inventory(source)
    if any(s.name in EXCLUDED_FUNCTIONS for s in selected):
        raise CatalogError("historical demo function reached; no SQL may be emitted")
    args.out.mkdir(parents=True, exist_ok=True)
    report_path = args.out / "dependency_report.json"
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    if args.emit_candidate:
        # This flag does NOT lift any diagnostic gate or authorize execution.
        header = "-- REVIEW ONLY / SQL NOT_RUN / COMPLETE FALSE\n-- Exact canonical source spans; requires reviewed external fixtures and dynamic SQL closure.\n"
        (args.out / "canonical-candidate.sql").write_text(header + "\n".join(s.sql for s in selected) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"status": report["status"], "complete": False, "counts": report["counts"], "report": str(report_path), "runtime": "NOT_RUN"}))


if __name__ == "__main__":
    main()
