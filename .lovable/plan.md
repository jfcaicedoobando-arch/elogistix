## Objetivo

Reemplazar piezas hechas a mano del módulo de reportar bugs con librerías open-source maduras, sin sacar los datos de Lovable Cloud. Resultado esperado: menos código propio que mantener, reportes con más contexto técnico, y mejor UX (captura de pantalla automática + selectores estables + replay opcional).

## Dependencias a añadir

```
bun add @medv/finder modern-screenshot rrweb rrweb-player @sentry/react
```

Peso estimado en bundle: ~25 KB de `@medv/finder` + `modern-screenshot`, el resto se carga **bajo demanda** (lazy import) sólo cuando el usuario abre el modal de feedback o ocurre un error → 0 KB en el shell autenticado normal.

---

## Cambios por pieza

### 1. Selector de elemento → `@medv/finder` (reemplaza `buildSelector`)

`src/lib/feedback/elementSelector.ts`:

- Quitar `buildSelector`, `cssEscape` y el path con `:nth-of-type` casero (~50 líneas menos).
- Mantener `pickMeaningfulAncestor`, `elementText`, `shortLabel`, `isMeaningful`.
- Re-exportar:
  ```ts
  import { finder } from "@medv/finder";
  export const buildSelector = (el: Element | null): string =>
    el ? finder(el, { seedMinLength: 1, optimizedMinLength: 2, threshold: 800 }) : "";
  ```
- `finder` ya prioriza `id`, `data-testid`, `aria-label`, clases estables y evita `:nth-child` cuando puede. Sin cambios en consumidores.

### 2. Captura de pantalla automática → `modern-screenshot`

Nuevo helper `src/lib/feedback/screenshot.ts`:

```ts
import { domToBlob } from "modern-screenshot";
export async function captureViewport(): Promise<Blob> {
  return domToBlob(document.documentElement, {
    scale: window.devicePixelRatio,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
    filter: (n) => !(n instanceof Element) || !["feedback-picker-overlay","feedback-picker-label","feedback-picker-hint"].includes(n.id),
  });
}
```

En `FeedbackForm.tsx`:

- Nuevo botón "📷 Capturar pantalla" junto a "Adjuntar imagen".
- Antes de capturar: cerrar/ocultar el modal con `pickerActive` (ya reusable) ~200ms, capturar, convertir a `File` y añadir a `imagenes`.
- Mantiene Ctrl+V y file picker actuales.

### 3. Session replay opcional → `rrweb`

Nuevo helper `src/lib/feedback/sessionReplay.ts`:

- Buffer circular en memoria de los **últimos 15 segundos** de eventos rrweb (config `recordCanvas: false`, `maskAllInputs: true` para no capturar passwords/PII).
- API: `startReplayBuffer()`, `stopReplayBuffer()`, `getReplaySnapshot(): RrwebEvent[]`.
- `installReplayBuffer()` se llama en `main.tsx` tras `installConsoleBuffer()`.
- Lazy: `await import("rrweb")` la primera vez.

En `crearReporte` → `metadata.sessionReplay` recibe los eventos serializados (gzip vía `CompressionStream`) y se guardan en columna `metadata jsonb` o, si pesa >100 KB, como adjunto en el bucket `reportes-feedback/{reporteId}/replay.json.gz`.

En `AdminReporteDetalle.tsx`: si existe replay, renderizar `rrweb-player` con controles play/pause/speed.

**Privacidad**: por defecto sólo se graba mientras el modal está abierto + 15s previos. NO se graba continuamente para todos los usuarios.

### 4. Stack traces y breadcrumbs de errores → `@sentry/react` en modo local

- **NO** usamos DSN externo. Inicializamos Sentry sólo para que capture errores y mantenga breadcrumbs en memoria (clicks, navegación, fetch, console, XHR) — todo se queda en el cliente.
- En `main.tsx`:
  ```ts
  Sentry.init({
    dsn: undefined,            // no envía a ningún backend
    integrations: [Sentry.browserTracingIntegration(), Sentry.breadcrumbsIntegration()],
    beforeSend: () => null,    // belt-and-suspenders
    maxBreadcrumbs: 50,
  });
  ```
