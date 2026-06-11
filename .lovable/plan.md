## Objetivo

Arreglar el cuelgue en "Procesando…" al subir XML CFDI. Causa raíz confirmada en logs: el `fetch` a `ai.gateway.lovable.dev` en `parse-cfdi-xml` no tiene `AbortController` ni timeout — en el último intento de Isela tardó **52.9 s** (`latency_ms: 52186`) antes de responder, lo que hace que el botón nunca termine desde la perspectiva del usuario.

## Cambios

### 1. `supabase/functions/parse-cfdi-xml/index.ts` — timeout server (8 s)

Envolver el `fetch` al AI Gateway dentro de `sugerirCategoria()` con `AbortController` y timeout de **8 segundos**. Si expira:
- Se aborta el fetch (libera el slot, deja de esperar a Gemini).
- Devuelve `fallbackResult(conceptos)` (notas = concatenación de descripciones de conceptos, sin sugerencia de categoría).
- La instrumentación que ya existe (12.77.11) registra `outcome: "timeout"` y `latency_ms` automáticamente.

Resultado: el endpoint responde en ≤ ~9 s siempre. El usuario sigue pudiendo guardar la factura y elegir la categoría manualmente.

### 2. `src/components/cxp/CargaCfdiSection.tsx` — timeout cliente (15 s) + UX

Añadir un timeout de **15 segundos** alrededor de `parseCfdiXml(...)` usando `Promise.race`. Si expira:
- Se muestra toast: "Tiempo de espera agotado al procesar el XML. Inténtalo de nuevo o usa Captura manual."
- `setLoading(false)` para que el botón vuelva a su estado normal.
- Sentry ya capturará el error (la instrumentación de 12.77.11 envuelve `parseCfdiXml` en `Sentry.startSpan` con `captureException`).

El timeout cliente (15 s) > timeout server (8 s) para que normalmente sea el servidor quien decida y el cliente sólo cubra el caso de red caída / edge function fría.

### 3. Versionado

- `src/constants/appVersion.ts` → `12.77.12`.
- `CHANGELOG.md` (root) → entrada `## [12.77.12] - 2026-06-11`:
  > **fix(cfdi)**: la subida de XML CFDI ya no se queda colgada en "Procesando…". Se añadió timeout de 8 s al `fetch` del AI Gateway en `parse-cfdi-xml` (devuelve fallback si Gemini no responde) y timeout de 15 s en el cliente con toast claro. Causa raíz: una llamada al gateway tardó 52 s en el último intento de Isela.

## Detalles técnicos

```text
sugerirCategoria()
  ├─ controller = new AbortController()
  ├─ timeoutId = setTimeout(() => controller.abort(), 8000)
  ├─ try { fetch(..., { signal: controller.signal }) }
  ├─ finally { clearTimeout(timeoutId) }
  └─ catch AbortError → outcome = "timeout", return fallback
```

```text
procesar()                        // CargaCfdiSection
  ├─ Promise.race([
  │    parseCfdiXml(xml, cats),
  │    new Promise((_, rej) =>
  │      setTimeout(() =>
  │        rej(new Error("CLIENT_TIMEOUT")), 15000))
  │  ])
  └─ catch → toast adaptado si message === "CLIENT_TIMEOUT"
```

## Fuera de alcance

- Reintentos automáticos (puede esconder problemas reales del gateway).
- Cambiar el modelo o el prompt de Gemini.
- Cambios en el parseo del XML, validación o guardado de la factura.
