# Paso 2: Mejoras de CI/CD (esta semana + siguiente iteración)

Aplicar el resto del hardening recomendado en la auditoría, agrupado en dos bloques.

## Bloque A — Esta semana

### A1. Pinning por SHA de acciones de terceros
Reemplazar tags móviles por SHA completo con comentario de versión. Archivos afectados:
- `.github/actions/setup-bun/action.yml`: `oven-sh/setup-bun@v2` → SHA + `# v2.x.x`
- `.github/workflows/post-deploy-smoke.yml`: `denoland/setup-deno@v2` → SHA
- `.github/workflows/ci.yml` y `e2e.yml`: revisar y pinear `codecov/codecov-action@v7`, `actions/checkout@v6`, `actions/cache@v5`, `actions/upload-artifact`, `actions/download-artifact` (las de `actions/*` son first-party de GitHub, opcional pinearlas — las dejaremos como están para reducir ruido de Dependabot).
- Solo pinear third-party: `oven-sh/setup-bun`, `denoland/setup-deno`, `codecov/codecov-action`.

Los SHAs se obtienen con `gh api repos/<owner>/<repo>/git/refs/tags/<tag>` o desde la página de releases.

### A2. Dependabot para GitHub Actions
Nuevo archivo `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    groups:
      actions-minor:
        update-types: ["minor", "patch"]
    commit-message:
      prefix: "ci"
```
Esto generará PRs semanales con bumps de SHA + tag — compatible con el pinning de A1.

### A3. Workflow de `actionlint`
Nuevo `.github/workflows/actionlint.yml` que corre en PRs que tocan `.github/workflows/**`:
- `runs-on: ubuntu-latest`, `timeout-minutes: 5`
- `permissions: contents: read`
- Usa `rhysd/actionlint` (descarga el binario, sin Docker) y falla si encuentra issues de sintaxis/shellcheck en los YAML.

## Bloque B — Siguiente iteración (seguridad + observabilidad)

### B1. CodeQL semanal
Nuevo `.github/workflows/codeql.yml`:
- Triggers: `push` a `main`, `pull_request` a `main`, `schedule` lunes 06:00 UTC.
- Lenguajes: `javascript-typescript`.
- `permissions: security-events: write, contents: read, actions: read`.
- Pasos estándar `github/codeql-action/init` → `analyze`.

### B2. Gitleaks en PR
Nuevo `.github/workflows/gitleaks.yml`:
- Trigger: `pull_request`.
- `permissions: contents: read, pull-requests: read`.
- `gitleaks/gitleaks-action@v2` (pineado por SHA) con `fail` en findings.
- Reglas: configuración default + `.gitleaks.toml` mínimo permitiendo el `ANON_KEY` público que ya vive en workflows.

### B3. Notificación de fallo de smoke
En `post-deploy-smoke.yml`, agregar un job `notify` con `needs: [user-management-smoke, exchange-rates-smoke, tracking-public-smoke]` y `if: failure()` que:
- Crea/actualiza un GitHub Issue con label `smoke-failure` (vía `actions/github-script`), incluyendo link al run.
- Requiere `permissions: issues: write` solo en ese job.
- Sin webhooks externos para no introducir secrets nuevos.

## Verificación
- `actionlint` local (o vía el workflow nuevo) sobre los 6 workflows resultantes.
- Confirmar que `dependabot.yml` valida (sintaxis YAML correcta, no se ejecuta hasta merge).
- No tocar lógica de jobs existentes ni triggers; solo agregados.

## Metadata
- `APP_VERSION` → `13.21.11`
- `CHANGELOG.md` → entrada `## [13.21.11] - 2026-06-15` listando: pin por SHA de terceros, `dependabot.yml`, workflow `actionlint`, workflow `codeql`, workflow `gitleaks`, y notificación de fallo de smoke vía issue.

## Fuera de alcance
- Reusable workflows / composite actions adicionales (más allá de `setup-bun`).
- Build provenance / SLSA attestation.
- Bundle budget por chunk (ya existe `scripts/check-bundle-size.sh`, lo dejamos como está).
- Cambios a `ci.yml`, `e2e.yml`, `rls-tests.yml` más allá del pinning de A1.
