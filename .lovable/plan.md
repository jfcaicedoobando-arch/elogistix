# Auditoría — Sonner/Toasts y Sentry

Analogía rápida: nuestra app hoy es como una casa con alarma bien instalada (Sentry) y bocinas bien reguladas (toasts). La estructura está sólida; lo que falta es afinar sensores para no gastar batería en falsas alarmas y cerrar unas ventanas menores.

## 1) Estado actual (verificado)

### Toasts / Sonner
- **Backend único**: todos los toasts pasan por `sonner@2.0.7` vía dos wrappers autorizados:
  - `@/lib/ui/appFeedback` (`notifyError` / `notifySuccess` / `notifyWarning` / `notifyInfo`) — usado en **282 archivos**.
  - `@/hooks/shared/useToast` (shim legacy `{title, description, variant}` que delega en sonner).
- **Baseline SONNER-LEGACY vacía**: 0 features importan `sonner` directo. La allowlist en `eslint.config.js` sólo cubre wrappers, el `Toaster` y `ErrorDetailsDialog`.
- **Guardrails activos**:
  - Regla ESLint `no-restricted-imports` de `sonner` en `src/**`.
  - Script `scripts/audit-sonner-baseline.ts` (regresión en CI).
  - Tests arquitectónicos: `error-toasts-use-notifyError`, `no-double-toast-on-mutate`.
- **Toaster global**: `top-right`, `expand`, swipe-to-dismiss, tap targets ≥44 px, bordes semánticos por severidad. Consistente con la identidad visual.

### Sentry
- **SDK**: `@sentry/react@10.65.0` (front) + `@sentry/deno@8` (edge).
- **Init diferido** en `main.tsx` (chunk `sentry-vendor` fuera del critical path) con captura inmediata.
- **Configuración robusta**:
  - `beforeSend` con `shouldDropSentryEvent` (chunk/HMR, Zod, RLS 42501, ruido `flock.js` del hosting).
  - Fingerprint custom para `PostgrestError` por `code + ruta`.
  - `scrubEventPii` + `scrubBreadcrumb` para redactar RFC/emails/query strings.
  - `sendDefaultPii: false`, `normalizeDepth: 5`, `maxValueLength: 1500`.
  - Integraciones: BrowserTracing (react-router v6), Profiling, `extraErrorData` (`Error.cause` + props enumerables), `httpClient` (5xx en Supabase/`/api`/`/functions`), Replay con `maskAllText/Inputs + blockAllMedia`, Feedback widget.
  - Sampling: `tracesSampler` por ruta, replay session 2% + on-error 100%, profiles 10%.
- **Edge functions**: `_shared/sentry.ts` con init perezoso, `flush(2000)`, y helper `withMonitor` para cron. **41/41 edge functions** usan el wrapper.
- **Contexto enriquecido**: `reportCaughtError` inyecta tags (`organization_id`, `effective_role`, `route`, `app_version`, `error_kind`, `pg_code`) + payload sanitizado.
- **Guardrails de tests**: `sentry-edge-coverage`, `sentry-edge-wrapping`, `sentry-fiscal-services`, `sentry-imports-guardrail`.

## 2) Hallazgos y mejoras propuestas

### Sonner / Toasts

| # | Severidad | Hallazgo | Acción |
|---|---|---|---|
| T1 | Media | `useToast` shim legacy sigue activo — 20+ archivos aún lo usan. Duplica la superficie de API (legacy vs `notify*`). | Fase burn-down: codemod de `toast({variant, title, description})` → `notify*`. Al terminar, marcar el shim como deprecado (`@deprecated` + regla ESLint). |
| T2 | Baja | El primer parámetro `_toast` de las funciones `notify*` es histórico y siempre se ignora. Confunde a devs nuevos. | Deprecar la firma `(toast, opts)` → sólo `(opts)`. Migración con codemod + `@deprecated` overload. |
| T3 | Baja | No hay dedupe automático de errores idénticos consecutivos (mismo `errorCode`+`method` en <2 s). En cascadas RLS aparecen 3–5 toasts iguales. | Implementar dedupe por `id` sintético (`hash(errorCode+method)`) dentro de `notifyError`, dejando pasar sólo el primero por ventana de 2 s. |
| T4 | Baja | Toasts de éxito con `duration: Infinity` no existen hoy; usuarios en pantallas grandes pierden avisos rápidos (4 s). | Añadir `notifySuccess({ persistent: true })` como opción explícita cuando la acción abre otro flujo (ej. "Ver factura timbrada"). |
| T5 | Info | Falta un `notifyPromise(promise, {loading, success, error})` para operaciones async — hoy se emiten 2 toasts secuenciales manuales. | Envolver `sonnerToast.promise()` con nuestro tracking a Sentry cuando la promesa rechaza. |

