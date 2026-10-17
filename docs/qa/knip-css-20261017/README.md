# Knip CSS project coverage — 2026-10-17

Base: `9af3859fabd6e57343cb5fadd4494a0a14579cb2`, verified against remote
`main` before checkout and again before publication. Work uses an isolated clone
and branch `codex/knip-css-config-20261017`. Root instructions and contribution,
architecture and CI guidance were read; `.agents/skills` is absent at this base.

## Decision and minimal change

The normal Knip gate reproduces PR 386's remaining configuration suggestion:
`.css — Compiled extension excluded by project (imports not followed)`.
No documented intentional CSS exclusion was found. The source-only project
glob was inherited from the original configuration and retained by `57e0492c1`.

`src/main.tsx` imports `index.css`; that CSS imports `tailwindcss`, `styles.css`
and `tailwind-compat.css`, and references `tailwind.config.ts`. CSS is also
declared in `package.json` side effects. The installed Knip 6.41.0 Tailwind
plugin registers a `.css` compiler that follows `@import`, `@config` and
`@plugin` (`node_modules/knip/dist/plugins/tailwind/{index,compiler}.js`).

The only configuration change adds `css` to the root workspace's existing
`project` glob: `src/**/*.{ts,tsx,css}`. This admits CSS to the existing graph
and unused-file analysis. No CSS entry point, suppression, rule, plugin,
dependency, manifest, lockfile, workflow or application source is changed.
Existing exclusions, including `src/components/ui/**`, remain identical.

## Inventory and coverage controls

Runtime: Node **24.22.0**, Bun **1.4.0**, Knip **6.41.0**. Dependencies were
installed using `bun install --frozen-lockfile --ignore-scripts` into this clone.
The normal gate and reporter commands use the fixed Node executable:

```sh
node node_modules/knip/bin/knip.js --no-progress
node node_modules/knip/bin/knip.js --no-progress --reporter json
```

- Before and after normal gate: exit **0**; CSS configuration hints **1 → 0**.
- Raw reporter inventories are exactly equal: `{"issues":[]}` in both
  `before.json` and `after.json`, with equal SHA-256 digests in `comparison.json`.
- Normal Knip was rerun after probe cleanup: exit **0**, no configuration hint.
  `knip-before.txt` and `knip-after.txt` preserve stdout/stderr. Existing Sentry
  messages about an absent token remain visible; no token was supplied.

Temporary controls run the same JSON reporter with the amended configuration:

1. Create `src/__knip_css_probe_orphan__.css` containing
   `.knip-css-probe { color: red; }`. Knip reports that exact path under `files`
   and exits **1**. Remove the temporary file.
2. Create `src/__knip_css_probe_transitive__.css` containing
   `@plugin "knip-css-probe-missing";`, then temporarily append
   `@import "./__knip_css_probe_transitive__.css";` to `src/index.css`.
   Knip follows the CSS import, reports `knip-css-probe-missing` under `unlisted`
   at the imported stylesheet's **1:17**, and exits **1**, with no unused-file
   issue. Nothing is installed or added to a manifest.
3. A `finally` block restores the entry's original bytes and removes both probe
   paths. `probes.json` retains both raw inventories, exits and cleanup proof.
   The restored entry SHA-256 is
   `2145da531b9725faad9b0e5123c789a37c0397a88317295ab713cd1273778423`.

These controls establish that the suggestion is resolved by enabling graph
coverage and that actual file/dependency errors still fail the gate.
An independent subagent reviewed the configuration, compiler behavior,
inventories and cleanup without editing: no findings.

## Validation

`focused-tests.txt` retains **2 files / 21 passing tests**:

```sh
node node_modules/vitest/vitest.mjs run src/pdf/theme/__tests__/fontAssets.test.ts scripts/__tests__/check-css-size.test.ts
node node_modules/typescript/bin/tsc -b
node node_modules/eslint/bin/eslint.js . --max-warnings=0
node node_modules/vite/bin/vite.js build
node scripts/check-css-size.mjs dist/assets --json
git diff --check
```

TypeScript, ESLint with zero warnings and production build pass. Build runs with `SENTRY_AUTH_TOKEN`
absent, `ANALYZE=false` and `CI_REPORT_COMPRESSED_SIZE=false`, without uploads.
The existing HTML bundle verification passes. CSS budget passes with **196588
raw / 27568 gzip / 21163 Brotli bytes**, recorded in `css-budget.json`.
Check commands and exit codes are recorded in `validation.json`.

Existing Vite native-config/SWC recommendations and large-chunk warnings remain
diagnostic output; no claim of globally warning-free tooling is made.
Full ERP, database, RLS and browser suites are outside this configuration-only
change; no database or deployment action was run. `comparison.json` confirms
that `src`, `scripts`, `.github`, `package.json` and `bun.lock` equal the base.
Remote CI status belongs to the PR description so it does not change the tested
commit. The PR remains a draft for independent review; no merge is authorized.
