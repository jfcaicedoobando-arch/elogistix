#!/usr/bin/env python3
"""Fail closed: expected baseline L04 regression AND independent candidate success."""
import importlib.util
import json
from pathlib import Path
import re
import sys

PLAN = Path(__file__).resolve().parent
ERROR = 'L04: ordinary save lost lineage or failed recalculation'
DETAIL = {'expected_subtotal': 300, 'expected_opportunity_amount': 300,
          'quotation_subtotal': 300, 'pricing_lineage_matches': True,
          'opportunity_amount': 251}
SEVERITY = re.compile(r'^(?:psql:[^\r\n]+:\d+: )?(ERROR|FATAL|PANIC|WARNING):\s*(.*)$', re.M)
NOTICES = re.compile(r'^(?:psql:[^\r\n]+:\d+: )?NOTICE:  ([^\r\n]+)$', re.M)


def load_module(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), PLAN / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def exact(path, expected):
    if path.is_symlink() or path.read_text() != expected:
        raise ValueError(f'Missing or unexpected evidence: {path.name}')


def no_errors(path):
    if SEVERITY.search(path.read_text()):
        raise ValueError(f'Unexpected SQL diagnostic: {path.name}')


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate diagnostic key')
        result[key] = value
    return result


def validate_assertions(log, expected, arm, code):
    actual = NOTICES.findall(log)
    if actual != expected or len(actual) != (27 if arm == 'baseline' else 53):
        raise ValueError('Missing, duplicate, unexpected or reordered assertion notices')
    diagnostics = SEVERITY.findall(log)
    if arm == 'baseline':
        if code != 3 or diagnostics != [('ERROR', ERROR)]:
            raise ValueError('Baseline must fail ONLY at the exact L04 error with psql exit 3')
        error_line = re.search(r'^psql:/overlay/baseline-assertions\.sql:\d+: ERROR:  ' + re.escape(ERROR) + r'\n', log, re.M)
        if not error_line:
            raise ValueError('Wrong baseline error source or format')
        # No messages or successful SQL may follow the expected failure. This also
        # prevents a second unrelated failure from being hidden behind L04.
        tail = log[error_line.end():]
        match = re.fullmatch(r'DETAIL:  (\{[^\r\n]+\})\nCONTEXT:  PL/pgSQL function inline_code_block line \d+ at RAISE\n', tail)
        if not match:
            raise ValueError('Missing, extra or malformed L04 diagnostic lines')
        detail = json.loads(match[1], object_pairs_hook=unique_object)
        if set(detail) != set(DETAIL) or detail['pricing_lineage_matches'] is not True:
            raise ValueError('Unexpected L04 diagnostic fields or lineage')
        if any(type(detail[key]) not in (int, float) or detail[key] != value
               for key, value in DETAIL.items() if key != 'pricing_lineage_matches'):
            raise ValueError('L04 diagnostic amounts differ')
        if detail != DETAIL:
            raise ValueError('Unexpected baseline diagnostic')
    elif arm == 'candidate':
        if code != 0 or diagnostics or not actual[-1].startswith('PASS Z01:'):
            raise ValueError('Candidate must succeed through Z01 without SQL diagnostics')
    else:
        raise ValueError('Unknown arm')
    return actual


def hash_log(path, manifest):
    expected = [line.split('  ', 1)[1] + ': OK' for line in manifest.read_text().splitlines()]
    if path.read_text().splitlines() != expected:
        raise ValueError(f'Hash verification was incomplete: {path.name}')


