"""Offline harness checks only: never execute SQL or open a connection."""
import json
from subprocess import CompletedProcess
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

import sql_cases as cases


def response(text, code=0):
    return CompletedProcess([], code, text, '')


class SqlCaseHarnessTests(unittest.TestCase):
    def test_prepare_keeps_original_sql_verbatim_and_binds_fixture_values(self):
        original = ("INSERT INTO demo_owner_review.claims\n"
                    " SELECT $1,$2::uuid -- SYNTHETIC original-template sentinel\n"
                    " RETURNING obligation_id,context_id,binding")
        row = cases.issuance('prepare')
        row['deployment'] = "SYNTHETIC'VALUE"
        sql = cases.prepared_claim(SimpleNamespace(store_sql={'dispatch': original}), 'dispatch', row)
        self.assertIn(' AS\n' + original + ';\nEXECUTE ', sql)
        self.assertIn("'SYNTHETIC''VALUE'", sql)
        self.assertIn('$1,$2::uuid', sql)
        self.assertIn('DEALLOCATE qa_demo_dispatch;', sql)

    def test_returning_parser_handles_json_pipe_and_completion_marker(self):
        row = cases.issuance('returning')
        row['binding']['origin'] = 'SYNTHETIC|ORIGIN'
        line = row['obligation_id'] + '|' + row['context_id'] + '|' + json.dumps(row['binding'])
        marker = {'synthetic_marker': 'commit-completed', 'pid': 1234}
        actual, markers = cases.returned_rows(response(line + '\n' + json.dumps(marker) + '\n'))
        self.assertEqual(actual, [dict(obligation_id=row['obligation_id'], context_id=row['context_id'], binding=row['binding'])])
        self.assertEqual(markers, [marker])
        self.assertEqual(cases.returned_rows(response('')), ([], []))

    def test_returning_parser_rejects_extra_rows_or_noncontract_output(self):
        row = cases.issuance('extra')
        line = row['obligation_id'] + '|' + row['context_id'] + '|{}\n'
        for output in (line + line, 'unexpected command output\n',
                       json.dumps({'synthetic_marker': 'commit-completed', 'pid': True}),
                       row['obligation_id'] + '|' + row['context_id'] + '|[]'):
            with self.subTest(output=output), self.assertRaises(AssertionError):
                cases.returned_rows(response(output))

    def test_rejection_requires_exact_primary_state_and_unchanged_complete_rows(self):
        baseline = dict(issuer=[{'SYNTHETIC': 'issuer'}], claims=[], synthetic_business_events=[])
        for bad_result, after in (
            (response('ERROR:  23503: wrong state\n', 3), baseline),
            (response('ERROR:  23505: one\nERROR:  23505: two\n', 3), baseline),
            (response('ERROR:  23505: duplicate\n', 0), baseline),
            (response('ERROR:  23505: duplicate\n', 3), dict(baseline, claims=[{'SYNTHETIC': 'changed'}])),
        ):
            runner = Mock()
            runner.query.side_effect = [response(json.dumps(baseline)), bad_result, response(json.dumps(after))]
            with self.subTest(result=bad_result), self.assertRaises(AssertionError):
                cases.rejected(runner, 'crm_acl_fixture_unit', 'synthetic-probe', 'SELECT 1;', '23505')
            runner.check.assert_not_called()
        runner = Mock()
        runner.query.side_effect = [response(json.dumps(baseline)), response('ERROR:  23505: duplicate\n', 3),
                                    response(json.dumps(baseline))]
        cases.rejected(runner, 'crm_acl_fixture_unit', 'synthetic-probe', 'SELECT 1;', '23505')
        runner.check.assert_called_once()

    def test_empty_claim_never_opens_synthetic_business_transaction(self):
        runner = Mock()
        self.assertFalse(cases.business_if_claimed(runner, 'crm_acl_fixture_unit', 'synthetic', [], cases.issuance('sealed')))
        runner.query.assert_not_called()

    def test_database_and_original_sql_gate_runs_before_fixture_creation(self):
        runner = Mock(store_sql={})
        for name in ('postgres', 'crm_acl_fixture_', 'crm_acl_fixture_x;DROP DATABASE x'):
            with self.subTest(name=name), self.assertRaises(AssertionError):
                cases.run_sql_cases(runner, name)
        with self.assertRaises(AssertionError):
            cases.run_sql_cases(runner, 'crm_acl_fixture_unit')
        runner.query.assert_not_called()


if __name__ == '__main__':
    unittest.main()
