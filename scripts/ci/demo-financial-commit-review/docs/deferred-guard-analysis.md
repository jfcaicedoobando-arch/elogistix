# Deferred authorization at a real business COMMIT

This is a source diagnosis for an isolated Actions laboratory. At preparation time,
the original COMMIT attempt and its SQLSTATE/message are **NOT_RUN**. The expected
authorization failure is `42501`; the first actual error must be recorded rather
than replaced by a predicted message. The earlier PR354 assertions followed by
ROLLBACK, including its real early constraint drain, do not certify business COMMIT.

The laboratory uses the existing synthetic `postgres` candidate/session, selected
`service_role`, owner-reviewed fixture registry and real private RPC boundary.
These are disposable fixtures, not external authentication or deployed ACL proof.
The configuration remains EMPTY, operational wire UNBOUND and external demo DISABLED.

The relevant unchanged contracts are:

| Source | Contract |
| --- | --- |
| `upstream/flow/issuer/11-atomic-entry.sql` | `execution_authorized_deferred` is AFTER INSERT, DEFERRABLE INITIALLY DEFERRED. Its function `authorize_issuance_deferred()` is SECURITY INVOKER and calls real `assert_issued(NEW.execution_run_id)`. |
| `upstream/flow/sql/06-simulation-guards.sql` | The other deferred authorization function is SECURITY DEFINER. This does not change the descriptor of the separate execution-receipt trigger. |
| `upstream/flow/issuer/15-rpc-boundary.sql` | `prepare_execute_checkpoint` is SECURITY DEFINER with `search_path=pg_catalog`. On return its temporary owner identity ends. |
| `upstream/flow/issuer/16-owner-registry.sql` | Real transport validation requires actual owner identity, the registered LOGIN session, selected technical role and its matching synthetic claim role. A UUID or claim string alone is insufficient. |
| `demo-financial-behavior-recovery/sql/replay-correction.sql` | The reviewed same-context retry correction preserves the original deferred functions and grants. It supplies no new-purpose replay adapter or privilege elevation. |

The source paths above are under the frozen compile package except the separately
pinned same-context correction. The offline contract test pins their Git LF bytes
and exact function bodies. Windows CRLF expansion is normalized only to LF for
this comparison; it is not a database execution result.

In PostgreSQL 17.6, deferred-event records contain trigger/relation/tuple information
without a saved invoking role. `AfterTriggerFireDeferred()` invokes the pending
events immediately before commit, and `ExecCallTriggerFunc()` dispatches through
the normal function manager. Thus the invoker trigger does not retain the RPC's
temporary definer identity after that RPC returns. This is an inference from the
version-fixed [trigger implementation](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/commands/trigger.c)
(event records near lines 3481–3504, dispatch near 2165–2220 and precommit near
4937–4974) and [function manager](https://raw.githubusercontent.com/postgres/postgres/REL_17_6/src/backend/utils/fmgr/fmgr.c).

Leaving `SET LOCAL ROLE service_role` active until COMMIT gives the invoker trigger
that identity. The nested `assert_issued` call can already fail its revoked EXECUTE
privilege; reaching the transport check would still require the actual owner.
Resetting the role gives the owner identity but loses the required selected
technical role. Neither path satisfies the complete current contract.

A trusted SECURITY DEFINER procedure cannot move the transaction boundary inside
that elevated context: PostgreSQL forbids transaction control in such procedures.
A procedure with a `SET` clause also cannot perform transaction control. An INVOKER
procedure does not preserve a returned definer identity. See the official
[CREATE PROCEDURE restrictions](https://www.postgresql.org/docs/17/sql-createprocedure.html).
No alternative within the current SQL/role contract has been established.

The legitimate first experiment keeps the original descriptors, leaves constraints
deferred, and sends a real COMMIT after successful authentic materialization. It
must not call `flush_deferred`, issue `SET CONSTRAINTS ... IMMEDIATE`, or reset the
selected role before that COMMIT. Catalog evidence must independently bind the
trigger, table, function OID, owner, invoker descriptor, body hash, enabled state and
both deferred flags. A lexical SQL check alone does not prove those runtime facts.

If COMMIT fails, the runner must retain its exact bounded SQLSTATE/context, reject
any positive COMMIT marker, and use a separate backend to compare the complete
persistent row preimage after the failed transaction. Canonical read-only
`reconcile_context` may still return `unresolved`; that is not an `absent` proof or
permission to dispatch again. The observer's snapshot establishes the result of
this controlled transaction, not a general terminal barrier.

Subsequent task authorization permits preparing and testing a separate laboratory
proposal, `sql/deferred-owner-context.sql`. It contains only
`ALTER FUNCTION demo_flow_writer.authorize_issuance_deferred() SECURITY DEFINER`.
This deliberately elevates trigger execution privilege and does not revise the
historical INVOKER source or its expected failure. No SQL is applied locally; both
runtime modes remain **NOT_RUN** at this preparation stage.

The runner must first capture the original function OID, owner, closed ACL,
`proconfig`, exact `prosrc` hash and the complete enabled deferred trigger binding.
After the proposed ALTER, every captured value must match except `prosecdef`
changing from false to true. A changed body, grant, owner, search path, trigger OID,
target table or deferred flag must reject the experiment. The other definer guards
already present in source06 are no reason to silently relabel the original guard.

The original mode must preserve its real COMMIT failure and observer rollback.
The proposed mode must separately establish successful COMMIT visibility, fresh
read-only observation, and same-context retry without new business writes. No
early guard drain may substitute for either COMMIT. A required negative case must
materialize using the real boundary, revoke that run through the disposable owner
fixture, restore the selected technical role, and attempt real COMMIT. The real
authorization guards must reject the revoked run (expected `42501` /
`DEMO_RUN_UNAUTHORIZED`, message still to be observed), and an independent backend
must compare the complete post-abort persistent snapshot with its preimage. An
unrelated setup error or pre-COMMIT failure does not satisfy that negative case.
No production registration, grant, role or activation is authorized by this variant.

Even a future successful laboratory COMMIT would establish transaction visibility
under these fixtures. The inherited tmpfs cluster with fsync disabled does not
certify WAL durability, crash/failover behavior, real identity or production safety.
