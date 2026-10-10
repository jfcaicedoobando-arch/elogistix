#!/usr/bin/env python3
"""Derive isolated auth coverage while preserving the reviewed baseline exactly."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile

PLAN = Path(__file__).resolve().parent
REVIEWED_BUILDER_HASH = 'd3154291e5041dcac8fbf197380486518a9f640b3f294a9fb52fed23eb8d54ce'
ANCHOR = 'DO $assert$\nDECLARE first_result jsonb; second_result jsonb; keys text[]; before_retry jsonb; after_retry jsonb; physical_before tid; physical_after tid;\n'
OLD_HEADER = '-- All fixture rows and test mutations below roll back. No GRANT, REVOKE, disabled\n-- trigger, altered policy, function replacement, real account, or production data.\n'
NEW_HEADER = '-- All fixture rows and mutations roll back. The added coverage snippets grant\n-- only the candidate RPC inside savepoints and verify rollback of every grant.\n-- No disabled trigger, changed policy/function, real account, or production data.\n'
CASES = [('AP01', 'seller own', True), ('AP02', 'seller other', False), ('AP03', 'operational staff other', True), ('AP04', 'commercial manager other', True), ('AP05', 'tenant admin other', True), ('AP06', 'quote writer without CRM update', False), ('AP07', 'Pricing writer without CRM update', False), ('AP08', 'read-only staff', False), ('AP09', 'client with own portal quote', False), ('AP10', 'agent with own tariff', False), ('AP11', 'authenticated SQL role without subject', False), ('AP12', 'membership belongs to another tenant', False), ('AP13', 'membership revoked', False), ('AP14', 'super admin selected tenant', True), ('AP15', 'super admin without selection', False), ('AP16', 'super admin other selected tenant', False)]

def sha(data):
    return hashlib.sha256(data).hexdigest()


def reviewed_builder():
    path = PLAN / 'reviewed-build-overlay.py'
    if path.is_symlink() or sha(path.read_bytes()) != REVIEWED_BUILDER_HASH:
        raise ValueError('Reviewed baseline/candidate builder changed')
    spec = importlib.util.spec_from_file_location('reviewed_paired_overlay', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# Preserve the existing tests' literal original-L04 checks without rewriting them.
_reviewed = reviewed_builder()
BEFORE_L04, AFTER_L04 = _reviewed.BEFORE_L04, _reviewed.AFTER_L04
W01, R01 = _reviewed.W01, _reviewed.R01


def build(bundle, output):
    bundle, output = bundle.resolve(), output.resolve()
    if output == bundle or bundle in output.parents or output in bundle.parents:
        raise ValueError('Overlay output must be separate from the frozen bundle')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pricing-auth-build-', dir=output.parent) as temporary:
        reviewed_dir = Path(temporary) / 'reviewed'
        original_report = _reviewed.build(bundle, reviewed_dir)
        original = (reviewed_dir / 'candidate-assertions.sql').read_text()
        original_notices = json.loads((reviewed_dir / 'candidate-expected-notices.json').read_text())
        if len(original_notices) != 32 or original.count(ANCHOR) != 1 or original.count(OLD_HEADER) != 1:
            raise ValueError('Reviewed pre-L03 anchor or notice contract changed')
        snippet = (PLAN / 'authenticated-entry.sql').read_text()
        compatibility = (PLAN / 'compatibility-smokes.sql').read_text()
        insertion_sql = snippet + '\n' + compatibility + '\n'
        candidate = original.replace(ANCHOR, insertion_sql + ANCHOR, 1).replace(OLD_HEADER, NEW_HEADER, 1)
        if candidate.replace(insertion_sql, '', 1).replace(NEW_HEADER, OLD_HEADER, 1) != original:
            raise ValueError('Original candidate assertions were modified')
        additions = ['PASS AP00: single-RPC temporary grant inside disposable savepoint']
        for ident, label, allowed in CASES:
            expected = 'link and no-write retry' if allowed else ('LC_SIN_SESION' if ident == 'AP11' else 'LC_PRICING_ORIGEN_NO_AUTORIZADO')
            additions.append(f'PASS {ident}: authenticated {label}; expected {expected}; case rolled back')
        additions.append('PASS AP17: temporary grant and all authorization fixtures rolled back; original assertions resume')
        compatibility_notices = json.loads((PLAN / 'compatibility-expected-notices.json').read_text())
        if len(compatibility_notices) != 3 or [n.split(':', 1)[0] for n in compatibility_notices] != ['PASS CP01', 'PASS CP02', 'PASS CP03']:
            raise ValueError('Compatibility notice contract changed')
        all_additions = additions + compatibility_notices
        insertion = next(i for i, value in enumerate(original_notices) if value.startswith('PASS L03:'))
        notices = original_notices[:insertion] + all_additions + original_notices[insertion:]
        outputs = {
            'baseline-assertions.sql': (reviewed_dir / 'baseline-assertions.sql').read_text(),
            'baseline-expected-notices.json': (reviewed_dir / 'baseline-expected-notices.json').read_text(),
            'candidate-assertions.sql': candidate,
            'candidate-expected-notices.json': json.dumps(notices, indent=2) + '\n',
        }
        report = {
            'reviewed_paired_report': original_report,
            'reviewed_builder_sha256': REVIEWED_BUILDER_HASH,
            'authenticated_snippet_sha256': sha(snippet.encode()),
            'compatibility_snippet_sha256': sha(compatibility.encode()),
            'original_assertions_preserved': True,
            'baseline_expected_pass_notices_before_required_l04_failure': 27,
            'original_candidate_expected_pass_notices': 32,
            'authenticated_expected_pass_notices': len(additions),
            'compatibility_expected_pass_notices': len(compatibility_notices),
            'candidate_expected_pass_notices': len(notices),
            'outputs': {name: sha(text.encode()) for name, text in outputs.items()},
            'sql_runtime_executed': False,
        }
    output.mkdir(parents=True, exist_ok=True)
    for name, text in outputs.items():
        (output / name).write_text(text)
    (output / 'overlay-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.bundle, args.output), indent=2))
