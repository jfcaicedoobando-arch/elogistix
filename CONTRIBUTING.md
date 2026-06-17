# Contributing — Libre Carga

Guía corta para colaborar en el repo. Idioma de commits, PRs y comentarios: **español mexicano**.

## Branch protection requerido en `main`

Configurar en GitHub → Settings → Branches → Branch protection rules:

- **Require a pull request before merging** ✓
  - Require approvals: 1
  - Dismiss stale reviews on push: ✓
- **Require status checks to pass before merging** ✓ (los siguientes son **obligatorios**):
  - `Lint, typecheck, unused code & build` (job `quality` de `ci.yml`)
  - `Tests (shard X/8)` — los 8 shards
  - `Coverage merge & report`
  - `Edge Functions (Deno tests)`
  - `Analyze (javascript-typescript)` (de `codeql.yml`)
  - `gitleaks`
  - `actionlint` (solo si el PR toca `.github/**`)
  - `Dependency Review`
- **Require branches to be up to date before merging** ✓
- **Require conversation resolution before merging** ✓
- **Do not allow bypassing the above settings** ✓ (incluye admins)
- **Restrict who can push to matching branches**: nadie (solo merges vía PR)

## Versionado

Cada cambio funcional debe:
1. Bumpar `APP_VERSION` en `src/constants/appVersion.ts` (SemVer)
2. Agregar entrada al inicio de `CHANGELOG.md` con formato:
   ```
   ## [X.Y.Z] - YYYY-MM-DD
   - **tipo(scope)**: descripción breve en una línea.
   ```

## Workflows activos

| Workflow | Trigger | Bloquea PR |
|---|---|---|
| `ci.yml` | push/PR | sí |
| `codeql.yml` | weekly + push/PR a main | sí |
| `gitleaks.yml` | PR | sí |
| `dependency-review.yml` | PR | sí |
| `actionlint.yml` | PR (solo `.github/**`) | sí |
| `rls-tests.yml` | PR/push tocando `supabase/**` | sí |
| `e2e.yml` | weekly + manual | no |
| `post-deploy-smoke.yml` | daily + manual | no (abre issue al fallar) |

## Secrets necesarios

- `CODECOV_TOKEN` (opcional, coverage informativo si falta)
- `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` (smoke prod)
- `E2E_BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_PORTAL_EMAIL`, `E2E_PORTAL_PASSWORD` (e2e)

## Dependabot

`.github/dependabot.yml` actualiza GitHub Actions semanalmente (grouped). Revisar y mergear los PRs `ci(deps):` cuando los checks pasen.

## Cómo extender (reglas de la auditoría arquitectónica)

Las siguientes 5 reglas son **obligatorias** y bloquean PRs en review.
Surgieron del plan de remediación 13.56.1 → 13.56.7 y mantienen el baseline
limpio.

1. **Componentes ≤200 líneas.** Si crece más, extraer subcomponentes
   presentacionales puros o hooks (`useXxxController`). Ver `TabPnl`,
   `TabCierre` y `CosteoRutas` como referencia.
2. **Sin `SELECT *` en servicios.** Declarar constantes `*_COLUMNS` con las
   columnas explícitas necesarias. Esto blinda contra crecimiento del esquema
   y mejora el plan de consulta.
3. **Tokens semánticos para colores.** Nunca usar `text-emerald-*`,
   `text-rose-*`, `bg-[#...]`. Usar `text-success`, `text-destructive`,
   `text-warning`, `bg-card`, `bg-muted`, etc. Para tonos categóricos de
   tarjetas KPI usar `bg-kpi-{tone}` / `text-kpi-{tone}`.
4. **Tests por servicio + hook.** Todo módulo nuevo en `src/features/<x>/`
   debe traer `services/__tests__/*.test.ts` (mockear con
   `_supabaseChainMock`) y un test de hook con `createWrapper()` cuando
   exponga estado React Query.
5. **Cleanup obligatorio en `useEffect`.** Cualquier `useEffect` con canal
   Supabase, listener, `setTimeout` o `setInterval` debe retornar función
   de limpieza (`removeChannel`, `removeEventListener`, `clearTimeout`,
   `clearInterval`). Ver `mem://principles/power-of-10`.

Para deuda técnica futura usar el prefijo `// AUDIT(<id>)` y registrar la
entrada en `.lovable/audit-todos.md`.
