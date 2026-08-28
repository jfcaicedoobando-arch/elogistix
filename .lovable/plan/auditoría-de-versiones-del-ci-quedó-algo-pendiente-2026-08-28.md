# Auditoría de versiones del CI: ¿quedó algo pendiente?

## Estado verificado hoy

La infraestructura del CI ya está al día. Comparé cada pin del repo contra la última versión publicada upstream:

| Componente | En el repo | Última upstream | Estado |
|---|---|---|---|
| Bun (`setup-bun`) | 1.4.0 | 1.4.0 | al día |
| Deno (`ci.yml`, `post-deploy-smoke.yml`) | 2.6.x | 2.6.x | al día |
| `actions/checkout` | v7.0.1 | v7.0.1 | al día |
| `actions/cache` | v6.1.0 | v6.1.0 | al día |
| `actions/upload-artifact` | v7.0.1 | v7.0.1 | al día |
| `actions/download-artifact` | v8.0.1 | v8.0.1 | al día |
| `actions/github-script` | v9.0.0 | v9.0.0 | al día |
| `oven-sh/setup-bun` | v2.2.0 | v2.2.0 | al día |
| `denoland/setup-deno` | v2.0.5 | v2.0.5 | al día |
| `dorny/paths-filter` | v4.0.3 | v4.0.3 | al día |
| `dependency-review-action` | v5.0.0 | v5.0.0 | al día |
| `gitleaks-action` | v3.0.0 | v3.0.0 | al día |
| `codeql-action` | v4.37.9 | v4.37.9 | al día |
| `actionlint` (binario) | 1.7.12 | 1.7.12 | al día |
| Runner | ubuntu-24.04 | — | pin explícito, correcto |
| Postgres de pruebas | 17.9 (por digest) | 17.11 | producción corre 17.6 |

Conclusión: **no falta ningún workflow ni acción por actualizar**. Lo único que sigue "atrás de lo último" son dependencias del proyecto (no del CI) y la imagen de Postgres.

## Lo que sí queda como opcional

### Bloque A · Bumps de parche/minor seguros (recomendado)
Actualizaciones dentro del mismo rango semver ya declarado en `package.json`, sin cambio de mayor:

- Runtime: `@sentry/react` 10.72.0, `@supabase/supabase-js` 2.112.4, `@tanstack/react-query` (+persister, +devtools) 5.102.8, `react-hook-form` 7.86.0, `terser` 5.51.2, `libphonenumber-js`, `nuqs`.
- Dev/CI: `eslint` 10.9.1, `typescript-eslint` 8.68.0, `eslint-plugin-react-refresh` 0.5.5, `knip` 6.33.0, `@testing-library/react` 16.3.3, `@types/node` 26.4.0, `@react-pdf/types` 2.14.0, `rollup-plugin-visualizer` 7.1.1.

Validación: `bun install`, `lint`, `lint:unused`, `test` y `build` en verde antes de cerrar. Riesgo bajo; si algún paquete rompe, se revierte ese paquete solo.

### Bloque B · Postgres de pruebas 17.9 → 17.11 (opcional, no urgente)
Producción está en **17.6**, así que el CI ya va por delante. Subir a 17.11 obliga a regenerar `supabase/schema/baseline.sql` byte a byte con ese motor (el job `schema-baseline` compara el dump exacto). Beneficio real: casi nulo hoy. Sugerencia: dejarlo pendiente y sincronizarlo cuando el backend suba de parche.

### Bloque C · Majors bloqueados (no tocar)
`vite` 8, `tailwindcss` 4, `typescript` 7, `react-router` 7, `vitest`/`@vitest/coverage-v8` 4, `@vitejs/plugin-react-swc` 4, `recharts` 3, `@tanstack/react-table` 9, `date-fns` 4, `jsdom` 30, `@hookform/resolvers` 5, `@testing-library/jest-dom` 7, `zod-validation-error` 5.

Los primeros están prohibidos por los pins de la plataforma Lovable; el resto son cambios de API que requieren migración dedicada y su propia ola de pruebas. No entran en esta tanda.

## Detalles técnicos

- Todas las acciones siguen ancladas por SHA con comentario de versión; los bumps de Bloque A no tocan `.github/`.
- `setup-bun` ya refresca la clave de cache con el número de versión de Bun (`bun1.4.0`), así que el cache no se contamina entre bumps.
- Cierre estándar: entrada nueva en `CHANGELOG.md` (raíz) y bump de `APP_VERSION`.
