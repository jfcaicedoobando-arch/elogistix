## Objetivo

Resolver el caso donde Terminal49 ya creó el shipment en su sistema pero nuestro `tracking_request` sigue en `pending` sin `tracked_object`, y el fallback simple por BL devuelve vacío (probablemente porque el BL en el shipment no incluye el prefijo SCAC).

## Cambios

### 1. Edge function `terminal49-sync` — variantes automáticas de búsqueda

Cuando `tracked_object` es `null`, intentar en orden hasta encontrar un shipment:

```text
1. GET /v2/shipments?filter[bill_of_lading_number]={BL_completo}      (ej. ZIMUSHH32085770)
2. GET /v2/shipments?filter[bill_of_lading_number]={BL_sin_SCAC}      (ej. SHH32085770)
3. GET /v2/shipments?filter[number]={BL_completo}
4. GET /v2/shipments?filter[number]={BL_sin_SCAC}
```

- Detección "sin SCAC": si `request_number` empieza con `scac` (4 letras), quitar ese prefijo.
- Loggear cada intento (URL + count) para diagnóstico.
- El primero con `data[0].id` gana → se usa como `trackedObjectId`.
- Respuesta del endpoint: agregar `fallback_intentos` (array de `{url, count}`) para visibilidad.

### 2. Vínculo manual por shipment ID

**a) Edge function nueva `terminal49-link-shipment`**
- Body: `{ embarque_id: uuid, shipment_id: string }`
- Valida JWT + que el embarque pertenece a la org del usuario.
- Hace `GET /v2/shipments/{shipment_id}?include=containers,...` para confirmar que existe.
- Actualiza `tracking_externo.shipment_id` y dispara la misma lógica de inserción de eventos/ETA/estado que `sync`.
- Registra un `tracking_intento` con `accion='link_manual'`.

**b) UI en `TerminalAutomaticoCard`**
- Botón secundario **"Vincular shipment manualmente"** visible solo cuando `status='pending'` y `shipment_id` es `null`.
- Abre un `Dialog` con:
  - Input para pegar el shipment ID (UUID).
  - Texto de ayuda: *"Cópialo de la URL de Terminal49: app.terminal49.com/shipments/**[ESTE-ID]**"*.
  - Botón **Vincular** que llama a la nueva edge function.
- Al éxito: toast + invalida queries de tracking y eventos del embarque.

### 3. Hook + servicio

- `src/services/tracking/terminal49.ts`: agregar `linkShipmentManual(embarqueId, shipmentId)`.
- `src/hooks/embarque/useTrackingTerminal49.ts`: agregar mutation `useLinkShipmentManual` con invalidación de `tracking_externo`, `eventos_embarque` y `tracking_intentos`.

### 4. Changelog y versión

- Bump a **8.131.2** (patch).
- Entrada en `src/content/changelog/v8/chunks/0.ts` describiendo: variantes automáticas de BL, vínculo manual por shipment ID, nuevo botón en UI, edge function `terminal49-link-shipment`.
- Actualizar `src/constants/appVersion.ts`.

## Detalles técnicos

- No se requieren migraciones de DB: `tracking_externo.shipment_id` ya existe; `tracking_intentos` ya soporta acciones libres.
- La nueva edge function reusa el mismo patrón de auth/CORS de las dos existentes.
- El campo manual no reemplaza el flujo automático: el operador lo usa solo cuando todas las variantes fallan.
- En `supabase/config.toml` no se requieren bloques nuevos (sigue el default).

## Archivos afectados

```text
supabase/functions/terminal49-sync/index.ts            (variantes BL)
supabase/functions/terminal49-link-shipment/index.ts   (NUEVO)
src/services/tracking/terminal49.ts                    (linkShipmentManual)
src/hooks/embarque/useTrackingTerminal49.ts            (useLinkShipmentManual)
src/components/embarque/TerminalAutomaticoCard.tsx     (botón + dialog)
src/constants/appVersion.ts                            (8.131.2)
src/content/changelog/v8/chunks/0.ts                   (entrada nueva)
```
