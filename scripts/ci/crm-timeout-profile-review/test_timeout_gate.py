"""Independent draft/base fences, immutable inherited bytes, no local runtime."""
import copy
from pathlib import Path
import unittest
from unittest.mock import patch

import timeout_gate as gate


class TimeoutGateTests(unittest.TestCase):
    def fixture(self):
        repo = dict(full_name=gate.REPOSITORY, owner=dict(login='jfcaicedoobando-arch'))
        event = dict(action='opened', repository=copy.deepcopy(repo), pull_request=dict(draft=True,
            base=dict(repo=copy.deepcopy(repo)), head=dict(repo=copy.deepcopy(repo), sha='a' * 40)))
        event['pull_request']['base'].update(ref=gate.BASE_BRANCH, sha=gate.BASE)
        event['pull_request']['head']['ref'] = gate.BRANCH
        env = dict(GITHUB_ACTIONS='true', GITHUB_EVENT_NAME='pull_request', GITHUB_REPOSITORY=gate.REPOSITORY)
        return event, env, event['pull_request']['head']['sha']

    def test_exact_draft_event_and_head(self):
        event, env, head = self.fixture()
        self.assertEqual(gate.gate(event, env, head), head)

    def test_parent_branch_movement_other_heads_and_non_draft_reject(self):
        for key, value in (('sha', 'b' * 40), ('ref', 'main')):
            event, env, head = self.fixture()
            event['pull_request']['base'][key] = value
            with self.assertRaises(RuntimeError):
                gate.gate(event, env, head)
        event, env, head = self.fixture()
        event['pull_request']['draft'] = False
        with self.assertRaises(RuntimeError):
            gate.gate(event, env, head)
        event, env, head = self.fixture()
        event['pull_request']['head']['ref'] = 'main'
        with self.assertRaises(RuntimeError):
            gate.gate(event, env, head)
        event, env, head = self.fixture()
        with self.assertRaises(RuntimeError):
            gate.gate(event, env, 'c' * 40)

    def test_all_eighty_one_inherited_files_unchanged(self):
        manifest = gate.verify_inputs()
        self.assertEqual(manifest['source_commit'], gate.BASE)
        self.assertEqual(len(manifest['files']), 81)
        for name in ('comparator.py', 'transaction_envelope.py', 'evidence.py'):
            self.assertIn('scripts/ci/crm-operational-events-review/' + name, manifest['files'])

    def test_new_workflow_does_not_dispatch_or_accept_operational_inputs(self):
        path = gate.REPOSITORY_ROOT / '.github/workflows/crm-timeout-profile-review.yml'
        source = path.read_text()
        self.assertIn(gate.BASE, source)
        self.assertIn(gate.BASE_BRANCH, source)
        self.assertIn(gate.BRANCH, source)
        for value in ('workflow_dispatch:', 'pull_request_target:', 'secrets.', 'environment:', 'DATABASE_URL', 'SUPABASE_URL'):
            self.assertNotIn(value, source)
        self.assertIn('persist-credentials: false', source)
