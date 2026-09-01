# Arreglar la carga de facturas con IA (bloqueo de CORS)

## Qué está pasando (verificado)

La app envía un encabezado nuevo llamado `x-organization-id` (agregado en la ola P2 de seguridad, para decirle al servidor a qué organización pertenece la factura). Ese encabezado ya existe en el código local, pero **las funciones publicadas todavía no lo autorizan**.

Comprobado en vivo contra las funciones publicadas:

- `parse-invoice-pdf` → responde `access-control-allow-headers: ... sentry-trace, baggage` (**sin** `x-organization-id`).
- `parse-cfdi-xml` → igual, **sin** `x-organization-id`.
- `adjuntar-xml-entrante` → **sí** lo trae (se redesplegó la semana pasada, por eso esa ruta funciona).

Analogía: el guardia de la entrada tiene una lista de credenciales permitidas. La app empezó a presentar una credencial nueva que el guardia todavía no tiene en su lista, así que el navegador ni siquiera deja entrar la petición. Por eso ves *"No pudimos contactar al servidor desde este dispositivo"* aunque tu internet esté bien, y por eso en los registros del servidor se ven arranques de la función pero **cero** peticiones y **cero** llamadas a la IA (la última llamada exitosa a Gemini fue hoy 15:47 CDMX, antes de que el navegador cacheara el preflight nuevo).

## Qué hacer

1. Redesplegar `parse-invoice-pdf` y `parse-cfdi-xml` con el código actual (ya contiene el encabezado permitido). No hace falta cambiar código de la app.
2. Verificar el preflight de ambas funciones: `access-control-allow-headers` debe incluir `x-organization-id`.
3. Verificar de punta a punta: subir un PDF de proveedor y confirmar que la IA responde (registro `pdf_ia_ok` en los logs de la función y una llamada exitosa a Gemini), y subir un XML CFDI para confirmar la otra ruta.
4. Registrar el cierre: bump de `APP_VERSION` y entrada breve en `CHANGELOG.md`.

## Notas técnicas

- Sin migraciones, sin SQL, sin secretos, sin features nuevas (YAGNI): esto es únicamente un despliegue de funciones que quedó rezagado respecto al frontend.
- Riesgo residual: el navegador cachea el preflight hasta 24 h (`Access-Control-Max-Age: 86400`); si tras el redespliegue sigue fallando en tu equipo, un recargado forzado limpia ese caché.
- Prevención mínima sugerida (opcional, decidir al aplicar): dejar constancia en el CHANGELOG de que cualquier cambio en `_shared/cors.ts` obliga a redesplegar **todas** las funciones que lo importan, no sólo la que se tocó.
