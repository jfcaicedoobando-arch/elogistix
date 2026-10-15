"""Trusted-validator boundary tests; no target capture or database access."""
import subprocess
import unittest
from unittest.mock import patch

from projection_validator import ProjectionSchemaError, ProjectionValidator, _COMMAND


class ProjectionValidatorTests(unittest.TestCase):
    def test_values_go_only_to_stdin_and_success_cache_is_content_bound(self):
        validator = ProjectionValidator()
        value = {'TEST_ONLY': "'); Write-Output injected; #"}
        response = subprocess.CompletedProcess([], 0, 'CRM_COMPARATOR_SCHEMA_VALID', '')
        with patch('projection_validator.subprocess.run', return_value=response) as run:
            self.assertIs(validator(value), True)
            self.assertIs(validator(dict(value)), True)
            self.assertEqual(run.call_count, 1)
            args, options = run.call_args
            self.assertEqual(args[0][-1], _COMMAND)
            self.assertNotIn(value['TEST_ONLY'], ' '.join(args[0]))
            self.assertEqual(options['input'], '{"TEST_ONLY":"\'); Write-Output injected; #"}')
            self.assertTrue(options['capture_output'])
            self.assertEqual(validator.formally_validated, 1)
            validator({'TEST_ONLY': 'different'})
            self.assertEqual(run.call_count, 2)
            self.assertEqual(validator.formally_validated, 2)

    def test_schema_failure_and_unexpected_output_do_not_cache_or_expose_values(self):
        for response in (subprocess.CompletedProcess([], 1, '', 'private error'),
                         subprocess.CompletedProcess([], 0, 'True', ''),
                         subprocess.CompletedProcess([], 0, 'CRM_COMPARATOR_SCHEMA_VALID', 'warning')):
            with self.subTest(returncode=response.returncode, stdout=response.stdout):
                validator = ProjectionValidator()
                with patch('projection_validator.subprocess.run', return_value=response) as run:
                    for _ in range(2):
                        with self.assertRaisesRegex(ProjectionSchemaError, '^CRM_COMPARATOR_PROJECTION_SCHEMA$'):
                            validator({'TEST_ONLY': 'private'})
                    self.assertEqual(run.call_count, 2)
                    self.assertEqual(validator.formally_validated, 0)

    def test_missing_or_timed_out_validator_fails_closed(self):
        for error in (FileNotFoundError('private path'), subprocess.TimeoutExpired('private cmd', 30)):
            with self.subTest(error=type(error).__name__):
                with patch('projection_validator.subprocess.run', side_effect=error):
                    with self.assertRaisesRegex(ProjectionSchemaError,
                                                '^CRM_COMPARATOR_PROJECTION_VALIDATOR_UNAVAILABLE$'):
                        ProjectionValidator()({'TEST_ONLY': True})

    def test_non_json_and_nonfinite_values_are_rejected_before_process(self):
        with patch('projection_validator.subprocess.run') as run:
            for value in ({'TEST_ONLY': float('nan')}, {'TEST_ONLY': object()}):
                with self.assertRaisesRegex(ProjectionSchemaError, '^CRM_COMPARATOR_PROJECTION_JSON$'):
                    ProjectionValidator()(value)
            run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
