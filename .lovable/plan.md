# Análisis: cobertura actual de Sentry

## Lo que ya está bien (no se toca)

- **SDK frontend** (`src/lib/sentry.ts`): init diferido vía `requestIdleCallback`, DSN público, release `libre-carga@APP_VERSION`, tunnel anti-adblock (`/functions/v1/sentry-tunnel`).
- **Sampling inteligente por ruta** (`sampleByRoute`): 100% en wizards críticos, 50% financiero, 5% listados, 0% marketing.
- **PII scrubbing** en `beforeSend` y `beforeBreadcrumb` (RFC/CURP/email, URLs sensibles).
- **Session Replay** sólo on-error con `maskAllText` + `blockAllMedia`.
- **Filtros** de ruido: chunk errors, HMR/React Refresh, refresh-token expirado.
- **Edge functions**: wrapper `_shared/sentry.ts` con `initSentryEdge` + `captureEdgeException` + `flush(2000)`. Adoptado en 9 funciones (parse-cfdi, parse-csf, user-management, demo-access, cxc-recordatorios, exchange-rates, client-error-log, auditoria-snapshot-daily, process-email-queue, tracking-public).
- **Source maps** subidas vía `sentryVitePlugin` con `SENTRY_AUTH_TOKEN`, `.map` borrados del dist.
- **Logger central** (`src/lib/observability/logger.ts`) reporta `error` a Sentry sin tocar call sites.
- **Sync de usuario** (`sentryUser.ts`) con `id`, `org_id`, `effective_role` como tags.

## Gaps detectados y mejoras propuestas

### 1. Integración con React Router v6 (alto valor)
Hoy `browserTracingIntegration()` se usa sin la variante de Router → las transactions aparecen como `/embarques/abc-123-uuid` en lugar de `/embarques/:id`, lo que **fragmenta métricas** y rompe el sampling por patrón.

**Acción**: reemplazar por `Sentry.reactRouterV6BrowserTracingIntegration(...)` con `useEffect`, `useLocation`, `useNavigationType`, `createRoutesFromChildren`, `matchRoutes`. Adaptar `sampleByRoute` para usar `attributes['http.route']`.

### 2. ErrorBoundary nativo de Sentry (medio)
`src/components/shared/ErrorBoundary.tsx` captura manualmente. Cambiar a `Sentry.ErrorBoundary` (o componer) para obtener:
- `eventId` automático en el fallback → botón "Reportar este error" pre-llenado con el evento.
- `showReportDialog` opcional.
- Mantener el `tryReloadForChunkError` actual con `beforeCapture`.

### 3. Tags de tenancy automáticos en todos los eventos (medio)
Hoy `sentryUser.ts` setea tags al login, pero si el usuario impersona o cambia de org en sesión, los tags no se refrescan en cada evento. Añadir `getCurrentScope().setTag(...)` en el cambio de `effectiveRole`/`activeOrganizationId` desde `OrganizationContext`.

### 4. Spans en flujos críticos restantes (medio)
Sólo 4 flujos están instrumentados (`proforma/crud`, `parseCfdi`, `descargarPdf`, `embarques/mutations`). Agregar `Sentry.startSpan({ op: "db.rpc" | "pdf" | "ai" })` en:
- `crear_proforma_atomica` y `actualizar_proforma` (RPC pesados).
- `useReconciliacionEmbarque` (conciliación masiva).
- `useNuevoEmbarqueWizard` submit.
- Generación de PDFs grandes (`cotizacionPdf`, `rentabilidadPdf`, `estadoCuentaPdf`) — ya existe envoltura genérica en `descargarPdf`, validar que la usen todos.

### 5. Edge functions: spans + adopción universal (medio)
- Verificar que **todas** las funciones críticas usen `wrapEdgeHandler` (hoy varias hacen `initSentryEdge` manual y try/catch). Migrar a `wrapEdgeHandler` para uniformidad.
- Añadir `Sentry.startSpan` alrededor de llamadas al AI Gateway (`parse-cfdi-xml`, `parse-csf`) y de queries pesadas (`cxc-recordatorios`, `auditoria-snapshot-daily`) para tener latencia desglosada.

### 6. Release Health y alertas (bajo, configuración Sentry-side)
- Activar `autoSessionTracking` (default true en v8, confirmar).
- Documentar en `docs/` qué alertas crear: crash-free rate < 99.5%, p95 transaction `/embarques/:id/editar` > 2s, error rate edge `parse-cfdi-xml` > 5%.

### 7. Limpieza menor
- `ErrorBoundary` actual hace `console.error` antes de capturar. Cambiar a `logger.error` para evitar duplicación (ya se reportará vía logger).
- `replaysOnErrorSampleRate: 1.0` es correcto, pero considerar `mask: ['[data-pii]']` + `unmask: ['[data-safe-label]']` para que los badges de estado se vean en replays.

## Sección técnica (resumen de archivos)

| Archivo | Cambio |
|---|---|
| `src/lib/sentry.ts` | Usar `reactRouterV6BrowserTracingIntegration`; `Sentry.ErrorBoundary` integration setup |
| `src/App.tsx` / `routes.tsx` | Envolver el `Router` con `withSentryReactRouterV6Routing` o pasar hooks a la integración |
| `src/components/shared/ErrorBoundary.tsx` | Migrar a `Sentry.ErrorBoundary` conservando reload de chunks |
| `src/contexts/OrganizationContext.tsx` | `getCurrentScope().setTag('active_org', id)` en cambios de org |
| `src/services/proforma/crud.ts` (otros RPC) | Añadir `Sentry.startSpan({op:"db.rpc"})` |
| `src/features/embarques/hooks/useReconciliacionEmbarque.ts` | Envolver mutación en span |
| `src/features/embarques/hooks/useNuevoEmbarqueWizard.ts` | Span en `submit` final |
| `supabase/functions/*/index.ts` | Migrar manualmente a `wrapEdgeHandler` donde aplique |
| `supabase/functions/parse-cfdi-xml/index.ts`, `parse-csf/index.ts` | Span alrededor de AI Gateway |
| `CHANGELOG.md` + `appVersion.ts` | Bump y entrada |
| `docs/observability.md` (nuevo) | Lista de alertas recomendadas en Sentry |

## Fuera de alcance (no se incluye salvo que lo pidas)

- Custom metrics (`Sentry.metrics.*`) → API deprecada en v8, no recomendado.
- Profiling continuo en producción → ya hay `profilesSampleRate: 0.1`, suficiente.
- Migración a Sentry v9 → trabajo separado.

## Preguntas antes de implementar

1. ¿Implementamos **todos** los gaps (1-5) o priorizamos sólo los de alto/medio impacto (1-3)?
2. ¿Quieres también el doc `docs/observability.md` con alertas recomendadas?
