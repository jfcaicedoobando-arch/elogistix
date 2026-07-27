# Runbook Sentry — Libre Carga

Documento de gobierno para la implementación de Sentry (front + edge functions).
Fuente de la verdad para on-call y para futuras auditorías.

## 1. Piezas y dónde viven

| Capa | Archivo | Función |
| --- | --- | --- |
| Init front | `src/lib/observability/sentry/core.ts` | Boot dinámico (idle callback), integrations, `beforeSend` |
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

## 3. Envolturas obligatorias

Toda edge function crítica (fiscales, correo, cron, tipo de cambio) DEBE arrancar con:

```ts
import { wrapEdgeHandler } from "../_shared/sentry.ts";
Deno.serve(wrapEdgeHandler("nombre-fn", handler));
```

El test `src/__tests__/architecture/sentry-edge-wrapping.test.ts` bloquea CI si
faltas al contrato. Cuando agregues una función crítica nueva, agrégala al array
`CRITICAL` del test.

Para funciones programadas usar `withCronMonitor(fn, slug, handler, cfg)` en
lugar de `wrapEdgeHandler` — genera check-ins automáticos en Sentry Crons.

## 4. Trazas distribuidas front → edge

- El front adjunta `sentry-trace` + `baggage` a fetches que caen en
  `TRACE_PROPAGATION_TARGETS` (functions/rest de Supabase, librecarga.com).
- `corsHeaders` permite ambos headers (ver `supabase/functions/_shared/cors.ts`).
- `wrapEdgeHandler` llama a `Sentry.continueTrace()` cuando detecta los headers,
  así el span del edge cuelga de la transaction del browser.
- Verificar en Sentry → Performance → una transaction del front debe mostrar
  span hijo con `fn: <edge-function>`.

## 5. Filtrado de ruido y PII

- `IGNORE_ERRORS` en `initOptions.ts` bloquea familia de errores conocidos
  (ChunkLoadError, Refresh Token, ResizeObserver, Load failed…).
- `DENY_URLS` bloquea extensiones y GTM.
- `scrubEventPii` redacta `email`, `rfc`, `tax_id`, `phone` en `message`,
  `breadcrumbs`, `request.url`.
- `beforeBreadcrumb` recorta bodies de fetch/xhr contra `isSensitiveApiUrl`.
- Replay: `maskAllText`, `maskAllInputs`, `blockAllMedia` (v13.310.0).
- Edge extras: `scrubExtraDeep` redacta claves con `password`, `token`,
  `authorization`, `apikey`, `cookie`, `bearer`.

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
| `effective_role` | `user.ts` | Rol resuelto (owner, contador…) |
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
- [ ] Error dominio (409/422 esperado) → agregar a `IGNORE_ERRORS` o retornar
      antes del throw.

## 10. Referencias internas

- Tests: `src/__tests__/architecture/sentry-*.test.ts` (imports, wrapping,
  fiscal services), `sentry/__tests__/*` (unit).
- Memoria: `mem://preferences/sentry-resolve` — cerrar issues en el mismo turno
  del fix.
