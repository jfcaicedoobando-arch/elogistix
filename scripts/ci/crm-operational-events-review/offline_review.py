"""Local-file evidence assembly and inert review; never target admission.

The manifest is a file map, not an evidence bundle: exactly the nine bundle
keys, with literal kind and local filenames for every other value (a list of
filenames for supabase_pages). Envelopes may be direct or the exact Lovable
wrapper {"rows":[{"crm_evidence": ENVELOPE}]}. No JSON-string envelope, inline
capture, glob, directory scan, URL, SQL, connection or output file is accepted.

Public review code checks supplied observations only. It neither authenticates
their provenance/completeness nor approves their semantics, transport, event
policy or operational window. No actual IDs, hashes, filenames, private counts
or input representations are printed. All successful results remain
NOT_ADMITTED. The only subprocess is an optional offline schema validator.
"""
import argparse
import ast
import copy
import hashlib
import importlib
import json
from pathlib import Path, PureWindowsPath
import re
import shutil
import sys

import comparator
import evidence
import gate
from projection_validator import ProjectionValidator


SCHEMA_KEY = 'scripts/ci/crm-canonical-review/operational-capture/evidence.schema.json'
KINDS = {'review': 'crm-offline-preimage-review-v1',
         'compare': 'crm-offline-delta-review-v1'}
REASON_CODES = frozenset('CRM_OFFLINE_' + suffix for suffix in (
    'LOCAL_FILE_REQUIRED LOCAL_FILE_UNREADABLE JSON_REJECTED ENVELOPE_WRAPPER '
    'MANIFEST_KEYS MANIFEST_KIND VALIDATOR_REQUIRED PAGE_FILES_REQUIRED '
    'PROJECTION_SCHEMA_REJECTED SECTION_MISMATCH PAGE_OFFSET_REPEAT '
    'EVIDENCE_REJECTED NONLOCAL_SCHEMA_REFERENCE SCHEMA_PIN_MISMATCH '
    'SCHEMA_DRAFT SCHEMA_UNAVAILABLE VALIDATOR_ENGINE PUBLIC_INPUT_PIN_MISMATCH '
    'VALIDATOR_UNAVAILABLE REGISTRATION_CONFLICT_OR_FUTURE REGISTERED_ACL_DRIFT '
    'SEQUENCE_EXHAUSTED PREIMAGE_CONTRACT_REJECTED MALFORMED_PREIMAGE ARGUMENTS '
    'RETURNING_WRAPPER RETURNING_REQUIRED_OR_FORBIDDEN REJECTED UNEXPECTED_FAILURE '
    'COMPARISON_REJECTED').split())


class OfflineError(ValueError):
    """Only a fixed code is retained, never private exception diagnostics."""
    def __init__(self, code, detail=None):
        super().__init__(code)
        self.detail_code = _safe_detail(detail)


def _safe_detail(error):
    """Expose only declared public reason literals, never arbitrary exceptions.

    Both libraries use require(condition, STATIC_SUFFIX). Read their trusted
    public source to allow those suffixes and explicit static exception codes.
    Source read/parse failure simply omits the detail. No private input enters
    this allowlist and no exception diagnostic is used as an unconstrained code.
    """
    if isinstance(error, evidence.EvidenceError):
        module, prefix = evidence, 'CRM_EVIDENCE_'
    elif isinstance(error, comparator.ComparisonError):
        module, prefix = comparator, 'CRM_COMPARATOR_'
    else:
        return None
    try:
        constants = {node.value for node in ast.walk(ast.parse(Path(module.__file__).read_text(encoding='utf8')))
                     if isinstance(node, ast.Constant) and type(node.value) is str
                     and re.fullmatch(r'[A-Z_]+', node.value)}
        allowed = constants | {prefix + value for value in constants}
        code = str(error)
        return code if code.startswith(prefix) and code in allowed else None
    except Exception:
        return None


def require(condition, code):
    if not condition:
        raise OfflineError('CRM_OFFLINE_' + code)


