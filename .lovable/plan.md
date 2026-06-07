
## Re-auditoría profunda del shard 9/16 (segunda pasada)

Re-leí los 19 archivos buscando lo que la primera pasada no priorizó: **leaks de QueryClient, mocks sin `mockReset`, casts residuales y patrones que sostienen memoria entre tests**. El stub de `@react-pdf/renderer` ya está aliaseado en `vitest.config.ts`, así que la hipótesis "React-PDF carga fontkit" queda descartada — el verdadero leak está en otro lado.

### Hallazgos nuevos (ordenados por impacto en el hang)

**CRITICAL — leak transversal de QueryClient**
- `src/test/utils/queryWrapper.tsx` crea un `QueryClient` por test pero **nunca lo desmonta ni lo limpia**. El `afterEach` global en `src/test/setup.ts` sólo limpia `globalThis.__TEST_QUERY_CLIENT__`, que `createWrapper` jamás asigna. Cada test que usa `createWrapper` deja vivos: suscripciones, queries pendientes, refs internas de React Query, y el `QueryClientProvider` montado.
- Afectados en shard 9: `useEmbarqueDocumentosActions.test.tsx`, `useAlertasSistema.test.tsx`, `useReportes.test.tsx` (3 archivos, 8 renders acumulados sin liberar).

**HIGH — mocks hoisted sin reset entre tests**
1. `useLoginAudit.test.ts`: `mockSession.getItem` recibe `mockReturnValue("1")` en el test 2 y persiste hasta el test 3 porque `vi.clearAllMocks()` sólo limpia historial, no implementaciones. El test 3 funciona por casualidad (no consulta getItem).
2. `useReportes.test.tsx`: `mockUseRentabilidad.mockReturnValue(...)` se sobreescribe en cada test, pero si en el futuro se agrega un test que no llama `mockReturnValue`, hereda el valor anterior.
3. `logClientError.test.ts`: `invoke.mockImplementationOnce(() => { throw ... })` puede sobrevivir si el test 3 corre antes del 2 (orden aleatorio de vitest).

**HIGH — `vi.importActual` innecesario**
- `useAuditoriaEjecutivo.test.tsx` hace `await vi.importActual(...)` dentro del factory de `vi.mock` sólo para spread `...actual` y luego sobreescribir `useAuditoriaRevisiones`. Esto carga el módulo real (que importa `supabase` cliente), inflando el grafo de imports del archivo.

**MEDIUM — casts residuales (Power of 10)**
- `conciliacion.test.ts` línea 39: `} as MovimientoBBVA;` al final del helper `makeMov` (cast tipado pero innecesario si el objeto ya satisface la interfaz).
- `ReporteEjecutivoDocument.test.tsx` línea 41: `{ nombre, saldo, moneda: "USD" } as SnapshotEjecutivo["topDeudores"][number]`.
- `useEmbarqueDocumentosActions.test.tsx` línea 23: `embarqueStub = { id, expediente } as Parameters<...>[0]` — se podría reemplazar con un helper `makeEmbarqueStub()` tipado.

**MEDIUM — toast mock recreado en cada render**
- `useEmbarqueDocumentosActions.test.tsx`: `useToast: () => ({ toast: vi.fn() })` crea un `vi.fn()` nuevo en cada llamada al hook. No causa fallos pero acumula spies que `vi.clearAllMocks()` no alcanza (no están registrados centralmente).

**OK (limpios en segunda pasada)**
- `embarqueConstants.test.ts`, `embarqueFases.test.ts`, `conceptos.test.ts`, `update.test.ts`, `styles.test.ts`, `estadoResultados.test.ts`, `vendedoras.test.ts`, `configuracion/index.test.ts`, `useAuditoriaEjecutivo.test.tsx` (salvo el importActual).

### Plan de remediación (orden recomendado)

**Fase 1 — Cortar el leak de QueryClient (máxima prioridad)**
- Modificar `src/test/utils/queryWrapper.tsx` para registrar el client en `globalThis.__TEST_QUERY_CLIENT__` (el `afterEach` global ya sabe cómo limpiarlo con `cancelQueries → clear → unmount`).
- Cero cambios en los tests consumidores.

**Fase 2 — Mocks deterministas**
- `useLoginAudit.test.ts`: agregar `mockSession.getItem.mockReset()` en `beforeEach` (o cambiar a `mockSession.getItem.mockReturnValue(null)` explícito al inicio de cada test).
- `logClientError.test.ts`: cambiar `invoke.mockClear()` por `invoke.mockReset()` + reasignar implementación default `mockResolvedValue({ data: null, error: null })` en `beforeEach`.

**Fase 3 — Simplificar `useAuditoriaEjecutivo`**
- Reemplazar el factory `async` con `vi.importActual` por un mock plano: `vi.mock("@/features/auditoria/hooks/useAuditoriaRevisiones", () => ({ useAuditoriaRevisiones: vi.fn(), revisionKey: (h) => \`${h.embarque_id}|${h.regla}|${h.detalle}\` }))`. Verificar primero la firma real de `revisionKey` para replicarla.

**Fase 4 — Limpieza de casts residuales**
- `conciliacion.test.ts`: quitar el `as MovimientoBBVA` final del helper (devolver el objeto tipado directamente).
- `ReporteEjecutivoDocument.test.tsx`: construir el item de `topDeudores` con la forma completa (sin cast).
- `useEmbarqueDocumentosActions.test.tsx`: extraer `makeEmbarqueStub()` con `satisfies` en lugar del cast `as Parameters<...>[0]`.

**Fase 5 — Toast mock estable**
- `useEmbarqueDocumentosActions.test.tsx`: mover `const toast = vi.fn()` fuera del factory para que `useToast` devuelva siempre el mismo objeto.

**Fuera de alcance (no tocar)**
- `src/test/setup.ts` (ya correcto).
- Código de producción.
- Los 13 archivos marcados OK.

### Changelog y versión
- Bump `APP_VERSION` a `12.60.38`.
- Entrada `[12.60.38]` en `CHANGELOG.md` listando: fix leak QueryClient en `createWrapper`, reset determinista de mocks hoisted, eliminación de `vi.importActual` innecesario, limpieza de casts residuales.

### Riesgos
- Cambiar `createWrapper` para escribir en globalThis es un cambio sólo en tests; si dos tests corren en paralelo en el mismo proceso (no aplica: `fileParallelism=false`), sobreescribirían el slot. El setup ya asume serialización.
- `mockReset` en `useLoginAudit` puede revelar tests que dependían implícitamente de implementaciones residuales — si ocurre, se ajusta cada test para fijar su propia implementación.

### Lo que esta auditoría NO promete
- No garantiza que el `HARD TIMEOUT` desaparezca, pero el leak de QueryClient es el sospechoso más fuerte que queda tras los fixes de 12.60.37. Si tras la Fase 1 el shard sigue colgando, el siguiente paso obligatorio es instrumentar `[file-start]/[file-end]` en `setup.ts` para identificar el archivo exacto.
