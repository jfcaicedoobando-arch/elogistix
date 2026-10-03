# Runbook Sentry — Libre Carga

Documento de gobierno para la implementación de Sentry (front + edge functions).
Fuente de la verdad para on-call y para futuras auditorías.

> Revisión documental: 2026-10-02. React/Core, Deno y bundler plugins: 11.4.0.
> Describe código/configurable; no certifica
> alertas, destinatarios, retención o crons activos en el dashboard remoto.

## 1. Piezas y dónde viven

| Capa | Archivo | Función |
| --- | --- | --- |
| Init front | `src/lib/observability/sentry/core.ts` | Boot dinámico inmediato; `runtime.ts` comparte readiness |
| Spans SDK 11 | `src/lib/observability/sentry/spanPrivacy.ts` | `beforeSendSpan`, formato streamed |
| Captura única | `src/lib/observability/captureExceptionOnce.ts` | Query/UI/React comparten la identidad del fallo |
| Helpers puros | `src/lib/observability/sentry/helpers.ts` | `sampleByRoute`, `scrubEventPii`, `computePostgrestFingerprint` |
| Drop/env | `src/lib/observability/sentry/dropPredicate.ts` | Filtros de eventos ruidosos |
| User scope | `src/lib/observability/sentry/user.ts` | `syncSentryUser`, `syncSentryActiveOrg` |
| Context ambiental | `src/lib/observability/errorContextStore.ts` | tenant/route hydratados en cada evento |
| Error Boundary | `src/components/shared/ErrorBoundary.tsx` | Captura React + widget de feedback |
| React Query hook | `src/lib/query/queryClient.ts` | `QueryCache.onError` + `MutationCache.onError` |
| Edge wrapper | `supabase/functions/_shared/sentry.ts` | `wrapEdgeHandler`, `withCronMonitor`, `captureEdgeException` |

## 2. Variables de entorno

**Front (Vite):**
- `VITE_SENTRY_DSN` — DSN público. Sin él, Sentry NO arranca.
- `VITE_SENTRY_PROFILES_SAMPLE_RATE` (default `0.1`)
- `VITE_SENTRY_REPLAYS_SESSION_RATE` (default `0.02` desde v13.320.1)
- `VITE_SENTRY_REPLAYS_ON_ERROR_RATE` (default `1.0`)
- `VITE_BUILD_HASH` — se envía como `dist`.

**Edge (Deno):**
- `SENTRY_DSN_EDGE` — DSN del proyecto. Sin él, todo el wrapper es no-op.
- `DENO_ENV` / `SUPABASE_ENV` — determina `environment`.
- `SENTRY_RELEASE_EDGE` — commit/build de despliegue; alternativa `DENO_DEPLOYMENT_ID`.
  Sin ambos se etiqueta `release_versioned=false`; no confundirlo con una release verificable.
- `SENTRY_CRON_MONITOR_SLUG` — allowlist de slugs separados por comas; vacío desactiva check-ins.

**Build:** `SENTRY_AUTH_TOKEN` es secreto de build, nunca `VITE_*`.
Se usa `@sentry/bundler-plugins/vite`; release coincide con runtime.
Sin token no se generan maps de producción. `BUILD_SOURCEMAPS=false` también
los desactiva; verificar subida real antes de prometer stack legible.

## 3. Envolturas obligatorias

Toda edge function crítica (fiscales, correo, cron, tipo de cambio) DEBE arrancar con:

```ts
import { wrapEdgeHandler } from "../_shared/sentry.ts";
Deno.serve(wrapEdgeHandler("nombre-fn", handler));
```

El test `src/__tests__/architecture/sentry-edge-wrapping.test.ts` bloquea CI si
faltas al contrato. Cuando agregues una función crítica nueva, agrégala al array
`CRITICAL` del test.

Para funciones programadas usar `withCronMonitor(fn, slug, handler, cfg)` y
habilitar su slug por env. Envía check-in inicial/final y hace flush después
del final. Un HTTP 5xx marca error sin alterar la respuesta HTTP del handler.

## 4. Trazas distribuidas front → edge

- El front adjunta `sentry-trace` + `baggage` a fetches que caen en
  `TRACE_PROPAGATION_TARGETS` (functions/rest de Supabase, librecarga.com).
- `corsHeaders` permite ambos headers (ver `supabase/functions/_shared/cors.ts`).
- `wrapEdgeHandler` crea isolation scope por request, continúa la traza y
  abre `http.server` con fn/request ID/status; también traza requests sin padre.
- El frontend envuelve `Routes` con `wrapReactRouterRouting` y re-renderiza
  tras init sin remount de formularios. Los nombres usan patrones de ruta.
- Verificar en Sentry → Performance → una transaction del front debe mostrar
  span hijo con `fn: <edge-function>`.

