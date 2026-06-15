# Paso 1: Hardening rápido de GitHub Actions

Aplicar las mejoras de bajo riesgo y alto valor identificadas en la auditoría a los dos workflows que hoy heredan permisos por defecto y no tienen control de concurrencia.

## Cambios

### 1. `.github/workflows/post-deploy-smoke.yml`
- Agregar bloque a nivel workflow:
  ```yaml
  permissions:
    contents: read
  concurrency:
    group: post-deploy-smoke
    cancel-in-progress: false
  ```
  - `cancel-in-progress: false` para no abortar un smoke nocturno en curso si se dispara un `workflow_dispatch` manual.
- Asegurar newline final del archivo (hoy falta).

### 2. `.github/workflows/rls-tests.yml`
- Agregar a nivel workflow:
  ```yaml
  permissions:
    contents: read
  concurrency:
    group: rls-tests-${{ github.ref }}
    cancel-in-progress: true
  ```
  - `cancel-in-progress: true` porque en PRs queremos cancelar corridas obsoletas; el grupo por `ref` evita que un PR cancele la corrida de `main`.

### 3. Verificación
- `cat` de ambos archivos para confirmar sintaxis YAML válida (indentación consistente, llaves dobles correctas).
- No se tocan jobs, steps, secrets ni triggers existentes.

## Metadata
- `src/constants/appVersion.ts` → `13.21.10`
- `CHANGELOG.md` → nueva entrada `## [13.21.10] - 2026-06-15` con bullet: "CI: permisos mínimos (`contents: read`) y `concurrency` en workflows post-deploy-smoke y rls-tests; newline final corregido."

## Fuera de alcance (siguiente iteración)
- Pinning por SHA de `oven-sh/setup-bun@v2`, `denoland/setup-deno@v2`, `codecov/codecov-action@v7`.
- `dependabot.yml` y workflow de `actionlint`.
- CodeQL, gitleaks, notificaciones de fallo de smoke.
