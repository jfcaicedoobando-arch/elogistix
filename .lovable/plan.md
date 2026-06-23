## Problema

El reporte que te llegó tiene `errorDetails: {}` vacío y `errorCode: "UNKNOWN"`, así que no se puede saber:
- Si fue red caída del usuario, edge function caída, CORS, o timeout.
- En qué intento murió (1ª, 2ª, 3ª) ni después de cuánto tiempo.
- Si el navegador reportaba `online: false` en ese momento.

Causa: en `CargaCfdiSection.tsx` línea 71 (rama `_4`), `notifyError` recibe sólo `{ title: msg, method }`. **No se pasa `error: e` ni `context`**, así que `extractErrorDetails` regresa `{}` y `deriveErrorCode` no puede inferir nada del `TypeError`.

## Cambios

**1) `src/features/cxp/services/parseCfdi.ts`**
- Capturar `attemptCount`, `latencyMs`, `navigator.onLine` y, si hubo respuesta HTTP fallida, `lastStatus`.
- Cuando `callEdgeFunction` falla, envolver el error original en una nueva clase `CfdiUploadError extends Error` que:
  - Preserva el error original como `cause` (así no se pierde el `TypeError: Failed to fetch`).
  - Expone `context` con `{ attemptCount, latencyMs, online, xmlSize, lastStatus? }`.
  - Mensaje legible: `"No se pudo procesar el CFDI (3 intentos · 8.4s · offline): Failed to fetch"`.

**2) `src/features/cxp/components/CargaCfdiSection.tsx`** (rama `_4`)
- Pasar `error: e` y `context: (e as CfdiUploadError).context ?? {...mínimo}` a `notifyError`.
- Incluir siempre como contexto mínimo: `{ xmlName, xmlSize, online: navigator.onLine }` aun para errores no envueltos.

**3) `src/components/shared/utils/errorDetailsExtract.ts`**
- Cuando el error tiene `cause` (Error o objeto), agregar `errorDetails.cause = { name, message, code, status }` sin recursión profunda (1 nivel basta — es el caso 99%). Así el reporte muestra el `TypeError` interno aunque venga envuelto.
- Si la cadena `cause` es un `TypeError` con `/fetch|network/i`, `deriveErrorCode` también debe poder derivar `NETWORK_ERROR` mirando el cause (no sólo el error superior).

**4) Versionado**
- `APP_VERSION` → `13.114.9`
- `CHANGELOG.md`: una entrada describiendo qué se gana en el reporte y por qué.

## Resultado esperado en el próximo reporte

```json
{
  "errorCode": "NETWORK_ERROR",
  "title": "No se pudo procesar el CFDI (3 intentos · 12.3s · online): Failed to fetch",
  "errorDetails": {
    "name": "CfdiUploadError",
    "message": "...",
    "cause": { "name": "TypeError", "message": "Failed to fetch" }
  },
  "context": {
    "attemptCount": 3,
    "latencyMs": 12340,
    "online": true,
    "xmlName": "factura-foo.xml",
    "xmlSize": 8421,
    "lastStatus": null
  }
}
```

## Verificación

- Tests existentes: `parseCfdi.test.ts`, `errorDetailsExtract.test.ts`, `appFeedback.test.ts`, `sentry-edge-wrapping.test.ts`.
- Agregar/ajustar caso en `errorDetailsExtract.test.ts`: verificar que `cause` se serializa y que `deriveErrorCode` mira el `cause` para `NETWORK_ERROR`.
- Agregar caso en `parseCfdi.test.ts`: que ante `TypeError: Failed to fetch` se lance `CfdiUploadError` con `context.attemptCount === 3` y `cause.name === "TypeError"`.

## Analogía

Hoy cuando el sistema marca error es como una llamada al 911 que sólo dice "algo pasó". Después de este cambio, la misma llamada dirá "intenté llegar 3 veces durante 12 segundos, tenía internet, el archivo pesaba 8KB y la respuesta final fue 'no pude conectar'." Con eso ya puedes saber si culpas a la red del usuario, al edge function o al CORS.
