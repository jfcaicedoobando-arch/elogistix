Revisé el shard 3 archivo por archivo sin ejecutar el shard. El reparto calculado por Vitest contiene 26 tests; los riesgos reales están concentrados en contaminación de globales y timers.

## Hallazgos principales

1. `src/lib/errors/__tests__/dynamicImportError.extra.test.ts`
   - Riesgo alto: reemplaza `globalThis.window` completo con `Object.defineProperty`.
   - Eso no lo revierte `vi.unstubAllGlobals()` y puede dejar el fork con un `window` incompleto para los archivos siguientes.
   - Es el candidato más fuerte para timeout/cuelgue transversal.

2. `src/features/crm/services/leads/__tests__/bulk.test.ts`
   - Riesgo medio: usa `vi.useFakeTimers()` en `beforeAll`, pero el `afterEach` global de `src/test/setup.ts` llama `vi.useRealTimers()` después de cada test.
   - Resultado: sólo el primer test queda con timers falsos; el test que espera fecha congelada puede comportarse de forma no determinística.

3. `src/features/portal/hooks/__tests__/usePortalDocumentDownload.test.tsx`
   - Riesgo medio/bajo: asigna directamente `global.fetch`, `URL.createObjectURL`, `URL.revokeObjectURL` y mantiene un spy de `document.createElement` entre tests del archivo.
   - Conviene usar `vi.stubGlobal`/`vi.spyOn` con restauración por test para evitar fugas.

4. `src/services/admin/__tests__/stats.test.ts`
   - Riesgo bajo: el mock por tabla conserva `tableResults` entre tests y el `beforeEach` está vacío.
   - No parece causa directa del timeout, pero puede generar contaminación de datos entre casos.

## Archivos revisados sin hallazgos de cuelgue

- `src/services/proforma/__tests__/consolidar.test.ts`
- `src/features/cxp/services/__tests__/parseCfdi.test.ts` (usa stubs, pero el cleanup global los revierte)
- `src/features/proveedor/services/__tests__/operaciones.test.ts`
- `src/features/cotizacion/services/__tests__/costos.test.ts`
- `src/pdf/documents/__tests__/ProformaHeader.test.tsx`
- `src/features/embarques/services/__tests__/idempotencyClaimSchema.test.ts`
- `src/features/crm/services/__tests__/notificaciones.test.ts`
- `src/hooks/shared/__tests__/useTabsParam.test.tsx`
- `src/features/cotizacion/hooks/__tests__/usePortalCotizacionDetalle.test.tsx`
- `src/hooks/admin/__tests__/useAdminData.test.tsx`
- `src/features/embarques/domain/__tests__/embarqueKpis.test.ts`
- `src/features/embarques/hooks/__tests__/useEmbarqueQueries.test.tsx`
- `src/features/crm/domain/__tests__/forecast.test.ts`
- `src/hooks/shared/__tests__/useListPageState.test.ts`
- `src/features/crm/services/__tests__/automatizacionesEtapa.test.ts`
- `src/services/__tests__/idempotency.integration.test.ts`
- `src/features/crm/services/__tests__/lineage.test.ts`
- `src/lib/mappers/__tests__/embarqueRoundtrip.test.ts`
- `src/features/auditoria/domain/__tests__/csv.test.ts`
- `src/services/configuracion/__tests__/emisor.test.ts`
- `src/services/admin/__tests__/papelera.test.ts`
- `src/features/cxp/services/__tests__/proveedorFacturas.test.ts`

## Plan de implementación

1. Corregir `dynamicImportError.extra.test.ts`
   - No reemplazar `globalThis.window` completo.
   - Mockear sólo `location.reload` de forma reversible con utilidades de Vitest o restauración explícita.
   - Asegurar que cada test deja intacto el `window` real de JSDOM.

2. Corregir `bulk.test.ts`
   - Cambiar timers congelados de `beforeAll` a `beforeEach`, o congelarlos sólo en el caso que valida `deleted_at`.
   - Dejar que el cleanup global haga `vi.useRealTimers()` después de cada test.

3. Corregir `usePortalDocumentDownload.test.tsx`
   - Reemplazar asignaciones directas de globales por `vi.stubGlobal`/`vi.spyOn`.
   - Restaurar el spy de `document.createElement` después de cada test para evitar acumulación dentro del archivo.

4. Endurecer `stats.test.ts`
   - Agregar limpieza real del `Map` de resultados por tabla en `beforeEach` para evitar contaminación entre casos.

5. Actualizar metadatos del proyecto
   - Bump de `APP_VERSION`.
   - Entrada nueva en `CHANGELOG.md` con el arreglo del shard 3.

## Validación

- No ejecutaré el shard 3 completo.
- Validaré por inspección y, si hace falta, sólo con pruebas individuales/dirigidas, nunca con `--shard=3/16`.