# Actualización de versiones en CI (después de Postgres 17)

Revisé los 8 workflows y la acción compuesta `setup-bun`. Esto es lo que está desactualizado hoy, ordenado por impacto real.

## Bloque 1 — Deno 1.46 → 2.x (el más importante)

Dos workflows fijan `deno-version: v1.46.x` (`ci.yml` job de edge functions y `post-deploy-smoke.yml`). Deno 1.46 es de 2024; la línea actual es 2.9.x y las Edge Functions ya corren sobre Deno 2 en el backend.

Es exactamente el mismo tipo de divergencia que acabamos de corregir con Postgres: los tests de las edge functions se validan contra un runtime distinto al de producción.

Trabajo: subir el pin a `v2.x`, correr `deno test` de las 42 pruebas y ajustar lo que rompa (APIs removidas en Deno 2, imports `node:`, permisos). Si algo no se puede resolver limpio, se documenta y se deja en 1.46 con nota explícita.

## Bloque 2 — Acciones de GitHub (bajo riesgo, cambio mecánico)

| Acción | Hoy | Última |
| --- | --- | --- |
| `actions/checkout` | v6.1.0 | v7.0.1 |
| `actions/cache` | v5.1.0 (y **v5.0.5** dentro de `setup-bun`) | v6.1.0 |
| `actions/github-script` | v8.0.0 | v9.0.0 |
| `dorny/paths-filter` | v3.0.4 | v4.0.3 |
| `actions/dependency-review-action` | v4.9.0 | v5.0.0 |
| `rhysd/actionlint` (binario) | 1.7.7 | 1.7.12 |

Detalle a corregir de paso: `actions/cache` está en dos versiones distintas según el archivo. Se unifica.

Todo se mantiene anclado por SHA con el comentario `# vX.Y.Z`, como ya está la convención.

Ya están al día: `oven-sh/setup-bun` v2.2.0, `denoland/setup-deno` v2.0.5, `gitleaks-action` v3.0.0, `upload-artifact` v7.0.1, `download-artifact` v8.0.1, `codeql-action` v4.37.9.

## Bloque 3 — Bun 1.3.3 → 1.4.0 (opcional, riesgo medio)

`setup-bun` fija Bun 1.3.3 deliberadamente. La 1.4.0 es un salto de línea menor que puede tocar resolución del lockfile y el runner de Vitest. Implica también actualizar la llave de cache (`bun1.3.3`) y correr la suite completa.

Lo dejaría fuera de esta tanda salvo que lo quieras, porque no corrige ninguna divergencia con producción.

## Lo que NO tocaría

- `runs-on: ubuntu-24.04` — anclado a propósito; `ubuntu-latest` reintroduce inestabilidad.
- `@playwright/test` — ya flota con `^1.62.1` y se instala en cada job.
- `engines.node >= 22` — correcto.

## Notas técnicas

- Cada bump de acción se verifica con `actionlint` local antes de cerrar.
- El bump de Deno se valida corriendo `deno test` sobre `supabase/functions/**/*_test.ts` (excluyendo `smoke_test.ts`, igual que CI).
- Se registra en `CHANGELOG.md` y se sube `APP_VERSION`.

## Alcance propuesto

Bloques 1 y 2. Bloque 3 solo si lo apruebas explícitamente.
