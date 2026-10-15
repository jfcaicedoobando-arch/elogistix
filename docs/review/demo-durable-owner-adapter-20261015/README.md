# Durable owner adapter: REVIEW ONLY / HOLD

2026-10-15. Main topology reported by integrator: Supabase HTTP only; no current direct DB owner executor. This package does not change that topology. No production configuration, DSN, new role, GRANT, route, scheduler, database execution, migration application, Docker, dependency installation or Git mutation occurred.

## Concrete implementation and explicit boundary

- `driver.mjs`: dedicated protocol wrapper checks immutable socket/backend identity, actual ReadyForQuery state, command acknowledgment, exclusive ownership, no reconnect/replay and concurrent use. Always destroys transport; never returns it to a pool. Connection metadata comes from an as-yet-unbound trusted wire implementation, not from local booleans guessed after queries.
- `store.sql`: proposed new isolated schema; immutable issuer ledger and dispatch/ingress consumption rows; canonical natural-key uniqueness; context uniqueness; exact binding FK; mutation-rejecting triggers. No SQL has been compiled/executed against PostgreSQL.
- `store.mjs`: fixed parameterized `INSERT ... SELECT ... ON CONFLICT DO NOTHING RETURNING` queries. Ingress only inserts for an existing exact dispatch binding. Return from this live insert plus confirmed claim COMMIT is the only gate. A SELECT of a prior row never grants authority.
- `issuer.mjs`: canonical key based on version, stable deployment, tenant, semantic manifest identity, scheduler job and separately authorized occurrence. Authenticated resolver supplies all fields. Digest is consistency, not authority. Changing both context ID and snapshot/retry binding retains the same obligation. Natural uniqueness prevents canonical-version escape. A different context for existing obligation is rejected, never rebound. Resolver and issuer persistence entrypoint are intentionally unbound.
- `owner.mjs`: request shape is exactly `{contextId}`. Authentication, dedicated wire acquisition, claimTX + durable COMMIT, current guard check, one businessTX, business COMMIT, close. Any uncertainty/error => quarantine; never retries, forwards HTTP or reconstructs authority. Claim survives business rollback. Close failure is surfaced. Outcomes do not assert financial checkpoint validity.
- `owner.test.mjs`: 25 offline tests with synthetic transport/store. They demonstrate control-flow invariants, not actual PostgreSQL, WAL, concurrency across processes, issuer authentication or physical driver properties.

No network driver is installed or masquerading as complete. No real issuer resolver, authentic business producer, SQL guard or reconciliation implementation is included. The business SQL calls a deliberately absent review-schema entrypoint and therefore cannot accidentally invoke an existing RPC. This is a concrete implementable driver/store boundary, not an activated end-to-end solution. The previous owner adapter and original packages remain unchanged.

## Why not equate Postgres.js reserve with a certified driver

Reviewed official [Postgres.js documentation](https://github.com/porsager/postgres#reserving-connections), [connection documentation](https://github.com/porsager/postgres#connection-details) and [custom socket documentation](https://github.com/porsager/postgres#custom-socket), 2026-10-15. `reserve()` isolates a pooled connection; custom `socket` accepts a stream. Documentation describes rejecting a sent query on connection loss, then lazy reconnection on a subsequent query. Those APIs alone do not prove our no-reconnect physical ownership and protocol-state contract. No Postgres.js adapter or version certification is claimed. A custom socket/protocol shim needs an implementation audit and fault tests before this boundary can be bound.

The protocol wrapper requires decoded [CommandComplete and ReadyForQuery](https://www.postgresql.org/docs/current/protocol-message-formats.html). Metadata identity is supplemental detection, never a substitute for an exclusive transport that cannot silently swap or replay. No pooler mode is assumed. A direct verified connection is the simplest candidate; transaction multiplexing is unsupported. Startup identity must be read from the same authenticated backend, include backend start, and be tied to the socket epoch. It must not be supplied by an HTTP caller.

The store uses PostgreSQL [INSERT conflict handling and RETURNING](https://www.postgresql.org/docs/current/sql-insert.html). [synchronous_commit](https://www.postgresql.org/docs/current/runtime-config-wal.html) is set locally before claim. That does not alone certify fsync hardware, replication/failover durability or backup restoration: acceptance must demonstrate that consumed history cannot regress in the accepted domain.

## Hard prerequisites; all unfulfilled means HOLD

1. Authorized direct database executor and authenticated server ingress; no old-RPC bypass. Current Supabase HTTP-only main has neither demonstrated here. No new credentials/access are assumed or requested by this package.
2. Reviewed driver implementation mapping actual protocol state and authenticated socket identity to `wire`; no retry, reconnect, replay, HTTP forwarding, requeue, or multiplexer. `driverEvidence` is an audit-reference placeholder, not a magic assertion.
3. Protected issuer evidence resolver and occurrence policy. A client cannot request a new authorized occurrence to escape uncertainty. Semantic manifest identity cannot rotate on deploy/restart. Deployment partition remains stable over restores/rollouts. Full binding must cover tenant, origin, context/run/lineage, skip, snapshots, generation and expiry.
4. Existing privilege review that isolates issuance from ingress and forbids direct claim insertion or business bypass by external callers. Triggers do not constrain superusers/schema owners; no privileges are supplied here. Never install this schema as a supposed ACL solution.
5. Business SQL integration executing authentic prepare, execute and checkpoint in a SINGLE transaction with authoritative policy, expiry, revocation and provenance checks. The external `businessGuard` is supplementary, not a replacement for SQL guards and serialization. No downstream HTTP.
6. Durable WAL/failover history and administrative fence after restore/data loss. Never rotate namespace, expire claims, delete rows, reclaim by TTL, or convert unknown ACK to permission. Large binding size/index limits require reviewed bounded representation; insertion errors fail closed.
7. Separately authenticated RR READ ONLY reconciliation validating historical financial evidence. It must never call execute, issue, renew, repair or interpret absence as permission. Not implemented here.
8. Disposable PostgreSQL compilation, authentic runtime integration and independent review. No DB acceptance test was run.

## Known deliberate availability cost

Claim may commit and process die before business begins; obligation is permanently lost. Business failure consumes the obligation. Unknown business COMMIT may have committed; only read-only reconciliation can resolve it. Timeout, close, cancellation or absence never prove a delayed original cannot arrive. No exactly-once or eventual-completion promise.

## Reproduce offline only

Run `node --test owner.test.mjs` in this directory. Uses only built-in Node modules and synthetic fixtures; no environment variables or credentials are read. `config.example.json` is wholly empty, immutable defaults fail closed and there is no activation flag. SQL is a review artifact and should not be applied by the test command.

## Independent review correction

Pre-query metadata mismatch/exception now permanently poisons the driver, including when metadata later appears normal. Terminal-state checks run before metadata access. Request contextId is read once and validated as a primitive string; the identical snapshot is passed to authentication and SQL. Exact own-key checks reject hidden/symbol overrides. Six added regressions pass. This closes a driver fail-closed weakness; no owner execution bypass had been demonstrated and operational HOLD is unchanged.
