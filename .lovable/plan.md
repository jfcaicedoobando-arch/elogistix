## Plan P2 — Cobertura avanzada Sentry (replay, profiling, sampling dinámico, spans manuales)

P0 y P1 quedaron implementados (wrapper edge + tunnel + source maps). Esta fase agrega visibilidad **profunda** en errores reales de cliente y latencia en operaciones críticas.

---

### 1) Session Replay (rrweb en crash time)

**Problema:** cuando un usuario reporta "se trabó al guardar el embarque", hoy sólo vemos el stack. No sabemos qué tocó, qué vio, ni en qué pantalla estaba.

**Cambios en `src/lib/sentry.ts`:**
- Agregar `Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })`.
- `replaysSessionSampleRate: 0` (no grabamos sesiones random — caro).
- `replaysOnErrorSampleRate: 1.0` (100% de sesiones con error → replay completo de los últimos ~60s).
- Privacidad: `maskAllText: true` enmascara texto (RFC, montos, nombres clientes); `blockAllMedia: true` ignora imágenes/PDFs renderizados.

**Costo:** Sentry cobra por replay; con `onErrorSampleRate=1.0` y volumen actual (<50 errores/día) entra holgado en el tier free/team.

**Bundle:** `@sentry/replay` ya viene incluido en `@sentry/react@8`, no agrega dep.

---

### 2) Browser Profiling

**Problema:** cuando un PDF tarda 8s o el dashboard lagea, no sabemos qué función concreta consume CPU.

**Cambios en `src/lib/sentry.ts`:**
- Importar `browserProfilingIntegration` de `@sentry/react`.
- Agregar a `integrations`.
- `profilesSampleRate: 0.1` (10% de transactions perfiladas — suficiente para detectar hotspots sin saturar).

**Requisito:** los profiles sólo se generan dentro de transactions activas (ya tenemos `tracesSampleRate: 0.1`), así que se aprovecha la instrumentación existente.

---

### 3) `tracesSampler` dinámico por ruta

**Problema:** hoy `tracesSampleRate: 0.1` global. Trazamos 10% del dashboard (alto volumen, bajo valor) y 10% del wizard de embarque (bajo volumen, alto valor → perdemos casos).

**Cambios en `src/lib/sentry.ts`:**
- Reemplazar `tracesSampleRate` por `tracesSampler(samplingContext)`:
  - `1.0` en rutas críticas: `/embarques/nuevo`, `/embarques/:id/editar`, `/cotizaciones/nueva`, `/facturas/nueva`, `/conciliacion/*`.
  - `0.5` en operaciones financieras: `/profit/*`, `/tesoreria/*`, `/comisiones`.
  - `0.05` en navegación/listados: `/dashboard`, `/embarques` (lista), `/clientes`.
  - `0` en marketing público: `/`, `/landing`, `/privacidad`, `/terminos`.
- Mantener `0.1` como fallback para rutas no listadas.

**Resultado:** capturamos 100% de los flujos donde el usuario realmente pierde dinero/tiempo, sin inflar el cuota de transactions.

---

### 4) Spans manuales en operaciones críticas

**Problema:** las transactions auto-instrumentadas miden `pageload`/`navigation`/`http`, pero no vemos cuánto tarda **generar un PDF** o **un RPC de liquidación**.

**Cambios:**

**`src/pdf/render/descargarPdf.ts`** — envolver el render en `Sentry.startSpan({ name: 'pdf.render', op: 'pdf', attributes: { document } }, ...)`. Hoy es la queja #1 de latencia.

**`src/generators/proformaPdf.tsx`, `cotizacionPdf.tsx`, `rentabilidadPdf.tsx`** — un span por generador con el `document` como atributo. Mide tanto el render como el `Blob` final.

**RPCs financieros críticos** (envoltura ligera con `Sentry.startSpan`):
- `liquidar_factura` (en `src/services/facturas*` — verificar nombre exacto al implementar).
- `eliminar_embarque` (en `src/services/embarques*`).
- `generar_proforma` / `conciliar_pago`.

Patrón:
```ts
return Sentry.startSpan(
  { name: 'rpc.liquidar_factura', op: 'db.rpc', attributes: { factura_id } },
  async () => supabase.rpc('liquidar_factura', { ... })
);
```

Sólo en las 4-5 RPCs más críticas, no en todas (eso lo cubre la auto-instrumentación).

---

### 5) Versionado + changelog

- `APP_VERSION` → `12.79.0` (minor bump, observabilidad nueva).
- `CHANGELOG.md` → entrada `[12.79.0]` con los 4 puntos.

---

### Detalles técnicos

- **Bundle impact:** Replay y Profiling ya están en `@sentry/react@8` (no añade deps), pero pesa ~30 KB extra gzip. Aceptable porque Sentry se carga vía `requestIdleCallback` fuera del critical path (ver `src/main.tsx`).
- **Privacy by default:** `maskAllText: true` + `blockAllMedia: true` evitan filtración de datos fiscales/personales en los replays (cumple con la sensibilidad del proyecto aunque sea demo).
- **Sin secrets nuevos:** todo corre con el DSN actual.
- **Tests:** no se rompen tests existentes — Sentry está mockeado/no-op en `src/test/setup.ts`.

---

### Fuera de alcance (P3 futuro)

- `beforeSend` para scrub adicional de PII en breadcrumbs.
- Alertas Sentry por release (regression detection).
- Integración Sentry ↔ Slack/email del equipo.
- Métricas custom (`Sentry.metrics.distribution('pdf.size_kb', ...)`).

---

### Confirmaciones antes de implementar

1. **Replay con 100% on-error** — ¿OK el costo? Con el volumen actual de errores entra en plan gratuito. Si prefieres más conservador, puedo bajar a `0.5` (50% de errores graban replay).
2. **Profiling al 10%** — ¿OK o lo subimos al 25% durante 1 semana para tener baseline y luego ajustamos?
3. **Lista de rutas críticas para `tracesSampler`** — la propuesta de arriba ¿cubre lo que más te importa o quieres agregar/quitar alguna?
