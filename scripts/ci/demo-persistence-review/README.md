# Demo persistence review prerequisites

This is **offline intake preparation**, not a PostgreSQL lane or operational
driver. The exact proposal could not be materialized through the supported
Library flow on this Windows executor. No SQL, fixture, connection configuration,
role, grant, migration, endpoint binding, or replacement protocol is supplied.

The requested package is `Elogistix-persistencia-propuesta.zip`, with expected SHA256
`45ec554f587cc3a12048732254ac98bd98f09ceaf18383dde496eba6c227dfa1`.
That hash is the **requested pin**, not an observed hash of a local file.

After a supported Library materialization has completed, run:

```text
python3 scripts/ci/demo-persistence-review/intake.py --zip <local-materialized-ZIP>
```

There is no pin override. The verifier reads raw bytes without extracting files,
checks the fixed ZIP hash, requires one `TRANSFER-SHA256SUMS`, verifies every
payload file against it, and identifies one exact `store.sql`. It accepts UTF-8
checksum records in ordinary `sha256sum` format, with paths relative to the
manifest's directory (optional leading `./`). Unsupported formats fail closed
and require review of the real package, not an inferred normalization. It
rejects traversal, case collisions, duplicate records, encrypted members,
symlinks, missing/unlisted payloads, and bounded-size violations.

This tool does not download files, repair Library metadata, attest to local
Library identity, execute SQL, validate bindings, or certify transaction
semantics. Its PASS is only byte integrity; SQL remains NOT_RUN and wire UNBOUND.
The CLI returns nonzero for missing or invalid input.

```text
python3 -m unittest discover -s scripts/ci/demo-persistence-review -p 'test_*.py' -v
```

Tests use **synthetic ZIPs** with an explicitly synthetic comment as `store.sql`.
They prove rejection behavior and preservation of raw CRLF bytes. They do not
exercise the requested package, a business engine, an issuer, or identity.
Public-file regression tests also reject private source identifiers and local
profile paths in this review's tracked files.

The existing `scripts/ci/crm-acl-review` sources and workflow remain unchanged.
Its offline suite is independently useful, but its CLI/gate and CRM SQL must not
be invoked under a spoofed event or repurposed as this lane. See the
[lane plan](../../../docs/qa/demo-persistence/lane-plan.md),
[driver findings](../../../docs/qa/demo-persistence/driver-evidence.md), and
[recorded status](../../../docs/qa/demo-persistence/status.json).
