
## Contexto

Sólo hay **un** issue sin resolver en Sentry (elogistix, últimos 7 días):

- **JAVASCRIPT-REACT-1M** — `xZ` / `captureException` disparado por React Query.
- 55 ocurrencias, 8 usuarios, regresión.
- `queryKey: ["cotizaciones", "c5a10ecc-..."]`
- Extra: `{ code: "PGRST116", details: "The result contains 0 rows", message: "Cannot coerce the result to a single JSON object" }`
- URL: `/cotizaciones/{id}` con un ID que ya no existe (probablemente soft-delete reciente o link viejo).

**Causa raíz:** `fetchCotizacionById` en `src/features/cotizacion/services/queries.ts:76-81` usa `.single()`, que lanza PGRST116 cuando no hay filas. El error se propaga a React Query → `MutationCache`/`QueryCache` → Sentry, pese a que la UI ya sabe manejar "no encontrada" (`CotizacionDetalle.tsx:56-58` muestra el empty state cuando `cotizacion` es `null`).

Analogía: es como pedir "el" libro con cierto ISBN a la biblioteca; si no está, `.single()` grita alarma, cuando lo correcto es devolver "no hay libro" en silencio (`.maybeSingle()`).

## Cambios

### 1. `src/features/cotizacion/services/queries.ts`
- Cambiar `fetchCotizacionById(id)` de `.single()` a `.maybeSingle()`.
- Firma nueva: `Promise<CotizacionRow | null>`.
- Devolver `null` cuando no haya fila (sin lanzar).

### 2. Ajustar consumidores para el tipo `CotizacionRow | null`
Revisar y adaptar (probablemente ya toleran null porque la UI muestra empty state, pero hay que hacer explícito el tipo):
- `src/features/cotizacion/queries.ts` (queryOptions `detail`).
- `src/features/cotizacion/hooks/useCotizacionDetalleState.ts`.
- `src/features/cotizacion/hooks/usePdfPreviewCotizacionPage.ts`.
- `src/features/cotizacion/routes/EditarCotizacion.tsx` — si asume no-null, agregar guard que redirija a `/cotizaciones` con toast "Cotización no encontrada".

### 3. Tests
- Actualizar `src/features/cotizacion/services/__tests__/queries.test.ts` para cubrir el caso "0 rows → null".
- Ajustar `usePdfPreviewCotizacionPage.test.tsx` si el mock devuelve throws.

### 4. Versionado
- Bump `APP_VERSION` a `13.297.1` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md`: `Fixes JAVASCRIPT-REACT-1M — PGRST116 al abrir cotización inexistente`.

### 5. Cerrar issue en Sentry
- `update_issue` a `resolved` referenciando la versión, según regla `mem://preferences/sentry-resolve`.

## Verificación

- `bun run typecheck` limpio.
- Tests de `queries.test.ts` y consumidores en verde.
- Manual: navegar a `/cotizaciones/<uuid-inexistente>` debe mostrar "Cotización no encontrada" **sin** reportar a Sentry.

## Fuera de alcance

- No se toca lógica de negocio de cotizaciones.
- No se cambia la política de reporting global de React Query (`errorHandler`); el fix es a nivel de fuente para no ensuciar los reportes futuros.
