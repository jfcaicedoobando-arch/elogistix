## Buscar contenedores por BL Master vía JSONCargo

Agregar una utilidad en el tab Tracking del embarque para consultar el endpoint `GET /containers/bol/{bl}?shipping_line=...` de JSONCargo, mostrar los contenedores devueltos, dejar elegir uno y guardarlo en el embarque, sincronizando tracking inmediatamente después.

### Flujo UX

En `TrackingLiveCard` (tab Tracking), cuando `modo === "Marítimo"`, naviera está soportada y existe `bl_master`:

1. Aparece botón secundario **"Buscar contenedores por BL Master"** (visible aunque ya haya contenedor — útil para corregir).
2. Al click → llama edge function nueva → muestra Dialog/Popover con:
   - Cabecera: BL, naviera, total de contenedores, `last_updated`.
   - Lista de contenedores como `RadioGroup` (uno seleccionable). Si el embarque ya tiene contenedor, queda preseleccionado y marcado con badge "actual".
   - Botón **"Guardar y sincronizar"** → actualiza `embarques.contenedor` y dispara `useSyncJsonCargo` con el contenedor elegido.
3. Manejo de errores: BL no encontrado (404), naviera inválida, 429 cuota, sin BL Master → mensajes claros con `notifyError`.
4. Si no hay `bl_master` aún, el botón se muestra deshabilitado con tooltip "Captura el BL Master en Datos / Ruta".

### Backend

Nueva edge function `jsoncargo-bol-lookup` (en lugar de extender `jsoncargo-track` para mantener responsabilidades separadas):

- Input: `{ embarque_id }` (lee bl_master + naviera del embarque vía service role; valida pertenencia a la organización del usuario).
- Valida JWT, mapea naviera con helper compartido `_shared/jsoncargo.ts` (extender con `getBolContainers(bl, shippingLine)`).
- Llama `https://api.jsoncargo.com/api/v1/containers/bol/{bl}?shipping_line={X}` con `x-api-key`.
- Devuelve `{ ok, bill_of_lading, shipping_line_name, associated_containers, associated_container_numbers, last_updated }` o `{ ok:false, code, message }`.
- Registra en `bitacora_actividad` (acción `jsoncargo_bol_lookup`).

No requiere migración: ya existe `embarques.contenedor` y `embarques.bl_master`.

### Frontend

- `src/lib/jsoncargo/navieras.ts`: ya tiene `mapNavieraToJsonCargo` — reutilizar.
- `src/hooks/embarque/useJsonCargoBolLookup.ts` (nuevo): mutation que invoca la edge function.
- `src/hooks/embarque/mutations/useUpdateEmbarque.ts`: ya existe — reusar para guardar el `contenedor` elegido.
- `src/components/embarque/DialogBolContainers.tsx` (nuevo): Dialog con RadioGroup de contenedores y botón confirmar; al confirmar:
  1. `updateEmbarque({ contenedor })`
  2. `syncJsonCargo({ embarqueId, contenedor, naviera })`
  3. Cerrar, invalidar queries (`embarques.detail`, `tracking_externo`, `tracking_eventos`).
- `TrackingLiveCard.tsx`: agregar botón "Buscar contenedores por BL Master" + estado para abrir el Dialog.

### Notas técnicas

- No aplica validación de prefix BIC en BL lookup (el endpoint es por BL, no por contenedor). El prefix check sigue corriendo después al sincronizar el contenedor seleccionado.
- Sin throttle propio: la cuota la controla JSONCargo (429). Sí mostrar el `requests_available` si viene en headers (opcional, no bloqueante).
- Solo Marítimo (igual que tracking).
- Localización es-MX para fechas (`formatDate`).

### Versión y changelog

- Bump a `8.132.0` (feature).
- Entrada en `src/content/changelog/v8/chunks/0.ts` y `Changelog.tsx`: "Búsqueda de contenedores por BL Master vía JSONCargo en el tab Tracking."

### Archivos a crear / modificar

Crear:
- `supabase/functions/jsoncargo-bol-lookup/index.ts`
- `src/hooks/embarque/useJsonCargoBolLookup.ts`
- `src/components/embarque/DialogBolContainers.tsx`

Modificar:
- `supabase/functions/_shared/jsoncargo.ts` (agregar helper `getBolContainers`)
- `src/components/embarque/TrackingLiveCard.tsx`
- `src/constants/appVersion.ts`
- `src/content/changelog/v8/chunks/0.ts`
- `src/content/changelogData.ts`
- `src/pages/Changelog.tsx`