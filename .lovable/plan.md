## Objetivo

Tener señal accionable en Sentry cuando la llamada al AI Gateway dentro de `parse-cfdi-xml` se cuelga, tarda demasiado o falla — sin esperar a que un usuario reporte "se queda en Procesando…".

## Alcance

Instrumentación únicamente. NO cambia la lógica de parseo, ni la validación, ni el guardado. Complementa el timeout ya pendiente (issue 12.77.11 si se aplica) registrando además su disparo.

## Cambios

### 1. Edge function `supabase/functions/parse-cfdi-xml/index.ts`

Instrumentar `sugerirCategoria()` para emitir un log estructurado por cada llamada al AI Gateway con:

- `event: "ai_gateway_call"`
- `model: "google/gemini-2.5-flash-lite"`
- `latency_ms` (medido con `performance.now()` alrededor del `fetch`)
- `status_code` HTTP de la respuesta
- `outcome`: `"ok" | "http_error" | "timeout" | "network_error" | "parse_error"`
- `conceptos_count`, `categorias_count`
- `request_id` (el que ya genera `createLogger`)

El log usa el `createLogger` existente (`log.info` / `log.warn`) — Supabase ya los expone via `edge_function_logs`, que es nuestra fuente principal en sandbox.

Además, propagar el outcome al log final `cfdi parseado` agregando un campo `ai_outcome` y `ai_latency_ms` para poder agregar por `search_events` en Sentry/Supabase sin abrir cada log.

### 2. Cliente `src/services/cxp/parseCfdiXml.ts` (o equivalente) + `src/components/cxp/CargaCfdiSection.tsx`

Envolver la invocación con breadcrumbs y span de Sentry:

- `Sentry.addBreadcrumb({ category: "cfdi", message: "parse_cfdi_xml.start", level: "info", data: { xml_size, xml_name } })` antes del fetch.
- `Sentry.startSpan({ name: "parse-cfdi-xml", op: "http.client" }, async () => { ... })` para tener latencia end-to-end visible en performance.
- En `.catch`: breadcrumb `parse_cfdi_xml.error` con `{ latency_ms, message }` y `Sentry.captureException(err, { tags: { feature: "cfdi_upload" }, contexts: { cfdi: { xml_size, latency_ms } } })`.
- Si se dispara el timeout cliente (15 s) ya planeado, capturar como `Sentry.captureMessage("cfdi_upload.client_timeout", "warning")` con tags para que se pueda alertar.

### 3. Helper compartido `src/lib/sentry.ts`

Exponer un wrapper pequeño `withSentryBreadcrumbs(category, name, fn)` para reutilizar el patrón en futuras edge calls (CFDI, PDF, etc.) sin duplicar boilerplate. Solo si no añade >30 líneas; si no, dejar inline en el servicio CFDI.

### 4. Panel de diagnóstico `src/pages/admin/SentryDiagnostico.tsx`

Agregar una sección "Últimas llamadas a AI Gateway (CFDI)" que liste los breadcrumbs locales acumulados en sesión actual — útil para soporte cuando un usuario reproduce el bug en vivo. (Solo lectura desde `window`, sin red.)

### 5. Versionado

- `src/constants/appVersion.ts` → `12.77.12` (o el siguiente disponible al implementar).
- `CHANGELOG.md` (root) → entrada `## [12.77.12] - 2026-06-11` con bullet: "Instrumentación Sentry (breadcrumbs + latencia + outcome) para llamadas al AI Gateway en parse-cfdi-xml".

## Detalles técnicos

```text
Edge function flow
──────────────────
handle()
  └─ sugerirCategoria()
       ├─ t0 = performance.now()
       ├─ fetch(ai.gateway...)         ← ya con AbortController (8 s) si se aplicó 12.77.11
       ├─ t1 = performance.now()
       ├─ log.info("ai_gateway_call", { outcome, latency_ms: t1-t0, status_code })
       └─ return result
  └─ log.finish(200, "cfdi parseado", { ai_outcome, ai_latency_ms })
```

```text
Cliente flow
────────────
procesar()
  └─ Sentry.startSpan("parse-cfdi-xml")
       ├─ breadcrumb start
       ├─ parseCfdiXml(xml, categorias)   ← con timeout 15 s
       ├─ on success: breadcrumb ok { latency_ms }
       └─ on error: breadcrumb error + captureException con tags
```

## Riesgos

- **Volumen de eventos**: solo se reportan exceptions y breadcrumbs (sin `captureMessage` por cada éxito). Esperado: <50 eventos/día.
- **PII**: NO se envía contenido del CFDI (RFC, montos, conceptos) a Sentry — solo tamaño, latencia y outcome.
- **Compatibilidad**: `Sentry.startSpan` requiere `@sentry/react` ≥ 8 (ya en uso por `browserTracingIntegration`).

## Fuera de alcance

- Cambios en la UI de carga (mantengo la propuesta del toast de timeout, no la rediseño).
- Dashboards/alertas en Sentry (se configuran desde la UI de Sentry, no desde código).
- Instrumentar otras edge functions — se hará en un PR separado si esta prueba funciona.
