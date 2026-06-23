
## Diagnóstico

Sentry reporta **2 issues** activos, ambos de la **misma causa raíz**:

- `JAVASCRIPT-REACT-1B` — release `13.114.2`, `/cxp`
- `JAVASCRIPT-REACT-19` — release `13.103.0`, `/embarques/.../`

```
TypeError: Failed to fetch (eorqadkulqtneqjbsblk.supabase.co/functions/v1/parse-cfdi-xml)
feature: cfdi_upload  ·  user: contador  ·  xml_size: 13 KB
latencias observadas: 5.1 s y 11.5 s
```

### Qué está pasando (analogía)

Tu app es un mesero que pide un platillo (parsear XML CFDI) a la cocina (edge function `parse-cfdi-xml`). La cocina a su vez le pide al sommelier (AI Gateway de Lovable) que recomiende una categoría. Cuando el sommelier tarda demasiado, **toda la mesa se desespera y se va antes de que llegue el platillo** — eso es el `Failed to fetch` del browser.

Evidencia técnica:
1. En el evento más reciente (13.114.2) ya está activo `fetchWithRetry` con 3 intentos × 60 s de timeout. Aún así falla → no es timeout del cliente, es **el edge function el que cierra la conexión** (cold start + AI gateway lento + CPU wall-limit de Supabase).
2. Los logs de `parse-cfdi-xml` muestran **boot en `2026-06-23T00:43:19Z`**, exactamente cuando falló el request — confirma cold start.
3. `parse-cfdi-xml` **NO está envuelto en `wrapEdgeHandler`** → los crashes del lado servidor son invisibles en Sentry, sólo vemos el síntoma del browser.

## Solución propuesta

### 1. Visibilidad: envolver `parse-cfdi-xml` con `wrapEdgeHandler`

Agregar a `CRITICAL` en `src/__tests__/architecture/sentry-edge-wrapping.test.ts` y refactorizar `supabase/functions/parse-cfdi-xml/index.ts` para usar `Deno.serve(wrapEdgeHandler("parse-cfdi-xml", handler))` (mismo patrón que `facturapi-emitir`). Así, la próxima vez que el edge function crashee, veremos el stack real en Sentry server-side, no sólo el "Failed to fetch" del browser.

### 2. Resiliencia: bajar el riesgo del AI Gateway colgado

En `supabase/functions/parse-cfdi-xml/index.ts`:
- Reducir el timeout del fetch al AI gateway de **8 s → 5 s** (línea 71). El AI es opcional — si tarda, devolvemos `fallbackResult` y seguimos. Mejor responder en 6 s sin sugerencia de categoría que colgar 11 s y morir.
- Garantizar que `errorResponse` siempre incluya headers CORS (ya lo hace via `buildCors`, pero validar que `handlePreflightStrict` no rechace silenciosamente).

### 3. Cliente: breadcrumb con `outcome` del retry

En `src/features/cxp/services/parseCfdi.ts`, ya se reportan retries vía `onRetry`. Añadir un breadcrumb final con `attempt_count` cuando el último intento falla, para distinguir "falló al primer intento" vs "fallaron los 3" en Sentry.

### 4. Bump versión + changelog

- `APP_VERSION` → `13.114.5`
- `CHANGELOG.md`: entrada `[13.114.5] - 2026-06-23` con `fix(cfdi): reducir timeout AI gateway y envolver edge function en wrapEdgeHandler para visibilidad Sentry`.

### 5. Resolver los issues en Sentry

Marcar `JAVASCRIPT-REACT-1B` y `JAVASCRIPT-REACT-19` como `resolvedInNextRelease` apuntando a `libre-carga@13.114.5` (vía `update_issue`).

## Verificación

- `bunx vitest run src/__tests__/architecture/sentry-edge-wrapping.test.ts` debe pasar con `parse-cfdi-xml` en la lista CRITICAL.
- `bunx vitest run supabase/functions/parse-cfdi-xml/index_test.ts` (si existe) o ejecutar el deno test si está.

## Detalles técnicos (referencia)

| Archivo | Cambio |
|---|---|
| `supabase/functions/parse-cfdi-xml/index.ts` | Reemplazar `serve(async (req) => {...})` por `Deno.serve(wrapEdgeHandler("parse-cfdi-xml", handler))`. Bajar AbortController timeout 8000 → 5000. |
| `src/__tests__/architecture/sentry-edge-wrapping.test.ts` | Agregar `"supabase/functions/parse-cfdi-xml/index.ts"` al array `CRITICAL`. |
| `src/features/cxp/services/parseCfdi.ts` | En el `catch` del callEdgeFunction, agregar breadcrumb `parse_cfdi_xml.exhausted` con `attempt_count`. |
| `src/constants/appVersion.ts` | `APP_VERSION = "13.114.5"`. |
| `CHANGELOG.md` | Nueva entrada `[13.114.5]`. |
