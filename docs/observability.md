# Observabilidad — Sentry

Arquitectura, alertas y métricas de Libre Carga. Documento operativo:
actualizar cuando se modifique `src/lib/sentry.ts`, `supabase/functions/_shared/sentry.ts`
o las reglas en la UI de Sentry.

## Arquitectura

```
                       ┌──────────────────────────────────┐
   Browser (React)  ──►│ POST /functions/v1/sentry-tunnel │──► ingest.us.sentry.io
   (@sentry/react)     └──────────────────────────────────┘
                              (anti-adblock, no logs)

   Edge Functions ──────────────► ingest.us.sentry.io (npm:@sentry/deno@8)
   (10 funciones)                  via SENTRY_DSN_EDGE
```

- **Frontend DSN:** `VITE_SENTRY_DSN` (público; default en `src/lib/sentry.ts`).
- **Edge DSN:** secret `SENTRY_DSN_EDGE` (privado, sólo en Lovable Cloud).
- **Release:** `libre-carga@${APP_VERSION}` empata bundle, source maps y eventos.
- **Source maps:** `vite.config.ts` build con `sourcemap: 'hidden'`; `@sentry/vite-plugin`
  sube los `.map` al release y los borra tras upload (`filesToDeleteAfterUpload`).

## Sampling (P2)

- `tracesSampler` por ruta (ver `sampleByRoute` en `src/lib/sentry.ts`):
  - `1.0` wizards y edición crítica
  - `0.5` finanzas
  - `0.05` listados de alto volumen
  - `0` marketing público
  - `0.1` fallback
- `profilesSampleRate: 0.1` (Browser Profiling sólo sobre transactions trazadas).
- `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 1.0` (grabamos sólo el
  contexto de errores; texto y media enmascarados por defecto).

## PII Scrub (P3)

Implementado en `src/lib/observability/piiScrub.ts` y aplicado vía `beforeSend` /
`beforeBreadcrumb` en `src/lib/sentry.ts`. Cubre:

- **Eventos:** `event.user` recortado a `{ id }`; `event.request.url` con query
  string limpio (`token`, `email`, `rfc`, `curp`, `access_token`, `refresh_token`
  → `[REDACTED]`); `event.message` y `event.exception.values[*].value` con regex
  de RFC mexicano (12/13 chars), CURP (18 chars) y email → placeholders.
- **Breadcrumbs:** `console.log` descartados; bodies (`request_body`, `response_body`)
  eliminados en endpoints sensibles (`/rest/v1/clientes|facturas|proformas|proveedores|
  conceptos_*|pagos_*`); URL scrub aplicado siempre.

## Métricas de negocio (P3)

Emitidas vía `Sentry.metrics` (low-cardinality tags). Disponibles en
Sentry → Insights → Metrics.

| Métrica                         | Tipo         | Tags                       | Emite en                                          |
| ------------------------------- | ------------ | -------------------------- | ------------------------------------------------- |
| `pdf.size_kb`                   | distribution | `prefix` (folio prefix)    | `src/pdf/render/descargarPdf.ts` tras render      |
| `proforma.total_mxn`            | distribution | —                          | `src/services/proforma/crud.ts` tras RPC          |
| `embarque.wizard_duration_ms`   | distribution | —                          | `useNuevoEmbarqueWizard` tras submit              |
| `embarque.created`              | count        | `modo` (maritimo/terrestre/aereo) | `useNuevoEmbarqueWizard` tras submit       |
| `conciliacion.failed`           | count        | `tipo`, `reason`           | `src/services/tesoreria/conciliacion.ts` on error |

> **Regla:** no agregar tags de alta cardinalidad (`cliente_id`, `embarque_id`,
> `factura_id`, RFC). Sólo enums o prefijos.

## Alertas (Sentry UI)

**Canal de notificación:** email. Las alertas se envían al equipo a través de la
integración nativa de email de Sentry (no requiere Slack/Discord/webhook). Cada
miembro del proyecto Sentry recibe los avisos en el correo con el que se dio de
alta. Para agregar/quitar destinatarios: Sentry → Settings → Members, o crear
un Team y asignarlo al proyecto.

Configuradas como Alert Rules en el proyecto `elogistix/javascript-react`. Si se
modifican, actualizar esta tabla.

| Alerta                       | Condición                                                                | Acción              |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------- |
| Regression in new release    | `event.type:error AND release:libre-carga@latest AND times_seen:>5 in 1h` | Send email to team  |
| High error rate              | `event.type:error count() > 50 in 10min`                                 | Send email to team  |
| Critical RPC failure         | `span.op:db.rpc status:internal_error count() > 3 in 5min`               | Send email to team  |

### Cómo crearlas en Sentry (una sola vez)

1. Sentry → **Alerts** → **Create Alert** → tipo **Issues** (las dos primeras) o
   **Metric** (la de RPC).
2. Pegar la condición de la tabla en el filtro.
3. En **Then perform these actions** elegir **Send a notification to Members
   and Teams** y seleccionar el team del proyecto (o `#all-members`).
4. Guardar con el nombre exacto de la tabla para mantener trazabilidad.

> **Nota:** la creación de Alert Rules no está disponible vía API/MCP en este
> proyecto; se configura manualmente en la UI. Una vez creadas, son persistentes.

## Runbook

1. **Llega alerta de regression:** abrir el issue desde Sentry → confirmar release
   afectado → ejecutar `git log` para identificar commits del release → si confirma
   regresión, hacer rollback vía Publish history o hotfix.
2. **High error rate:** revisar `tags.organization_id` y `tags.effective_role` en
   los issues para descartar afectación a un único tenant; si es global, rollback.
3. **RPC failure:** abrir el span en Performance, capturar `embarque_id` /
   `factura_id` del contexto, replicar en local con esos datos.

## Cambios recientes

- `12.81.0` — P3.1: canal de alertas = email + instrucciones de setup en UI.
- `12.80.0` — P3: PII scrub + métricas custom + esta documentación.
- `12.79.0` — P2: replay, profiling, sampling dinámico, spans manuales.
- `12.78.0` — P1: source maps + sentry-tunnel.
- `12.77.13` — P0: wrapper edge + logger.error → captureException.
