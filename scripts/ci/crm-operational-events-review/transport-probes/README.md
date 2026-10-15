# Three read-only transport calls

These public probes are inputs for the parent to review and, if independently
authorized, submit through the selected project's `query_database` integration.
Creating them does not execute a database call or authorize an application.
Their live results are **NOT_RUN** until the parent supplies an observed receipt.
Every SQL result remains **NOT_ADMITTED**. No private target, PID, object identity,
response, endpoint, capture or credential belongs in this directory or CI.

There are exactly three proposed calls, in this order. Each call's `query` value
is the complete UTF-8 content of the indicated file, without a Markdown fence,
editing, added wrapper, statement splitting or an explicit retry. The public
`manifest.json` gives its byte length and SHA256. Read the full response before
deciding whether to proceed to the next call. These calls do not share a session
contract; their PIDs must never be compared as evidence of continuity.

| Call | Exact query file | Purpose |
| --- | --- | --- |
| 1 | `01-literal.sql` | One SELECT: literal/charset preservation and the server-observed query hash. |
| 2 | `02-read-only-transaction.sql` | One successful batch: BEGIN READ ONLY, observations A/B, COMMIT, observation C. |
| 3 | `03-error-stop.sql` | One batch without BEGIN: control result, intentional SQLSTATE 22012, terminal sentinel. |

Call 1 must return exactly one complete `crm_transport_probe` object. Compare its
literal UTF-8 hex, byte length and SHA256 with `manifest.json`, and require the
terminal marker. Both encodings should be UTF8 for the intended execution
profile. The returned query hash and byte length must match the file to establish
that the server saw that complete exact query text in this observation. A
different query hash can reveal wrapping, trimming or splitting; a matching
literal alone does not establish preservation of the complete statement. No
result here establishes the capacity for a larger future private envelope or
proves the absence of hidden executions.

Call 2 has no intentional failure. Retain every rowset, command status, warning
and completion indication, in order. Require A, B and C exactly once in the
returned evidence. A and B must each report `repeatable read`, read-only `on`,
exactly one own virtualxid, and matching database, PID, users and virtualxid.
Require C after the COMMIT status, the same database/PID/users, exactly one own
virtualxid, and a virtualxid different from A/B. C's isolation/read-only values
are reported, not assumed to match A/B. The file hash must match all three
server-observed query hashes to establish an intact Simple Query batch in this
observation. If hashes differ, record the observed framing rather than claiming
Simple Query. A/B identity can still demonstrate the same observed transaction
only when both complete results and their order are available.

The `pg_locks` subqueries return only the calling backend's granted exclusive
virtualxid lock. They do not return other backends, blockers, activity, queues or
objects. They allocate no permanent transaction ID and take no application lock.
Do not infer transaction identity from timestamps: PostgreSQL documents that
statements in one Simple Query message share `statement_timestamp()`.

If BEGIN is rejected, an intermediate statement fails, a response is lost or
truncated, or the adapter does not confirm completion, stop. A regular
transaction can remain open, or aborted if an error precedes COMMIT. A terminal
row alone does not certify the wrapper's final state. Ask the transport owner to
establish and clean up the actual connection using its own documented controls;
never assume another `query_database` call reaches that backend. Do not send a
blind ROLLBACK, repeat the batch or proceed to call 3. A successful read-only
COMMIT is not a demonstration of commit durability or acknowledgement of writes.

Call 3 deliberately fails with integer division by zero. It contains no BEGIN,
savepoint, transaction-control statement or persistent/session-setting operation.
In native PostgreSQL Simple Query semantics, the implicit block rolls back and
processing stops at that error. This design avoids opening a failed explicit
transaction itself. If the integration adds an outer transaction, its error
cleanup remains a transport responsibility; these SELECTs cannot certify it.

Retain the native SQLSTATE `22012`, message and complete wrapper error/status.
If SQLSTATE is suppressed, classify native-code propagation as UNKNOWN rather
than reconstructing it from a translated message. A returned terminal sentinel
is positive evidence that some execution continued after the intended error;
reject that behavior for a stop-on-error contract. Its absence alone cannot
prove nonexecution: the wrapper may suppress results, stop collecting output or
retry internally. If complete native message framing and transport behavior are
independently documented, combine that contract with the observations; do not
upgrade an error-only response into evidence about invisible later statements.
Do not retry this call. No fourth call is needed or proposed.

## Private record and sanitized report

The parent retains privately the exact submitted query bytes/hash, selected
project/transport identity and version if known, invocation identifier if
provided, local call order/times, all resultsets and command tags, all errors and
warnings, raw completion status and any advertised truncation/retry metadata.
Record absent fields as UNKNOWN. Do not invent an invocation ID or retry count.
The captured backend/virtualxid/database/user values remain private.

Return only a sanitized report such as:

```json
{
  "kind": "crm-transport-observation-v1",
  "admission": "NOT_ADMITTED",
  "literal_bytes": "PASS_OBSERVED|FAIL|UNKNOWN|NOT_RUN",
  "complete_query_bytes": "PASS_OBSERVED|FAIL|UNKNOWN|NOT_RUN",
  "read_only_transaction_batch": "PASS_OBSERVED|FAIL|UNKNOWN|NOT_RUN",
  "resultsets_and_completion": "PASS_OBSERVED|FAIL|UNKNOWN|NOT_RUN",
  "native_error_propagation": "PASS_OBSERVED|FAIL|UNKNOWN|NOT_RUN",
  "post_error_statement": "OBSERVED_CONTINUATION|NOT_OBSERVED|UNKNOWN|NOT_RUN",
  "automatic_retry_policy": "UNKNOWN",
  "exactly_once": "UNKNOWN",
  "write_commit_and_output_failure": "NOT_TESTED",
  "larger_private_request_capacity": "NOT_TESTED"
}
```

This example is a report vocabulary, not a schema or a pass receipt. No boolean
in this report enables an envelope. `NOT_OBSERVED` is deliberately weaker than
proof that the statement was not executed. These probes cannot establish
retry/exactly-once guarantees, future session reuse, ownership of pooled
connections, a timeout before a future DO, write commit/rollback durability,
automatic migration registration, output errors after a write commit, lost
response reconciliation or mutator exclusion. Those require the transport's
actual contract and isolated tests of the intended full execution path. The
parent can then coordinate a separate new DDL/ACL window; the probes supply none.

## PostgreSQL sources and local verification

The [PostgreSQL 17 message-flow documentation](https://www.postgresql.org/docs/17/protocol-flow.html#PROTOCOL-FLOW-MULTI-STATEMENT)
defines multi-statement Simple Query behavior, automatic closure of implicit
blocks, stop-on-error, explicit transaction cleanup and shared statement
timestamps. It does not describe the integration's implementation. The
[PostgreSQL 17 pg_locks documentation](https://www.postgresql.org/docs/17/view-pg-locks.html)
defines the own virtual transaction lock, and
[session information functions](https://www.postgresql.org/docs/17/functions-info.html#FUNCTIONS-INFO-SESSION-TABLE)
define `current_query()` and `pg_backend_pid()`. These sources support the
PostgreSQL interpretation, not a claim about connector behavior.

`test_transport_probes.py` checks the public file hashes and exact UTF-8 literal,
lexes complete statements across comments/quoted semicolons, and verifies the
read-only statement/function allowlist and self-only lock predicates. It opens
no connection. Static success is not a SQL runtime or live transport result.