def _local_path(value, basepath):
    require(type(value) is str and value and '\x00' not in value, 'LOCAL_FILE_REQUIRED')
    require(not str(basepath).startswith(('\\\\', '//')), 'LOCAL_FILE_REQUIRED')
    require(not value.startswith(('\\\\', '//'))
            and not re.match(r'^[A-Za-z][A-Za-z0-9+.-]*:', value)
            or (re.match(r'^[A-Za-z]:[\\/]', value) is not None
                and not value.startswith(('\\\\', '//'))), 'LOCAL_FILE_REQUIRED')
    # Device names/alternate streams are not ordinary local JSON files. Do not
    # resolve a UNC name first: that could itself contact a network filesystem.
    windows = PureWindowsPath(value)
    require(not any(PureWindowsPath(part).is_reserved() for part in windows.parts), 'LOCAL_FILE_REQUIRED')
    without_drive = value[2:] if re.match(r'^[A-Za-z]:[\\/]', value) else value
    require(':' not in without_drive, 'LOCAL_FILE_REQUIRED')
    try:
        path = Path(value)
        if not path.is_absolute():
            path = Path(basepath) / path
        path = path.resolve()
        require(not str(path).startswith(('\\\\', '//')) and path.is_file(), 'LOCAL_FILE_REQUIRED')
        return path
    except (OSError, ValueError, RuntimeError):
        raise OfflineError('CRM_OFFLINE_LOCAL_FILE_REQUIRED') from None


def _read(path):
    try:
        return evidence.load_bundle(path.read_bytes())
    except evidence.EvidenceError as error:
        raise OfflineError('CRM_OFFLINE_JSON_REJECTED', error) from None
    except (OSError, ValueError):
        raise OfflineError('CRM_OFFLINE_LOCAL_FILE_UNREADABLE') from None


def _unwrap(value):
    if type(value) is dict and value.keys() == {'rows'}:
        rows = value['rows']
        require(type(rows) is list and len(rows) == 1 and type(rows[0]) is dict
                and rows[0].keys() == {'crm_evidence'}, 'ENVELOPE_WRAPPER')
        value = rows[0]['crm_evidence']
    require(type(value) is dict and value.keys() == {'kind', 'section', 'admission', 'capture', 'result'},
            'ENVELOPE_WRAPPER')
    return value


def assemble(manifest, basepath, *, validate_projection):
    """Read the declared local files into memory; preserve all captured arrays.

    Page *files* are ordered by their validated decimal offset, not by filename
    or arbitrary manifest order. No row/node is sorted, deduplicated or repaired.
    ingest subsequently checks complete offsets, row order, counts and hashes.
    This callable requires a trusted actual validator, as does evidence.ingest.
    """
    require(type(manifest) is dict and manifest.keys() == evidence.BUNDLE_KEYS, 'MANIFEST_KEYS')
    require(manifest['kind'] == evidence.BUNDLE_KIND, 'MANIFEST_KIND')
    require(callable(validate_projection), 'VALIDATOR_REQUIRED')
    pages = manifest['supabase_pages']
    require(type(pages) is list and pages, 'PAGE_FILES_REQUIRED')
    bundle = {'kind': manifest['kind']}
    try:
        for key in evidence.BUNDLE_KEYS - {'kind', 'supabase_pages'}:
            envelope = _unwrap(_read(_local_path(manifest[key], basepath)))
            require(validate_projection(copy.deepcopy(envelope)) is True, 'PROJECTION_SCHEMA_REJECTED')
            expected = 'supabase_manifest' if key.startswith('supabase_manifest_') else key
            require(envelope['section'] == expected, 'SECTION_MISMATCH')
            bundle[key] = envelope
        loaded = []
        for filename in pages:
            page = _unwrap(_read(_local_path(filename, basepath)))
            require(validate_projection(copy.deepcopy(page)) is True, 'PROJECTION_SCHEMA_REJECTED')
            require(page['section'] == 'supabase_page', 'SECTION_MISMATCH')
            offset = evidence._integer(page['result']['offset'], nonnegative=True)
            loaded.append((offset, page))
        require(len({offset for offset, _ in loaded}) == len(loaded), 'PAGE_OFFSET_REPEAT')
        bundle['supabase_pages'] = [page for _, page in sorted(loaded, key=lambda item: item[0])]
        evidence.ingest(bundle, validate_projection=validate_projection)
        return bundle
    except OfflineError:
        raise
    except evidence.EvidenceError as error:
        raise OfflineError('CRM_OFFLINE_EVIDENCE_REJECTED', error) from None
    except Exception:
        raise OfflineError('CRM_OFFLINE_PROJECTION_SCHEMA_REJECTED') from None


def _local_refs(schema):
    if type(schema) is dict:
        for key, value in schema.items():
            if key in ('$ref', '$dynamicRef', '$recursiveRef'):
                require(type(value) is str and value.startswith('#'), 'NONLOCAL_SCHEMA_REFERENCE')
            _local_refs(value)
    elif type(schema) is list:
        for value in schema:
            _local_refs(value)


