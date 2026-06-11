## Plan P0 — Ampliar cobertura de Sentry (cliente + edge functions)

Objetivo: cerrar los 3 huecos más críticos de observabilidad detectados en el análisis previo, sin tocar lógica de negocio.

---

### 1) Sentry en edge functions (Deno SDK)

**Nuevo archivo:** `supabase/functions/_shared/sentry.ts`
- Wrapper ligero que inicializa `Sentry` desde `https://deno.land/x/sentry/index.mjs` una sola vez por isolate.
- DSN desde `Deno.env.get("SENTRY_DSN_EDGE")` (secret nuevo). Si no está, el wrapper es no-op (no rompe deploys).
- Exporta:
  - `initSentryEdge(fnName)` — `Sentry.init({ dsn, environment, release, tracesSampleRate: 0.1 })`.
  - `withSentry(fnName, handler)` — envuelve `Deno.serve` handler en `Sentry.startSpan` + `captureException` automático en errores no controlados, agrega tags `fn`, `request_id` y (si está disponible) `user_id` / `organization_id`.
  - `captureEdgeError(err, ctx)` — atajo para errores controlados que queremos visibles en Sentry sin romper la respuesta.
- **No** envía payloads del request (sólo metadatos: status, latency, fn, request_id).

**Integración progresiva** (sólo handler-level, no toca lógica):
- `parse-cfdi-xml/index.ts` — primer candidato (es el que motivó esto).
- `parse-csf/index.ts`
- `user-management/index.ts`
- `tracking-public/index.ts`
- `cxc-recordatorios/index.ts`
- `process-email-queue/index.ts`
- `exchange-rates/index.ts`
- `demo-access/index.ts`
- `client-error-log/index.ts`
- `auditoria-snapshot-daily/index.ts`

Cada función: `import { withSentry } from "../_shared/sentry.ts"` y envolver el `Deno.serve(...)` existente. El `createLogger` actual sigue escribiendo a `app_logs` sin cambios.

**Secret requerido:** `SENTRY_DSN_EDGE` (DSN de un proyecto Sentry separado para backend, o el mismo del frontend si se prefiere unificar — recomiendo separado para distinguir issues cliente vs edge).

---

### 2) Tag global `organization_id` + `role` en cliente

**Editar:** `src/lib/sentryUser.ts`
- Ya setea `userId`. Agregar:
  - `Sentry.setTag("organization_id", orgId)`
  - `Sentry.setTag("role", effectiveRole)`
  - `Sentry.setTag("is_impersonating", boolean)`
- Llamarlo desde `OrganizationContext` cuando cambie la org activa o el rol efectivo (impersonación).
- `clearSentryUser()` también limpia tags al logout.

Resultado: todos los issues en Sentry filtrables por org y rol → triage instantáneo en multi-tenant.

---

### 3) `logger.error` → Sentry (unificación)

**Editar:** `src/lib/observability/logger.ts`
- Hoy el método `error` sólo manda a `console.error` + `app_logs`.
- Agregar import dinámico de `@sentry/react` (para no romper el code-split idle):
  ```ts
  import("@sentry/react").then(S => S.captureException(err, { tags: { scope } }))
  ```
- Sólo en producción y sólo si `isSentryReady()` (ya existe en `src/lib/sentry.ts`).
- Si el primer arg no es `Error`, construir uno sintético con el `message` para conservar stack.

Resultado: cualquier `logger.error(...)` distribuido en el código (PDFs, RPCs, servicios) llega automáticamente a Sentry sin tocar call sites.

---

### Versionado y changelog

- `src/constants/appVersion.ts` → `12.77.13`.
- `CHANGELOG.md` → entrada `[12.77.13]` con los 3 puntos (P0 Sentry).

---

### Detalles técnicos

- **Sin migraciones SQL.** `app_logs` sigue siendo la fuente para `/admin/diagnostico`.
- **Sin cambios en `tracesSampleRate`** (sigue 0.1 cliente y edge).
- **Sin replay, profiling, tunnel, source maps** — esos son P1/P2.
- **Tests:** los `*_test.ts` Deno existentes no requieren cambios; el wrapper Sentry es no-op cuando `SENTRY_DSN_EDGE` no está seteado (tests siguen pasando sin tocar).
- **Cleanup:** `withSentry` hace `Sentry.flush(2000)` antes de retornar la respuesta para garantizar envío en entornos serverless.

---

### Fuera de alcance (P1/P2 para después)

- `sentryVitePlugin` + source maps en CI.
- Edge function `sentry-tunnel` para sortear adblockers.
- `replayIntegration` (rrweb on crash).
- `profilesSampleRate`.
- `tracesSampler` dinámico por ruta.
- Spans manuales en generadores PDF y RPCs específicos.

---

### Acción requerida del usuario antes de implementar

Necesito que confirmes:
1. ¿DSN separado para edge functions (recomendado) o reutilizamos el del frontend? Si es separado, crea el proyecto en Sentry y pásame el DSN para guardarlo como secret `SENTRY_DSN_EDGE`.
2. ¿Envolvemos las **10 edge functions** listadas o prefieres empezar sólo con las críticas (`parse-cfdi-xml`, `parse-csf`, `user-management`)?
