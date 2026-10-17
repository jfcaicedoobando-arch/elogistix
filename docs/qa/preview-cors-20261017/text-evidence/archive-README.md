# Preview CORS: manual Deno evidence

Base Git: `366e896df775490c29f87475db32ac7a9c126c30`.
The only production change pins `npm:@supabase/supabase-js@2/cors` to
`npm:@supabase/supabase-js@2.118.0/cors`. The exact version was selected after
the floating reference resolved to 2.118.0 in a fresh task-local Deno cache.
The ESM export, module bytes, package graph and headers match the candidate.

Executed with Deno **2.9.7**, V8 **15.0.245.2-rusty**, TypeScript **6.0.3**.
The portable runtime was copied with explicit authorization; source before/after
and destination SHA256 all match
`e020f3e232bd16e33768dee528e5983349c962952051ced0a5d58ad42f5d9b33`.
No runtime was downloaded or installed globally. `runtime-provenance.json`
records the copy; the binary and cache are excluded from the evidence archive.

## Actual-handler coverage

`handler_contract_test.ts` imports the real repository `index.ts`, intercepts
its `Deno.serve` registration without creating a socket, and retains the real
React 18.3.1, `renderAsync`, registry and eight committed TSX templates.
It does not replace the renderer, authorization code or templates with helpers.

Reference and pinned candidate each pass one Deno contract with 12 request
scenarios: OPTIONS before configuration/auth, missing/empty API key, missing/wrong
token, valid POST, lowercase Bearer, and existing GET/PUT/PATCH/DELETE behavior.
The complete status, normalized headers and literal body/HTML are exactly equal
between versions. Successful requests verify all eight names/order, display names,
subjects, `ready` status and independent preview-data/HTML markers.

`cors_resolution_test.ts` passes a separate Deno contract importing the actual
floating and pinned npm exports and package metadata. It checks the exact resolved
version and complete `corsHeaders`. Both module/package graphs are identical.
`summary.json` records the results, command stages and per-response body hashes;
raw response JSON includes the full rendered HTML.

Typechecking remains enabled, including an explicit check of the dynamic import
target `index.ts` and the harness. Ops/resources/exit sanitizers remain enabled.
The handler and resolver run with `--cached-only`, `--node-modules-dir=none`,
`DENO_NO_PACKAGE_JSON=1`, and net/env/run/ffi/sys denied. Read permission is limited
to `index.ts`, its committed template directory and the comparison JSON; write
permission is limited to the requested output JSON. Global `fetch` throws and
records attempts: **zero** in reference and candidate.

The real environment getter is never called. `LOVABLE_API_KEY` is an in-memory
fixture; dependency queries `NODE_ENV` and `NODE_OPTIONS` return `undefined` and
are checked separately. No production destination, key, email provider or browser
is used. This is local CLI evidence; it does not certify deployed runtime/state
or historical resolutions of the floating range in other environments.

## Reproduction

Extract this archive outside a repository checkout. Use an authorized Deno 2.9.7
executable, a dedicated cache, and an independent checkout of the base for the
reference, then the PR head for the candidate. Do not apply source copies from
`source/`: they are byte witnesses only, not importable substitute handlers.
Windows checkout CRLF is preserved in those witnesses; the one-line Git comparison
normalizes CRLF to LF and checks the exact import replacement.

Set `$corsDeno`, `$corsRoot`, `$corsRepo` and `$corsCache` to those paths.
Public dependency acquisition is a separate authorized step; cache the actual
entrypoint, the two `/cors` specifiers and their `/package.json` exports. Preserve
`deno info --json` for both specifiers using that same cache. Do not grant network
access to handler tests. The execution records retain the exact successful commands.

```powershell
$env:DENO_DIR = $corsCache
$env:DENO_NO_PACKAGE_JSON = '1'
$env:DENO_NO_UPDATE_CHECK = '1'
$corsConfig = Join-Path $corsRepo 'supabase/functions/preview-transactional-email/deno.json'
$corsEntry = Join-Path $corsRepo 'supabase/functions/preview-transactional-email/index.ts'
$corsTemplates = Join-Path $corsRepo 'supabase/functions/_shared/transactional-email-templates'
$corsReference = Join-Path $corsRoot 'reference-handler.json'
$corsCandidate = Join-Path $corsRoot 'candidate-handler.json'

& $corsDeno check --cached-only --no-lock --node-modules-dir=none "--config=$corsConfig" `
  $corsEntry (Join-Path $corsRoot 'handler_contract_test.ts') `
  (Join-Path $corsRoot 'cors_resolution_test.ts')
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }

# At the base checkout, before the pin:
& $corsDeno test --cached-only --no-lock --node-modules-dir=none "--config=$corsConfig" `
  --sanitize-ops --sanitize-resources --deny-net --deny-env --deny-run --deny-ffi --deny-sys `
  "--allow-read=$corsEntry,$corsTemplates" "--allow-write=$corsReference" `
  (Join-Path $corsRoot 'handler_contract_test.ts') -- `
  "--entry=$(([Uri]$corsEntry).AbsoluteUri)" --label=reference `
  "--output=$(([Uri]$corsReference).AbsoluteUri)"
if ($LASTEXITCODE -ne 0) { throw 'Reference handler failed' }

# At the PR checkout, with the reviewed exact pin:
& $corsDeno test --cached-only --no-lock --node-modules-dir=none "--config=$corsConfig" `
  --sanitize-ops --sanitize-resources --deny-net --deny-env --deny-run --deny-ffi --deny-sys `
  "--allow-read=$corsEntry,$corsTemplates,$corsReference" "--allow-write=$corsCandidate" `
  (Join-Path $corsRoot 'handler_contract_test.ts') -- `
  "--entry=$(([Uri]$corsEntry).AbsoluteUri)" --label=candidate `
  "--compare=$(([Uri]$corsReference).AbsoluteUri)" `
  "--output=$(([Uri]$corsCandidate).AbsoluteUri)"
if ($LASTEXITCODE -ne 0) { throw 'Candidate handler/comparison failed' }

& $corsDeno test --cached-only --no-lock --node-modules-dir=none "--config=$corsConfig" `
  --sanitize-ops --sanitize-resources --deny-net --deny-env --deny-run --deny-ffi --deny-sys `
  --deny-read (Join-Path $corsRoot 'cors_resolution_test.ts') -- --candidate=2.118.0
if ($LASTEXITCODE -ne 0) { throw 'Resolution/export comparison failed' }
```

The existing helper tests are not used as proof of `index.ts`. This archive is a
manual, immutable audit snapshot, not a new automatic CI lane or maintained test
suite. The PR's ordinary CI/adapters/Deno checks are reported separately.

## Traceability and limits

`manifest.json` hashes all archive inputs. Final stage records validate exit code,
signal, process error and stdout/stderr hashes. `source/` matches source hashes in
the successful snapshots. `build-summary.mjs` checks one-line source equivalence,
raw responses, graphs, protected paths and successful execution records.
`run-deno.mjs` records the actual Windows execution with a minimal environment;
its local relative directory layout is historical, while the commands above accept
independent paths.

Four initial failures are retained and explained in the summary: a harness
`HeadersInit` type, accessor interception, template-source read scope and synthetic
dependency env setup. None changed product behavior or disabled checks. Earlier
`registry-reference.json`/`published-export.json` fields saying Deno was unverified
are dated preparatory evidence; `resolution-final` and `summary.json` supersede them.
Independent read-only reviews verified npm bytes/graphs and exact response equality.
No PR388 suite, full ERP suite, database/RLS, migration, email, merge or deployment
was executed for this local check.