## 5. Filtrado de ruido y PII

- `IGNORE_ERRORS` bloquea sólo ruido conocido (auth esperada, extensiones, ResizeObserver).
  ChunkLoadError agotado, online Failed to fetch, React queue y 5xx son reportables.
- `DENY_URLS` bloquea extensiones y GTM.
- `scrubEventPii` redacta `email`, `rfc`, `tax_id`, `phone` en `message`,
  `breadcrumbs`, `request.url`.
- `beforeBreadcrumb` recorta bodies de fetch/xhr contra `isSensitiveApiUrl`.
- Replay: `maskAllText`, `maskAllInputs`, `blockAllMedia` (v13.310.0).
- Front y Edge comparten `supabase/functions/_shared/piiScrub.ts` y
  `scrubTelemetryData.ts`: extra/context/cause/query keys/spans, claves camelCase
  y credenciales/PII en texto. Traversal acotado; ciclos y exceso se truncan.
- SQLSTATE 23514/23505/P0001 ni un prefijo LC_ genérico prueban que sea esperado.
  Usar `expected=true` en validaciones comprobadas; `expected=false` fuerza reporte.
- Logout limpia usuario, tenant, rol y organización activa; tags para eventos
  y `setAttributes` para spans SDK 11. No transmitir email como user metadata.

**Regla:** si agregas un campo con PII (RFC, email, teléfono, CURP, dirección),
verifica que `scrubEventPii` lo cubre antes de mergear.

## 6. Fingerprint y agrupación

- `computePostgrestFingerprint` agrupa errores Postgres por `code` + ruta
  normalizada (IDs UUID/numéricos → `:id`). Un `42501` en `/embarques/abc` y
  `/embarques/xyz` cae en el mismo issue.
- Para agrupar manualmente, `Sentry.withScope(s => s.setFingerprint([...]))`
  antes del `captureException`.

## 7. Tags críticos

| Tag | Origen | Uso |
| --- | --- | --- |
| `feature` | `queryClient.ts` | Filtra errores de `react_query` |
| `kind` | `queryClient.ts` | `query` vs `mutation` |
| `auth_status` | `user.ts` | `authenticated` vs `anonymous` |
| `organization_id` / `active_organization_id` | `user.ts` | Multi-tenant blast radius |
| `effective_role` | `user.ts` | Rol resuelto (administrador, contador…) |
| `crashed_route` | `ErrorBoundary` | Ruta que rompió |
| `app_version` | init + boundary | Correlaciona con release |
| `fn` | Edge wrapper | Nombre de la edge function |

## 8. Rotación de DSN

1. Rotar DSN en Sentry → Project Settings → Client Keys.
2. Actualizar `VITE_SENTRY_DSN` (Lovable) y `SENTRY_DSN_EDGE` (secretos edge).
3. Deploy front (release nueva). Los eventos migran automáticamente.
4. Confirmar en Sentry que la nueva release aparece con `sessionOK: true`.

## 9. Checklist al agregar código nuevo

- [ ] Edge function crítica → agregar al array `CRITICAL` del test de wrapping.
- [ ] Mutation nueva → si captura errores manualmente, usar `notifyError`
      (que ya rutea a Sentry con contexto), no `captureException` directo.
- [ ] Campo PII nuevo → cubrir en `scrubEventPii` + regex en `piiScrub.ts`.
- [ ] Cron nuevo → `withCronMonitor` con schedule real (no `interval` genérico).
- [ ] Error de dominio esperado → `expected=true` explícito o regla de dominio
      precisa en `expectedTelemetryError.ts`; nunca filtrar una familia SQL entera.

## 10. Referencias internas

- Tests: `src/__tests__/architecture/sentry-*.test.ts` (imports, wrapping,
  fiscal services), `sentry/__tests__/*` (unit).
- Cerrar issues después de verificar la corrección y su despliegue; mantener
  evidencia de versión/ruta, no ocultar eventos para simular cierre.

## 11. Validación operativa pendiente de dashboard/despliegue

- Confirmar DSN/release/dist del deploy, Debug IDs/maps subidos y stack simbolizado.
- Verificar trace front→edge, tenant/rol del usuario actual y ninguno anterior al logout.
- Probar feedback/screenshot y Replay; túnel conserva bytes y expone Retry-After /
  X-Sentry-Rate-Limits, con timeout de upstream de 5 s y body máximo de 1 MiB.
- Medir descartes/rate limiting del túnel (60 requests/min/IP); no ampliar cuota
  ni muestreo a ciegas, especialmente en una oficina con IP compartida.
- El contrato Deno usa SDK real y transporte falso: valida aislamiento, privacidad,
  trazas/check-ins; no demuestra que secretos/alertas del servicio remoto estén configurados.
