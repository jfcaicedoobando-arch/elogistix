"""Admission and byte-integrity regressions. No SQL, Docker or network calls."""
import copy
from pathlib import Path
import shutil
import tempfile
from types import MappingProxyType
import unittest

from gate import (BASE, BASE_BRANCH, BRANCH, CANONICAL_SHA256, IMAGE, INPUT_SHA256,
                  OWNER, REPOSITORY, REPOSITORY_ROOT, gate, verify_inputs)


class EventGate(unittest.TestCase):
    def setUp(self):
        self.head = 'a' * 40
        repository = {'full_name': REPOSITORY, 'owner': {'login': OWNER}}
        self.event = {'action': 'opened', 'repository': copy.deepcopy(repository),
                      'pull_request': {'draft': True,
                                       'base': {'ref': BASE_BRANCH, 'sha': BASE, 'repo': copy.deepcopy(repository)},
                                       'head': {'ref': BRANCH, 'sha': self.head, 'repo': copy.deepcopy(repository)}}}
        self.env = {'GITHUB_ACTIONS': 'true', 'GITHUB_EVENT_NAME': 'pull_request',
                    'GITHUB_REPOSITORY': REPOSITORY}

    def rejects(self, event=None, env=None, head=None):
        with self.assertRaisesRegex(RuntimeError, '^CRM_EVENT_GATE_'):
            gate(self.event if event is None else event,
                 self.env if env is None else env, self.head if head is None else head)

    def test_accepts_only_supported_draft_event_with_exact_checkout(self):
        for action in ('opened', 'synchronize', 'reopened'):
            with self.subTest(action=action):
                event = copy.deepcopy(self.event)
                event['action'] = action
                self.assertEqual(gate(event, self.env, self.head), self.head)

    def test_environment_mapping_is_supported_without_mutation(self):
        self.assertEqual(gate(self.event, MappingProxyType(self.env), self.head), self.head)

    def test_base_is_recorded_parent_not_main_or_a_later_tip(self):
        self.assertEqual(BASE, '3ca13983dc08c075155da9910e4f042aae90c2fe')
        for wrong in ('5d1f00d27628100a58ab166367a067ea90068b84',
                      '8887cb5c11307b420719ec4430bb8eed2d44b121', 'b' * 40, None):
            with self.subTest(wrong=wrong):
                event = copy.deepcopy(self.event)
                event['pull_request']['base']['sha'] = wrong
                self.rejects(event=event)

    def test_wrong_base_branch_rejects_even_with_the_recorded_hash(self):
        for wrong in ('main', BRANCH, BASE_BRANCH + '-changed', None):
            event = copy.deepcopy(self.event)
            event['pull_request']['base']['ref'] = wrong
            self.rejects(event=event)

    def test_wrong_head_branch_rejects(self):
        for wrong in ('main', BASE_BRANCH, BRANCH + '-changed', None):
            event = copy.deepcopy(self.event)
            event['pull_request']['head']['ref'] = wrong
            self.rejects(event=event)

    def test_only_boolean_draft_true_admitted(self):
        for wrong in (False, None, 1, 'true'):
            event = copy.deepcopy(self.event)
            event['pull_request']['draft'] = wrong
            self.rejects(event=event)

    def test_local_manual_and_privileged_event_modes_rejected(self):
        for key, wrong in (('GITHUB_ACTIONS', 'false'), ('GITHUB_ACTIONS', None),
                           ('GITHUB_EVENT_NAME', 'workflow_dispatch'),
                           ('GITHUB_EVENT_NAME', 'pull_request_target'),
                           ('GITHUB_REPOSITORY', 'other/elogistix')):
            with self.subTest(key=key, wrong=wrong):
                env = dict(self.env)
                env[key] = wrong
                self.rejects(env=env)
        for action in ('closed', 'ready_for_review', 'edited', None):
            event = copy.deepcopy(self.event)
            event['action'] = action
            self.rejects(event=event)

    def test_fork_repository_or_owner_rejected_on_every_event_side(self):
        for location in (('repository',), ('pull_request', 'base', 'repo'),
                         ('pull_request', 'head', 'repo')):
            for field in ('full_name', 'owner'):
                with self.subTest(location=location, field=field):
                    event = copy.deepcopy(self.event)
                    target = event
                    for item in location:
                        target = target[item]
                    target[field] = 'other/elogistix' if field == 'full_name' else {'login': 'other'}
                    self.rejects(event=event)

    def test_checkout_must_equal_well_formed_event_head(self):
        for wrong in ('b' * 40, 'a' * 39, 'a' * 41, self.head + '\n', ''):
            self.rejects(head=wrong)
        for wrong in ('A' * 40, 'a' * 39, 'g' * 40, None, 1):
            event = copy.deepcopy(self.event)
            event['pull_request']['head']['sha'] = wrong
            self.rejects(event=event)

    def test_malformed_missing_objects_fail_closed(self):
        for event in ({}, {'pull_request': None}, [], None):
            with self.assertRaisesRegex(RuntimeError, '^CRM_EVENT_GATE_'):
                gate(event, self.env, self.head)
        for location in ('base', 'head'):
            event = copy.deepcopy(self.event)
            event['pull_request'][location] = None
            self.rejects(event=event)


class ImmutableInputs(unittest.TestCase):
    def test_current_inherited_files_match_measured_parent_bytes(self):
        result = verify_inputs()
        self.assertEqual(result['source_commit'], BASE)
        self.assertEqual(result['canonical_sha256'], CANONICAL_SHA256)
        self.assertEqual(result['files'], INPUT_SHA256)
        self.assertEqual(result['image'], IMAGE)
        self.assertRegex(IMAGE, r'^postgres@sha256:[0-9a-f]{64}$')

    def test_changed_payload_mirror_or_inherited_runner_rejects(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for relative in INPUT_SHA256:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(REPOSITORY_ROOT / relative, target)
            self.assertEqual(verify_inputs(root)['files'], INPUT_SHA256)
            for relative in ('drizzle/migrations/0021_crm_helpers_owner_only.sql',
                             'supabase/migrations/20261015194324_crm_helpers_owner_only.sql',
                             'scripts/ci/crm-canonical-review/run_ci.py'):
                with self.subTest(relative=relative):
                    target = root / relative
                    original = target.read_bytes()
                    target.write_bytes(original + b'\n')
                    with self.assertRaisesRegex(RuntimeError, 'CRM_EVENT_GATE_INPUT_HASH_'):
                        verify_inputs(root)
                    target.write_bytes(original)

    def test_missing_source_rejects(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(RuntimeError, 'CRM_EVENT_GATE_UNSAFE_INPUT_'):
                verify_inputs(Path(temporary))

    def test_workflow_keeps_exact_checkout_read_only_permissions_and_evidence(self):
        source = (REPOSITORY_ROOT / '.github/workflows/crm-operational-events-review.yml').read_text()
        self.assertIn('branches: [' + BASE_BRANCH + ']', source)
        self.assertIn("base.sha == '" + BASE + "'", source)
        self.assertIn("base.sha != '" + BASE + "'", source)
        self.assertIn('ref: ${{ github.event.pull_request.head.sha }}', source)
        self.assertIn('persist-credentials: false', source)
        self.assertIn('permissions:\n  contents: read\n', source)
        self.assertNotIn('pull_request_target:', source)
        self.assertNotIn('workflow_dispatch:', source)
        self.assertNotIn('secrets.', source)
        self.assertIn('if: always()', source)
        self.assertIn('run_event_ci.py --output "$RUNNER_TEMP/crm-event-evidence"', source)


if __name__ == '__main__':
    unittest.main()
