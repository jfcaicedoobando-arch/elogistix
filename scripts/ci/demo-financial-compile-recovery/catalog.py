"""Offline canonical source closure and compile plan; never execute SQL or a DB.

The exact PR348 extractor remains upstream and unmodified. This module adds
explicit fixture write roots, preserves every selected source span, and emits a
mandatory second function-validation pass. Source closure is not business, ACL,
external identity, installation or runtime acceptance.
"""
from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys


HERE = Path(__file__).resolve().parent
EXTRACTOR = HERE / 'upstream/extract_catalog.py'
EXTRACTOR_SHA256 = 'f43ecd420e03caf3ab9fdf47dcc0047d16a28bf94d02a78929885e20bb6714f5'
FIXTURE_WRITE_ROOTS = frozenset({'organizations', 'organization_members', 'user_roles'})
KINDS = frozenset({'collation', 'type', 'table', 'sequence', 'function', 'constraint', 'index', 'view', 'trigger'})
SOURCE_ONLY = 'SOURCE_CLOSURE_REVIEWED_NOT_RUNTIME_ACCEPTANCE'


class CatalogBuildError(ValueError):
    pass


def require(ok, message):
    if not ok:
        raise CatalogBuildError(message)


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class CatalogBundle:
    catalog_sql: bytes
    validation_sql: bytes
    manifest: dict
    report: dict


def load_extractor():
    require(EXTRACTOR.is_file() and not EXTRACTOR.is_symlink(), 'HOLD_EXTRACTOR_ABSENT')
    require(sha(EXTRACTOR.read_bytes()) == EXTRACTOR_SHA256, 'HOLD_EXTRACTOR_BYTES_CHANGED')
    name = 'financial_compile_recovery_pinned_extractor'
    spec = importlib.util.spec_from_file_location(name, EXTRACTOR)
    module = importlib.util.module_from_spec(spec)
    # Dataclasses resolves future annotations through sys.modules.
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    except BaseException:
        sys.modules.pop(name, None)
        raise
    return module


def function_parts(statement):
    """Find an outer AS dollar body without treating quoted defaults as code."""
    text, i, state, depth, escaped = statement.sql, 0, 'normal', 0, False
    while i < len(text):
        c, pair = text[i], text[i:i + 2]
        if state == 'line':
            if c == '\n':
                state = 'normal'
        elif state == 'block':
            if pair == '/*':
                depth, i = depth + 1, i + 1
            elif pair == '*/':
                depth, i = depth - 1, i + 1
                if depth == 0:
                    state = 'normal'
        elif state == 'single':
            if c == '\\' and escaped:
                i += 1
            elif c == "'":
                if text[i + 1:i + 2] == "'":
                    i += 1
                else:
                    state = 'normal'
        elif state == 'double':
            if c == '"':
                if text[i + 1:i + 2] == '"':
                    i += 1
                else:
                    state = 'normal'
        elif pair == '--':
            state, i = 'line', i + 1
        elif pair == '/*':
            state, depth, i = 'block', 1, i + 1
        elif c == "'":
            escaped = i > 0 and text[i - 1] in 'eE' and (i < 2 or not (text[i - 2].isalnum() or text[i - 2] == '_'))
            state = 'single'
        elif c == '"':
            state = 'double'
        elif c == '$':
            tag = re.match(r'\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$', text[i:])
            if tag:
                require(re.search(r'\bAS\s*$', text[:i], re.I) is not None,
                        'HOLD_UNSUPPORTED_FUNCTION_BODY')
                start = i + len(tag[0])
                end = text.find(tag[0], start)
                require(end >= start, 'HOLD_UNCLOSED_FUNCTION_BODY')
                require(text[end + len(tag[0]):].strip() == ';', 'HOLD_FUNCTION_TRAILER')
                language = re.search(r'\bLANGUAGE\s+(sql|plpgsql)\b', text[:i], re.I)
                require(language is not None, 'HOLD_UNREVIEWED_FUNCTION_LANGUAGE')
                return text[:i], text[start:end], language[1].lower()
        i += 1
    raise CatalogBuildError('HOLD_FUNCTION_DOLLAR_BODY_REQUIRED')


