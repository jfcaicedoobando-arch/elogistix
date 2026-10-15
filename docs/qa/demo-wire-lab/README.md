# Synthetic physical wire laboratory

This branch adds an isolated Actions experiment after the SQL-only persistence
review. Product code, disabled endpoints and the original empty configuration
are unchanged. **The deployment wire remains UNBOUND.** The intended guarantee
is at-most-once with quarantine; availability and exactly-once execution are not
guaranteed.

## Execution boundary

The draft PR gate fixes repository, branch, checkout and stacked base
`8386f47502ca70516a9111c9983b5c3f6955d953`. It reuses the hash-pinned persistence
runner and unchanged CRM infrastructure. PostgreSQL 17.6 uses the same pinned
image, network none, no ports, no mounts, read-only root, tmpfs and non-superuser
candidate. Software is staged from public, integrity-pinned Node/npm inputs on
the Actions host, transferred via binary stdin, then every extracted file hash
is checked inside the owned container. No dependency installation or outbound
connection occurs there.

Node 24.19.0 Linux x64 archive SHA256:
`14b342e71204f811bde6153be8e04b62aef63c236fef92b55f9c83154b409647`.
The `pg` 8.23.1 lock fixes all transitive packages and SRI. Installed driver
source files must also match the audited Git blobs. See
[driver source review](driver-review.md) for primary sources and private API
assumptions. No application dependency or root lock is changed.

The only transport is one exclusive `net.Socket` over the disposable Unix
socket per private `pg.Client`. The adapter admits extended-protocol frames
once, observes real CommandComplete and ReadyForQuery, binds an epoch to that
socket, and seals after SQL errors, closure, identity drift or concurrent use.
There is no retry, reconnect, pool, HTTP RPC or replay path after a claim.

## Synthetic matrix

Nine ordered cases cover empty config before opening a transport, committed
claim before the sole business transaction on one socket, duplicate sealing,
missing dispatch, rollback after a real SQL business exception, uncertain claim
COMMIT acknowledgment, uncertain business COMMIT acknowledgment, close after
claim and terminal real SQL error without subsequent writes. The COMMIT fault
destroys the socket after the observed command message and before accepting
ReadyForQuery; it is deterministic injection, not arbitrary network-loss proof.

The fixture creates the deliberately absent business function **only in this
disposable database after checking its absence**. Authentication, issuer,
guards and its event table are SYNTHETIC. The table has no uniqueness fence
that could hide repeat business execution. An independent backend observes a
committed ingress claim before any business BEGIN. All owned transports must
confirm closure before runtime PASS; the outer runner requires stopped server,
no PID, reaped owned clients and removed container before final PASS.

Only sanitized `public/*.json` evidence is uploaded. Ownership files, container
inspection logs, dependency trees, paths and transfer bytes remain private.
The artifact includes the ordered protocol timeline, identities of disposable
backends and source/runtime hashes. Offline tests are registered in the complete
catalog and execute automatically in general CI as `node-demo-wire-lab`.

Inherited fsync-off/tmpfs settings establish committed visibility and rollback,
not crash recovery, stable storage, WAL/failover or restore durability. No crash
phase is claimed. The prior lane's two-psql races remain separate evidence;
this laboratory does not repeat that race matrix.

## Evidence required before operational binding

- A reviewed topology identifying the actual direct database transport and any
  proxy/pooler, plus documented guarantees and observations that preserve the
  same physical backend across claim COMMIT and business COMMIT. A pool reserve
  or reusable HTTP token alone is insufficient.
- A reviewed dedicated connection lifecycle, retry/reconnect/replay policy,
  timeout and cancellation behavior, dependency versions and protocol evidence
  for the deployed path, including uncertain acknowledgments and closure.
- Authoritative issuer/scheduler identity and immutable obligation mapping,
  business guards and direct SQL integration with the real engine. No synthetic
  resolver/fixture result satisfies those requirements.
- Reviewed runtime ACL, transport authentication and recovery/restore fencing,
  storage durability and failover behavior. This work creates no real roles,
  grants, credentials, persistent access or deployment configuration.

Request these infrastructure contracts and sanitized deployment evidence from
the owner; do not invent a connection or read secret values. Until those gates
are met, config stays empty and the endpoint stays closed.
