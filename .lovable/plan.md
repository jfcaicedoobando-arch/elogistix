
## Diagnóstico

El pipeline `Coverage merge & report` marcó rojo por **dos causas** independientes:

**A. 5 tests de arquitectura/unit fallan (regresiones de nuestras últimas fases)**

1. `src/lib/__tests__/architecture-baseline.test.ts` y `src/__tests__/audit-report.test.ts` — Power-of-10: **2 archivos > 200 líneas** fuera de la allowlist:
   - `src/features/crm/routes/Actividades.tsx` (201)
   - `src/hooks/emails/useEnvioDocumentoForm.ts` (201)
2. `src/lib/__tests__/architecture.test.ts` y `src/__tests__/architecture/safe-casts-services.test.ts` — 3 `as unknown as` sin marcador `// SAFE-CAST:`:
   - `src/hooks/shared/useMutationWithFeedback.ts:150` y `:163` (introducidos en el refactor optimista)
   - `src/features/embarques/queries.ts:25` (introducido al migrar a `queryOptions`)
3. `src/__tests__/architecture/mutations-have-onerror.test.ts` — `src/features/facturacion/hooks/useTimbrarFacturaDialog.ts:78` tiene `useMutation` (mutación `actualizarDatos`) sin `onError`.
4. `src/features/facturacion/hooks/__tests__/useNotaCreditoFacturapi.test.tsx` — El test espera que se invalide `["factura_notas_credito", "recientes"]` inline, pero al migrar a `queryKeys` el hook ahora invalida con la factory. Hay que alinear el test con la key centralizada.

**B. Cobertura global cayó por debajo del umbral** (statements 30.08 % / requerido 38 %). La memoria `coverage-threshold` prohíbe bajar el umbral; hay que **escribir tests** o **acotar el `include` de cobertura** si se están contando archivos que antes no se contaban.

## Cambios propuestos

### Fix A — Fallos de arquitectura y unit (una tanda)

1. **Reducir a ≤200 líneas** ambos archivos, extrayendo helpers puros a módulos vecinos:
   - `Actividades.tsx` → mover columnas / filtros a `Actividades.helpers.ts` (o `.columns.ts`).
   - `useEnvioDocumentoForm.ts` → mover validaciones/mapeos a `useEnvioDocumentoForm.helpers.ts`.
2. **Añadir `// SAFE-CAST:`** con justificación breve encima de cada cast:
   - `useMutationWithFeedback.ts:150,163` (react-query tipa el `error` como `unknown`; sólo leemos `.message`).
   - `embarques/queries.ts:25` (react-query key acepta `Record<string, unknown>`; los filters son un DTO plano).
3. **`useTimbrarFacturaDialog.ts`** — Añadir `onError: (e) => notifyError(...)` a la mutación `actualizarDatos` (y verificar `guardarDefaults`, que es best-effort: si el linter la marca, añadir `onError` no-op documentado).
4. **`useNotaCreditoFacturapi.test.tsx`** — Reemplazar la key inline por `facturasKeys.notasCreditoRecientes()` (o la factory ya registrada) para que el test verifique lo que hoy invalida el hook. Si esa factory no existe todavía, crearla en `queryKeys` y usarla tanto en hook como test.

### Fix B — Cobertura

Antes de escribir tests a ciegas: **auditar el delta**. Ejecutar `bun run test:coverage` local y comparar el reporte con el último verde para identificar si:

- (a) archivos nuevos sin tests son los culpables (agregar tests focalizados), o
- (b) el `coverage.include` de `vitest.config.ts` está sumando código muerto/generado (ajustar el patrón, sin tocar el umbral).

En cualquier caso: **no bajar el umbral** (regla de la memoria). Reportar hallazgos al usuario y proponer 1–2 tandas concretas de tests.

## Detalles técnicos

- `useMutationWithFeedback.ts` líneas 150 y 163 — cast `error as unknown as Error` — añadir comentario `// SAFE-CAST: react-query tipa error como unknown; sólo se lee .message`.
- `embarques/queries.ts:25` — `filters as unknown as Record<string, unknown>` — comentario análogo.
- La regla del test `mutations-have-onerror.test.ts:95` recorre `useMutation({...})` y exige propiedad `onError`. `onError: () => {}` con comentario cuenta como "manejado" — se usará para casos best-effort.
- La factory `facturasKeys.notasCreditoRecientes()` debe vivir en `src/features/facturacion/queryKeys.ts`; registrar en `src/lib/query/index.ts` si aplica.

## Fuera de alcance de este plan

- Warnings de React Router v7 future flags (ruido en logs, no bloquea).
- Ajustes de UI/UX derivados del `/inicio`.
