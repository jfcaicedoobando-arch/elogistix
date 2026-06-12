## Plan P3 — Endurecimiento Sentry (PII scrub, alertas, integración equipo, métricas custom)

P0/P1/P2 ya están en producción (wrapper edge + tunnel + source maps + replay + profiling + sampling dinámico + spans manuales). Esta fase cierra el ciclo: **proteger datos**, **avisar al equipo cuando algo se rompe**, y **medir lo que importa al negocio**.

---

### 1) `beforeSend` / `beforeBreadcrumb` — Scrub adicional de PII

**Problema:** aunque Replay ya enmascara texto visible, los **breadcrumbs** y **eventos** pueden contener RFC, montos, emails, y payloads de Supabase en URLs / bodies que llegan en claro a Sentry.

**Cambios en `src/lib/sentry.ts`:**
- `beforeSend(event)`:
  - Recortar `event.request.url` quitando query strings que contengan `email=`, `rfc=`, `token=`.
  - Recortar `event.user` a sólo `{ id }` (no email, no username).
  - Aplicar regex de RFC mexicano (`/[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}/g`) y CURP sobre `event.message` y `event.exception.values[*].value` → reemplazar por `[RFC]` / `[CURP]`.
  - Regex de email → `[EMAIL]`.
- `beforeBreadcrumb(breadcrumb)`:
  - Si `category === 'fetch'` o `'xhr'` y la URL apunta a `/rest/v1/clientes|facturas|proformas` → eliminar `breadcrumb.data.request_body` y `response_body`.
  - Drop completo de breadcrumbs `category === 'console'` con `level === 'log'` (sólo conservar `warn` / `error`).

**Beneficio:** cumplimos privacidad de datos fiscales aunque el proyecto sea demo, y reducimos ruido en breadcrumbs en ~70%.

---

### 2) Alertas Sentry por release (regression detection)

**Problema:** hoy nadie se entera cuando un deploy introduce un error nuevo hasta que un usuario reporta. Sentry tiene **release tracking** ya activo (via `release: libre-carga@${APP_VERSION}` en `sentryVitePlugin`), pero **no hay alertas configuradas**.

**Cambios (vía Sentry MCP, sin cambios de código):**
- Crear alert rule **"Regression in new release"**:
  - Trigger: `event.type:error AND release:libre-carga@latest AND times_seen:>5 in 1h`
  - Action: email al owner del proyecto + (opcional) webhook.
- Crear alert rule **"High error rate"**:
  - Trigger: `event.type:error count() > 50 in 10min`.
- Crear alert rule **"Critical RPC failure"**:
  - Trigger: cualquier transaction con `op:db.rpc` y `status:internal_error` (>3 en 5min) — esto aprovecha los spans manuales P2.

Estas reglas se crean con `mcp_sentry_r1zPu` desde la UI de Sentry, no requieren commit. Lo que sí queda en código es **documentación** en `docs/observability.md` (nuevo) describiendo qué dispara cada alerta y a quién avisa.

---

### 3) Integración Sentry ↔ canal del equipo

**Decisión pendiente del usuario:** ¿email, Slack, Discord, o webhook genérico? (ver pregunta 2 abajo).

Una vez decidido:
- Instalar la integración nativa de Sentry para ese canal (UI de Sentry, sin código).
- Apuntar las 3 alertas del punto 2 a ese canal.
- Documentar en `docs/observability.md` el flujo: error → Sentry → canal → on-call.

---

### 4) Métricas custom (Sentry Metrics API)

**Problema:** medimos latencia técnica (spans), pero no KPIs de negocio. Ej: ¿cuántos MB pesa un PDF promedio? ¿cuánto tarda un wizard de embarque end-to-end? ¿cuántas conciliaciones fallan?

**Cambios:**

**`src/pdf/render/descargarPdf.ts`** — agregar `Sentry.metrics.distribution('pdf.size_kb', sizeKb, { tags: { filename_prefix } })` después del render (ya tenemos el `size_kb` como atributo del span; sólo lo emitimos también como métrica agregable).

**`src/features/embarques/hooks/useNuevoEmbarqueWizard.ts`** — al completar el wizard:
- `Sentry.metrics.distribution('embarque.wizard_duration_ms', durationMs)`.
- `Sentry.metrics.increment('embarque.created', 1, { tags: { modo: 'maritimo|terrestre|aereo' } })`.

**`src/services/conciliacion/*`** — al fallar una conciliación:
- `Sentry.metrics.increment('conciliacion.failed', 1, { tags: { reason } })`.

**`src/services/proforma/crud.ts`** — al crear proforma:
- `Sentry.metrics.distribution('proforma.total_mxn', total, { unit: 'currency' })` (sin RFC, sin cliente — sólo monto agregado).

Con esto Sentry nos da dashboards de "tamaño promedio de PDF la última semana", "tasa de éxito de conciliación", etc., sin necesidad de Mixpanel/Amplitude adicional.

---

### 5) Versionado + changelog

- `APP_VERSION` → `12.80.0` (minor bump, sigue siendo observabilidad).
- `CHANGELOG.md` → entrada `[12.80.0]` con los 4 puntos.
- Nuevo archivo `docs/observability.md` con: arquitectura Sentry (tunnel + edge wrapper), lista de alertas, lista de métricas custom, y runbook básico ("llegó alerta X → revisar Y").

---

### Detalles técnicos

- **`beforeSend` performance:** las regex corren sólo en errores (decenas/día), impacto despreciable.
- **Metrics API:** disponible en `@sentry/react@8`, no agrega deps. Los `tags` deben ser low-cardinality (no `cliente_id`, no `embarque_id` — sólo enums).
- **Sin secrets nuevos:** todo con el DSN actual + integración nativa Sentry.
- **Sin migración DB.**

---

### Fuera de alcance (P4 futuro, si llegamos)

- Distributed tracing con propagación a edge functions (hoy frontend y edge son traces separadas).
- Sentry Crons para los cron-jobs de `cxc-recordatorios` / `auditoria-snapshot-daily`.
- Custom dashboards versionados en repo.

---

### Confirmaciones antes de implementar

1. **PII scrub agresivo** — ¿OK redactar RFC/email/CURP de mensajes y breadcrumbs? Asumo sí (proyecto maneja datos fiscales mexicanos). Si prefieres ver los datos crudos en Sentry para debug más rápido, podemos hacerlo opt-in por entorno (`dev` sin scrub, `prod` con scrub).
2. **Canal de alertas** — ¿Email, Slack, Discord, o webhook a otro sistema? Necesito saber a dónde mandar las alertas para configurar la integración.
3. **Métricas custom propuestas** — ¿las 4 (PDF size, wizard duration, conciliación fallida, monto proforma) cubren lo que te interesa medir, o agregamos/quitamos alguna?
