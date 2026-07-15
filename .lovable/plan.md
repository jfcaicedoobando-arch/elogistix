## Problema

Al timbrar, FacturAPI responde `"serie" is not allowed`. Estamos enviando el campo con nombre en español (`serie`), pero la API de FacturAPI espera `series` (inglés, plural). De hecho ya leemos `fapiJson.series` en la respuesta, así que la inconsistencia está sólo en el envío.

**Analogía:** Es como escribir "calle" en un formulario que exige "street" — el sistema rechaza el campo aunque el valor sea correcto.

## Cambios

Archivo único: `supabase/functions/facturapi-emitir/helpers.ts`

1. En la interfaz `FacturapiPayload` (línea 53): renombrar `serie?: string` → `series?: string`.
2. En `buildFacturapiPayload` (línea 162): cambiar `payload.serie = ctx.serie` → `payload.series = ctx.serie`.

El resto queda igual: internamente seguimos usando `ctx.serie` (input) y `serieTimbrada` (respuesta parseada desde `fapiJson.series`), sólo cambia el nombre del campo que viaja por HTTP a FacturAPI.

## Verificación

- Actualizar `helpers_test.ts` si valida el nombre del campo del payload (revisar línea 42 que hoy compara `p.serie`).
- Bump `APP_VERSION` a `13.300.56` y entrada en `CHANGELOG.md`.
- Reintentar timbrado desde la UI.
