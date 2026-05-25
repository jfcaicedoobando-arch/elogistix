## Objetivo

Cerrar de un solo golpe todos los pendientes de **bajo riesgo** que quedan en el roadmap arquitectónico. Sin cambios funcionales, sin refactors invasivos, sin migraciones. Foco en blindar lo que ya está limpio y completar deuda de baja superficie.

## Alcance

### 1. Eliminar duplicados de `hooks/` raíz (P2.10)

Hoy existen **dos copias** del mismo hook:
- `src/hooks/use-toast.ts` ←→ `src/hooks/shared/useToast.ts`
- `src/hooks/use-mobile.tsx` ←→ `src/hooks/shared/useIsMobile.ts`

73 archivos importan desde la versión raíz. Acciones:
- Verificar que ambas implementaciones son equivalentes (si no, dejar la de `shared/` como única fuente y migrar diferencias).
- Reescribir `src/hooks/use-toast.ts` y `src/hooks/use-mobile.tsx` como **re-exports** del canónico en `hooks/shared/` (compat temporal).
- Migrar los 73 imports a `@/hooks/shared/useToast` y `@/hooks/shared/useIsMobile` (codemod con `sed`/`rg`).
- Borrar los archivos raíz.
- Re-correr suite (709 tests) + lint.

### 2. Mover Supabase fuera de `pages/dev/PdfPreviewCotizacion.tsx`

Última llamada directa a Supabase fuera de `services/`. Extraer el query a `services/cotizacion/queries.ts` (o usar el que ya exista) y consumirlo desde el sandbox.

### 3. Refactor de complejidad — edge function `list-users`

`supabase/functions/list-users/index.ts` arroja warning de complexity 17. Extraer 2-3 helpers internos (parse de query params, build del filtro, mapeo de respuesta) para bajar a ≤15 sin tocar el contrato HTTP.

### 4. Endurecer ESLint (P2.12)

Aprovechar que las métricas están en cero:
- `complexity`: `max: 15` → `max: 12` en `src/` (sigue como `warn`).
- `no-restricted-imports` en los globs donde es `warn`: subir a `error` (ya está en cero, evita regresiones).
- Añadir glob de excepción para `supabase/functions/**/*_test.ts` con `@typescript-eslint/ban-ts-comment: off` para silenciar los 5 errores actuales de `@ts-nocheck` en tests Deno (son intencionales).

### 5. Documento `docs/architecture-map.md` (P2.11)

Crear archivo nuevo con tabla **dominio → pages → hooks → services → lib** para los dominios principales (embarques, cotizaciones, clientes, facturación, auditoría, portal, admin). Sirve para onboarding y como ancla viva del roadmap. ~150-250 líneas.

### 6. Refrescar `mem://audit/pendings`

Marcar P2.10, P2.11, P2.12 + limpieza Supabase + edge function como cerrados. Reducir el memo a los 3-4 pendientes reales restantes (P1.5, P1.6, P1.7, P3.13).

### 7. Versionado

- `APP_VERSION` → `11.45.0`.
- Entrada nueva en `CHANGELOG.md` con resumen por sub-loop.

## Fuera de alcance (NO se tocan en este loop)

- **P1.5** — unificar `utils/` (alto riesgo, requiere coordinar imports masivos).
- **P1.6** — partir servicios "god" (medio riesgo, decisiones de diseño).
- **P1.7** — schemas zod en boundary Supabase para embarques/facturas/cotizaciones (alto esfuerzo, lo posponemos a su propio loop).
- **P3.13** — nuevos specs E2E (conciliación, portal, export ZIP) — alto esfuerzo de diseño de fixtures.
- Conversión de imágenes a WebP / preconnect a Google Fonts (era 5.6 de la etapa de performance, no de Track B).

## Verificación

1. `bun run audit:tests` — gate de higiene limpio.
2. `bun run test` — 709/709 verdes.
3. `bunx eslint src/` — 0 errors, 0 warnings con el nuevo umbral 12.
4. `bun run build` — chunks sin regresión de tamaño.
5. `rg "@/hooks/use-toast|@/hooks/use-mobile" src/ -l | wc -l` → 0.
6. `rg -l "from ['\"]@/integrations/supabase/client['\"]" src/pages src/components | wc -l` → 0.

## Detalles técnicos

- El re-export temporal de `use-toast.ts` / `use-mobile.tsx` se hace en el mismo commit que la migración para que no quede deuda transitoria.
- Para subir `complexity` a 12 antes hay que correr `eslint` y, si aparecen warnings nuevos en `src/`, **bajar el alcance**: en ese caso quedarse en 14 y dejar el salto a 12 como TODO en el memo. No introducimos refactors no planeados.
- El `architecture-map.md` se genera leyendo la estructura real, no inventando. Si un dominio no calza limpio en la tabla, se documenta el desvío.

## Esfuerzo estimado

| Sub-loop | Esfuerzo |
|---|---|
| 1. Eliminar duplicados hooks | Medio (codemod + revisar 73 imports) |
| 2. Supabase fuera de PdfPreview | Bajo |
| 3. Edge function list-users | Bajo |
| 4. Endurecer ESLint | Bajo |
| 5. architecture-map.md | Medio |
| 6. Refresh memoria | Bajo |
| 7. Versionado + changelog | Bajo |

Total: 1 loop de tamaño normal. Todo verificable con la suite existente, sin migraciones de DB, sin cambios visibles para el usuario final.