def _schema():
    try:
        raw = evidence.PROJECTION_SCHEMA.read_bytes()
        require(hashlib.sha256(raw).hexdigest() == gate.INPUT_SHA256[SCHEMA_KEY], 'SCHEMA_PIN_MISMATCH')
        schema = evidence.load_bundle(raw)
        _local_refs(schema)
        require(schema.get('$schema') == 'https://json-schema.org/draft/2020-12/schema', 'SCHEMA_DRAFT')
        return schema
    except OfflineError:
        raise
    except Exception:
        raise OfflineError('CRM_OFFLINE_SCHEMA_UNAVAILABLE') from None


def make_validator(engine='auto'):
    """Use installed Draft202012Validator or native pwsh Test-Json, offline.

    No packages or schemas are installed/downloaded. The pinned schema is parsed
    and all references checked before either engine receives any private input.
    """
    require(engine in ('auto', 'python', 'pwsh'), 'VALIDATOR_ENGINE')
    try:
        gate.verify_inputs()
    except Exception:
        raise OfflineError('CRM_OFFLINE_PUBLIC_INPUT_PIN_MISMATCH') from None
    schema = _schema()
    if engine in ('auto', 'python'):
        try:
            module = importlib.import_module('jsonschema')
        except ImportError:
            require(engine == 'auto', 'VALIDATOR_UNAVAILABLE')
        else:
            try:
                module.Draft202012Validator.check_schema(schema)
                # All refs are fragments; explicit deny-retrieval also prevents
                # accidental future remote resolution inside the Python engine.
                registry_module = importlib.import_module('referencing')
                def deny(_uri):
                    raise OfflineError('CRM_OFFLINE_NONLOCAL_SCHEMA_REFERENCE')
                validator = module.Draft202012Validator(schema,
                    registry=registry_module.Registry(retrieve=deny))
                def validate(envelope):
                    try:
                        require(validator.is_valid(envelope), 'PROJECTION_SCHEMA_REJECTED')
                    except OfflineError:
                        raise
                    except Exception:
                        raise OfflineError('CRM_OFFLINE_PROJECTION_SCHEMA_REJECTED') from None
                    return True
                return validate
            except OfflineError:
                raise
            except Exception:
                raise OfflineError('CRM_OFFLINE_VALIDATOR_UNAVAILABLE') from None
    require(shutil.which('pwsh') is not None, 'VALIDATOR_UNAVAILABLE')
    return ProjectionValidator()


def review(bundle, *, validate_projection):
    """Derive the exact proposed ACL catalog privately; emit only fixed statuses.

    The existing comparator's internal derivation/sequence routines are reused
    deliberately. Their output stays in memory and does not supply registration
    IDs or post-captures. Stable default hashes are not semantic approval.
    """
    try:
        summary = evidence.ingest(bundle, validate_projection=validate_projection)
        _, removed = comparator._helper_postimage(bundle)
        value, called = comparator._sequence_profile(bundle)
        rows = bundle['drizzle_history']['result']['rows']
        matches = [row for row in rows if row['hash'] == comparator.PAYLOAD_SHA256
                   or int(row['created_at']) == comparator.JOURNAL_WHEN]
        if matches:
            require(len(matches) == 1 and matches[0]['hash'] == comparator.PAYLOAD_SHA256
                    and int(matches[0]['created_at']) == comparator.JOURNAL_WHEN
                    and comparator._same(matches[0], rows[-1]), 'REGISTRATION_CONFLICT_OR_FUTURE')
            require(removed == 0, 'REGISTERED_ACL_DRIFT')
            registration = 'EXACT_REGISTERED_READ_ONLY_REVIEW'
        else:
            require(all(int(row['created_at']) < comparator.JOURNAL_WHEN for row in rows),
                    'REGISTRATION_CONFLICT_OR_FUTURE')
            require(value + int(called) <= 2147483647, 'SEQUENCE_EXHAUSTED')
            registration = 'ABSENT_NO_ROW_OR_ID_INVENTED'
        visibility = summary['visibility']
        return {'kind': KINDS['review'], 'admission': 'NOT_ADMITTED', 'status': 'PASS_REVIEW_ONLY',
            'projection_schema_checked': True, 'page_integrity_order_and_counts_checked': True,
            'drizzle_history_commitments_checked': True, 'catalog_postimage_derived_in_memory': True,
            'helper_source_trigger_and_acl_contract_checked': True,
            'sequence_profile_ownership_and_position_checked': True, 'registration': registration,
            'client_visibility': visibility['client_backends'],
            'overall_observed_visibility': visibility['overall_observed_visibility'],
            'default_expression_semantics': 'UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
            'preimage_semantic_review': 'UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
            'capture_provenance_and_catalog_completeness': 'UNKNOWN',
            'event_policy_and_external_consumers': 'UNKNOWN_REQUIRES_INDEPENDENT_REVIEW',
            'transport_and_ddl_acl_window': 'UNKNOWN_REQUIRES_PARENT_VERIFICATION',
            'supabase_row_preimages': 'NOT_VERIFIED_COMMITMENTS_ONLY',
            'single_transaction_snapshot': 'NOT_ESTABLISHED'}
    except OfflineError:
        raise
    except evidence.EvidenceError as error:
        raise OfflineError('CRM_OFFLINE_EVIDENCE_REJECTED', error) from None
    except comparator.ComparisonError as error:
        raise OfflineError('CRM_OFFLINE_PREIMAGE_CONTRACT_REJECTED', error) from None
    except Exception:
        raise OfflineError('CRM_OFFLINE_MALFORMED_PREIMAGE') from None


