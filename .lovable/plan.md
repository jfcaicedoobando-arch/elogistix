# Plan: estabilizar suite de pruebas (snooze mock + concurrencia)

## Objetivo
Resolver los dos hallazgos del último `vitest run`:
1. `clearSnoozeRevision` falla porque el mock encadenado de Supabase no soporta el patrón `.update(...).eq(...)` (segundo caso del test).
2. Un worker fork supera el límite de heap (8 GB) y rompe el IPC. Necesitamos forzar serialización para que cada archivo libere memoria antes del siguiente.

## Cambios

### 1. `src/features/auditoria/services/__tests__/snooze.test.ts`
Reescribir el mock para que cada llamada a `supabase.from(...)` devuelva una cadena fresca y soporte ambos flujos:
- `from().upsert().select().single()` → resuelve con `{ data, error }`.
- `from().update().eq()` → resuelve con `{ error }` (thenable).

Estrategia: helper `createChain(resolved)` que devuelve un objeto cuyos métodos (`upsert`, `update`, `select`, `eq`, `single`) retornan el mismo objeto y que además es thenable (implementa `then`) resolviendo a la respuesta configurada. Reasignar `mockSupabase.from` por test con `vi.fn(() => createChain(...))`. Mantener las aserciones existentes (`upsert` llamado, `update` con payload correcto, `eq('id','1')`).

### 2. `vitest.config.ts`
Reducir paralelismo del pool de forks para evitar acumulación de heap entre archivos pesados (PDFs, leak regression, etc.):
- `poolOptions.forks.singleFork: true` (un solo fork reutilizable) **o** `maxForks: 1, minForks: 1`.
- Añadir `fileParallelism: false` a nivel `test` para serializar archivos.
- Mantener `isolate: true` y `--max-old-space-size=8192`.

Esto sacrifica algo de velocidad pero garantiza que cada archivo arranque con heap limpio (gracias a `isolate`) y que nunca haya dos archivos pesados compitiendo por memoria en el mismo proceso padre.

### 3. Versionado y changelog
- `src/constants/appVersion.ts` → bump a `12.60.9`.
- `CHANGELOG.md` → entrada `[12.60.9] - 2026-06-06`:
  - Fix: mock de Supabase en `snooze.test.ts` soporta cadena `update().eq()`.
  - Chore: `vitest.config.ts` serializa ejecución de archivos (`singleFork`, `fileParallelism: false`) para eliminar OOM intermitente en CI/local.

## Validación
Tras los cambios, ejecutar `npx vitest run` y confirmar:
- `snooze.test.ts` pasa los dos casos.
- No aparece `FATAL ERROR: ... heap limit` ni `ERR_IPC_CHANNEL_CLOSED`.
- Suite completa termina (tiempo esperado: algo mayor a ~190s previos por la serialización).
