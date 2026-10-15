"""CI-only admission for the synthetic event-trigger envelope review.

The recorded stacked PR base is immutable. Neither current main nor a later
parent-branch tip substitutes for that event base. This admits no real database,
private contract, transport, operational application, or previous DDL window.
"""
import hashlib
from collections.abc import Mapping
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parent
REPOSITORY_ROOT = ROOT.parents[2]
REPOSITORY = 'jfcaicedoobando-arch/elogistix'
OWNER = 'jfcaicedoobando-arch'
BASE_BRANCH = 'fix/crm-canonical-owner-only-20261015'
BRANCH = 'codex/crm-operational-event-envelope-20261015'
BASE = '3ca13983dc08c075155da9910e4f042aae90c2fe'
CANONICAL_SHA256 = '32173fdde2d456d6d9da8f46b54e38f4535b699b3ca36d921f93f444105fecc6'
IMAGE = 'postgres@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3'

# Measured from the unchanged files at the recorded parent commit above.
# No mutable tag, arbitrary image, private evidence or regenerated hash is used.
INPUT_SHA256 = {
    'drizzle/migrations/meta/_journal.json': '397060687921b1c9996b177906a8d775c6991e9f8c664e63f7389287b577fa37',
    'drizzle/migrations/0021_crm_helpers_owner_only.sql': CANONICAL_SHA256,
    'supabase/migrations/20261015194324_crm_helpers_owner_only.sql': CANONICAL_SHA256,
    'scripts/ci/crm-canonical-review/run_ci.py': 'd85fd4ea06f9db197fcef56898a806e365a27145be94254192023257d053ae6f',
    'scripts/ci/crm-canonical-review/adapter.py': '44ee06881c763e188e30071a87c7c42723b93463dbbde90c3cc31b6f227c67c3',
    'scripts/ci/crm-canonical-review/snapshot.sql': 'a7241e66e1295e63cbac3d6add3cb05b11e9ed8ce5410f7d91325c610152fd5a',
    'scripts/ci/crm-canonical-review/direct_wrapper.py': '070aa6ee9288ef5d93315361431c5bdfa4176a997b3db14858dbbb9ea7623408',
    'scripts/ci/crm-canonical-review/cases.py': 'e01107b059a3d425d0ddae099a79774b9573ef5053d847afccff14022eedc5d6',
    'scripts/ci/crm-canonical-review/wrapper_cases.py': 'c76e7b57eb33be2e5549c9eb067f9116b7a198e6e26b74e3d41054851d1fc37e',
    'scripts/ci/crm-canonical-review/test_operational_capture.py': '31eee0f3a5646d84d3ac857a639f394b28c68c1a203b12a4ec09c5e7642e31c3',
    'scripts/ci/crm-canonical-review/operational-capture/01_discovery.sql': '7dbbf36e2f704a1e1350cdfaa7dfd8e43b370372f0b662d0ab8948ccecd25685',
    'scripts/ci/crm-canonical-review/operational-capture/02_scoped_catalog.sql': '172ccf1ca4d297cb8eead617f9436630bcda85015faeb255cec868c085b05877',
    'scripts/ci/crm-canonical-review/operational-capture/03_drizzle_history.sql': '78a8f6e39608cac363c65ddf085d18a1ce062263d0e972d69e993d9f9f534338',
    'scripts/ci/crm-canonical-review/operational-capture/04_supabase_manifest.sql': '54909cb2826865a3b262ede06577c8202d3037a62f1bff7263538525ab5ce493',
    'scripts/ci/crm-canonical-review/operational-capture/05_supabase_page.sql': '1c77c12c6436031d7fdf2009040dbaa2a89da5a9448e4c487027de8191f1a871',
    'scripts/ci/crm-canonical-review/operational-capture/06_activity.sql': 'b0dd88bc039a71bdad7bc7937d70289093af6abca7e6d5928206a40d9cbdce40',
    'scripts/ci/crm-canonical-review/operational-capture/evidence.schema.json': '0728816422e9463eb4e0a52c355e5741a8bc38098a17ecb2a6dcfb166034da23',
    'scripts/ci/crm-canonical-review/input-manifest.json': '24c78ac78315789725ee5b4c665495fb52b15f147fbbeb586bae883480195ebc',
    'scripts/ci/crm-canonical-review/inputs/fixture.sql': 'dcdcf15c0f9c3b71d5ae4721bef20afc91158f98bdb60cedd93372631ff31631',
    'scripts/ci/crm-canonical-review/inputs/sources/0016_crm_empresa_desde_cliente.sql': '9a1092ca7e9a59a2166140c19a182f05c562284e10db489e998cdb098d14a629',
    'scripts/ci/crm-canonical-review/inputs/sources/0017_crm_empresa_no_borrar_cliente.sql': '548be2b88fde30174ce4b90fdc333cd6f745f0948bf331907de879ee5c95bcdb',
    'scripts/ci/crm-canonical-review/inputs/sources/0018_cargos_tarifario_aplica_iva.sql': 'e54c5f4dce851c8d30d3c71336c315ae7b600c72a5a5cc1d5194b908cbbbadee',
}


def require(condition, message):
    if not condition:
        raise RuntimeError('CRM_EVENT_GATE_' + message)


def _object(value, label):
    require(isinstance(value, dict), label + '_OBJECT_REQUIRED')
    return value


def _repository(value, label):
    repo = _object(value, label)
    require(repo.get('full_name') == REPOSITORY, label + '_REPOSITORY')
    owner = _object(repo.get('owner'), label + '_OWNER')
    require(owner.get('login') == OWNER, label + '_OWNER')


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
    """Verify exact inherited bytes before importing or executing the harness."""
    root = Path(root)
    require(root.is_dir() and not root.is_symlink(), 'INPUT_ROOT')
    resolved_root = root.resolve()
    for relative, wanted in INPUT_SHA256.items():
        path = root / relative
        require(path.is_file() and not path.is_symlink()
                and path.resolve().is_relative_to(resolved_root), 'UNSAFE_INPUT_' + relative)
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        require(actual == wanted, 'INPUT_HASH_' + relative)
    return {'source_commit': BASE, 'canonical_sha256': CANONICAL_SHA256,
            'image': IMAGE, 'files': dict(INPUT_SHA256)}


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