class _Parser(argparse.ArgumentParser):
    def error(self, _message):
        raise OfflineError('CRM_OFFLINE_ARGUMENTS')

    def exit(self, status=0, message=None):
        raise OfflineError('CRM_OFFLINE_ARGUMENTS')


def _parser():
    parser = _Parser(prog='crm-offline-review', add_help=False)
    commands = parser.add_subparsers(dest='mode', required=True, parser_class=_Parser)
    for mode in ('review', 'compare'):
        command = commands.add_parser(mode, add_help=False)
        command.add_argument('--validator', choices=('auto', 'python', 'pwsh'), default='auto')
        if mode == 'review':
            command.add_argument('--manifest', required=True)
        else:
            command.add_argument('--before-manifest', required=True)
            command.add_argument('--after-manifest', required=True)
            command.add_argument('--outcome', choices=sorted(comparator.OUTCOMES), required=True)
            command.add_argument('--returning')
    return parser


def _from_file(filename, validator):
    path = _local_path(filename, Path.cwd())
    return assemble(_read(path), path.parent, validate_projection=validator)


def _returning(filename):
    value = _read(_local_path(filename, Path.cwd()))
    if type(value) is dict and value.keys() == {'rows'}:
        require(type(value['rows']) is list and len(value['rows']) == 1, 'RETURNING_WRAPPER')
        value = value['rows'][0]
    require(type(value) is dict and value.keys() == {'id', 'hash', 'created_at'}, 'RETURNING_WRAPPER')
    return value


def main(argv=None):
    """CLI exits 0 for matched observations, 2 for blocked/rejected; JSON only."""
    try:
        options = _parser().parse_args(argv)
        validator = make_validator(options.validator)
        if options.mode == 'review':
            result = review(_from_file(options.manifest, validator), validate_projection=validator)
        else:
            require((options.outcome == 'registered_read_only') is (options.returning is None),
                    'RETURNING_REQUIRED_OR_FORBIDDEN')
            before = _from_file(options.before_manifest, validator)
            after = _from_file(options.after_manifest, validator)
            returned = None if options.returning is None else _returning(options.returning)
            compared = comparator.compare(before, after, outcome=options.outcome,
                returned_row=returned, validate_projection=validator)
            result = dict(compared, kind=KINDS['compare'], status='PASS_REVIEW_ONLY',
                          projection_schema_checked=True, page_integrity_order_and_counts_checked=True)
        code = 0
    except OfflineError as error:
        reason = str(error)
        # Only our own fixed codes are exposed, even if a host component raises
        # an unexpected exception with sensitive diagnostics.
        if reason not in REASON_CODES:
            reason = 'CRM_OFFLINE_REJECTED'
        result = {'kind': 'crm-offline-review-result-v1', 'admission': 'NOT_ADMITTED',
                  'status': 'BLOCKED', 'reason': reason}
        if error.detail_code is not None:
            result['detail_code'] = error.detail_code
        code = 2
    except comparator.ComparisonError as error:
        result = {'kind': 'crm-offline-review-result-v1', 'admission': 'NOT_ADMITTED',
                  'status': 'BLOCKED', 'reason': 'CRM_OFFLINE_COMPARISON_REJECTED'}
        detail = _safe_detail(error)
        if detail is not None:
            result['detail_code'] = detail
        code = 2
    except (Exception, KeyboardInterrupt):
        result = {'kind': 'crm-offline-review-result-v1', 'admission': 'NOT_ADMITTED',
                  'status': 'BLOCKED', 'reason': 'CRM_OFFLINE_UNEXPECTED_FAILURE'}
        code = 2
    print(json.dumps(result, ensure_ascii=True, sort_keys=True, separators=(',', ':')))
    return code


if __name__ == '__main__':
    sys.exit(main())
