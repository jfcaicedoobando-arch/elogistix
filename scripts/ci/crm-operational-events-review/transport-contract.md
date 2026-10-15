# Required transport contract for one atomic statement

Status: **analysis only; NOT_ADMITTED**. This document authorizes no SQL call,
fence removal, deployment or application. Both public renderers remain fenced.
The selected integration is known only to accept SQL and return rows; pooling,
retry, automatic registration, notice delivery and commit handling are UNKNOWN.

## What the single statement provides

The transaction experiment puts locks, fresh metadata/history checks, the exact
canonical payload, one default-generated Drizzle INSERT RETURNING and terminal
checks inside one outer DO. It contains no transaction-closing command. A future
admitted execution can therefore use one statement without separate BEGIN or
COMMIT calls or continuity between integration calls. PostgreSQL runs a lone
statement transactionally; an existing outer transaction can still defer its
commit. Statement success alone is not evidence of that outer transaction's end.
See [PostgreSQL message flow](https://www.postgresql.org/docs/17/protocol-flow.html#PROTOCOL-FLOW-MULTI-STATEMENT).

Exactly-once invocation is not a prerequisite for the abstract atomic operation.
Every attempt must independently acquire locks and recheck the entire frozen
preimage, registration and sequence state. A duplicate may fail closed rather
than execute again. This does not prove an integration's retries harmless,
authorize a blind retry, or bound unreviewed effects outside that statement.
After an uncertain outcome, stop and reconcile through fresh read-only evidence
before deciding what, if anything, may run next. Do not reset sequence gaps.

## Necessary evidence still missing from the integration contract

1. The exact statement reaches the intended target with the reviewed actor,
   no split execution, injected mutation, automatic migration registration or
   additional persistent effect. The statement's internal Supabase check cannot
   detect an extra registration performed by the adapter after it returns.
2. The reviewed statement timeout is established before DO starts. A setting
   changed inside the running block does not demonstrate that its existing
   execution deadline was armed correctly. Lock timeout and cancellation/error
   cleanup also need a known execution contract. See
   [client connection defaults](https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-STATEMENT-TIMEOUT).
3. The actual INSERT RETURNING witness and complete success/error/completion
   evidence reach the parent without silent truncation. A DO returns void,
   rather than a rowset: this experiment emits its internal returning witness
   through NOTICE. A rows-only API does not establish delivery of that receipt.
   See [DO](https://www.postgresql.org/docs/17/sql-do.html).
4. Commit or rollback disposition and lost-response reconciliation are known.
   A NOTICE is emitted before commit and is not commit acknowledgement. A later
   SELECT can observe the stored row but cannot be relabeled as the actual
   INSERT RETURNING receipt required by the current offline comparison API.
   Replacing that receipt requires a separately reviewed proof-channel/API
   change; no such replacement is implemented here.

These requirements do not impose exactly-once invocation or session reuse
across separate calls. They require a bounded execution path and observable
outcome. The single DO does not supply either an external writer exclusion or
a newly authorized DDL/ACL window.

## Minimum supported alternative, if already available to the parent

Use an existing authorized PostgreSQL executor controlled by the parent, with
an owned connection initially idle and autocommit enabled, startup timeouts set
to the reviewed values, and no automatic retry or additional registration.
Retain its actual NOTICE receipt, native errors and completion/transaction
status; close or clean up that owned connection under its documented controls.
PostgreSQL ReadyForQuery includes transaction status, and completion must be
distinguished from an individual command tag. See
[protocol message formats](https://www.postgresql.org/docs/17/protocol-message-formats.html).
Then perform the independent read-only postflight within the coordinated window.
On uncertainty, stop and reconcile before a new candidate or attempt is approved.
This is a conditional alternative, not a claim that an executor exists or
permission to create credentials, grant access or execute against a real target.

## Current probe disposition and history scope

The BEGIN/COMMIT and intentional-error probes remain conditional **NOT_RUN**;
they are not proposed for the current integration without its missing contract.
No new probe is required; the literal probe cannot establish pooling, retry, notice or commit behavior.

Preserving the fully checked historical baseline requires its accepted complete
rows/commitments to remain unchanged. It does not require auditing or replaying
every historical Supabase statement: none is executed by this envelope. Request
additional historical evidence only for a specific unresolved registration
conflict, without claiming that commitment preservation proves SQL provenance.
