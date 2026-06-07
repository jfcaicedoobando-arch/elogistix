# Plan: arreglar los hallazgos de la auditoría del shard 9/16

Foco: eliminar todos los `as any`, accesos inseguros y stubs débiles encontrados en los 19 tests. **No** se toca el setup global (`src/test/setup.ts` ya hace `vi.useRealTimers()` y `cleanup()` en `afterEach`, así que la hipótesis de timer-leak queda descartada). Las degradaciones MEDIUM se documentan pero **no** se aplican en este pase para mantener el cambio acotado.

## Archivos a editar (7)

### 1. `src/contexts/auth/__tests__/useLoginAudit.test.ts`
- Quitar `as any` en `mockSession.getItem.mockReturnValue("1" as any)` → cambiar el mock para que `getItem` esté tipado como `(k: string) => string | null` desde el `vi.hoisted`.
- Añadir `afterEach(() => vi.useRealTimers())` explícito (redundante con el global, pero hace al archivo auto-contenido).

### 2. `src/services/profit/__tests__/estadoResultados.test.ts`
- Reemplazar `(res as any).emb` por aserción tipada: usar `expect(res).toMatchObject({ emb: [] })` que no requiere cast.

### 3. `src/services/tesoreria/__tests__/conciliacion.test.ts`
- Eliminar `as any` en `sugerirCandidatos({ cargo: 0, abono: 0 } as any)`: importar el tipo del parámetro desde `../conciliacion` y construir un stub válido (o usar `Parameters<typeof sugerirCandidatos>[0]` y completar campos requeridos).

### 4. `src/services/observability/__tests__/logClientError.test.ts`
- Reemplazar `invoke.mock.calls[0][1].body` por desestructuración segura con assertion `!` después de verificar `toHaveBeenCalled()`, y tipar el body para evitar `any` implícito.

### 5. `src/features/embarques/hooks/__tests__/useEmbarqueDocumentosActions.test.tsx`
- Eliminar `as Parameters<typeof useEmbarqueDocumentosActions>[0]` usando un factory `makeEmbarqueStub()` que devuelva un objeto con tipo `Embarque` (importado del módulo de tipos del feature).

### 6. `src/services/comisiones/__tests__/vendedoras.test.ts`
- Quitar `as any` en `upsertVendedoraConfig({ ... } as any)` usando `TablesInsert<"vendedora_config">`.

### 7. `src/pdf/documents/__tests__/ReporteEjecutivoDocument.test.tsx`
- Quitar `as any` del `mockSnapshot` importando el tipo del snapshot desde el módulo del documento PDF.
- Añadir `afterEach(() => cleanup())` explícito y, si el tipo expone props opcionales, no inventar campos.

## Archivos no tocados (pero documentados como deuda futura)

- `src/lib/financial/__tests__/financialUtils.edge.test.ts` — limpieza de líneas blancas residuales (cosmético).
- `src/features/auditoria/hooks/__tests__/useAuditoriaEjecutivo.test.tsx` — migrar `new Date()` a `vi.setSystemTime()` (flakiness teórica).
- `src/hooks/admin/__tests__/useAlertasSistema.test.tsx`, `src/hooks/reportes/__tests__/useReportes.test.tsx`, `src/features/embarques/hooks/__tests__/useEmbarqueDocumentosActions.test.tsx` — el cleanup global ya cubre QueryClient/RTL, no se duplica.
- `src/features/embarques/constants/__tests__/embarqueConstants.test.ts` — cobertura insuficiente (sólo 4 casos), pendiente de ampliar.

## No cambios en código de producción

Ninguno de los fixes toca `src/`fuera de carpetas `__tests__`. Sólo se modifican tests.

## Versionado

- Bump `APP_VERSION` a `12.60.37`.
- Entrada en `CHANGELOG.md`:
  > **test(shard-9) — limpieza Power of 10 en 7 archivos de test**: eliminados todos los `as any` y accesos sin guards en `useLoginAudit`, `estadoResultados`, `conciliacion`, `logClientError`, `useEmbarqueDocumentosActions`, `vendedoras` y `ReporteEjecutivoDocument`. No toca código de producción ni resuelve el hang del shard (el global setup ya restablece timers/RTL en `afterEach`, así que el culpable está en otra parte — probablemente teardown de React-PDF o coverage flush).

## Aclaración importante

Este plan **no** garantiza resolver el `HARD TIMEOUT` del shard 9. El cleanup global ya hace `vi.useRealTimers()` y `cleanup()`, por lo que mi hipótesis previa sobre timer-leak fue incorrecta. Para diagnosticar el hang real recomiendo (en una siguiente iteración separada) instrumentar `[file-start]/[file-end]` en `src/test/setup.ts` como ya propuse en 12.60.36-prep. Esto es higiene de calidad.