def validate_arm(evidence, arm, overlay):
    directory = evidence / arm
    expected = json.loads((overlay / (arm + '-expected-notices.json')).read_text())
    code = 3 if arm == 'baseline' else 0
    for name in ('assertion-exit.txt', 'docker-start-exit.txt'):
        exact(directory / name, f'{code}\n')
    exact(directory / 'status.txt', f'exit_code={code}\ncluster_disposed=true\n')
    exact(directory / 'container-state.txt', f'{code} false ""\n')
    exact(directory / 'disposal-status.txt', 'container_disposed=true\nanonymous_volumes_disposed=true\n')
    exact(directory / 'load-exit.txt', '0\n')
    no_errors(directory / 'load.log')
    hash_log(directory / 'frozen-hashes.log', PLAN / 'frozen-SHA256SUMS')
    hash_log(directory / 'candidate-hashes.log', PLAN / 'SHA256SUMS')
    hash_log(directory / 'overlay-hashes.log', overlay / 'SHA256SUMS')
    version = (directory / 'postgres-version.txt').read_text()
    if not re.fullmatch(r'psql \(PostgreSQL\) 17\.[^\r\n]+\n', version):
        raise ValueError('PostgreSQL 17 version evidence missing')
    server_version = (directory / 'postgres-server-version.txt').read_text()
    if not re.fullmatch(r'17[0-9]{4}\nPostgreSQL 17\.[^\r\n]+\n', server_version):
        raise ValueError('PostgreSQL 17 server version evidence missing')
    exact(directory / 'server-version.log', '')
    cid = (directory / 'container-id.txt').read_text().strip()
    sources = {'/bundle': str(PLAN.parent / 'pricing-rpc-bounded'), '/candidate': str(PLAN), '/overlay': str(overlay)}
    verified = load_module('verify-container').verify_container(
        json.loads((directory / 'container-inspect.json').read_text()), arm, sources, cid)
    if json.loads((directory / 'isolation.json').read_text()) != verified:
        raise ValueError('Isolation evidence mismatch')
    if (directory / 'anonymous-volumes.txt').read_text().split() != verified['anonymous_volumes']:
        raise ValueError('Owned anonymous-volume manifest mismatch')
    if arm == 'baseline':
        if any((directory / name).exists() for name in ('migration.log', 'migration-exit.txt', 'final-acl.log', 'final-acl-exit.txt')):
            raise ValueError('Baseline unexpectedly applied migration or continued after L04')
    else:
        exact(directory / 'migration-exit.txt', '0\n')
        # The reviewed standalone migration must commit, not merely exit cleanly.
        exact(directory / 'migration.log', 'BEGIN\nSET\nSET\nSET\nLOCK TABLE\nDO\nCOMMIT\n')
        exact(directory / 'final-acl-exit.txt', '0\n')
        exact(directory / 'final-acl.log', 'DO\n')
    assertions = validate_assertions((directory / 'assertions.log').read_text(), expected, arm, code)
    return {'arm': arm, 'status': 'expected-regression' if arm == 'baseline' else 'passed',
            'psql_exit': code, 'notices': assertions, 'notice_count': len(assertions),
            'container_id': cid, 'postgres_version': version.strip(),
            'postgres_server_version': server_version.strip(), 'cluster_disposed': True,
            'container_disposed': True, 'anonymous_volumes_disposed': True,
            'final_acl_checked': arm == 'candidate'}


def verify_evidence(evidence):
    inputs = load_module('verify-inputs').verify_inputs()
    if json.loads((evidence / 'input-verification.json').read_text()) != inputs:
        raise ValueError('Input verification changed during execution')
    exact(evidence / 'postgres-image.txt', inputs['image'] + '\n')
    if not re.fullmatch(r'[a-f0-9]{40}\n', (evidence / 'checkout-commit.txt').read_text()):
        raise ValueError('Missing checkout commit')
    overlay = evidence / 'overlay'
    load_module('verify-overlay').verify_overlay(overlay)
    results = [validate_arm(evidence, arm, overlay) for arm in ('baseline', 'candidate')]
    if results[0]['container_id'] == results[1]['container_id']:
        raise ValueError('Arms reused a container')
    if (results[0]['postgres_version'] != results[1]['postgres_version']
            or results[0]['postgres_server_version'] != results[1]['postgres_server_version']):
        raise ValueError('Arms used different PostgreSQL versions')
    return {'status': 'two-arm-contract-passed', 'arms': results,
            'scope': 'disposable frozen baseline and authenticated candidate coverage with CI-only trigger fixture',
            'application_execute_enabled_at_end': False, 'temporary_authenticated_execute_tested': True, 'production_or_http_validation': False,
            'artifact_upload_required_separately': True}


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('Usage: verify-evidence.py EVIDENCE_DIRECTORY')
    print(json.dumps(verify_evidence(Path(sys.argv[1]).resolve()), indent=2))
