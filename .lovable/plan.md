## Contexto

Del paquete M1–M14 ya están aplicados (verificado en repo): **M3, M4, M5, M6, M7, M8, M11, M13**.

Quedan **6 hallazgos**, todos verificados como pendientes hoy:

| Fix | Estado verificado |
|---|---|
| M1 | Los 4 marcadores `SAFE-CAST` obsoletos siguen presentes |
| M2 | `cast.ts:32` conserva el docstring falso; `readSchemas.ts` no existe |
| M9 | `useAuthProfile.ts:22` sigue con `CONTEXT_TTL_MS` manual, sin `useQuery` |
| M10 | `useCxpPageState.ts` usa 10 `useState`, sin nuqs |
| M12 | `src/lib/async/` no existe; `FacturasMasivasToolbar.tsx:56,95` tiene los 2 loops seriales |
| M14 | 11 `useQuery` inline + 6 archivos con `useMutation` inline + los 7 hooks en `components/` |

Propongo 3 olas, cada una verde en typecheck + lint + tests antes de pasar a la siguiente.

---

## Ola 4 — Higiene de tipos y validación de fronteras (M1 + M2)

**M1 — SAFE-CAST obsoletos**
- Eliminar los 4 casts y sus marcadores en `aprobacion.ts`, `proveedoresCrud.ts`, `useTabProformasController.ts`, `eliminarBorrador.ts` (los tipos generados ya los cubren).
- Borrar el `;` huérfano de `useTabProformasController.ts:14`.
- Nuevo test `src/__tests__/architecture/safe-cast-freshness.test.ts`: falla si un marcador que alega "los tipos aún no…" menciona un identificador que ya existe en `types.ts`.

**M2 — adopción de zod en `fromDb`**
- Corregir el docstring de `src/lib/supabase/cast.ts`.
- Nuevo `src/features/cotizacion/services/readSchemas.ts` con schemas de lectura `.passthrough()` para las fronteras de dinero.
- Migrar 5 call sites (proformas/queries, cotización queries + costos + crear).
- Ratchet `fromdb-zod-adoption.test.ts` (la baseline solo puede bajar) y métrica `fromDb {total, conSchema, ratio}` en `scripts/audit-report.ts`.

## Ola 5 — Estado de servidor y URL (M9 + M10)

**M9 — perfil/organización sobre TanStack Query**
- Reescribir `useAuthProfile` con `useQuery` (`staleTime` 60s, misma firma pública `{profile, reset, refresh}`), exportando `userContextKey`.
- `useAdminOrgInfo` invalida ese key en `updateOrg`/`toggleActivo` para que el encabezado/sidebar refleje el nombre nuevo al instante.

**M10 — filtros de CxP en la URL**
- Migrar `useCxpPageState` a `useTableFilters` (nuqs), eliminando el efecto de reset de página.
- `useCxpDeepLinks` a `useQueryState("factura")`; se borra el efecto mount-only de `?aprobacion=` (queda reactivo gratis).
- `useEditarFacturaProveedorForm`: sincronizar row→estado solo al cambiar de factura, para no pisar la captura en curso en un refetch.
- Tests de filtros por URL.

## Ola 6 — Rendimiento y organización de código (M12 + M14)

**M12 — acciones masivas concurrentes**
- Nuevo helper `src/lib/async/mapWithConcurrency.ts` (tandas + `Promise.allSettled` + `onProgress`, sin dependencias nuevas) con su test.
- `FacturasMasivasToolbar`: concurrencia 4 en ZIP y reenvío, contador "Descargando 12/50…", guard de desmontaje, misma lógica de toasts.

**M14 — hooks fuera de componentes**
- Extraer los 11 `useQuery` y 11 `useMutation` inline a hooks en `features/*/hooks/`.
- Mover los 7 hooks que hoy viven en `components/` a su carpeta `hooks/` y actualizar imports.
- Respetando el límite de 200 líneas por archivo (Power of 10).

---

## Detalles técnicos

- Migraciones SQL: **ninguna**; esta tanda es 100% frontend/scripts.
- Guardrails a respetar: ESLint de `queryKey` inline, límite de 200 líneas, `notify*` para toasts, marcador `// SAFE-CAST` solo cuando siga siendo cierto.
- Verificación por ola: `bun run typecheck`, `bun run lint --max-warnings 0`, tests de arquitectura y los suites tocados.
- Al cierre de cada ola: entrada en `CHANGELOG.md` y bump de `APP_VERSION` (13.329.0 → 13.331.0).
