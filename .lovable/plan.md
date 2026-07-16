# Batch F — Estabilizar CI post Batch E

El CI de v13.301.1 falló en 3 jobs. Ninguno es de lógica: son de calidad, tamaño de archivo y cobertura. **No bajaré thresholds**; escribiré tests.

## Diagnóstico (extraído de los logs)

**1. Quality (`bun run lint --max-warnings 0`)** — 8 warnings:

| Archivo | Regla | Detalle |
|---|---|---|
| `supabase/functions/facturapi-cancelar/index.ts` | `max-lines-per-function` | handler async = 223 líneas (máx 200) |
| `supabase/functions/facturapi-reconciliar-cancelaciones/index.ts` | `complexity` | 32 (máx 16) |
| ídem | `max-depth` (×5) | bloques anidados 5-7 (máx 4) |
| `supabase/functions/facturapi-webhook/helpers.ts` | `complexity` | `mapEventToFacturaPatch` = 18 (máx 16) |

**2. Tests (`audit-report.test.ts` en shard 8)** — 2 fallos:
- Arch baseline: `src/features/facturacion/components/DialogSustituirFactura.tsx` = 224 líneas (hoy 266, no está en allowlist).
- Casts baseline: 1 hallazgo HIGH/CRITICAL nuevo (introducido en Batch E).

**3. Coverage merge** — 4 umbrales globales por debajo:
- lines 36.46% < 38%
- functions 27.73% < 30%
- statements 36.05% < 38%
- branches 30.86% < 34%

Los archivos nuevos (`DialogSustituirFactura`, helpers de reconciliación, guard de webhook) entraron sin tests unitarios de UI ni del cliente RPC, arrastrando el promedio.

## Plan (analogía: pulir carrocería y sumar cinturones que faltaron)

### F1. Lint (edge functions) — refactor a helpers puros

**`facturapi-webhook/helpers.ts`**
- Extraer sub-mappers: `mapInvoiceStatusUpdated`, `mapInvoiceCanceled`, `mapCancellationStatusUpdated`, `mapDelivery`. `mapEventToFacturaPatch` queda como despachador (`switch (event.type)` → sub-mapper). Complexity ≤ 6.

**`facturapi-reconciliar-cancelaciones/index.ts`**
- Extraer a un módulo hermano `reconcile.ts`:
  - `fetchCandidateInvoices(sb)` — SELECT.
  - `consultarEstadoCancelacion(facturapi, id)` — llamada HTTP + parseo.
  - `resolveNextPatch(remote, local)` — decide patch/log (case por sub-estado).
  - `reconcileOne(sb, facturapi, factura)` — orquesta el ciclo, sin anidamientos > 3.
- El `index.ts` queda como bootstrap: valida req → `for` sobre candidatas → `reconcileOne` → responder resumen. Complexity ≤ 8, depth ≤ 3.

**`facturapi-cancelar/index.ts`**
- Extraer del handler async: `validateAndAuthorize(req)`, `postCancelToFacturapi(...)`, `applyLocalPatch(...)`, `classifyFacturapiError(err)` (ya existe parcialmente inline; sólo moverla). Handler queda ~120 líneas.

### F2. Arch baseline — `DialogSustituirFactura.tsx` (266 → ≤200 líneas)

Extraer a `components/sustitucion/`:
- `useSustitucionState.ts` — `readPersisted / writePersisted / clearPersisted` + hook con `nuevaId`, `step`, `sustitutaQuery`, `sustitutaTimbrada`, `resetIfMissing`.
- `SustitucionStepIntro.tsx` — UI del paso "intro" (duplicar borrador + navegar).
- `SustitucionStepConfirmar.tsx` — UI del paso "confirmar" (guard `sustitutaTimbrada` + cancelar).
- El componente principal orquesta: dialog shell + `switch(step)`.

### F3. Casts baseline — eliminar el HIGH nuevo

Identificar el `as ...` HIGH/CRITICAL introducido en Batch E (candidatos: casts en `DialogSustituirFactura` sobre `sustitutaQuery.data`, `helpers.ts` sobre `event.object`). Sustituir por:
- Type guards (`isInvoiceEvent`, `isCancellationEvent`) con narrowing.
- O `// SAFE-CAST:` con justificación si es inevitable (mem://principles/safe-cast).

### F4. Coverage — sumar tests para el código nuevo

Archivos con muy poca cobertura hoy y objetivo mínimo para volver por encima del threshold:

- `supabase/functions/facturapi-reconciliar-cancelaciones/reconcile.test.ts` (Deno) — casos: accepted → patch, pending → sólo `cancellation_status`, rejected → limpia timestamps, expired → limpia, error HTTP → log sin patch. **5 tests**.
- `src/features/facturacion/components/sustitucion/useSustitucionState.test.ts` (Vitest + RTL) — `readPersisted` sin/ con valor, `writePersisted` idempotente, `clearPersisted`, guard `sustitutaTimbrada` con estados `Borrador`/`Emitida`. **6 tests**.
- `src/features/facturacion/services/__tests__/duplicarFacturaParaSustitucion.test.ts` — happy path, error propagado, mapeo de columnas retornadas. **3 tests**.
- `src/lib/observability/__tests__/reportCaughtError.additional.test.ts` — sólo si tras los anteriores seguimos por debajo (probable que no).

Meta: recuperar +2 pts en lines/statements, +3 pts en branches, +3 pts en functions. Suficiente para pasar el gate de 38/34/30/38.

### F5. Versionado

- `APP_VERSION` → `13.301.2`.
- `CHANGELOG.md`: entrada Batch F resumiendo fixes de CI y refactor por Power-of-10.

## Detalles técnicos

- Ningún cambio de lógica de negocio: el webhook y la reconciliación deben producir exactamente los mismos patches que hoy (los tests existentes de `helpers_test.ts` deben seguir pasando sin tocar).
- Los sub-mappers exportados quedan disponibles para pruebas unitarias directas.
- El allowlist `OVERSIZED_BASELINE` en `audit-report.test.ts` NO se toca (evitamos "esconder" deuda).
- No se modifica `vitest.config.ts` ni los thresholds (memoria core).
- Los tests Deno usan el patrón `import "https://deno.land/std@0.224.0/dotenv/load.ts"` y consumen bodies como marca `edge-function-testing`.

## Verificación

1. `bun run lint -- --max-warnings 0` → 0 warnings.
2. `bunx vitest run src/__tests__/audit-report.test.ts` → 5/5 pasan.
3. `supabase--test_edge_functions` para `facturapi-webhook` y `facturapi-reconciliar-cancelaciones`.
4. `bun run test:coverage` local (o revisar output de CI) → los 4 umbrales por encima.
5. `wc -l` de los 4 archivos tocados ≤ 200.

¿Ejecuto Batch F?
