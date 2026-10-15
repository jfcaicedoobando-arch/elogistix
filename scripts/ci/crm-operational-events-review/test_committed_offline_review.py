"""No paths, auxiliary raw values, failures or receipt data escape the CLI."""
from contextlib import redirect_stdout
from io import StringIO
import json
import unittest
from unittest.mock import patch

import committed_offline_review as cli
import committed_state


class CommittedOfflineTests(unittest.TestCase):
    args = ['--before-manifest', 'PRIVATE_BEFORE', '--after-manifest', 'PRIVATE_AFTER',
            '--before-bindings', 'PRIVATE_BINDINGS_BEFORE', '--after-bindings', 'PRIVATE_BINDINGS_AFTER']

    def invoke(self, args):
        output = StringIO()
        with redirect_stdout(output):
            status = cli.main(args)
        value = output.getvalue()
        self.assertNotIn('PRIVATE', value)
        return status, json.loads(value)

    def test_no_receipt_or_outcome_or_retry_arguments(self):
        for extra in (['--returning', 'PRIVATE_RECEIPT'], ['--outcome', 'applied'], ['--retry'], ['--apply']):
            status, value = self.invoke(self.args + extra)
            self.assertEqual(status, 2)
            self.assertEqual(value['retry_permission'], 'NOT_GRANTED')

    def test_complete_file_inputs_dispatched_to_separate_channel(self):
        with patch.object(cli, 'verify_inputs'), patch.object(cli.offline_review, 'make_validator', return_value=True), \
             patch.object(cli.offline_review, '_from_file', side_effect=['before', 'after']), \
             patch.object(cli, '_bindings', side_effect=['binding-before', 'binding-after']), \
             patch.object(cli, 'compare_committed_state', return_value={'admission': 'NOT_ADMITTED'}) as compare:
            status, _ = self.invoke(self.args)
            self.assertEqual(status, 0)
            compare.assert_called_once_with('before', 'after', before_bindings='binding-before',
                                             after_bindings='binding-after', validate_projection=True)

    def test_failures_and_missing_inputs_are_static_and_do_not_mean_rollback(self):
        for error in (committed_state.CommittedStateError('PRIVATE'), RuntimeError('PRIVATE')):
            with patch.object(cli, 'verify_inputs', side_effect=error):
                status, value = self.invoke(self.args)
                self.assertEqual(status, 2)
                self.assertEqual(value['admission'], 'NOT_ADMITTED')
                self.assertEqual(value['rollback'], 'NOT_ESTABLISHED')
                self.assertEqual(value['retry_permission'], 'NOT_GRANTED')
        self.assertEqual(self.invoke([])[0], 2)
