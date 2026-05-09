## Problema

Cuando el usuario presiona "Sincronizar ahora", la respuesta es `Sin cambios` y no se genera información. Esto **no es un bug**: el `tracking_request` en Terminal49 está en estado `created` y aún no tiene un `shipment` vinculado (la naviera ZIM todavía no ha respondido con los datos del BL `ZIMUSHH32085770`).

El usuario no tiene forma de ver esto en la UI — solo ve "Sin cambios" y asume que algo está roto.

## Objetivo

Hacer visible el ciclo de vida del tracking request y dar feedback claro de qué está pasando con la naviera, sin cambiar la lógica de sincronización.

## Cambios propuestos

### 1. Panel de estado en `TabTracking.tsx`

Mostrar una tarjeta con:
- **Estado del tracking request** con badge de color:
  - `pending` / `created` → amarillo · "Esperando respuesta de la naviera"
  - `tracking` → azul · "Naviera respondió, recibiendo eventos"
  - `succeeded` → verde · "Sincronizado correctamente"
  - `failed` → rojo · mostrar `failed_reason`
- **Última sincronización** (`last_synced_at` formateado en es-MX).
- **Shipment vinculado**: ✓ si `shipment_id` existe, ✗ con texto "La naviera aún no ha respondido" si es null.
- **Tracking Request ID** (copiable, útil para soporte de Terminal49).
- **SCAC + BL** que se enviaron.

### 2. Mensaje contextual en el botón "Sincronizar ahora"

Cuando la respuesta del sync sea `eventos_nuevos: 0` y el `status` siga en `created`/`pending`, en lugar de un toast genérico "Sin cambios", mostrar:

> "La naviera aún no ha publicado información para este BL. Terminal49 reintentará automáticamente. Esto puede tardar de minutos a 24-48h dependiendo de la naviera."

### 3. Mejora en `terminal49-sync` (edge function)

Devolver más detalle en la respuesta:
```json
{
  "ok": true,
  "status": "created",
  "shipment_id": null,
  "is_retrying": true,
  "retry_count": 3,
  "failed_reason": null,
  "containers": 0,
  "eventos_nuevos": 0
}
```

Esto permite al frontend mostrar "Terminal49 reintentando (intento 3)" cuando aplica.

### 4. Auto-refresh suave

Cuando el `status` esté en `pending` o `created`, hacer que el query de `tracking_externo` haga `refetchInterval: 60_000` (cada minuto) — solo mientras la pestaña Tracking esté abierta. Cuando llegue a `tracking` o `succeeded`, detener el polling.

Esto, combinado con el webhook que ya está configurado, garantiza que el usuario vea actualizaciones casi en tiempo real sin presionar nada.

### 5. (Opcional) Botón "Verificar en Terminal49"

Un link directo al request en Terminal49: `https://app.terminal49.com/tracking_requests/{tracking_request_id}` para que el usuario pueda revisar el estado original ahí mismo si quiere.

## Archivos a tocar

- `src/components/embarque/TabTracking.tsx` — panel de estado + mensaje contextual
- `src/hooks/embarque/useTrackingTerminal49.ts` — `refetchInterval` condicional
- `supabase/functions/terminal49-sync/index.ts` — devolver más campos de diagnóstico
- `src/pages/Changelog.tsx` — entrada nueva

## Lo que NO se cambia

- La lógica de sincronización en sí (T49 manda info cuando la manda; no podemos forzarla).
- El webhook ya configurado seguirá empujando eventos cuando ZIM responda.
