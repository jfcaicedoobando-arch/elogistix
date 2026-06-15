
# Step 3 — 8 mejoras pendientes de GitHub Actions

Bump: `APP_VERSION` → `13.21.12` + entrada en `CHANGELOG.md`.

## Bloque C — Seguridad de supply chain

### C1. Dependency Review en PRs (item #5)
Nuevo workflow `.github/workflows/dependency-review.yml`:
- Trigger: `pull_request` sobre `main`.
- `actions/dependency-review-action` SHA-pinneado.
- `fail-on-severity: high`, `comment-summary-in-pr: on-failure`.
- `permissions: contents: read, pull-requests: write`.

### C2. `--ignore-scripts` en bun install (item #10)
Editar `.github/actions/setup-bun/action.yml` (composite) para correr `bun install --frozen-lockfile --ignore-scripts` por defecto. Protege contra postinstall maliciosos en dependencias.

## Bloque D — Calidad y feedback

### D1. ESLint `--max-warnings 0` explícito (item #11)
En `.github/workflows/ci.yml`, paso de lint: `bun run lint -- --max-warnings 0` (sin tocar `package.json`).

### D2. E2E nightly (item #12)
Editar `.github/workflows/e2e.yml`: añadir `schedule: cron '0 6 * * *'` (06:00 UTC diario ≈ 00:00 CDMX) además del lunes existente. Mantener `concurrency` para evitar duplicados.

### D3. Comentario de cobertura en PR cuando falla (item #14)
En `ci.yml` job de tests: añadir step condicional `if: failure()` que use `actions/github-script` para postear comentario con link al run y resumen del coverage report (si existe `coverage/coverage-summary.json`). `permissions: pull-requests: write` solo en ese job.

## Bloque E — Validaciones y performance

### E1. Lint de migraciones SQL (item #15)
Nuevo workflow `.github/workflows/sql-lint.yml`:
- Trigger: PRs que tocan `supabase/migrations/**`.
- Usa `sqlfluff` (Python, dialect `postgres`) con config mínima `.sqlfluff` permisiva (solo errores de parsing y reglas críticas L010/L030/L048).
- `permissions: contents: read`.

### E2. Bundle budget por chunk versionado (item #16)
Nuevo archivo `.github/bundle-budget.json` con límites en KB por chunk principal (`index`, `vendor-react`, `vendor-supabase`, `vendor-charts`, etc.). Nuevo step en `ci.yml` después del build: script `scripts/check-bundle-budget.mjs` que lee `dist/assets/*.js` (gzipped) y compara contra el JSON; falla si excede.

### E3. Cache de Vite/Vitest (item #17)
En `ci.yml`, añadir `actions/cache` (SHA-pinneado) para:
- `node_modules/.vite`
- `node_modules/.vitest`
- `.vitest-reports`
Key basado en `bun.lockb` + hash de `vite.config.ts`/`vitest.config.ts`.

## Detalles técnicos

- Todas las acciones de terceros SHA-pinneadas con comentario de versión (consistente con Step 2).
- Permisos mínimos por job (default `contents: read`, elevar solo donde se requiera).
- Sin tocar `rls-tests.yml` ni `post-deploy-smoke.yml`.
- `sqlfluff` corre vía `pip install sqlfluff==3.x` en un job Ubuntu con `actions/setup-python` SHA-pinneado.
- `bundle-budget.json` con valores iniciales calibrados al build actual + 10% de margen.

## Fuera de alcance

- Reusable workflows / composite refactor mayor.
- SLSA / build provenance.
- Cambios a `package.json` scripts.
- Renovate (ya hay Dependabot).
