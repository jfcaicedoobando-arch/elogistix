## Fase C — Breadcrumbs (historial de acciones recientes)

### Cambio de criterio respecto al plan original

El plan original proponía `@sentry/react` en modo "local" (sin DSN) sólo para usar su captura de breadcrumbs. Revisando el módulo `consoleBuffer.ts` que ya tenemos, **escribir nuestro propio buffer es más limpio**:

- Sentry sin DSN pesa ~80 KB minified+gzip y trae integraciones que no usamos (tracing, profiling, replay propio que duplicaría rrweb).
- Necesitamos algo idéntico a `consoleBuffer.ts`: ring buffer de eventos, instalado una vez en `main.tsx`, leído al enviar el reporte.
- Cero dependencias nuevas y ~80 líneas de código que controlamos.

Si más adelante queremos enviar errores a un backend de errores, ahí sí vale Sentry con DSN; hoy no aporta.

## Cambios

### 1. Nuevo `src/lib/feedback/breadcrumbsBuffer.ts`

Ring buffer de los últimos **50 breadcrumbs**, registrando:

- **`click`** — listener global en `document` (capture phase): `target` (tag + texto corto + selector via `@medv/finder`), coordenadas.
- **`nav`** — patch a `history.pushState` / `replaceState` y listener de `popstate`: from → to.
- **`fetch`** — wrapper sobre `window.fetch`: método, URL (sin querystring de tokens), status, duración. Filtrar las llamadas a Supabase Storage por privacidad → guardar sólo path, no signed URLs.
- **`xhr`** — patch a `XMLHttpRequest.prototype.open/send` por si alguna lib (Supabase auth-helpers viejo) la usa.
- **`error`** — `window.error` y `unhandledrejection` con `message` + primera línea del stack.

API:
```ts
export function installBreadcrumbsBuffer(): void;
export function getBreadcrumbsSnapshot(): Breadcrumb[];

export interface Breadcrumb {
  ts: string;             // ISO sin segundos
  category: "click" | "nav" | "fetch" | "xhr" | "error";
  message: string;
  data?: Record<string, string | number>;
}
```

Patrón idéntico a `consoleBuffer`: `installed` flag, `MAX = 50`, `push()` que trunca strings y atrapa errores en try/catch.

### 2. Instalar en `src/main.tsx`

Justo después de `installConsoleBuffer()`:

```ts
import { installBreadcrumbsBuffer } from "./lib/feedback/breadcrumbsBuffer";
installBreadcrumbsBuffer();
```

### 3. Adjuntar al reporte

En `src/types/feedback.ts` añadir al `ReporteFeedbackMetadata`:

```ts
breadcrumbs?: Breadcrumb[];
```

En `src/components/feedback/FeedbackDialog.tsx`, dentro del `crearReporte`, sumar:

```ts
breadcrumbs: getBreadcrumbsSnapshot(),
```

### 4. Renderizar en el admin (`AdminReporteDetalle.tsx`)

Hoy el panel muestra todo `metadata` como JSON crudo. Añadir una sección colapsable **"Acciones recientes"** que tabule los breadcrumbs:

```
┌───────────┬──────┬──────────────────────────────────┐
│ 14:23:01  │ nav  │ /embarques → /embarques/4e8b...   │
│ 14:23:05  │ click│ button "Editar"                   │
│ 14:23:06  │ fetch│ GET /rest/v1/embarques · 200 · 84ms│
│ 14:23:08  │ error│ TypeError: Cannot read 'id' of …  │
└───────────┴──────┴──────────────────────────────────┘
```

Iconos `MousePointer`, `Navigation`, `Network`, `AlertCircle` por categoría. Color suave en error.

### 5. Versionado

- `src/constants/appVersion.ts` → `8.230.0`.
- `src/content/changelog/v8/chunks/0.ts` — entrada minor `8.230.0`.

## Privacidad y seguridad

- **No** se capturan valores de `input` ni texto pegado.
- En `fetch`/`xhr`: sólo método + path + status + duración. Los headers `Authorization` y los querystring con `access_token` se elide a `***`.
- El buffer vive en memoria, se reinicia con cada recarga; nunca se persiste en localStorage.

## Archivos modificados / nuevos

**Nuevos:**
- `src/lib/feedback/breadcrumbsBuffer.ts`

**Modificados:**
- `src/main.tsx` — `installBreadcrumbsBuffer()`.
- `src/types/feedback.ts` — campo `breadcrumbs`.
- `src/components/feedback/FeedbackDialog.tsx` — `breadcrumbs: getBreadcrumbsSnapshot()` en `crearReporte`.
- `src/pages/admin/AdminReporteDetalle.tsx` — bloque "Acciones recientes" formateado.
- `src/constants/appVersion.ts` → `8.230.0`.
- `src/content/changelog/v8/chunks/0.ts` — entrada `8.230.0`.

## Verificación

1. Recargar la app, navegar entre 3 rutas, hacer 4-5 clicks, abrir el modal de feedback y enviar un reporte.
2. En `/admin/reportes/:id` aparece la sección "Acciones recientes" con la navegación, los clicks (botón "Editar" con su selector) y las llamadas fetch recientes con status y duración.
3. Si fuerzo un error (`throw new Error("test")`), aparece como último breadcrumb categoría `error`.
4. Los signed URLs de Supabase Storage no aparecen completos.
5. Bundle inicial crece <2 KB.
