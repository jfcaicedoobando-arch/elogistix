# PR 461 follow-up: safe logout and aligned Sentry/Supabase contracts

Base: `683e56b2dbf9be7fd2967fe6cf5a00303356456a` (2026-11-09).
This extracts the Sentry 11.11.0 and Supabase 2.119.0 families from the
mixed Dependabot update #461. Existing Vitest 5.1.0, Query 5.106.1 and
GitHub Actions updates remain unchanged; the remaining packages stay in #461.

## Changes and preserved boundaries

- Logout first attempts global revocation. Auth 2.119 preserves its persisted
  session when that request fails, so the wrapper falls back to local logout
  and verifies that `getSession()` has no session before resolving. Errors
  remain generic; no raw Auth/storage response reaches UI or logs.
- A local-only result warns that logout on other devices was not confirmed.
  Profile, in-memory queries, persisted queries and drafts are cleared only
  after the local session is verified absent. Login navigation waits for this
  result, and local failures remain on the current page with a safe error.

- The root Sentry packages, real Deno imports, harness and version assertion
  agree on 11.11.0. Privacy, request isolation, scrubbers, allowlists, default
  integrations, tracing and no-OTEL/runtime-patching assertions are unchanged.
- All live Supabase Edge imports (including types, tests and `/cors`) use
  exact npm 2.119.0, matching the root SDK and its five installed consumers.
- Auth 2.119 performs GET before deleting a user to preserve the v2 return
  value when Auth DELETE returns an empty response (upstream issue #2751).
  Tests assert every method/path/header in each operation, not merely 12
  requests instead of 10. Added empty-204 result, failed preflight with no
  DELETE, and failed DELETE contracts. All malformed UUID no-transport cases
  remain intact. Transport is synthetic and external fetch/WebSocket fail.
- The closed demo adapter changes only its SDK import. The historical source
  inventories remain byte-identical. Its adaptation helper pins the new
  complete source digest before reversing that one line for historical
  verification. Wiring/body/import/version mutation controls still fail.
- No migration contents, authorization permissions, credentials, deployed code,
  database or real Auth users were changed.

## Local validation

Node 26.13.0, Bun 1.4.4, Deno 2.9.8, Linux. Synthetic fixtures only:

- Frozen Bun install: PASS, no lock changes (749 packages).
- Dependency consumer contracts: PASS, including exact Edge import inventory,
  per-operation Auth transport and Vitest runner/coverage alignment.
- Sentry frontend: 26 files, 254 tests PASS.
- Sentry/Auth/scrubber real Deno SDK: 24 tests and 6 steps PASS with typecheck,
  cached dependencies and network denied. Sentry tests explicitly deny runtime
  networking even when the surrounding CI command allows it.
- Complete offline authority-contract and authority-bridge lanes: 44 and 71
  tests PASS; operational gates remain CLOSED/UNBOUND/NOT_RUN.
- Six static database audits PASS: manifest, schema columns, schema functions,
  migrations, replay mirror and RPC sync. Used `node --import tsx` because the
  container denies the tsx CLI's IPC socket. No database execution occurred.
- Knip unused-code inventory: PASS.
- Logout/auth/context/wizard storage: 26 files, 199 tests PASS, including real
  SDK offline/503/401/403 persisted-session and reload regressions.
- Focused ESLint on all 15 logout files and the 3 SDK contract files: PASS.
- Independent final review: no blocking findings; cleanup uses no lazy chunks.

## Complete CI is required

Local `typecheck:ci`, full ESLint and the production build were killed with
SIGKILL by the shared environment; none is a pass. Deno Data/Realtime lacked cached `testing/time.ts` from
deno.land. Full TypeScript, all deployable Edge adapters, the complete Deno
suite and all fourteen Vitest shards must pass on the actual remote commit.

No test selection, coverage threshold, operational gate or historical source
provenance check was removed or weakened. No migration, real authentication
operation, deployment or production data change is included.
