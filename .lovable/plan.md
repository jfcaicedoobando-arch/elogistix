## Resumen de hallazgos


| Issue                 | Mensaje                                                                   | Diagnóstico                                                                                                                                                                                                                                                                                                              | Acción                                            |
| --------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `JAVASCRIPT-REACT-1R` | `column "user_id" of relation "bitacora_actividad" does not exist`        | Ya resuelto en BD por el parche `13.141.7`. Las 2 funciones que la búsqueda destacó (`portal_responder_cotizacion`, `solicitar_reaprobacion_tarifa`) usan los nombres correctos — sólo tienen la palabra "entidad_tipo" en un literal. El evento de hace 15 min vino de un tab en caché con la versión vieja `13.141.5`. | Marcar **resolved** en Sentry y dejar comentario. |
| `JAVASCRIPT-REACT-1S` | `Failed to send a request to the Edge Function` (test conexión FacturApi) | La edge function `facturapi-test-conexion` se quedó colgada (logs sólo muestran `booted`). Sospechoso: cold-start del SDK `npm:facturapi@5` corriendo en Deno + llamada `client.organizations.retrieve()` sin timeout.                                                                                                   | Fix en código + verificar.                        |


## Cambios

### 1. `supabase/functions/facturapi-test-conexion/index.ts`

Reemplazar la llamada al SDK por un `fetch` directo (sólo en esta función, las demás siguen usando el SDK porque ahí el cold-start ya está amortizado):

- Importar sólo `resolveFacturapiKey` (sin `getFacturapiClient`, que carga el SDK).
- Construir `Authorization: Basic base64(apiKey + ":")`.
- Hacer `fetch("https://www.facturapi.io/v2/organizations/" + facturapiOrgId)` con `signal: AbortSignal.timeout(12000)`. Si no hay `facturapiOrgId` previo, usar `fetch("https://www.facturapi.io/v2/organizations")` y tomar `data[0]`.
- Loggear con `console.log` los pasos (`auth-ok`, `key-resolved`, `fetch-start`, `fetch-status:<n>`) para que si vuelve a fallar sepamos dónde se quedó.
- Mapear errores: `AbortError` → `{ ok:false, status:504, detail:"facturapi_timeout" }`; HTTP no-2xx → `{ ok:false, status, detail }`.

### 2. `src/features/configuracion/services/facturapiCredenciales.ts`

En `probarFacturapiConexion`: si `supabase.functions.invoke` devuelve `error`, traducir el mensaje a español ("Tiempo de espera agotado al contactar FacturApi" / "No fue posible conectar con la función. Intenta nuevamente.") en vez del crudo `Failed to send a request to the Edge Function`.

### 3. Sentry

- Marcar `JAVASCRIPT-REACT-1R` como **resolved** con razón: "Schema mismatch arreglado en migration 20260630172919; eventos posteriores provienen de tabs cacheados con release 13.141.5."
- `JAVASCRIPT-REACT-1S` quedará auto-resuelto por el commit (`Fixes JAVASCRIPT-REACT-1S`).

### 4. CHANGELOG.md + APP_VERSION

- Bump patch (`13.141.5` → `13.141.6` o el siguiente disponible) con entrada: "Fix: probar conexión FacturApi usa `fetch` directo con timeout para evitar cold-start del SDK npm."

## Validación

1. Tras el deploy automático, llamar `supabase--curl_edge_functions` a `/facturapi-test-conexion` con sandbox y live; debe responder < 3 s con `{ ok: true, nombre, facturapi_org_id }`.
2. Revisar `supabase--edge_function_logs facturapi-test-conexion` y ver el rastro `auth-ok → key-resolved → fetch-start → fetch-status:200`.

## Fuera de alcance

- No toco `_shared/facturapiClient.ts` ni las funciones que timbran/cancelan/emiten REP; ahí el SDK ya funciona y un cambio masivo arriesgaría regresiones fiscales.

No quiero dejar de usar el SDK, existe otro fix? Que dice la documentacion de facturapi?