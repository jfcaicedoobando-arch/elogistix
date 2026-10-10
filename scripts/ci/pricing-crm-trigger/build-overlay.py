#!/usr/bin/env python3
"""Derive explicit baseline/candidate tests; never write into the frozen bundle.

No database execution, network, or executable shell construction occurs here.
Inputs are pinned to the reviewed diagnostic head d1e94d2d45195e21a55b4d40970a8f0275d4a2af.
"""
import argparse
import hashlib
import json
from pathlib import Path

ASSERTIONS_SHA256 = '6a1933e7ff623bd47c52c65e4f0ba32ce524d9522e127dbf2c75b192b54975ed'
REPLAY_SHA256 = '77d60cb54a2cc7804b08a9fe69d2f42f38481e123c143a590dabd6e2c742c41e'
NOTICES_SHA256 = '64869142a0d9ba329942e88b9eae5256b0c6680829d370bf2936378e5b17ca54'
OLD_TRIGGER = 'CREATE TRIGGER trg_crm_sync_oportunidad_desde_cotizacion AFTER INSERT OR UPDATE OF subtotal, moneda, cliente_id, oportunidad_id ON cotizaciones FOR EACH ROW EXECUTE FUNCTION _crm_sync_oportunidad_desde_cotizacion()'
NEW_TRIGGER = OLD_TRIGGER.replace('oportunidad_id ON', 'oportunidad_id, conceptos_venta ON')
BEFORE_L04 = "SET LOCAL ROLE authenticated;\nUPDATE public.cotizaciones SET conceptos_venta="
AFTER_L04 = " RAISE NOTICE 'PASS L04: authenticated ordinary save recalculates totals and opportunity amount without changing lineage';\nEND $assert$;\n"
OLD_C07 = 'PASS C07: all 45 original user triggers on thirteen mutation tables'
NEW_C07 = 'PASS C07: all 45 user triggers; only the reviewed CRM conceptos_venta watch column differs'
W01 = 'PASS W01: wizard-shaped save synchronizes 340; savepoint restores the pre-L04 251 amounts'
R01 = 'PASS R01: repeated concepts-only save keeps 300 and causes no physical CRM row rewrite'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def exactly_once(value, old, new):
    if value.count(old) != 1:
        raise ValueError(f'Expected exactly one reviewed anchor: {old[:90]}')
    return value.replace(old, new, 1)


def build(bundle, output):
    bundle, output = bundle.resolve(), output.resolve()
    if output == bundle or bundle in output.parents or output in bundle.parents:
        raise ValueError('Overlay output must be separate from the frozen bundle')
    source_bytes = (bundle / 'assertions.sql').read_bytes()
    notices_bytes = (bundle / 'expected-notices.json').read_bytes()
    if (sha(source_bytes) != ASSERTIONS_SHA256
            or sha((bundle / 'replay.sql').read_bytes()) != REPLAY_SHA256
            or sha(notices_bytes) != NOTICES_SHA256):
        raise ValueError('Frozen diagnostic assertion/replay/notice hash mismatch')
    source = source_bytes.decode('utf-8')
    snippets = Path(__file__).resolve().parent
    wizard = (snippets / 'wizard-payload.sql').read_text()
    repeated = (snippets / 'repeated-concepts.sql').read_text()
    baseline = exactly_once(source, BEFORE_L04, wizard + BEFORE_L04)
    candidate = exactly_once(baseline, OLD_TRIGGER, NEW_TRIGGER)
    candidate = exactly_once(candidate, OLD_C07, NEW_C07)
    candidate = exactly_once(candidate, AFTER_L04, AFTER_L04 + repeated)
    # Both L04 predicates, original UPDATE, exception and scalar diagnostics remain literal.
    l04 = source[source.index(BEFORE_L04):source.index(AFTER_L04) + len(AFTER_L04)]
    assert l04 in baseline and l04 in candidate
    assert candidate.count('AND monto_estimado=300') == source.count('AND monto_estimado=300')
    original_notices = json.loads(notices_bytes)
    if len(original_notices) != 30 or original_notices[26] not in AFTER_L04:
        raise ValueError('Unexpected frozen notice contract')
    baseline_notices = original_notices[:26] + [W01]
    candidate_notices = original_notices.copy()
    candidate_notices[candidate_notices.index(OLD_C07)] = NEW_C07
    candidate_notices.insert(candidate_notices.index(original_notices[26]), W01)
    candidate_notices.insert(candidate_notices.index(original_notices[26]) + 1, R01)
    output.mkdir(parents=True, exist_ok=True)
    outputs = {
        'baseline-assertions.sql': baseline,
        'candidate-assertions.sql': candidate,
        'baseline-expected-notices.json': json.dumps(baseline_notices, indent=2) + '\n',
        'candidate-expected-notices.json': json.dumps(candidate_notices, indent=2) + '\n',
    }
    for name, contents in outputs.items():
        (output / name).write_text(contents)
    report = {
        'source_assertions_sha256': ASSERTIONS_SHA256,
        'source_replay_sha256': REPLAY_SHA256,
        'source_notices_sha256': NOTICES_SHA256,
        'source_files_unchanged': all(sha((bundle / name).read_bytes()) == expected for name, expected in (
            ('assertions.sql', ASSERTIONS_SHA256), ('replay.sql', REPLAY_SHA256),
            ('expected-notices.json', NOTICES_SHA256))),
        'original_l04_block_preserved': True,
        'baseline_expected_pass_notices_before_required_l04_failure': len(baseline_notices),
        'candidate_expected_pass_notices': len(candidate_notices),
        'outputs': {name: sha(contents.encode()) for name, contents in outputs.items()},
        'sql_runtime_executed': False,
    }
    (output / 'overlay-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.bundle, args.output), indent=2))
