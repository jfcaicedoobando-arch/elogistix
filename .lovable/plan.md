## Integración JSONCargo — Tracking automático de contenedores

Endpoint a usar: **Endpoint 1 — Get Container Details** (`GET /api/v1/containers/{tracking_number}?shipping_line={NAME}`, header `x-api-key`).

Navieras compatibles: MAERSK, HAPAG_LLOYD, HMM, ONE, EVERGREEN, MSC, CMA_CGM, COSCO, ZIM, YANG_MING, PIL.

---

### 1. Backend (Lovable Cloud)

**Secret**: `JSONCARGO_API_KEY` (se solicita al inicio).

**Tabla existente reutilizada**: `tracking_externo` (ya tiene `provider`, `raw_payload`, `last_synced_at`, `last_event_at`, RLS por org y portal cliente).
- Nuevo `provider = 'jsoncargo'`. Sin migración de esquema, solo nuevo valor.

**Migración mínima** — agregar tabla `tracking_navieras_supportadas` no es necesario; usaremos una constante TS con el mapeo `naviera (texto libre del embarque) → shipping_line API name`. Si la naviera del embarque no mapea, se omite el call y se marca un mensaje "naviera no soportada".

**Edge function `jsoncargo-track`** (verify_jwt = false, valida JWT en código; admin/operador requeridos):
- Input: `{ embarqueId: string }`
- Lee `embarques` (contenedor, naviera, organization_id, modo='Marítimo').
- Mapea naviera → shipping line code. Si no mapea → 422 con mensaje claro.
- Llama `https://api.jsoncargo.com/api/v1/containers/{contenedor}?shipping_line={code}` con `x-api-key`.
- Upsert en `tracking_externo` (unique por embarque_id+provider): guarda `raw_payload`, `status='ok'|'failed'`, `last_synced_at=now()`, `last_event_at = data.last_movement_timestamp`, `request_number=contenedor`, `request_type='container'`, `scac=code`.
- Sincroniza `eventos_embarque`: para cada milestone con timestamp (atd_origin, atd_last_location, eta_next_destination, customs_clearance, last_movement_timestamp), inserta evento si no existe ya uno con misma fecha+tipo (idempotente). Tipos mapeados a `tipo_evento_tracking` enum.
- Si `eta_final_destination` ≠ `embarques.eta`, actualiza `embarques.eta` y deja un evento "ETA actualizada por tracking".
- Devuelve `{ ok, summary: { last_location, current_vessel, eta_final_destination, last_updated, eventos_creados } }`.

**Edge function `jsoncargo-track-batch`** (cron, sin JWT, autenticada por header secreto):
- Recorre embarques con `modo='Marítimo'`, `estado NOT IN ('Cerrado','Entregado')`, `contenedor IS NOT NULL`, naviera mapeable.
- Llama internamente la lógica de `jsoncargo-track` por embarque, con backoff entre llamadas para no rebasar rate limit.
- Logs por embarque a `bitacora_actividad`.

**Cron**: `pg_cron` diario 06:00 UTC con `net.http_post` al edge function `jsoncargo-track-batch` (insert directo, no migración pública — incluye anon key).

---

### 2. Frontend

**`src/lib/jsoncargo/navieras.ts`** (nuevo) — `mapNavieraToJsonCargo(naviera: string | null): string | null` con fuzzy match.

**`src/hooks/embarque/useJsonCargoTracking.ts`** (nuevo):
- `useJsonCargoStatus(embarqueId)` → query `tracking_externo` filtrado por provider='jsoncargo'.
- `useSyncJsonCargo()` → mutation que llama edge function y refresca cache de `tracking_externo` + `eventos_embarque` + `embarques`.

**`src/components/embarque/TabTracking.tsx`** (editar):
- Card nueva en la parte superior "Tracking en vivo (JSONCargo)" con:
  - Si naviera no soportada → aviso gris.
  - Si no hay sync previo → botón "Sincronizar ahora".
  - Si hay sync → panel con: estado contenedor, last_location, current_vessel + voyage, ETA destino final, last_updated, botón "Actualizar".
- El timeline existente se conserva; los eventos auto-generados se identifican con badge "Auto" (usuario = `jsoncargo`).

**`src/pages/portal/PortalEmbarqueDetalle.tsx`** (editar):
- Misma card en modo solo lectura (sin botón sincronizar). RLS de `tracking_externo` ya permite cliente leer.

**Auto-trigger al crear/editar embarque marítimo**:
- En `useUpdateEmbarque` y el flujo de creación, después de guardar, si `modo='Marítimo'` + `contenedor` + naviera mapeable, dispara `supabase.functions.invoke('jsoncargo-track', { body: { embarqueId } })` en background (sin await bloqueante, errores silenciados pero logueados).

---

### 3. Cambios en archivos

```text
NUEVOS
  supabase/functions/jsoncargo-track/index.ts
  supabase/functions/jsoncargo-track-batch/index.ts
  src/lib/jsoncargo/navieras.ts
  src/lib/jsoncargo/eventMapping.ts        (data → tipo_evento_tracking[])
  src/hooks/embarque/useJsonCargoTracking.ts
  src/components/embarque/TrackingLiveCard.tsx

EDITADOS
  src/components/embarque/TabTracking.tsx        (insertar TrackingLiveCard)
  src/pages/portal/PortalEmbarqueDetalle.tsx     (insertar TrackingLiveCard read-only)
  src/hooks/embarque/mutations/useUpdateEmbarque.ts (auto-invoke)
  src/pages/embarques/NuevoEmbarque.tsx          (auto-invoke al final del wizard)
  src/lib/query/index.ts                         (queryKey trackingExterno)
  src/constants/appVersion.ts                    (8.130.0 — minor)
  src/content/changelog/v8/chunks/0.ts
  src/content/changelogData.ts

INSERT (no migración):
  pg_cron schedule diario → jsoncargo-track-batch
```

---

### 4. Notas técnicas

- **Idempotencia de eventos**: clave compuesta lógica `(embarque_id, tipo, fecha truncada al minuto)` para evitar duplicados al sincronizar repetidamente.
- **Rate limit**: 1 call por embarque por sync; el batch espera 250ms entre llamadas. Mensajes claros si JSONCargo devuelve 429.
- **Multi-tenant**: el edge function valida que el JWT del usuario tenga rol admin/operador y que el embarque pertenezca a su org (vía RLS al leerlo con cliente con-token).
- **Costo**: cada sync cuenta 1 API call. La auto-sincronización al editar puede dispararse muchas veces; se agrega un throttle de 10 minutos por embarque (consultando `last_synced_at`).
- **Errores**: 404 (contenedor no encontrado) → `status='failed'`, `failed_reason` con título del error. Se muestra en la card sin spammear toasts.
- **Naviera unsupported**: card explica al usuario y sugiere navieras compatibles.

---

### 5. Pasos de ejecución

1. Solicitar `JSONCARGO_API_KEY` (secret).
2. Crear edge functions y librerías frontend.
3. Insertar cron job (pg_cron + pg_net) por separado (no migración).
4. Bump versión a `8.130.0` y entrada de changelog.
5. Probar manualmente en `/embarques/{id}` con un contenedor MSC/Maersk real.
