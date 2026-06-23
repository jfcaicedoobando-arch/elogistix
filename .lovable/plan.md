# Plan — Auditoría Sentry → `13.114.20`

Dos sub-agentes auditaron el SDK frontend y las 21 edge functions sobre `13.114.19`. Lo bueno: init inmediato sin ventana ciega, scrub PII robusto (incluye Luhn para tarjetas), React Query con tags filtrables, ErrorBoundaries en dos niveles, 0 funciones edge sin instrumentar, 0 mismatches en tests guardrail. Lo malo: el toast unificado `notifyError` (340 call sites en 198 archivos) **no** reporta a Sentry — toda la app tira errores en silencio salvo que el usuario abra "Ver detalles" y los pegue. Eso es la fuga grande. Además quedaron tres edge functions con el filtro viejo `>= 500` (no se actualizaron en `13.114.19`) y dos crons con errores silenciados.

## Hallazgos a corregir

| # | Sev | Archivo | Problema | Fix |
|---|---|---|---|---|
| 1 | 🔴 ALTA | `src/components/shared/utils/appFeedback.ts:42` | `notifyError` arma el debug pero **nunca llama a Sentry**. 340 call sites afectados. | Añadir `reportCaughtError(error, { feature: phase ?? 'ui_notify', op: method ?? 'unknown' }, { ...context, step, errorCode })` cuando `error` esté presente (skip si no, para no inflar con errores de validación de form). |
| 2 | 🔴 ALTA | `supabase/functions/parse-cfdi-xml/index.ts:187` | Catch raíz filtra `status >= 500`; los 4xx (validación, authz) no llegan a Sentry. Inconsistente con el patrón de `13.114.19`. | Cambiar a `>= 400`. |
| 3 | 🔴 ALTA | `supabase/functions/parse-csf/index.ts:168` | Mismo patrón viejo `>= 500`. | Cambiar a `>= 400`. |
| 4 | 🔴 ALTA | `supabase/functions/process-email-queue/queueProcessor.ts:63` | Si `read_email_batch` falla, `console.error` + `return {totalProcessed:0}` → la cola se detiene en silencio (cron no levanta alarma). | Llamar `captureEdgeException(readError, { fn: 'process-email-queue', extra: { phase:'read_batch', queue }})` antes del return. |
| 5 | 🟠 MEDIA | `supabase/functions/tracking-public/index.ts:63` | Error de RPC `get_tracking_public` devuelve 500 manual sin pasar por el catch global → no llega a Sentry. | `await captureEdgeException(error, { fn:'tracking-public', status_code:500, extra:{phase:'rpc'}})` antes del `errorResponse`. |
| 6 | 🟠 MEDIA | `supabase/functions/preview-transactional-email/index.ts` (loop de plantillas) | Errores por-plantilla sólo se `console.error`; no se sabe qué template está roto. | `captureEdgeException` por iteración con `extra:{template_key}`. |
| 7 | 🟡 BAJA | `supabase/functions/enviar-cotizacion-email/handlers.ts` (loop destinatarios) | Errores de envío por destinatario acumulados sin reporte. | `captureEdgeException` por fallo individual con `extra:{recipient_index}`. |
| 8 | 🟡 BAJA | `src/features/tesoreria/services/conciliacion.ts:101` | Usa `Sentry.metrics?.count?.()` — API removida del SDK v8. Hoy es no-op silencioso. | Reemplazar por `Sentry.captureMessage('conciliacion.failed', { level:'warning', tags:{tipo, reason}})` o eliminar si no se consume en dashboards. |

## Descartado (con justificación)

- **`useAuthSession.ts:64`** (el auditor lo marcó como gap): falsa alarma — las líneas 66-68 ya hacen `import('@sentry/react').captureException`. Cobertura correcta.
- **Ampliar `httpClientIntegration` a `[[400,599]]`**: los 401/403 de Supabase son ruido por diseño (sesión expirada, RLS bloqueando lectura intencional). Inflaría cuota sin señal accionable. Mantener `[500,599]`.
- **Capturar chunk errors antes del reload (`main.tsx:46`)**: ya están en `ignoreErrors` por decisión consciente (`13.63.0`); auto-recuperan con reload y no aportan señal.
- **Migrar `parse-csf`/`auditoria-explicar-hallazgo` de `serve()` legacy**: cambio estructural ya descartado en rondas previas.

## Versionado

- `src/constants/appVersion.ts` → `13.114.20`
- `CHANGELOG.md` → entrada `## [13.114.20] - 2026-06-23`

## Validación

- `vitest run` sobre `src/lib/observability/**` (no debería cambiar nada)
- Smoke manual: disparar un `notifyError` con `error: new Error('test')` y verificar que el sub-import a `@sentry/react` corre (en dev no envía, sólo log).
- `deno test` en `process-email-queue` si tiene tests.

## Archivos a tocar (9)

1. `src/components/shared/utils/appFeedback.ts`
2. `supabase/functions/parse-cfdi-xml/index.ts`
3. `supabase/functions/parse-csf/index.ts`
4. `supabase/functions/process-email-queue/queueProcessor.ts`
5. `supabase/functions/tracking-public/index.ts`
6. `supabase/functions/preview-transactional-email/index.ts`
7. `supabase/functions/enviar-cotizacion-email/handlers.ts`
8. `src/features/tesoreria/services/conciliacion.ts`
9. `src/constants/appVersion.ts` + `CHANGELOG.md`

¿Apruebas para implementar?
