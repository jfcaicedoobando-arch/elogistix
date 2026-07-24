
# Investigación de rollbacks masivos — 82.6M (89%) en 39 días

## Hallazgos iniciales (ya verificados)

Analogía: la base de datos comete 1 de cada 10 pedidos y rechaza 9. Aunque cada rechazo es barato (~microsegundos), sumados a **~24 rollbacks/seg sostenidos por 39 días** queman CPU.

Datos confirmados con `psql` y Sentry:

| Métrica | Valor | Fuente |
|---|---|---|
| Commits desde boot | 9,901,297 | `pg_stat_database` |
| **Rollbacks desde boot** | **82,614,717 (89.3%)** | `pg_stat_database` |
| Uptime | 38 días 23 h | `pg_postmaster_start_time` |
| Ratio rollback/seg | ~24.6/s sostenido | derivado |
| Errores en Sentry (7d) | ~50 eventos totales | `search_events` |
| Errores en `app_logs` (24h) | 22 client-side, 0 server | tabla `app_logs` |

**Conclusión preliminar**: los rollbacks NO se corresponden con excepciones que llegan a Sentry ni con `app_logs`. Esto indica que son **rollbacks "silenciosos"** — transacciones abortadas que la app trata como flujo normal. Sospechosos:

1. **PostgREST envuelve cada request en `BEGIN…COMMIT`**. Cualquier `SELECT ... .single()` que devuelve 0 filas (PGRST116), 401/403 por RLS en INSERT/UPDATE, o `RAISE EXCEPTION` en trigger produce ROLLBACK. El cliente lo maneja como "no encontrado" sin log.
2. **Triggers con `RAISE EXCEPTION` de negocio**: `guard_pago_proveedor` (LC_PAGO_EXCEDE_SALDO), `tg_bloquear_si_embarque_cerrado`, `LC_ROL_LEGACY_BLOQUEADO`, etc. Si algún flujo los dispara "de prueba" antes de la operación real, cada intento fallido = 1 rollback.
3. **Realtime / PgBouncer health checks** que abren transacciones cortas.
4. **Idempotency checks**: `idempotency_commit` que falló 4 veces en Sentry ("function does not exist") — cada intento = rollback.

## Plan de investigación (3 fases)

### Fase 1 — Instrumentar para atribuir los rollbacks (sin cambios de negocio)

1. **Extensión `pg_stat_statements`**: no está activa. Solicitar activación (o confirmar si Lovable Cloud la expone). Sin ella no podemos saber *qué query* está rollbackeando.
2. **Snapshot temporal**: registrar `pg_stat_database.xact_rollback` en dos momentos separados por 10 min para medir la **tasa real actual** (vs. cumulativa). Si la tasa bajó tras las policies de v13.312.24, puede que ya no sea prioritario.
3. **Query a `pg_stat_activity`** durante 1 minuto en loop (cada 2 s) filtrando `state = 'idle in transaction (aborted)'` para capturar in-flight qué query dejó la transacción abortada.
4. **Sampling de errores PostgREST**: revisar logs del edge proxy Supabase (si accesibles vía `edge_function_logs` de `postgrest`) buscando patrones 4xx/5xx.

### Fase 2 — Correlacionar con Sentry + edge logs

1. Listar top 20 errores de Sentry por frecuencia (últimos 30d) — ya obtenidos:
   - `agente_nombre column not found` (10) — schema cache stale
   - `generar_expediente does not exist` (5) — RPC ausente
   - `idempotency_commit does not exist` (4) — RPC ausente
   - `column pp.factura_id does not exist` (1)
   - `AprobacionFacturaError: conceptos no cuadran` (5+2+1=8) — validación esperada
   - Cada uno de estos causó rollback en PG. Si `generar_expediente` se llama en cada creación de embarque → decenas de miles de rollbacks/día por sí sola.
2. Cruzar con `ai_gateway_logs` y `edge_function_logs` de las funciones más ruidosas (`process-email-queue`, `facturapi-*`, `parse-invoice-pdf`) para ver ratio de fallos.
3. Auditar triggers con `RAISE EXCEPTION` que actúan como validación de UI:
   - Si UI pre-valida y aun así llega al trigger, es doble trabajo.
   - Candidatos: `guard_pago_proveedor`, `tg_bloquear_si_embarque_cerrado`, guardas de proformas/NC.

### Fase 3 — Remediación priorizada

Según lo que emerja de Fases 1-2, aplicar (en release aparte v13.312.25):

- **Crear RPCs faltantes** o eliminar las llamadas huérfanas (`generar_expediente`, `idempotency_commit`, columna `agente_nombre`).
- **Refrescar `pg_notify('pgrst', 'reload schema')`** para el error de schema cache.
- **Convertir `SELECT ... .single()`** en `.maybeSingle()` donde el "0 filas" es legítimo (no debe rollback silencioso).
- **Mover validaciones de trigger a `CHECK` constraints** cuando sean estrictamente estructurales (evita el `RAISE EXCEPTION` con costo de plpgsql).
- **Retry con backoff** en cliente para los flujos que hoy reintentan agresivamente.

## Detalles técnicos

- `pg_stat_database` es cumulativo; para tasa actual hay que hacer 2 snapshots.
- PostgREST usa `SET LOCAL role = authenticated`. Cualquier `permission denied` dentro del BEGIN aborta la transacción y produce rollback contable, aunque el usuario final vea un simple 403.
- `pg_stat_statements` requiere `shared_preload_libraries` — en Lovable Cloud puede requerir soporte.
- No proponemos `resize_compute`: la saturación es de patrón, no de recursos.

## Entregable esperado

Al final de Fase 1-2, un **reporte de 3-5 causas raíz con % de rollbacks atribuido a cada una** en `.lovable/plan.md`. Fase 3 se implementa en release posterior con el fix concreto por causa.

## Riesgo

Bajo. Fases 1 y 2 son **solo lectura**. Los cambios de Fase 3 se planifican después con su propio review.

## Requisitos previos (necesito confirmación tuya antes de ejecutar)

1. ¿Confirmas que puedo intentar activar `pg_stat_statements` vía migración (`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`) para poder atribuir queries?
2. ¿Autorizas correr un loop de sampling de 1-2 minutos contra `pg_stat_activity` (solo lectura, ninguna escritura)?
3. ¿Prefieres que arranque por Fase 1 (instrumentación) o directamente Fase 2 (correlación Sentry + logs) que puedo hacer sin cambios de infra?
