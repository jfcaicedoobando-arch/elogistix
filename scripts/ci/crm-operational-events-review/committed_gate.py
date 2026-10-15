"""Separate draft/base gate; no real SQL, mutable image or target arguments."""
import hashlib
import json
from collections.abc import Mapping
from pathlib import Path
import re

import gate as inherited
from gate import _object, _repository, require

ROOT = Path(__file__).resolve().parent
REPOSITORY_ROOT = ROOT.parents[2]
REPOSITORY = inherited.REPOSITORY
BASE_BRANCH = 'codex/crm-operational-event-envelope-20261015'
BRANCH = 'codex/crm-committed-state-observation'
BASE = 'a4778ec3933e2c6d04839d448fb894d76b19a6a7'
MANIFEST_SHA256 = 'e4330b0eadc41eec5dc596b1dd18d89dadc4dbc7ec09e15f69b9b9a732934da8'

def gate(event, env, head):
    """Validate the exact PR event and checkout, without Git/network/DB access."""
    event = _object(event, 'EVENT')
    require(isinstance(env, Mapping), 'ENVIRONMENT_OBJECT_REQUIRED')
    require(env.get('GITHUB_ACTIONS') == 'true', 'GITHUB_ACTIONS_REQUIRED')
    require(env.get('GITHUB_EVENT_NAME') == 'pull_request', 'PULL_REQUEST_REQUIRED')
    require(env.get('GITHUB_REPOSITORY') == REPOSITORY, 'ENVIRONMENT_REPOSITORY')
    require(event.get('action') in ('opened', 'synchronize', 'reopened'), 'EVENT_ACTION')
    _repository(event.get('repository'), 'EVENT')
    pr = _object(event.get('pull_request'), 'PULL_REQUEST')
    require(pr.get('draft') is True, 'DRAFT_REQUIRED')
    base = _object(pr.get('base'), 'BASE')
    branch = _object(pr.get('head'), 'HEAD')
    _repository(base.get('repo'), 'BASE')
    _repository(branch.get('repo'), 'HEAD')
    require(base.get('ref') == BASE_BRANCH and base.get('sha') == BASE,
            'RECORDED_STACKED_BASE_CHANGED_REVIEW_REQUIRED')
    require(branch.get('ref') == BRANCH, 'HEAD_BRANCH')
    sha = branch.get('sha')
    require(isinstance(sha, str) and re.fullmatch('[0-9a-f]{40}', sha) is not None,
            'EVENT_HEAD_SHA')
    require(isinstance(head, str) and head == sha, 'CHECKOUT_SHA_MISMATCH')
    return sha



def verify_inputs(root=REPOSITORY_ROOT):
    root = Path(root)
    inherited.verify_inputs(root)
    raw = (root / 'scripts/ci/crm-operational-events-review/committed-inputs.json').read_bytes()
    require(hashlib.sha256(raw).hexdigest() == MANIFEST_SHA256, 'COMMITTED_MANIFEST_PIN')
    manifest = json.loads(raw)
    require(manifest['source_commit'] == BASE and len(manifest['files']) == 70, 'COMMITTED_BASE_PIN')
    for relative, expected in manifest['files'].items():
        path = root / relative
        require(path.is_file() and not path.is_symlink()
                and path.resolve().is_relative_to(root.resolve()), 'COMMITTED_INPUT_PATH')
        require(hashlib.sha256(path.read_bytes()).hexdigest() == expected, 'COMMITTED_INPUT_PIN')
    return manifest


def main():
    import json
    import os
    import subprocess
    import sys

    require(len(sys.argv) == 1, 'NO_APPLICATION_ARGUMENTS')
    event = json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text(encoding='utf8'))
    head = subprocess.run(['git', 'rev-parse', 'HEAD'], check=True, text=True,
                          capture_output=True).stdout.strip()
    head = gate(event, dict(os.environ), head)
    inputs = verify_inputs()
    print(json.dumps({'status': 'pass', 'checkout': head, 'inputs': inputs}, indent=2))


if __name__ == '__main__':
    main()
