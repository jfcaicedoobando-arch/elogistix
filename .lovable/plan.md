# Plan: corregir fallos pre-existentes detectados en shards 1 y 2

Antes de seguir con la bisección (shards 3–10), resolvemos los 8 fallos no relacionados al leak. La mayoría son mocks de Supabase incompletos (mismo patrón ya resuelto en `snooze.test.ts` y `notificaciones/index.test.ts`).

## Hallazgos a corregir

### Shard 1
| # | Archivo | Causa | Fix |
|---|---|---|---|
| 1 | `src/features/auditoria/services/__tests__/revisiones.test.ts` (3 tests) | Mock no soporta `.upsert().select().single()`, `.update().eq()` ni `.delete().eq()` | Reescribir mock con `createChain` thenable (patrón snooze) |
| 2 | `src/services/planes/__tests__/index.test.ts` | Mock no soporta cadena de `fetchPlanes` | Adaptar mock al mismo patrón |
| 3 | `src/hooks/profit/__tests__/useProfit.test.tsx` (`useEstadoResultados uses filters`) | Mock del servicio retorna undefined | Inspeccionar y ajustar mock o aserción |
| 4 | `src/features/embarques/hooks/__tests__/useEmbarqueForm.test.tsx` (`gestiona archivos de documentos`) | `facturaEntry?.adjuntado` es undefined | Inspeccionar lógica del hook + mock de archivos |
| 5 | `src/lib/__tests__/architecture-baseline.test.ts` (2 baselines: imports directos + archivos >200 líneas) | Deuda arquitectónica acumulada | Inspeccionar diff vs baseline y decidir: actualizar allowlist o postergar como entrada de [Audit Pendings](mem://audit/pendings) |

### Shard 2
| # | Archivo | Causa | Fix |
|---|---|---|---|
| 6 | `src/services/tesoreria/__tests__/flujoProyectado.test.ts` | Mock `fetchResumenCuentas` retorna `undefined` → `.cuentas` falla | Stub debe retornar `{ cuentas: [], ... }` mínimo |
| 7 | `src/services/configuracion/__tests__/emisor.test.ts` (`fetchEmisorInfo`) | Mock chain incompleto | Adaptar al patrón thenable |
| 8 | `src/hooks/cliente/__tests__/useNuevoClienteController.test.tsx` (`CSF upload and extraction`) | Mock de invocación edge-function `parse-csf` incompleto | Inspeccionar y stub completo |

## Estrategia general

Para los mocks de Supabase usamos el mismo patrón ya probado:
```ts
const { mockSupabase, setNextResponse } = vi.hoisted(() => {
  let nextResponse = { data: null, error: null };
  const chain: Record<string, unknown> = {};
  const passthrough = vi.fn(() => chain);
  chain.from = chain.select = chain.update = chain.delete = chain.upsert =
    chain.insert = chain.order = passthrough;
  chain.eq = vi.fn(() => chain);
  chain.single = chain.maybeSingle = () => Promise.resolve(nextResponse);
  chain.then = (cb: any) => Promise.resolve(nextResponse).then(cb);
  return { mockSupabase: chain, setNextResponse: (r) => { nextResponse = r; } };
});
```

Cada test setea `setNextResponse(...)` antes de invocar.

## Pasos

1. **Inspeccionar** cada archivo de test + su servicio/hook bajo prueba (8 archivos × 2 = ~16 lecturas en paralelo).
2. **Editar** los tests/mocks (sin tocar código productivo salvo que el bug sea real).
3. Para el baseline de arquitectura: ejecutar el script de auditoría una vez, revisar el diff vs lo aceptado, y o bien actualizar el snapshot o documentar en [Audit Pendings](mem://audit/pendings) y skip-ear con TODO.
4. **Re-ejecutar shards 1 y 2** para confirmar 0 fallos.
5. **Versionado**: bump `APP_VERSION` → `12.60.11`, entrada en `CHANGELOG.md` listando los 8 fixes.
6. **Continuar** con shards 3–10 de la bisección.

## Notas

- Ningún cambio toca código productivo salvo si la inspección revela un bug real (poco probable; son mocks).
- No tocamos `vitest.config.ts`.
- El baseline de arquitectura puede requerir una decisión del usuario si la deuda es nueva — en ese caso, paramos y reportamos.
