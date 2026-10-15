# Physical wire laboratory: driver source review

Reviewed 2026-10-15. This is an Actions-only disposable PostgreSQL laboratory.
The deployment adapter remains **UNBOUND**; this module is not connected to an
endpoint, real database, issuer or identity provider. At-most-once with
quarantine does not provide exactly-once execution or guaranteed availability.

## Dependency identity

The official `brianc/node-postgres` tag
[`pg@8.23.1`](https://api.github.com/repos/brianc/node-postgres/git/ref/tags/pg%408.23.1)
has annotated tag object `07968bc4287ab7d98b6721183ce6860767a76fe9`, pointing to
commit [`0980cefebe0ae461da8883703be049fe13ca96cf`](https://github.com/brianc/node-postgres/commit/0980cefebe0ae461da8883703be049fe13ca96cf).
The tag is unsigned; a matching ref is not a cryptographic publisher attestation.

The coordinator independently checked the official npm registry: `pg` latest
was `8.23.1`, with that same `gitHead`, and tarball
`https://registry.npmjs.org/pg/-/pg-8.23.1.tgz`. Published SRI:

```text
sha512-aL96AHANtWjPLDOLqnhx+ngp9+UK7ETEU8VJrDCGvsSSi/mGLcWYsS6Herg7lmaBJe4uwrfqsa7gTEFaSizDoQ==
```

This reviewer verified the Git tag and fetched the source files at the exact
commit through the GitHub connector. Its local registry request failed DNS;
the npm metadata statement above is attributed to the coordinator's successful
read. The laboratory dependency preparation must verify the lock, package
integrities and installed files before running with networking disabled.
`pg` alone is not a full dependency pin: its range on `pg-protocol` and the
other transitive dependencies also require the reviewed lock. No package was
installed by this review or by the offline tests.

Git blob identifiers returned by the primary repository at the pinned commit
(Git SHA-1 object IDs, not SHA256 file digests):

| Source | Git blob |
| --- | --- |
| `packages/pg/package.json` | `0f693e314caeabcf75a8e77df9ab3d0bce3f0919` |
| `packages/pg/lib/client.js` | `2b13c1de74ce2742e521eb2ef71803b1da579439` |
| `packages/pg/lib/connection.js` | `85f3113a19a2f2e017630e58211c07ff04ad01ef` |
| `packages/pg/lib/query.js` | `3b93cb5bade3b5c3ac77ffe9a54086853d1a6b1a` |
| `packages/pg/lib/result.js` | `329fbf9fc615874e725d55a1026b4715414928fe` |
| `packages/pg/lib/stream.js` | `edc3018332d999139e6b6573230e8c0553650bc0` |
| `packages/pg/lib/connection-parameters.js` | `37987fd688a49d10327aef1ab21fa7dea43b8389` |
| `packages/pg-protocol/package.json` | `5caf29557c259b1ebd128ce21e5ad67aacedbeb5` |
| `packages/pg-protocol/src/index.ts` | `703ff2e49d870aeab39a2be91ae5f506445182f3` |
| `packages/pg-protocol/src/parser.ts` | `df48ca4a12cbae471ebf03da4f26b921e4f27f3f` |
| `packages/pg-protocol/src/messages.ts` | `c3fbbdd9bbde8ddd17b79d3e257b417be3682390` |

## Audited API and internal boundaries

The [public Client API](https://node-postgres.com/apis/client) provides a dedicated
`Client`, `getTransactionStatus()`, `query()` and lifecycle events. The adapter
keeps the client private. It uses neither Pool nor native libpq, and explicitly
disables pipelining. Configuration is the fixed synthetic UDS/database/role;
ambient PG variable names cause rejection without reading their values. A
fixed unused synthetic password prevents pgpass fallback if authentication is
unexpectedly requested; it is not a credential.

In pinned [`client.js`](https://github.com/brianc/node-postgres/blob/0980cefebe0ae461da8883703be049fe13ca96cf/packages/pg/lib/client.js),
`_handleReadyForQuery` records status before completing the active query and
pulsing its queue. Transport-error/end paths reject active and queued work
rather than replaying it. A backend SQL error alone does not permanently
disable the public Client; the wrapper seals and destroys its socket on that
protocol error. The wrapper admits one call, rejects concurrent use terminally,
checks the private queues and active-query slot, and never exposes a reconnect
or cancellation API. It supplies plain scalar parameters, no query name,
custom Query, cursor, row-page count, user type parser or callback. Every query
uses extended protocol. Upgrading these private fields requires another audit.

In pinned [`connection.js`](https://github.com/brianc/node-postgres/blob/0980cefebe0ae461da8883703be049fe13ca96cf/packages/pg/lib/connection.js),
`attachListeners` emits generic `message` before its specific event. The
laboratory observer uses that ordering to see CommandComplete/ReadyForQuery
before the Client handler. It does not infer status from SQL text or a timer.
The stream is one private `net.Socket` object; a generated epoch identifies
that object and its single permitted connect attempt. An own-property writer
installed after the core `connect()` call checks admission before calling the
captured native `Socket.write`, including writes buffered by corking. Its
identity is checked at the connect event and before queries. Replacing the
writer seals the attempt and leaves the guard installed. Replacing the stream,
closing it or attempting another connection also seals the attempt. TLS and
poolers are absent from this laboratory; their continuity is not certified by
its epoch.

Pinned [`query.js`](https://github.com/brianc/node-postgres/blob/0980cefebe0ae461da8883703be049fe13ca96cf/packages/pg/lib/query.js)
sends Parse/Bind/Describe/Execute/Sync for the selected extended-query mode.
The adapter permits each frame once per query and requires all five before
accepting completion. It rejects missing/duplicate command messages, multiple
results and completion without the matching ReadyForQuery. No timeout, SQL
error, lost acknowledgment or close permits replay.

Pinned [`result.js`](https://github.com/brianc/node-postgres/blob/0980cefebe0ae461da8883703be049fe13ca96cf/packages/pg/lib/result.js)
decodes command tags into command and row count. The adapter independently
checks the observed tag against the returned result. Only exact `BEGIN`,
`SET`, `COMMIT` and `ROLLBACK` tags translate pg's null count to integer zero.
Numeric tags retain their protocol count; unsupported or unsafe counts fail
closed. Rows are returned as decoded by pg without rebinding or rewriting.

The [`pg-protocol` parser](https://github.com/brianc/node-postgres/blob/0980cefebe0ae461da8883703be049fe13ca96cf/packages/pg-protocol/src/parser.ts)
handles fragmented/coalesced frames and decodes `Z` status and `C` tag. The
published dependency uses compiled artifacts: lock/SRI verification and runtime
checks remain necessary in addition to this source review. The wrapper records
no BackendKeyData secret, SQL text, parameter values or raw server error text.

## Factory and trace contract

`createLabWire({config: LAB_CONFIG, label, trace, fault})` returns a frozen
`{metadata, query, close}` object. `pg` is loaded lazily from the laboratory's
`./deps/node_modules/pg/lib/index.js`; it is never installed or auto-resolved
from application dependencies. `GITHUB_ACTIONS=true` and the exact fixture
scope are required before that import. This local guard does not authenticate
Actions by itself; the outer reviewed event/checkout/container gate is required.

The initial probe uses that same authenticated connection to obtain backend
PID, backend start, current database and session user. PID must also match
BackendKeyData's process ID. It runs as internal query ordinal 0; owner calls
start at 1. Metadata readiness follows actual admitted ReadyForQuery messages.
It remains `closed` permanently after terminal failure.

Trace events contain a monotone `n`, synthetic label and socket epoch:

- `query-admitted`: `queryOrdinal`, SHA256 `queryHash`, `internal`.
- `socket-write`: `queryOrdinal`, `wireType`, byte count; this means admission
  immediately before the socket write, not transmission or server execution.
- `protocol-command`: `queryOrdinal`, validated `tag`, `command`, `rowCount`,
  whether the tag has a counter.
- `protocol-ready`: admitted `queryOrdinal` and real status.
- `protocol-error`: SQLSTATE only.
- `protocol-ready-ignored`: a real late status observed after sealing; it does
  not restore readiness or complete a query. Absence of this event is not proof
  that the backend failed to send it after the socket was destroyed.
- `query-complete`, `terminal`, socket lifecycle and `close-confirmed` events.

`fault.closeAfterCommitCommand` may be 1 (claim) or 2 (business). It destroys the
socket immediately upon that observed COMMIT CommandComplete, before admitting
ReadyForQuery, even when both arrive in one chunk. This is a deterministic
injected boundary; it is not described as an arbitrary real network loss.
`fault.beforeQuery` rejects the selected positive owner query ordinal before
any of its writes. No caller-supplied fault callback can access the socket.

## Validation and remaining boundaries

The initial physical attempt at `ae19b938` reached actual SELECT CommandComplete
and ReadyForQuery, but recorded zero socket writes. Its `HOLD_LAB_RESULT` failure
therefore exposed a real missing barrier, rather than a passing physical proof.
The old inherited `write()` override was overwritten by Node itself.

The primary source inspected locally is Node **v24.19.0**'s incorporated
`process.binding('natives').net`, SHA256
`eba05bb24bdd1e208632a1df0fdeeb8e4bdf6ffc062cb19e92f0e7a8c37f60af`.
Lines 1460–1461 assign `this.write = Socket.prototype.write` in `connect()`.
The same source assigns `writeAfterFIN` on peer EOF. The corrected laboratory
class installs a nonconfigurable own accessor immediately after `super.connect`
returns, before the asynchronous connect event can invoke pg startup. Its getter
returns the fixed guarded writer; its setter seals and destroys the socket
without a readonly-property exception if core EOF handling or another caller
tries to replace it. No Node or pg prototype is modified.

The **22 offline tests** have two evidence categories. Nineteen cover the input
gates and state machine using synthetic protocol messages, unconnected
`net.Socket` objects and synthetic writer sinks. Three open actual local IPC sockets: Unix
domain sockets on Linux or named pipes on Windows, without TCP or PostgreSQL.
They reproduce core's inherited-override reset, exercise the production
`LabSocket` guard at the real connect event, verify receipt of only admitted
synthetic bytes, reject replacement with no further bytes written, and handle
a real peer FIN terminally. Those IPC tests use an explicitly synthetic policy;
they do not simulate a PostgreSQL server. Each confirms server/socket closure,
and Unix fixture directories are removed after server cleanup.
All 22 passed locally on Node v24.19.0/Windows with zero skips. The Linux UDS
variants remain to be exercised by Actions after this correction.

The public factory gate is also tested in a child process with an explicit
minimal non-Actions environment. The tests load no pg, execute no SQL and use
no external network. They do not certify PostgreSQL framing or physical owner
continuity; that proof still requires a successful separately authorized
disposable Actions lane and its exact artifact after this correction.

The fixture's fsync-off/tmpfs PostgreSQL setup cannot establish crash, WAL,
restore or failover durability. A direct laboratory UDS says nothing about a
deployment proxy, TLS upgrade or pooler. Real issuer authority, identity,
business guards, ACL provisioning and deployed infrastructure remain unbound.
The original owner/store sources and disabled endpoint are unchanged.