def replacement_statement(statement):
    """Derive only OR REPLACE; the complete canonical header/body stays exact."""
    prefix, body, language = function_parts(statement)
    updated, count = re.subn(r'\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b',
                             'CREATE OR REPLACE FUNCTION', prefix, count=1, flags=re.I)
    require(count == 1, 'HOLD_FUNCTION_HEADER')
    value = updated + statement.sql[len(prefix):]
    # Independent byte-slice assertion guards accidental body rewriting.
    require(value[len(updated):] == statement.sql[len(prefix):], 'HOLD_FUNCTION_BODY_REWRITE')
    return value.encode('utf-8'), body, language


def review_dynamic_arguments(extractor, selected):
    dynamic = [s for s in selected if s.kind == 'function'
               and re.search(r'\bEXECUTE\s+(?:format\s*\(|[a-z_])', s.body, re.I)]
    require(all(s.name == '_assert_padre_misma_org' for s in dynamic), 'HOLD_UNREVIEWED_DYNAMIC_SQL')
    if not dynamic:
        return []
    require(len(dynamic) == 1, 'HOLD_DYNAMIC_HELPER_OVERLOAD')
    helper = re.sub(r'\s+', ' ', dynamic[0].body)
    require(re.search(r'v_col text := TG_ARGV\[0\]', helper, re.I)
            and re.search(r'v_padre text := TG_ARGV\[1\]', helper, re.I)
            and re.search(r"EXECUTE format\( 'SELECT organization_id FROM public\.%I WHERE id = \$1', v_padre \) INTO v_org USING v_id", helper, re.I),
            'HOLD_DYNAMIC_HELPER_SHAPE')
    tables = {s.name for s in selected if s.kind == 'table'}
    bindings = []
    for s in selected:
        if s.kind != 'trigger' or not re.search(r'\b_assert_padre_misma_org\s*\(', s.body):
            continue
        match = re.search(r"EXECUTE FUNCTION public\._assert_padre_misma_org\(\s*'([a-z_][a-z_0-9]*)'\s*,\s*'([a-z_][a-z_0-9]*)'\s*\)", s.body, re.I)
        require(match is not None and s.parent in tables and match[2] in tables,
                'HOLD_DYNAMIC_TRIGGER_ARGUMENTS')
        bindings.append({'trigger': s.name, 'source_ordinal': s.ordinal, 'child_table': s.parent,
                         'column_argument': match[1], 'parent_table_argument': match[2],
                         'schema': 'public', 'identifier_interpolation': 'format %I',
                         'value_binding': '$1 USING v_id', 'status': 'SOURCE_ARGUMENT_MAP_REVIEWED'})
    require(bool(bindings), 'HOLD_DYNAMIC_HELPER_WITHOUT_REVIEWED_CALLERS')
    return bindings


def installation_order(selected):
    """Keep pg-dump's interleaved table/function prerequisites; defer attachments.

    Functions can be required by table defaults, and tables by function signatures.
    Grouping all tables or all functions first would lose that original ordering.
    Bodies are deferred only during installation and validated after all objects.
    """
    priority = {'collation': 0, 'type': 0, 'table': 1, 'sequence': 1, 'function': 1,
                'constraint': 2, 'index': 3, 'view': 4, 'trigger': 5}
    require(all(s.kind in KINDS for s in selected), 'HOLD_UNSUPPORTED_STATEMENT_KIND')
    return sorted(selected, key=lambda s: (priority[s.kind], s.ordinal))


def build_catalog(baseline: bytes) -> CatalogBundle:
    """The public/CLI path always checks the original extractor and baseline pins."""
    return _assemble(baseline, load_extractor(), enforce_pin=True)


