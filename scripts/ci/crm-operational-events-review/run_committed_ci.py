#!/usr/bin/env python3
"""Owned committed-state observations only; no DSN or operational application."""
import argparse
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parent
LAB = ROOT.parent / 'crm-canonical-review'
sys.path.insert(0, str(LAB))
sys.path.insert(0, str(ROOT))

from committed_gate import BASE, REPOSITORY, gate, verify_inputs
from public_source import verify_source


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    require(os.environ.get('GITHUB_ACTIONS') == 'true', 'GitHub Actions only')
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())
    head = subprocess.run(['git', 'rev-parse', 'HEAD'], check=True, text=True,
                          capture_output=True).stdout.strip()
    commit = gate(event, os.environ, head)
    inputs = verify_inputs()
    from run_ci import CRMRunner
    from committed_cases import COMMITTED_CASES, run_committed_cases
    public = verify_source()
    args.output.mkdir(parents=True, exist_ok=False)
    (args.output / 'logs').mkdir()
    runner = CRMRunner(args.output, uuid.uuid4().hex)
    runner.result.update(workflow_commit=commit, event_head_sha=event['pull_request']['head']['sha'],
                         event_base_sha=event['pull_request']['base']['sha'], source_commit=BASE,
                         input_manifest=inputs, public_source={k: v for k, v in public.items() if k != 'body'},
                         run_url='https://github.com/' + REPOSITORY + '/actions/runs/' + os.environ['GITHUB_RUN_ID'],
                         operational_admission='NOT_ADMITTED', real_database_actions=0,
                         limits=['Public handler on disposable synthetic fixtures only; not a real target profile',
                                 'No full ERP replay, operational transport, external consumer or DDL/ACL window proof',
                                 'No operational renderer admission; lab renderer and proposal fences stay intact',
                                 'F2 owner ACL normalization and external pre-read appliers remain limits'])

    def interrupted(number, frame):
        raise RuntimeError('Interrupted by signal ' + str(number))

    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)
    runner.save()
    try:
        runner.start()
        runner.prepare()
        run_committed_cases(runner)
        checks = runner.result['checks']
        names = [item['case'] for item in checks]
        expected_cases = COMMITTED_CASES
        require(len(names) == len(expected_cases) and set(names) == set(expected_cases)
                and len(set(names)) == len(names), 'Incomplete or duplicate event matrix')
        require(all(item['status'] == 'pass' for item in checks), 'Unexpected event status')
        runner.result['status'] = 'checks_pass_cleanup_pending'
        runner.save()
    except BaseException as exc:
        runner.result.update(status='failed', error=str(exc))
        runner.save()
        raise
    finally:
        try:
            runner.cleanup()
        except BaseException as exc:
            runner.result.update(status='failed', cleanup='failed', cleanup_error=str(exc))
            raise
        finally:
            runner.save()
    require(runner.result['status'] == 'checks_pass_cleanup_pending'
            and runner.result['cleanup'] == 'confirmed_stopped_and_removed', 'Tests or cleanup incomplete')
    runner.result['status'] = 'pass'
    runner.save()
    print(json.dumps(runner.result, indent=2))


if __name__ == '__main__':
    main()
