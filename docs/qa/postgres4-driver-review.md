# Postgres.js 4.0.0 driver review

Base: `9110b2d383d8892c4c8ecb16a5257513372d93c4` (main), 2026-11-01.
Runtime: Node 26.13.0, Bun 1.4.4, TypeScript 6.0.3.
Only the root JavaScript driver changes, from 3.4.9 to exact 4.0.0.
The PostgreSQL server version and all other dependency resolutions are unchanged.

## Consumers

| Consumer | Loading and API | Assessment |
| --- | --- | --- |
| `scripts/db/test-proforma-fixture-lock-order.mjs` | ESM default import; `unsafe` positional parameters; `.simple()` batches; explicit `BEGIN`/`ROLLBACK` with `max: 1`; application names; `code/message/where`; `end({ timeout })` | Synthetic real-driver comparisons pass. Its complete application-schema replay was not run. |
| `drizzle.config.ts` / Drizzle Kit 0.31.11 | CLI dynamically imports `postgres.default`, ESM ORM and migrator; preconstructs client with `max: 1`; overrides parsers/serializers | Offline loading and real ORM queries pass. Migrator is imported only, never invoked. |
| Drizzle ORM 0.45.4 CJS connection factory | `require('postgres')` wrapped as a default callable | **FAIL** with v4. See below; no repository consumer uses this factory. |
| App and Edge | No imports of the root `postgres` package | No runtime code change needed. |

`drizzle/schema.ts` is intentionally empty. Typecheck does not cover the `.mjs`
fixture or prove driver loading. The separate selector148 and demo-wire-lab
packages use `pg`, not this driver; their manifests, lockfiles and execution
gates are unchanged. No ownership, guards, network, cron or demo gate is enabled.

## Real driver comparison

The server was a new PostgreSQL 17.9 container using the existing repository
image pin:
`postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae`.
Docker network mode was `none`, published ports `{}`, data was in tmpfs, and
`listen_addresses` was empty. Both driver versions connected through the same
local Unix socket, with synthetic credentials and no application tables. Only
temporary fixture tables and synthetic SQL ran; no application migrations,
historical SQL, physical/ownership labs or remote databases ran.

`scripts/tests/postgres-driver-local.test.mjs`: **16 PASS, 0 FAIL, 0 SKIP**.

- Exact UUID/UUID arrays, empty arrays/null, JSON objects, parameter escaping,
  24-digit numeric values and bigint above the JavaScript safe-integer limit.
- Prepared statement reuse, unprepared statements, `.values()`, `.simple()`
  batches and application names.
- Commit, thrown application error rollback, nested savepoint rollback and
  explicit SQL `BEGIN`/`ROLLBACK` batches under `max: 1`.
- SQLSTATE `23505`, `23514`, `22P02`, `P0001`, `22012`, `25P02` and a real
  two-session deadlock (`40P01`), including error context and connection reuse.
- Real Drizzle ESM and CJS queries with explicit clients: JSON/numeric/UUID
  insert/read, repeated prepared selects and rollback.

The comparison records two upstream behavior changes rather than masking them:

| Probe | 3.4.9 | 4.0.0 |
| --- | --- | --- |
| JavaScript `Date('2026-11-01T00:30:00Z')::date`, session `America/Mexico_City` | `2026-10-31` | `2026-11-01` |
| Bare `select ${true}` | JS boolean | JS string |
| Explicit `::timestamptz`, same Date | Same instant | Same instant |
| Swallowed SQL division error within `sql.begin` | Rejects `22012` | Rejects `22012` |

The existing direct fixture passes string application names as parameters and
executes its date logic in SQL; it does not send untyped Date/boolean values.
Future consumers should use explicit SQL types. Upstream also removes
`sql.array()`; the repository has no use of that helper.
Reference: [upstream v3 upgrade guide](https://github.com/porsager/postgres#upgrading-from-v3).

## Known interoperability failure and review gate

On Node 26.13.0, `require('postgres')` changes from a function in v3 to an ESM
namespace object in v4. `require('postgres').default` is the v4 factory.
Drizzle 0.45.4's CJS `drizzle({ connection: config })` factory therefore fails
before any connection, with:

```text
TypeError: (0 , import_postgres.default) is not a function
```

Baseline 3.4.9 passes this probe; candidate 4.0.0 fails. Both versions accept
an explicitly constructed client. Drizzle Kit uses the compatible dynamic ESM
path. This PR does not patch vendored code or update Drizzle to hide the failure.
It remains a draft for coordination and acceptance of this limitation.

## Other validation

- Frozen Bun install: PASS; the lock diff changes only the root postgres entry.
- Typecheck, production build, ESLint with zero warnings: PASS.
- Dependency security/SDK/loader suite: 25 PASS, no socket attempts in loaders.
- Package script contracts: 4 PASS.
- Knip: PASS (configuration hints only).
- Test catalogue: PASS; loaders run in the existing automatic dependency lane;
  the real-driver comparison is explicitly manual and opt-in.
- Complete Vitest suite and exact-head GitHub CI: pending at PR creation.
- Complete proforma replay, SQL/RLS suites, remote migrations and deployment:
  SKIP. The real comparison uses synthetic fixtures and does not certify those
  application SQL suites.

## Reproduce only the disposable driver comparison

Use Node 26.13.0 and Bun 1.4.4. Install the locked root dependencies first.
The socket/container names below must be unused. Run from the repository root.
No repository `.env` or database URL is loaded by the test command.

```sh
npm --cache /tmp/elogistix-npm-cache install --prefix /tmp/elogistix-postgres4-baseline \
  --ignore-scripts --no-audit --no-fund postgres@3.4.9
mkdir -p /tmp/elogistix-postgres-driver-socket
chmod 0777 /tmp/elogistix-postgres-driver-socket
docker run -d --name elogistix-postgres4-compat \
  --network none --memory=512m --cpus=2 \
  --tmpfs /var/lib/postgresql/data:rw,size=256m \
  --mount type=bind,src=/tmp/elogistix-postgres-driver-socket,dst=/var/run/postgresql \
  -e POSTGRES_DB=driver_compat -e POSTGRES_PASSWORD=synthetic-driver-only \
  -e POSTGRES_INITDB_ARGS='--auth-local=trust --auth-host=reject' \
  postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae \
  -c listen_addresses= -c max_connections=20 -c shared_buffers=32MB
# Wait until pg_isready succeeds before running the tests.
docker exec elogistix-postgres4-compat pg_isready -U postgres -d driver_compat
env -i PATH="$PATH" \
  POSTGRES_DRIVER_LOCAL=1 \
  POSTGRES_DRIVER_SOCKET=/tmp/elogistix-postgres-driver-socket \
  POSTGRES_DRIVER_BASELINE=/tmp/elogistix-postgres4-baseline/node_modules/postgres/src/index.js \
  node --test scripts/tests/postgres-driver-local.test.mjs
# Also clean up after a failing comparison.
docker rm -f elogistix-postgres4-compat
```

Without `POSTGRES_DRIVER_LOCAL=1`, the real-driver test is reported as SKIP and
opens no database connection. Ordinary CI runs the separate offline loader tests.
