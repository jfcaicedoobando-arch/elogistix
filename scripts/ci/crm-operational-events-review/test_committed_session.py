"""Pure pipe framing tests; no session, process, socket or SQL execution."""
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'crm-canonical-review'))
from committed_cases import Session


class CommittedSessionTests(unittest.TestCase):
    def fake(self, response):
        session = Session.__new__(Session)
        session.counter = 0
        session.output = 'PRIOR_OUTPUT\n'
        def release(command):
            marker = command.rsplit('\\echo ', 1)[1]
            session.output += response + marker + '\n'
        session._release = release
        def read_until(predicate, label, timeout):
            self.assertTrue(predicate(), 'Complete zero-output command barrier must be visible')
        session._read_until = read_until
        return session

    def test_commit_with_no_stdout_before_barrier(self):
        self.assertEqual(self.fake('').execute('COMMIT;', 'unit'), '')

    def test_json_query_preserves_its_exact_output(self):
        self.assertEqual(self.fake('{"synthetic":true}\n').execute('SELECT;', 'unit'), '{"synthetic":true}\n')

    def test_completed_error_response_rejects(self):
        with self.assertRaisesRegex(RuntimeError, 'Owned serial client failed'):
            self.fake('ERROR: TEST_ONLY\n').execute('SELECT;', 'unit')
