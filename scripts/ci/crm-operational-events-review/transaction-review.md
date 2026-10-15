# Transaction comparison experiment and finite decision boundary

`transaction_envelope.py` is a separate review experiment. It does not change
`envelope.py`, the inherited lab renderer, or
`PROPOSAL_direct_ledger_wrapper.sql`. Its public renderer always raises
`CRM_TRANSACTION_NOT_ADMITTED` as its first executable action. There is no
admission flag, connection option, operational CLI, or supported procedure for
removing this fence. Rendered proposals contain private evidence and must stay
outside Git, pull requests and Actions.

The separate TEST_ONLY builder is restricted to the runner's owned disposable
PostgreSQL 17.6 fixture. The public and TEST_ONLY forms carry the same inner
program, compared byte for byte and by SHA256. The rollback experiment permits
only one fixed exception after the synthetic INSERT as a program difference.
These tests exercise the proposed program without enabling the public proposal.
Runtime claims require the artifact for the exact tested commit.

## Program under review

The caller supplies the unchanged canonical bytes, a complete validated private
bundle, a real offline projection validator and a separate binding witness.
The public source pins are checked before private evidence is used. The program
retains the complete supplied preimage and derives only the two permitted helper
ACL removals and their exact captured service-role ACL dependency removals.

The proposed inner program binds database identity, execution and session user,
engine version, encoding and the supported execution context. Its explicit
planned execution profile requires read committed, a writable transaction,
`postgres` without superuser, `statement_timeout=20s` and `lock_timeout=3s`
established before the outer DO. The entry search path must equal the reviewed
capture; the program then sets the local search path to `pg_catalog`. This
planned context is distinct from the observed read-only capture context. A
timeout set inside an already running DO does not establish that DO's deadline.

The lock order is Drizzle SHARE ROW EXCLUSIVE, Supabase SHARE, then the CRM root
SHARE UPDATE EXCLUSIVE, all NOWAIT. After locking, the program reruns the exact
pinned discovery, scoped catalog, Drizzle history and Supabase manifest SELECTs,
and compares complete stable results. Metadata and binding checks precede ledger
data reads. Capture timestamps, backend PIDs and snapshots remain observations,
not fields to normalize into a common earlier snapshot. Complete Supabase pages
are checked offline; the transaction compares the complete manifest and its
format settings without exporting every page again.

The additional `crm-transaction-bindings-v1` SELECT observes only three qualified
builtin routines, the `regclass` type and the applicable handler configuration.
It carries its own capture identity and timestamps. It does not invoke the
default, event callback, nextval or setval. Its raw catalog definitions belong
to this separate private witness, not the unchanged strict projection bundle.
The transaction compares the same binding result before and after its work.
This adds a fresh binding check for definitions already reviewed; it does not
request another complete capture or require review of excluded event routes.

For an absent registration, the program verifies the SHA256 and UTF8 round trip
of the exact 10,361-byte canonical payload and executes those bytes unchanged.
It then inserts only the public hash and journal timestamp into Drizzle. The
existing reviewed default supplies the ID; the actual RETURNING row is checked
and retained privately. The program checks the complete prior history prefix,
exact one-row terminal delta, expected sequence observation, unchanged Supabase
history and exact permitted catalog delta. It does not supply an ID or alter
Supabase history.

For an exact existing registration in a fresh reviewed preimage, all terminal
conditions must already hold. The program returns before payload decoding,
either REVOKE, INSERT or sequence allocation. Partial, conflicting, future or
otherwise changed registration state fails closed. An old absent-registration
contract is not silently upgraded to a registered contract.

Sequence state is selected through identifiers quoted from validated catalog
nodes after rechecking identity. Captured SQL strings are never executed.
Rollback restores transactional catalog and row changes; an allocated sequence
value may remain consumed. Table locks do not exclude a separate owner ACL
writer or a caller consuming the sequence directly. F2 remains a limit.

## Four finite conclusions

Code and isolated tests must be ready before an operational decision. The
remaining decision evidence is limited to these four conclusions; a window
does not substitute for missing code or transport evidence.

1. **Capture provenance and baseline preservation.** The parent records that the
   complete envelopes came from its direct SELECT calls to the intended target,
   retains the complete responses and reconciles every page with the manifests.
   Offline checks establish structure, ordered complete rows, commitments,
   canonical registration absence or exact presence, and the supported serial
   convention. This is capture provenance, not a new audit of every historical
   statement. Adding this row requires preservation of the exact supplied
   histories and independent verification of the new public payload identity;
   it does not require reexecuting historical migrations, rewriting historical
   hashes, or proving every historical statement from source. Additional
   historical evidence is needed only to resolve a specific conflicting,
   ambiguous or unreconcilable existing registration, which blocks this program
   until resolved without repairing history.
2. **Transport contract.** Before the BEGIN/COMMIT or intentional-error probe, the transport owner must
   guarantee a request-owned initially idle connection, no outer transaction or
   prior work, and connection-specific cleanup; otherwise that probe stays
   NOT_RUN_PENDING_IDLE_CONTRACT. SQL observations cannot establish this
   precondition. The parent verifies the bounded properties exposed by the
   read-only transport probes, then supplies documentation or isolated
   equivalent tests for properties those probes cannot establish: intact one
   invocation of the complete outer DO, deadline setup before execution,
   transaction/commit/error/output handling, automatic registration behavior,
   retry policy and uncertain-response reconciliation. No session continuity
   between calls, exactly-once execution or absence of retries is inferred from
   SELECT results or matching backend PIDs. Unknown required properties block
   application. The [single-statement transport analysis](transport-contract.md)
   identifies those properties and the conditional minimum supported executor;
   it does not require exactly-once invocation or session reuse between calls.
3. **Relevant mutator exclusion.** The parent identifies how relevant helper,
   ACL, role, event and ledger writers, direct sequence consumers, external
   appliers and queued retries are excluded, or proves a specific actor
   irrelevant. The plan names responsibility and its validity period. Session
   statistics and successful table locks do not prove this exclusion.
4. **New authorized window and current preimage.** The user coordinates a new
   DDL/ACL window only after code, tests and transport are ready. It binds the
   reviewed artifact, actor, destination, exclusion plan and abort conditions.
   Fresh identity/catalog/binding/history/sequence checks run under the planned
   locks before the first REVOKE. Exclusion continues through commit verification
   and independent postflight. No earlier closed window supplies authorization.

If the capture provenance and baseline checks are already established, record
that conclusion and do not request the same complete captures again merely to
repeat historical review. A fresh small binding witness or a window-time drift
check serves a different, explicitly bounded purpose.

## Uncertain response

Never blindly resend a potentially executed program. First obtain fresh
read-only observations through an independently understood transport. An exact
unique registration with all owner-only and preservation postconditions permits
only registered verification without allocation. No registration with a sequence
gap requires fresh review and a new candidate; do not reset the sequence.
Conflict, partial state or unknown completion blocks further application. This
procedure grants no real execution, deployment or merge permission.
