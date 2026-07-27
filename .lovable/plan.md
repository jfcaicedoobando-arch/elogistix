# Auditoría Sentry — Estado actual y plan de mejora

## Diagnóstico (verificado)

**Salud excelente:** 0 issues sin resolver, sólo 70 eventos en 7 días (env `production`). La implementación está madura y bien pensada.

### Lo que ya está bien hecho
- **Front (`src/lib/observability/sentry/`):** DSN por env, carga dinámica (`sentry-vendor` fuera del critical path), túnel `/functions/v1/sentry-tunnel` con whitelist de host + rate-limit por IP, PII scrub en events/breadcrumbs/headers, `denyUrls` + `ignoreErrors`, `dropPredicate` para RLS `42501` / ZodError / chunks / extensiones.
- **Sampling inteligente:** `sampleByRoute` prioriza flujos críticos (embarques/cotizaciones/facturas al 100%, listados al 5%).
- **Integraciones:** React Router v6 tracing, Profiling, `extraErrorData` (captura `Error.cause`), `httpClient` 5xx, Replay con `maskAllText/Inputs/Media`, Feedback widget en español.
- **Release management:** `libre-carga@${APP_VERSION}` + `dist=buildHash`, sourcemaps hidden + subida vía `sentry-vite-plugin` + `filesToDeleteAfterUpload`.
- **Edge functions:** wrapper `_shared/sentry.ts` con `@sentry/deno@8` y `SENTRY_DSN_EDGE`; guardrails arquitectónicos (`sentry-edge-coverage.test.ts`).

### Gaps detectados
1. **Sin alert rules ni monitors** documentados en el proyecto (Sentry Alerts / Crons).
2. **Cron jobs sin monitoreo Sentry:** `rep-retry-nocturno`, `cxc-recordatorio-enviar`, `auditoria-weekly-digest`, `exchange-rates` corren en schedule pero no reportan a Sentry Crons (si fallan silenciosos, nadie se entera).
3. **Trace propagation front→edge no verificada:** `tracePropagationTargets` está OK, pero los edge functions no continúan el trace (falta `Sentry.continueTrace` en el wrapper).
4. **Fingerprinting genérico para `PostgrestError`:** dos rutas distintas con el mismo `code` SQL generan issues separados en vez de agruparse por código de error.
5. **`Sentry.ErrorBoundary` no se usa:** el `ErrorBoundary` casero reporta manualmente; perderíamos el hook `showReportDialog` estándar.
6. **Replay sample session en 0%:** cuando llega el primer bug, sólo tenemos el clip on-error (muy corto). Un 1-3% session ayudaría a reproducir flujos completos.
7. **Ownership rules / CODEOWNERS de Sentry:** no hay reglas para auto-asignar issues por área (facturación / embarques / auditoría).
8. **Rate-limit del túnel en memoria por isolate:** un pico multi-isolate lo elude. Aceptable hoy (70 events/7d), pero conviene documentarlo.
9. **`user` scope no tagea `auth_status`:** anon vs. authenticated no se distingue en filtros.

## Plan (4 batches priorizados)

### Batch 1 — Alta señal, bajo esfuerzo
- **1.a Sentry Crons para jobs schedule.** Envolver los 4 edge functions cron con `Sentry.withMonitor("<slug>", …)` en `_shared/sentry.ts` (extender wrapper con helper `withCronMonitor`). Alertas de "no check-in en X min" gratis.
- **1.b Fingerprint por `PostgrestError.code`.** En `beforeSend`, si `originalException` es PostgrestError, setear `event.fingerprint = ["postgres", code, route]`. Reduce ruido y agrupa correcto.
- **1.c Tag `auth_status`.** `user.setTag("auth_status", userId ? "authenticated" : "anonymous")` en `syncSentryUser`.

### Batch 2 — Trace continuity front→edge
- **2.a** Extender `_shared/sentry.ts` con `wrapEdgeHandlerWithTrace` que llame `Sentry.continueTrace({sentryTrace, baggage}, () => Sentry.startSpan(...))` usando los headers ya propagados por el front.
- **2.b** Migrar 3 edge functions críticas (`enviar-factura-email`, `facturapi-emitir-*`, `parse-invoice-pdf`) al nuevo wrapper.
- **2.c** Test arquitectónico que valide que las funciones facturación crean spans nombrados.

### Batch 3 — Replay + ErrorBoundary
- **3.a** Subir `replaysSessionSampleRate` a 0.02 (2%) sólo en `production` — mantener 0 en preview.
- **3.b** Migrar `ErrorBoundary.tsx` a `Sentry.ErrorBoundary` con `showDialog` + `fallback` custom (conserva UI actual, gana `eventId` + integración feedback nativa).
- **3.c** Ajustar tests de `ErrorBoundary` a la nueva API.

### Batch 4 — Gobernanza y alertas
- **4.a** Documentar en `docs/observability/sentry-runbook.md`: quién recibe alertas, cómo escalar, cómo silenciar, políticas de retención.
- **4.b** Crear archivo `sentry.owners.yml` (o instructivo si no se puede vía código) mapeando paths → equipos/personas.
- **4.c** Definir 3 alert rules mínimas: `error_rate spike >5x baseline`, `new issue en release`, `cron missed check-in`.

## Detalles técnicos

- Sentry Crons: `Sentry.withMonitor(slug, handler, { schedule: { type: "crontab", value: "0 3 * * *" }, checkinMargin: 5, maxRuntime: 30 })`. Requiere confirmar el schedule real de cada job en `supabase/config.toml`.
- Trace continuity: el SDK ya adjunta `sentry-trace` y `baggage` a fetch por `tracePropagationTargets`. Sólo falta consumirlos en Deno.
- Ownership rules: pueden vivir sólo en el UI de Sentry; en repo dejaríamos el runbook.
- No modificamos `beforeSend` masivamente para no romper drop rules ya probadas (sólo añadimos fingerprint).

## Fuera de alcance
- Cambiar DSN, proyecto Sentry o retention.
- Reemplazar el túnel por un servicio externo (rate-limit actual es suficiente).
- Deshabilitar `maskAllText` (política de privacidad vigente).

## Entregable
Cada batch termina con: código + tests + entrada en `CHANGELOG.md` + bump de `APP_VERSION`. Puedo ejecutar batch por batch o los 4 seguidos; recomiendo empezar por **Batch 1** porque son 3 wins independientes y de bajo riesgo.

¿Ejecuto los 4 batches en orden, o prefieres validar Batch 1 antes de continuar?