- Al enviar un reporte: `Sentry.getCurrentScope().getBreadcrumbs()` se incluye en `metadata.breadcrumbs`.
- Si hay un error JS reciente sin manejar: `Sentry.getLastEventId()` y `Sentry.getCurrentScope()._eventProcessors`... más simple: mantener un `lastError` propio con `window.addEventListener("error")` y `unhandledrejection` (ya casi-trivial, sin dependencia). **Decisión**: si sólo queremos breadcrumbs, podemos saltar Sentry y escribir 40 líneas a mano. Pero por mantenimiento y robustez (timing, dedupe, integración con React errorBoundary, source maps en dev), Sentry vale la pena.

### 5. Selector de elemento — pulido extra con `@medv/finder`

`useElementPicker.ts` no cambia su lógica; sólo `buildSelector` interno mejora. La etiqueta flotante (`shortLabel`) sigue siendo nuestra.

---

## Base de datos

Tabla `reportes_feedback` no cambia de esquema; todo va en `metadata jsonb`. Sólo crear (si se aprueba replay) política RLS extra en el bucket para los archivos `*/replay.json.gz` (heredan la actual del bucket `reportes-feedback`, no requiere migración).

---

## Archivos modificados / nuevos

**Nuevos:**

- `src/lib/feedback/screenshot.ts` — wrapper de `modern-screenshot`.
- `src/lib/feedback/sessionReplay.ts` — buffer rrweb circular.
- `src/lib/feedback/sentryInit.ts` — init local-only de Sentry.

**Modificados:**

- `src/lib/feedback/elementSelector.ts` — `buildSelector` ahora delega a `@medv/finder`.
- `src/components/feedback/FeedbackForm.tsx` — botón "Capturar pantalla".
- `src/components/feedback/FeedbackDialog.tsx` — incluir `breadcrumbs` y `sessionReplay` en `metadata` al enviar.
- `src/pages/admin/AdminReporteDetalle.tsx` — visor `rrweb-player` cuando exista replay.
- `src/main.tsx` — `installReplayBuffer()` + `initSentryLocal()`.
- `package.json` — nuevas deps.
- `src/constants/appVersion.ts` → `8.228.0`.
- `src/content/changelog/v8/chunks/0.ts` — entrada minor `8.228.0`.

---

## Plan por fases (puedes ejecutar parcialmente)


| Fase                              | Esfuerzo           | Valor                                                  | Dependencia             |
| --------------------------------- | ------------------ | ------------------------------------------------------ | ----------------------- |
| **A. `@medv/finder**`             | 10 min, 1 archivo  | Selectores más estables y -50 LOC                      | `@medv/finder`          |
| **B. `modern-screenshot**`        | 30 min, 2 archivos | Botón "capturar pantalla" — gran UX win                | `modern-screenshot`     |
| **C. Sentry local + breadcrumbs** | 45 min, 3 archivos | Reportes con historia de clicks/fetch/console          | `@sentry/react`         |
| **D. rrweb replay**               | 2-3 h, 5 archivos  | "Video" del bug; el visor más útil para el super admin | `rrweb`, `rrweb-player` |


Recomiendo **A + B + C** ahora como una sola release `8.228.0`, y **D (rrweb)** como `8.229.0` separado por su tamaño y consideraciones de privacidad.

## Verificación

1. **A**: abrir picker, seleccionar el botón "Nuevo embarque" → el selector capturado es `button[data-testid="..."]` o equivalente estable, no `nav > div:nth-of-type(2) > button:nth-of-type(3)`.
2. **B**: clic en "Capturar pantalla" → adjunta un PNG del viewport actual; el modal/overlay no aparecen en la captura.
3. **C**: hacer 3-4 clicks por la app, abrir feedback, enviar → `metadata.breadcrumbs` contiene los clicks/navegaciones con timestamps.
4. **D**: enviar reporte → en `/admin/reportes/:id` aparece un player con scrubbing; los inputs de password aparecen enmascarados.
5. Build production sin warnings de tree-shaking; bundle inicial no crece (>1 KB) — verificar con `bunx vite-bundle-visualizer`.

## Pregunta abierta

¿Quieres que arranque con las 3 fases (A+B+C) o sólo A+B para ir incremental? Solo A, vamos a ir en pasos. También: ¿está OK habilitar rrweb sabiendo que graba interacciones (sin passwords) mientras el modal está abierto? Si, adelante.