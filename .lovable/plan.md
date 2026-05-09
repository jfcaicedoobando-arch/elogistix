## Objetivo

Guardar la documentación de la API de JSONCargo (https://jsoncargo.com/documentation-api/) como archivo Markdown en el repo, para tenerla como referencia rápida cuando se trabaje en tracking.

## Ubicación

`docs/integrations/jsoncargo-api.md`

(Se crea el directorio `docs/integrations/` si no existe — convención clara para futuras integraciones: `firecrawl`, `frankfurter`, etc.)

## Contenido del MD

1. **Header** con: fuente original, fecha de captura, versión de API (`v1`), nota de "snapshot — verificar contra docs oficiales antes de cambios mayores".
2. **Autenticación** — header `x-api-key`, secret usado en el proyecto: `JSONCARGO_API_KEY`.
3. **Endpoints** documentados (al menos):
   - `GET /api/v1/containers/{tracking_number}?shipping_line={NAME}` — detalle de tracking.
   - Cualquier otro endpoint que aparezca en la página (vessels, BL, etc.).
4. **Parámetros y shipping lines soportadas** — lista completa (MAERSK, HAPAG_LLOYD, HMM, ONE, EVERGREEN, MSC, CMA_CGM, COSCO, ZIM, YANG_MING, PIL).
5. **Ejemplo de respuesta JSON** del endpoint de containers (campos clave: `container_status`, `shipped_from`, `atd_origin`, `eta_final_destination`, `last_location`, `current_vessel_name`, etc.).
6. **Errores comunes** — incluyendo el "Prefix not found" que motivó la mejora reciente, con copy literal y código sugerido a mostrar al usuario.
7. **Referencias en el repo** — links a archivos donde se usa: `supabase/functions/_shared/jsoncargo.ts`, `supabase/functions/jsoncargo-track/index.ts`, `supabase/functions/jsoncargo-track-batch/index.ts`, `src/lib/jsoncargo/navieras.ts`, `src/lib/jsoncargo/containerPrefixes.ts`, `src/components/embarque/TrackingLiveCard.tsx`, `src/hooks/embarque/useJsonCargoTracking.ts`.

## Cómo se obtiene

Usaré `code--fetch_website` con format=markdown sobre `https://jsoncargo.com/documentation-api/`, limpiaré el resultado (quitar nav/footer/banners) y lo guardaré en el archivo. Si la página devuelve poco contenido (SPA), también guardaré el HTML como respaldo.

## Cambios

- Nuevo: `docs/integrations/jsoncargo-api.md`
- No requiere cambios en código, BD, ni edge functions.
- No bump de versión ni entrada en changelog (es documentación interna del repo, no feature visible).

## Fuera de alcance

- No modificar la integración actual.
- No automatizar refresh periódico de los docs.
