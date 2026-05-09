# Mejoras de compatibilidad con Terminal49

Aplicar las 2 mejoras detectadas en la verificación contra la API v2 de Terminal49.

## 1. `terminal49-delete-tracking`: liberar el tracking en Terminal49

Hoy solo borra la fila local. Vamos a llamar también `DELETE /v2/tracking_requests/{tracking_request_id}` para liberar el tracking en T49 y evitar consumo innecesario.

- Antes de borrar la fila local, leer `tracking_request_id` y `scac` de `tracking_externo`.
- Si existe `tracking_request_id`, hacer `DELETE` a Terminal49 con el header `Authorization: Token <TERMINAL49_API_KEY>`.
- Tolerar 404 (ya no existe en T49) como éxito.
- Si T49 responde con error distinto a 404, registrar el error en `tracking_intentos` pero **continuar** con el borrado local (el usuario ya pidió desactivar).
- Registrar el resultado del DELETE remoto en `tracking_intentos` (acción `delete`, campo `mensaje` y `http_status`).

## 2. `terminal49-webhook`: handlers explícitos para eventos de ciclo de vida

Hoy el `mapEventTypeToEnum` cubre los eventos de transporte por substring. Vamos a añadir handlers específicos para los 3 eventos que afectan estado del embarque:

- **`tracking_request.succeeded`** → actualizar `tracking_externo.status = 'succeeded'`, limpiar `failed_reason`.
- **`tracking_request.failed`** → actualizar `tracking_externo.status = 'failed'` y guardar `attributes.failed_reason` en `failed_reason`.
- **`shipment.estimated.arrival`** (cambio de ETA) → actualizar `embarques.eta` con `attributes.pod_eta_at` (o el campo que venga en el payload).

Estos handlers son adicionales: el flujo actual de inserción en `eventos_embarque` para eventos de transporte (`vessel_loaded`, `vessel_departed`, etc.) sigue funcionando igual.

Además: si el evento es `tracking_request.*` y el payload trae `relationships.tracking_request.data.id`, usar ese ID para localizar la fila (ya lo hace, solo verificar).

## 3. Changelog y versión

- Bump de versión patch en `src/constants/appVersion.ts` a `8.131.2`.
- Nueva entrada al inicio de `src/content/changelog/v8/chunks/0.ts` describiendo: "Compatibilidad Terminal49: liberación remota al desactivar tracking + actualización de ETA y estado vía webhooks".

## Archivos a modificar

- `supabase/functions/terminal49-delete-tracking/index.ts`
- `supabase/functions/terminal49-webhook/index.ts`
- `src/constants/appVersion.ts`
- `src/content/changelog/v8/chunks/0.ts`

## Sin cambios en

- Esquema de base de datos (no requiere migración).
- UI (`TabTracking.tsx`, `TerminalAutomaticoCard.tsx`, hooks).
- `terminal49-create-tracking` ni `terminal49-sync` (ya compatibles).
