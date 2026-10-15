#!/usr/bin/env python3
"""Separate local-file CLI; no execution, receipt, outcome or retry switches."""
import json
from pathlib import Path
import sys

from committed_gate import verify_inputs
from committed_state import compare_committed_state, CommittedStateError
import offline_review


def _bindings(filename):
    value = offline_review._read(offline_review._local_path(filename, Path.cwd()))
    if type(value) is dict and value.keys() == {'rows'}:
        rows = value['rows']
        offline_review.require(type(rows) is list and len(rows) == 1 and type(rows[0]) is dict
                               and rows[0].keys() == {'crm_bindings'}, 'ENVELOPE_WRAPPER')
        value = rows[0]['crm_bindings']
    return value


def main(argv=None):
    try:
        parser = offline_review._Parser(prog='crm-committed-state-review', add_help=False)
        parser.add_argument('--validator', choices=('auto', 'python', 'pwsh'), default='auto')
        for name in ('before-manifest', 'after-manifest', 'before-bindings', 'after-bindings'):
            parser.add_argument('--' + name, required=True)
        options = parser.parse_args(argv)
        verify_inputs()
        validator = offline_review.make_validator(options.validator)
        result = compare_committed_state(
            offline_review._from_file(options.before_manifest, validator),
            offline_review._from_file(options.after_manifest, validator),
            before_bindings=_bindings(options.before_bindings), after_bindings=_bindings(options.after_bindings),
            validate_projection=validator)
        print(json.dumps(result, ensure_ascii=True, sort_keys=True))
        return 0
    except (CommittedStateError, offline_review.OfflineError):
        result = dict(kind='crm-committed-state-review-v1', admission='NOT_ADMITTED',
                      status='REJECTED_OR_INCOMPLETE', rollback='NOT_ESTABLISHED',
                      retry_permission='NOT_GRANTED')
    except Exception:
        result = dict(kind='crm-committed-state-review-v1', admission='NOT_ADMITTED',
                      status='BLOCKED_REVIEW_UNAVAILABLE', rollback='NOT_ESTABLISHED',
                      retry_permission='NOT_GRANTED')
    print(json.dumps(result, sort_keys=True))
    return 2


if __name__ == '__main__':
    sys.exit(main())
