
# Ola B — Mezcla recomendada: "Ver, aguantar y blindar lo mínimo"

Después de la Ola A (datos blindados) el siguiente cuello es **no saber qué pasa en producción** y tener **dos o tres listados que ya pesan**. La seguridad está mayormente cubierta por la A, así que sólo tomamos el sub-entregable de seguridad que tapa el hueco más grande (tests de RLS automatizados). Total: 6 sub-versiones, ~2 semanas de trabajo.

## Mezcla seleccionada

| # | Origen | Sub-entregable | Versión |
|---|--------|---------------|---------|
| B.1 | Opción 1 · Observabilidad | Logging estructurado en edge functions + tabla `app_logs` | **8.171.0** |
| B.2 | Opción 1 · Observabilidad | Página `/admin/diagnostico` con últimos errores | **8.172.0** |
| B.3 | Opción 1 · Observabilidad | Alertas críticas (factura inmutable, RPC fallida, snapshot diario caído) | **8.173.0** |
| B.4 | Opción 2 · Performance | Reducción de N+1 en `useEmbarquesListData`, `useFacturas`, `useReportes` vía RPCs `*_listado` | **8.174.0** |
| B.5 | Opción 2 · Performance | Virtualización de tablas largas (embarques, facturas, bitácora) | **8.175.0** |
| B.6 | Opción 3 · Seguridad | Suite automática de tests de RLS por tabla × rol × org | **8.176.0** |

## Por qué este orden

1. **B.1 primero** porque los logs estructurados se vuelven la base de medición para todo lo demás. Sin esto, B.3 (alertas) no tiene fuente, y B.4 (perf) optimiza a ciegas.
2. **B.2 inmediatamente después** porque entrega valor visible (página de diagnóstico) sin esperar a que tengamos alertas.
3. **B.3** cierra el ciclo de observabilidad: detecta + alerta. Útil tanto para producción como para validar las optimizaciones de B.4/B.5.
4. **B.4 antes que B.5** porque arreglar el N+1 reduce el dataset antes de virtualizar; si virtualizamos primero, virtualizamos consultas ineficientes.
5. **B.6 al final** porque los tests de RLS son una red de seguridad permanente; conviene escribirlos cuando ya tengamos logs/alertas para detectar regresiones reales.

## Lo que NO entra y por qué

- **Materialized views del dashboard (Op.2 B.1):** la mejora real está en N+1; las MV agregan complejidad operativa que no compensa con el volumen actual.
- **Prefetch agresivo de catálogos (Op.2 B.3):** `useTasaIVA` y `usePuertos` ya tienen `staleTime` razonable; revisamos métricas en B.1 antes de tocar.
- **Lazy-load de rutas + bundle visualizer (Op.2 B.5):** las rutas ya están en `React.lazy`; el bundle se revisa en una Ola C de UX/perf si las métricas lo justifican.
- **Rate limiting, rotación de secretos, 2FA (Op.3 B.2/B.3/B.5):** críticos cuando abramos a clientes externos. Hoy somos demo interno; mejor en Ola D pre-launch.
- **Tracing con correlation_id (Op.1 B.5):** suma complejidad; el `request_id` que ya existe en idempotencia cubre el caso 80/20.

## Detalle técnico por sub-versión

### B.1 — Logging estructurado (8.171.0)

- Migración: tabla `public.app_logs(id, ts, level, fn, request_id, user_id, organization_id, msg, payload jsonb, latency_ms)` con índice `(organization_id, ts desc)` y retención 30 días vía cron.
- `supabase/functions/_shared/logger.ts` con `logInfo/logWarn/logError(req, payload)` que escribe en `app_logs` y a `console.log` (Supabase logs).
- Cada edge function existente se envuelve: timestamp inicio/fin, status code, latencia.
- Tests: unit del logger más smoke test en `parse-csf`.

### B.2 — Página /admin/diagnostico (8.172.0)

- Hook `useAppLogs` con paginación server-side y filtros (org, level, fn, rango fechas, búsqueda en `msg`).
- `src/pages/admin/Diagnostico.tsx` con DataTable estándar, tabs por severidad, deduplicación por (fn, msg) en columna "ocurrencias".
- Sólo `super_admin` y `admin` de la organización ven sus propios logs (RLS sobre `app_logs`).
- Item en sidebar admin "Diagnóstico" bajo Administración.

### B.3 — Alertas (8.173.0)

- Tabla `alert_rules` (event_type, threshold, window_minutes, channel, enabled).
- Edge function `alerts-evaluate` corre cada 5 min vía cron: cuenta eventos en `app_logs` y `bitacora_actividad`, si supera threshold envía email vía Resend (o Slack webhook si está configurado).
- Reglas seed: factura_inmutable >0/h, RPC crítica fallida >3/min, `auditoria_snapshot_daily` sin correr en 26h.
- UI mínima en `/admin/diagnostico` para ver/silenciar reglas.
- Requiere secreto `RESEND_API_KEY` (preguntar al usuario al iniciar B.3).

### B.4 — Reducción de N+1 (8.174.0)

- RPCs nuevas: `embarques_listado(p_org, p_filtros, p_offset, p_limit)`, `facturas_listado(...)`, `reportes_resumen(...)`. Cada una devuelve la fila + columnas calculadas (cliente_nombre, ruta, total_pagado, etc.) en una sola query.
- Hooks `useEmbarquesListData`, `useFacturas`, `useReportesPageController` migran a las RPCs.
- Benchmarks antes/después capturados en `app_logs.latency_ms` (gracias a B.1).
- Mantener compatibilidad de tipos en `src/integrations/supabase/types.ts` post-migración.

### B.5 — Virtualización (8.175.0)

- `bun add @tanstack/react-virtual`.
- Componente `VirtualDataTable` (variante de DataTable existente) para listas >200 filas.
- Aplicar en embarques, facturas, bitácora, idempotencia.
- Mantener densidad y striping (mem `ui-table-standardization`).

### B.6 — Tests de RLS (8.176.0)

- `src/services/__tests__/rls.integration.test.ts` con cliente Supabase de prueba que firma como 3 roles ficticios × 2 orgs.
- Cobertura: cada tabla con RLS debe rechazar lectura/escritura cross-org y permitir same-org según rol.
- Documentar matriz en `docs/security-checklist.md` (ya existe el archivo).
- Suite integrada en `bun run ci:local`.

## Verificación obligatoria por sub-versión

Igual que en Ola A: `bunx tsc --noEmit`, `bun run lint`, `bun run test`, `bun run build`, `bun run lint:unused`. Sólo cierro la sub-versión si los cinco pasan. Cada cierre actualiza `Changelog.tsx`, `chunk0.ts`, `changelogData.ts` y `APP_VERSION`.

## Memorias a actualizar

- Nueva `mem://features/observabilidad` tras B.3 (logger, app_logs, alertas).
- Actualizar `mem://technical/optimizacion-consultas` tras B.4 (patrón `*_listado` RPC).
- Actualizar `mem://audit/pendings` al cerrar B.6.

## Arranque

Empiezo con **B.1 (8.171.0)**: migración de `app_logs` + logger compartido. ¿Procedo o quieres ajustar la mezcla antes?
