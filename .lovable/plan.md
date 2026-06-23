## Problema

El modal "Nueva factura de proveedor" lanza `Failed to fetch` al subir XML. El edge function `parse-cfdi-xml` nunca se ejecuta (no hay logs en la hora del error). Causas probables, en orden:

1. **Falta el header `apikey`** en el `fetch` directo desde `src/features/cxp/services/parseCfdi.ts`. El gateway de Supabase Edge Functions exige `apikey` además de `Authorization`; sin él el request puede rechazarse antes de llegar al handler.
2. **Llamada al AI Gateway en el camino crítico**. Cuando el modelo se cuelga (timeout de 5–8 s) sumado al cold-start, el browser tira "Failed to fetch". Ya tenemos `fallbackResult`, pero hoy la llamada se *espera* aunque el resultado sea opcional.
3. **Diagnóstico ciego**: hoy sólo sabemos `lastStatus: null`. No distinguimos preflight CORS vs POST vs DNS.

## Plan

### 1. Reemplazar `fetch` crudo por `supabase.functions.invoke`
- En `src/features/cxp/services/parseCfdi.ts`, sustituir el `fetchWithRetry` directo por `supabase.functions.invoke('parse-cfdi-xml', { body: formData })`.
- El cliente Supabase inyecta `apikey` + `Authorization` automáticamente, maneja CORS y devuelve `{ data, error }` con campos diagnósticos.
- Conservar la lógica de reintentos envolviéndola alrededor de `invoke` (3 intentos, backoff 1s/3s).
- Conservar `CfdiUploadError` y su `context`, agregando dos campos: `phase` (`"preflight" | "request" | "response"`) y `errorName` (e.g. `"FunctionsFetchError"`).

### 2. Hacer la sugerencia de IA no bloqueante
En `supabase/functions/parse-cfdi-xml/index.ts`:
- Bajar el timeout AI de 5s a **2s** (es opcional, ya hay `fallbackResult`).
- Si el AI tarda más, devolver inmediatamente el CFDI parseado con `ai.categoria_id = null` y `ai.notas = primer concepto`.
- Resultado: la respuesta nunca tarda más de ~3s aún con cold-start + AI muerto.

### 3. Mejorar el toast con la fase de la falla
En `src/features/cxp/components/CargaCfdiSection.tsx` (o el hook `useCargaCfdi`):
- Mostrar mensajes distintos según `error.context.phase`:
  - `preflight` → "El navegador bloqueó la conexión (revisa extensiones/red corporativa)"
  - `request` → "No se pudo contactar el servidor (revisa internet)"
  - `response` → "El servidor respondió con error HTTP {status}"
- Botón "Copiar diagnóstico" que incluye `phase`, `errorName`, `attemptCount`, `latencyMs`, `online`, `lastStatus`.

### 4. Verificación
- `bunx vitest run src/features/cxp` para asegurar que los tests pasan.
- Probar el modal en `/cxp` con un XML real y revisar `edge_function_logs` confirmando invocación.
- Bump `APP_VERSION` a `13.114.11`, entrada nueva en `CHANGELOG.md`.

## Detalles técnicos

```text
ANTES                                    DESPUÉS
─────────────────────────────────        ─────────────────────────────────
fetch(URL, {                             supabase.functions.invoke(
  headers: { Authorization }                'parse-cfdi-xml',
  body: formData                            { body: formData }
})                                       )
  ↓                                        ↓
gateway puede rechazar                   apikey + auth + CORS automáticos
sin apikey → "Failed to fetch"           errores tipados con status/body
```

```text
AI flow:
  ANTES: await sugerirCategoria (5s timeout) → bloquea respuesta
  DESPUÉS: Promise.race([sugerirCategoria, sleep(2000)]) → siempre <2s
```

## Analogía

Hoy el modal es como mandar un paquete por mensajería sin la guía del cliente (`apikey`): a veces pasa, a veces lo regresan en la puerta sin explicación. El plan es (1) poner siempre la guía completa, (2) no esperar al sello opcional del notario (la IA) si tarda, y (3) si algo falla, anotar en qué punto del recorrido se cayó.