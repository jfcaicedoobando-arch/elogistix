## Integración Terminal49 — Sincronización automática de tracking marítimo

### Resumen de la API (de la documentación oficial)

Terminal49 es una API **event-driven** especializada en tracking de carga marítima:

- **Auth**: Bearer token simple → header `Authorization: Token TU_API_KEY`
- **Base URL**: `https://api.terminal49.com/v2`
- **Formato**: JSON:API (`Content-Type: application/vnd.api+json`)
- **Identificadores soportados**: Master BL (recomendado), Booking number, o Container number + SCAC del carrier (4 letras: MAEU, MSCU, CMDU, etc.). Hay endpoint `auto-detect-carrier` si no conocemos el SCAC.
- **Flujo recomendado**:
  1. `POST /tracking_requests` con BL/Booking + SCAC → respuesta inmediata `pending`.
  2. Terminal49 valida con la naviera y emite eventos: `tracking_request.succeeded` / `failed` → al confirmarse crea un **Shipment** con sus **Containers**.
  3. Cada cambio (ETA, milestones, LFD, holds, terminal availability, descarga, vacío) dispara un webhook.
- **Catálogo de eventos** (>30): `shipment.created`, `shipment.estimated.arrival.changed`, `container.transport.vessel_loaded`, `container.transport.vessel_departed`, `container.transport.vessel_arrived`, `container.transport.discharged`, `container.transport.full_out`, `container.transport.empty_in`, `container.updated` (LFD, holds), etc.
- **Polling desaconsejado**: consume rate limit (100 req/min) y pierde el contexto del campo cambiado. Webhooks son la vía oficial.
- **Pricing**: típicamente por shipment activo. La key de prueba usualmente da créditos limitados — perfecto para validación.

### Mapeo a nuestro modelo

Ya tenemos:

- `embarques` con `bl_master`, `bl_house`, `naviera`, `contenedor`, `etd`, `eta`, `fecha_llegada_real`, `estado`.
- `eventos_embarque` (timeline con `tipo`, `descripcion`, `ubicacion`, `fecha`) — calza 1:1 con milestones de Terminal49.
- Modo `Marítimo` ya existe en el wizard.

Lo que falta:

- Vincular cada embarque marítimo con un `tracking_request_id` y `shipment_id` de Terminal49.
- Guardar SCAC normalizado de la naviera.
- Recibir webhooks y actualizar `embarques.eta`, `fecha_llegada_real`, `estado` + insertar en `eventos_embarque` automáticamente.
- UI para forzar alta manual / re-sync / ver estado del tracking.

### Plan de implementación (3 fases)

#### Fase 1 — Infraestructura backend

1. **Secret**: registrar `TERMINAL49_API_KEY` y `TERMINAL49_WEBHOOK_SECRET` (este último lo elegimos nosotros para validar firma HMAC del webhook).
2. **Migración**:
  - Nueva tabla `tracking_externo` (1:1 con embarque): `embarque_id`, `provider` ('terminal49'), `tracking_request_id`, `shipment_id`, `request_number`, `request_type` (bol/booking/container), `scac`, `status` (pending/created/succeeded/failed/tracking/inactive), `failed_reason`, `last_event_at`, `raw_payload jsonb`. RLS por `organization_id`.
  - Nueva tabla `tracking_webhook_log` (auditoría): `event_type`, `payload jsonb`, `processed boolean`, `error`, `received_at`. RLS sólo super_admin.
  - Agregar columna `naviera_scac` a tabla `navieras` (catálogo) si no existe, para mapear naviera elegida → SCAC.
3. **Edge function `terminal49-create-tracking**` (verify_jwt = true, auth interna):
  - Input: `{ embarque_id }`. Lee BL/SCAC del embarque, llama `POST /tracking_requests`, persiste resultado en `tracking_externo`.
  - Maneja 422 "duplicate" reusando el tracking existente (`GET /tracking_requests?filter[number]=...`).
4. **Edge function `terminal49-webhook**` (verify_jwt = false, pública):
  - Valida firma del webhook (Terminal49 firma con HMAC-SHA256).
  - Persiste payload en `tracking_webhook_log`.
  - Despacha por `event` type: actualiza `embarques.eta`, `fecha_llegada_real`, `estado`, e inserta en `eventos_embarque`.
  - Devuelve 2xx siempre que se haya guardado (idempotente por `event.id`).
5. **Edge function `terminal49-sync**` (manual):
  - Re-fetch del shipment y containers para refrescar todo (`GET /shipments/{id}?include=containers,transport_events`).

#### Fase 2 — Integración en el flujo de embarque

1. **Trigger automático**: al crear/editar un embarque marítimo con BL Master + naviera con SCAC válido, mostrar toggle "Activar tracking automático con Terminal49". Al activarlo invoca `terminal49-create-tracking`.
2. **UI en `EmbarqueDetalle.tsx**`:
  - Tarjeta "Tracking automático" con: estado actual del tracking, último evento sincronizado, botones **Re-sync ahora**, **Pausar**, **Eliminar**.
  - Indicar fuente de cada evento en el timeline (badge "Terminal49" vs "Manual").
3. **Listado de embarques**: badge sutil cuando el embarque tiene tracking automático activo.
4. **Configuración global**: toggle "Activar Terminal49 por defecto en embarques marítimos" + campo para registrar la URL del webhook (auto-generada).

#### Fase 3 — Robustez y QA

1. **Test con números de prueba** (Terminal49 ofrece test tracking numbers documentados).
2. **Reintentos**: webhook idempotente por `event.id`; si falla un update marcamos `processed=false` y mostramos en `Auditoría`.
3. **Bitácora**: cada alta/baja/sync queda en la bitácora de actividad.
4. **Changelog + bump de versión**.

### Detalles técnicos

```text
[Wizard Embarque] --crea/edita-→ [embarques]
                                     │
                          (BL+SCAC) ─┴→ POST tracking_requests
                                                   │
                       Terminal49 ──webhook──→ [edge:terminal49-webhook]
                                                   │
                                        ┌──────────┴──────────┐
                                  upsert eventos_embarque   update embarques (eta/estado)
```

**Endpoint del webhook a registrar en el dashboard de Terminal49**:
`https://eorqadkulqtneqjbsblk.supabase.co/functions/v1/terminal49-webhook`

**Eventos a suscribir inicialmente** (para no saturar):

- `tracking_request.succeeded`, `tracking_request.failed`
- `shipment.estimated.arrival.changed`
- `container.transport.vessel_departed`
- `container.transport.vessel_arrived`
- `container.transport.discharged`
- `container.transport.full_out` (recogido por cliente / transportista)
- `container.updated` (para LFD y holds)

**Mapeo de eventos → `eventos_embarque.tipo**` (usaremos los valores ya existentes del enum `tipo_evento_tracking`; si falta alguno lo agregamos en migración separada).

### Confirmaciones antes de codificar

Antes de arrancar la Fase 1 quiero confirmar contigo:

1. ¿Activamos tracking **siempre** en embarques marítimos con BL Master + SCAC, o **opt-in** manual desde el detalle?  Opt-in
2. ¿Quieres que los webhooks sobrescriban `eta`/`estado` del embarque, o sólo agreguen al timeline y dejen los campos principales bajo control manual? Si
3. ¿Limitamos a Marítimo, o también probamos los pocos carriers aéreos que Terminal49 soporta (muy pocos)? Recomendación: sólo marítimo en v1. Solo Maritimo

Con tus respuestas avanzo con la migración + edge functions + UI.