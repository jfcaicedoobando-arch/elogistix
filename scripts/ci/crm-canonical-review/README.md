# Exact canonical SQL lane

52 runtime cases planned and executable via the draft same-repository Actions workflow. The runner reads the exact 0021 file and its byte-identical mirror and records SHA256; there is no fixture contract rebinding or SQL rewrite. The public semantic migration permits source-equivalent recreated objects; only a future private target envelope can pin instance identity.

The disposable bootstrap covers fresh CRM helper history 0016/0017/0018, upgrade from that state, mixed ACLs, owner-only replay, authenticated DML, source/config/owner/signature/ACL/trigger drift, full scoped snapshots, and 8 additional canonical cases including equivalent recreation and transactional registry witness commit/idempotency/rollback/conflict. This is NOT a full clean ERP history replay and does not execute 0020 dependencies. That additional full-repository job remains a prerequisite where required.

The registry witness uses a synthetic table with explicit integer ID and exercises the exact canonical DO within one transaction. It is NOT the operational Drizzle ledger wrapper, does not model its serial sequence and does not prove actual transport auto-registration behavior. A normal sequence gap is not itself a conflict. The actual direct wrapper remains fenced.

This initial canonical lane does NOT run the 54 concurrency/F2 cases of the older private-identity fixture lane. F2 limitation remains outstanding and requires a fresh operational DDL/ACL window; no runtime pass here makes a concurrency-immunity claim. No DSN, cloud credentials, host mount, network connection or arbitrary container argument is accepted. It retains the reviewed pinned PG17.6 isolated non-superuser setup and owned shutdown/removal verification.

Offline tests do not execute SQL or Docker. Runtime evidence is NOT RUN until the exact published Actions commit is inspected. Artifact result must contain 52 unique passed cases, exact canonical hash, SQL logs, full snapshots and confirmed cleanup before calling this lane passed.