def _assemble(baseline: bytes, extractor, *, enforce_pin: bool) -> CatalogBundle:
    # Private small-fixture seam for offline lexical tests; not a CLI option.
    original_roots = extractor.ADDITIONAL_WRITE_ROOTS
    try:
        extractor.ADDITIONAL_WRITE_ROOTS = original_roots | FIXTURE_WRITE_ROOTS
        report, selected = extractor.inventory(baseline, enforce_pin=enforce_pin)
    finally:
        extractor.ADDITIONAL_WRITE_ROOTS = original_roots
    require(not any(s.name in extractor.EXCLUDED_FUNCTIONS for s in selected), 'HOLD_HISTORICAL_SEED_REACHED')
    dynamic_arguments = review_dynamic_arguments(extractor, selected)
    ordered = installation_order(selected)
    catalog = (b'-- COMPILE-ONLY canonical source; SYNTHETIC disposable database only.\n'
               b'-- Installation defers body checks; validate-functions.sql is MANDATORY afterward.\n'
               b'SET check_function_bodies = off;\n')
    catalog += b'\n'.join(s.sql.encode('utf-8') for s in ordered) + b'\n'
    validation = (b'-- MANDATORY second pass: validate exact canonical bodies after all objects exist.\n'
                  b'-- This is compilation, not behavior/ACL/identity acceptance.\n'
                  b'SET check_function_bodies = on;\n')
    objects, functions, validation_rows = [], [], []
    for s in ordered:
        objects.append({'kind': s.kind, 'schema_name': 'public', 'name': s.name,
                        'parent_name': s.parent, 'source_ordinal': s.ordinal,
                        'source_sha256': sha(s.sql.encode('utf-8'))})
    for s in sorted((s for s in selected if s.kind == 'function'), key=lambda s: s.ordinal):
        generated, body, language = replacement_statement(s)
        validation += generated + b'\n'
        functions.append({'schema_name': 'public', 'name': s.name, 'language': language,
                          'body_sha256': sha(body.encode('utf-8')), 'source_ordinal': s.ordinal,
                          'source_sha256': sha(s.sql.encode('utf-8'))})
        validation_rows.append({'source_ordinal': s.ordinal, 'sha256': sha(generated),
                                'transformation': 'CREATE OR REPLACE only; canonical body unchanged'})
    manifest = {'schema_version': 1, 'scope': 'SYNTHETIC_COMPILE_ONLY', 'complete': False,
                'source_commit': extractor.COMMIT, 'extractor_sha256': EXTRACTOR_SHA256,
                'baseline_sha256': sha(baseline), 'baseline_git_blob': extractor.git_blob(baseline),
                'baseline_bytes': len(baseline), 'catalog_sha256': sha(catalog),
                'validation_sha256': sha(validation), 'mandatory_function_validation': True,
                'validation_transformations': validation_rows,
                'counts': dict(sorted(Counter(s.kind for s in selected).items())),
                'objects': objects, 'functions': functions,
                'ordering': 'collations/types; original interleaved table/sequence/function order; constraints; indexes; views; triggers',
                'signature_verification': 'canonical source headers preserved; pg identity-argument normalization NOT_RUN',
                'runtime': 'NOT_RUN', 'business': 'NOT_RUN', 'identity': 'NOT_RUN', 'acl_rls': 'NOT_RUN'}
    report.update(status=SOURCE_ONLY, complete=False, source_closure_reviewed=True,
                  fixture_write_roots=sorted(FIXTURE_WRITE_ROOTS),
                  dynamic_argument_review=dynamic_arguments,
                  compile_recovery={'status': 'NOT_RUN', 'mandatory_second_pass': True,
                                    'check_function_bodies_during_install': 'off',
                                    'check_function_bodies_validation': 'on',
                                    'accepted_business_behavior': False})
    # Preserve original gates, including external fixtures and runtime NOT_RUN.
    # The finite argument map supplements the lexical dynamic-SQL blocker; it
    # does not silently turn every dynamic statement into an execution PASS.
    report['limitations'].extend([
        'Explicit fixture write roots include their canonical INSERT/UPDATE/DELETE triggers and transitive source dependencies.',
        'Original canonical spans are unchanged; only generated validation adds OR REPLACE.',
        'Installation requires separate synthetic external bootstrap and mandatory second-pass function validation.',
        'Source argument-map review is not SQL execution or a general dynamic SQL proof.',
    ])
    return CatalogBundle(catalog, validation, manifest, report)


def write_bundle(bundle: CatalogBundle, output: Path):
    require(not output.exists(), 'HOLD_FRESH_OUTPUT_DIRECTORY_REQUIRED')
    output.mkdir(parents=True)
    (output / 'catalog.sql').write_bytes(bundle.catalog_sql)
    (output / 'validate-functions.sql').write_bytes(bundle.validation_sql)
    for name, data in [('catalog-manifest.json', bundle.manifest), ('dependency-report.json', bundle.report)]:
        (output / name).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8', newline='\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    bundle = build_catalog(args.baseline.read_bytes())
    write_bundle(bundle, args.out)
    print(json.dumps({'status': SOURCE_ONLY, 'complete': False,
                      'counts': bundle.manifest['counts'], 'runtime': 'NOT_RUN'}))


if __name__ == '__main__':
    main()
