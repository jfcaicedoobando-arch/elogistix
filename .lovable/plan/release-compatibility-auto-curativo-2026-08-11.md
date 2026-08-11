# `release-compatibility` auto-curativo

## Problema (verificado)
`bun run db:release-manifest:check` falla ahora mismo con:

```text
ERROR: No existe manifest para APP_VERSION 13.517.0.
```

El manifest `supabase/releases/migration-manifest.json` es un diccionario por versión y no tiene entrada para la versión actual, así que el workflow `release-compatibility` (paths incluyen `supabase/migrations/**` y `src/constants/appVersion.ts`) falla en cada push a main cuando el bot mergea migraciones sin regenerarlo.

## Qué se va a cambiar

### 1. Regenerar el manifest ya
Correr `bun run db:release-manifest:update` para crear la entrada de `13.517.0` (incluye la migración de buckets del cambio anterior) y dejar main en verde de inmediato.

### 2. `.github/workflows/release-compatibility.yml` — auto-curación en push
- `permissions: contents: read` → `contents: write` (necesario para el auto-commit).
- El step final `Verify migration manifest` pasa a tener `id: manifest` y captura el resultado en `steps.manifest.outputs.ok`:
  - en `pull_request` (y cualquier evento que no sea `push`) sigue fallando duro, para que el arreglo se haga en el PR;
  - en `push` sólo emite un `::warning::` y continúa.
- Nuevo step `Auto-heal manifest (push a main)`, condicionado a `github.event_name == 'push' && github.ref == 'refs/heads/main' && steps.manifest.outputs.ok == 'false'`: regenera el manifest, re-verifica (si sigue fallando el run muere ahí), commitea sólo `supabase/releases/migration-manifest.json` como `release-manifest-bot` con `[skip ci]` y hace `git push origin HEAD:main`. Si no hay diff, sale limpio.

Contenido tal cual el diff que subiste. El checkout ya usa `persist-credentials: true`, así que el push funciona sin token extra.

## Bitácora
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`. El manifest se regenera **después** del bump, de modo que la entrada registrada corresponda a la versión final del commit.