### Sentry

| # | Severidad | Hallazgo | Acción |
|---|---|---|---|
| S1 | Media | 5 servicios llaman `Sentry.captureException` directo en lugar de `reportCaughtError` (`conciliacion.ts`, `catalogos/services/index.ts`, `parsePdfInvoice.ts`, `parseCfdi.ts`, `ErrorBoundary.tsx`). Pierden tags automáticos (`organization_id`, `effective_role`, `route`). | Migrar los 5 a `reportCaughtError`. `ErrorBoundary` es caso especial (necesita `eventId` para el feedback dialog) — mantener `captureException` pero setear tags antes vía `withScope`. |
| S2 | Media | `beforeSend` tiene 5 predicados de drop pero no hay métrica de **cuántos** eventos se descartan por cada uno. Riesgo: silenciar bugs reales. | Agregar `Sentry.metrics.increment('event.dropped', 1, {tags: {reason}})` antes de retornar `null`. Panel Sentry para monitorear ratios. |
| S3 | Baja | `console.error/warn` aparece en **12 archivos** de features. En prod se pierde (Sentry no captura console por defecto). | Sustituir con `logger.warn/error` (`src/lib/observability/logger.ts`), que ya rutea a Sentry como breadcrumb + captura en `error`. |
| S4 | Baja | Session Replay al 2% + on-error 100%. Buen balance, pero **no hay canary** para replays fallidos (Replay a veces se cae silenciosamente en Safari iOS). | Agregar `onError` handler de la integración Replay que loggee a un breadcrumb `replay_failed`. |
| S5 | Baja | Cron monitoring (`withMonitor`) existe en `_shared/sentry.ts`, pero necesita auditoría rápida: verificar que **todos** los edge functions programados (`pg_cron`) lo usen. | Grep `pg_cron.schedule` → cruzar con `withMonitor`. Reportar deltas y envolver los faltantes. |
| S6 | Info | Falta `Sentry.startSpan` en RPCs pesados (auditoría, aging, PnL) — hoy sólo tenemos traces automáticos de router. Cuellos de botella lentos no aparecen en Performance. | Envolver los 6–8 RPCs "lentos conocidos" con `Sentry.startSpan({op: 'db.rpc', name})`. |
| S7 | Info | El `DSN` público en `.env` no está documentado en `docs/observabilidad/` (existe `runbook.md` pero no menciona cómo rotar DSN). | Añadir sección "Rotar DSN" al runbook + checklist post-rotación (verificar que edge functions lo tomen del `SENTRY_DSN_EDGE`). |

## 3) Ejecución sugerida (3 tandas)

**Tanda 1 — Consolidación (bajo riesgo, alto valor)**
- S1: migrar 5 `captureException` → `reportCaughtError`.
- S3: sustituir `console.error/warn` por `logger.*` en features.
- Test arquitectónico nuevo: prohibir `Sentry.captureException` fuera de `observability/` y `ErrorBoundary`.

**Tanda 2 — Observabilidad de la observabilidad**
- S2: métricas de drop en `beforeSend`.
- S5: auditoría cron + envolver faltantes con `withMonitor`.
- S6: `startSpan` en RPCs lentos.
- T3: dedupe de toasts de error consecutivos.

**Tanda 3 — DX y limpieza**
- T1: burn-down del shim `useToast` legacy.
- T2: deprecar primer parámetro `_toast` de `notify*`.
- T4/T5: `persistent` en success + `notifyPromise`.
- S4: canary Replay.
- S7: doc runbook.

## 4) Fuera de alcance
- Cambiar de proveedor (Sentry queda).
- Cambiar de librería de toasts (Sonner queda).
- Rediseñar el toaster visualmente (ya cumple identidad Apple-like).

## Detalles técnicos
- Codemod para T1/T2: `scripts/codemod-sonner-to-appfeedback.ts` ya existe y se puede reutilizar/extender.
- Métricas S2: `Sentry.metrics` está en el SDK 10 (`@sentry/react/metrics`).
- `withMonitor` S5: firma en `supabase/functions/_shared/sentry.ts:250`.
- Tests: agregar `sentry-no-direct-capture.test.ts` (guardrail) y `toast-dedupe.test.ts`.
- Todos los cambios respetan el límite de 200 líneas por archivo (Power of 10).
- Cada tanda: bump `APP_VERSION` + entrada en `CHANGELOG.md`.
