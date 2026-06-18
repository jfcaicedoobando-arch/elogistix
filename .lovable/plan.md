## Estado actual

Las Fases A–E del audit anterior están aplicadas (v13.64.0). El sub-agente identificó **6 gaps reales** + 5 deudas menores que aún limitan la cobertura efectiva (~92% → ~98% si se cierran).

## Hallazgos clave

**Gaps reales:**
1. **G1 — 8 edge functions sin `wrapEdgeHandler`** (cobertura backend: 55%). Críticas: `send-transactional-email`, `process-email-queue`, `enviar-cotizacion-email`. Media: `auditoria-weekly-digest`, `handle-email-suppression`, `exchange-rates` (importa `initSentryEdge` pero no envuelve handler). Baja: `handle-email-unsubscribe`, `preview-transactional-email`.
2. **G2 — `ErrorBoundary` solo en `Layout.tsx`**, no en raíz. Rutas públicas (`/landing`, `/tracking-public`, login, `/privacidad`) y errores en `<BrowserRouter>` / providers → pantalla en blanco sin evento.
3. **G3 — Source maps condicionales a `SENTRY_AUTH_TOKEN`** que no está documentado como configurado. Sin token → stacks minificados en producción (variables `o`, `r`, `n`).
4. **G4 — ~30 `toast.error()` en flujos críticos** fuera de `MutationCache` (catch manuales). Top 5: `FacturasMasivasToolbar`, `TesoreriaConciliacion`, `useTesoreriaCuentasController`, `useCotizacionDetalleState`, `ProfitDashboardEjecutivo`.
5. **G5 — `scrubEventPii` incompleto**: no toca `event.request.headers` (puede incluir `Authorization`/cookies) ni breadcrumbs de `ui.click`/`navigation` con query strings sensibles.
6. **G6 — Falta `httpClientIntegration()`** — 4xx/5xx de `fetch`/XHR (RLS de Supabase, Resend) no generan eventos automáticos.

**Deuda menor:** `exchange-rates` sin wrap (3 líneas); sin scrub/límite de tamaño en `ctx.extra` del wrapper edge; `sampleByRoute` no cubre `/reportes`, `/auditoria/:id`, `/admin`; `autoSessionTracking` no explícito; `SENTRY_DSN_EDGE` sin documentar en `.env.example`/README.

## Plan F — Propuesta de ejecución (priorizado por ROI)

Sugiero ejecutar en este orden — **F2+F3 primero (1 h total, ROI máximo)**, luego F1, finalmente F4/F5/limpieza de deuda.

| # | Ítem | Esfuerzo | Por qué primero |
|---|---|---|---|
| **F2** | `<ErrorBoundary>` raíz en `App.tsx` (envolviendo `BrowserRouter`/providers) + `Sentry.httpClientIntegration({ failedRequestStatusCodes: [[400,599]] })` en `core.ts` | ½ h | Toda la app queda cubierta; 4xx/5xx aparecen automáticos. |
| **F3** | Documentar requisito `SENTRY_AUTH_TOKEN` + agregar warning en build si falta (sin token, log `[sentry] sourcemaps NO subidos`) | ½ h | Sin token, los stacks de prod son ilegibles — invalida todo el resto. |
| **F1** | `wrapEdgeHandler` en las 8 edge functions descubiertas (priorizando email/cola/ventas) | ½ día | Cierra 45% del blind spot backend. |
| **F4** | `captureException` en los 5 catch manuales TOP de G4 (`tags: { feature: <dominio> }`) | 1 h | Errores en flujos de dinero hoy invisibles. |
| **F5** | Extender `scrubEventPii` con `headers.authorization|cookie|x-*-token` y scrub de query strings en `breadcrumbs[].data.url`; añadir guard de tamaño (`extra` > 32 KB → truncar) en `_shared/sentry.ts` | ½ h | Compliance/PII y evitar 413 en envíos a Sentry. |
| **F-deuda** | Cerrar D1–D5: `exchange-rates` wrap, `sampleByRoute` ampliado (`/reportes`→50%, `/auditoria`→30%), `autoSessionTracking: true` explícito, `.env.example` con `SENTRY_DSN_EDGE` + nota en README de observabilidad | ½ h | Limpieza arquitectónica. |

## Detalles técnicos

- **F2 — orden de envoltorio**: `<Sentry.ErrorBoundary fallback={<AppFatalError />}>` por fuera de `<BrowserRouter>` para capturar errores de routing. Reutilizar el `ErrorBoundary` actual o crear `RootErrorBoundary` minimalista (sin layout, solo mensaje + reload).
- **F2 — httpClient**: usar `failedRequestTargets` con regex del proyecto Supabase + dominios productivos para no capturar errores de terceros (CDN, ads-block). Configurar `failedRequestStatusCodes: [[500, 599]]` inicialmente (más restrictivo) y subir a 4xx después de calibrar volumen, para no quemar cuota.
- **F3 — guardia de build**: en `vite.config.ts`, si `mode === "production"` y `!process.env.SENTRY_AUTH_TOKEN` → `console.warn("[sentry] SENTRY_AUTH_TOKEN ausente: sourcemaps NO se subirán")`. No romper el build (CI debe poder correr en forks).
- **F4 — patrón**: lazy `import("@sentry/react")` en cada catch para respetar el ESLint guardrail; añadir tag `feature` específico (`facturacion`, `tesoreria`, `cotizacion`, `pnl`).
- **F5 — scrub headers**: lista negra: `authorization`, `cookie`, `x-supabase-auth`, `apikey`. Iterar `Object.keys` case-insensitive.
- **Tests**: cada fase F lleva sus propios casos (extender `environment.test.ts` para httpClient integration, nuevos archivos para los catch de F4, casos en `helpers.test.ts` para los nuevos scrubs).
- **CHANGELOG/versionado**: bump por cada fase (F2+F3 → `13.65.0`, F1 → `13.66.0`, F4+F5 → `13.67.0`).

## Verificación al cerrar

- Build de prod debe loguear "sourcemaps subidos a release `libre-carga@13.65.0`".
- `vitest run` y `deno test supabase/functions/_shared/` deben pasar.
- Smoke manual: forzar un 500 desde una llamada a edge function de prueba y verificar evento en Sentry con frames legibles.