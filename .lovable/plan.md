## Plan

1. **Corregir la causa raíz de producción**
   - Actualizar `supabase/functions/_shared/cors.ts` para permitir los headers que Sentry agrega en producción: `sentry-trace` y `baggage`.
   - Esto aplica a `parse-cfdi-xml` porque usa `handlePreflightStrict()` y `buildCors()`.

2. **Blindar con pruebas**
   - Actualizar `supabase/functions/_shared/cors_test.ts` para verificar que el preflight desde `https://librecarga.com` acepta:
     - headers del SDK (`authorization`, `apikey`, `x-client-info`, etc.)
     - headers de Sentry (`sentry-trace`, `baggage`)

3. **Mantener trazabilidad sin romper CORS**
   - Revisar `src/lib/observability/sentry/core.ts`: hoy `tracePropagationTargets` incluye `*.supabase.co/functions/v1`, por eso Sentry adjunta esos headers a la llamada del CFDI.
   - No quitaría la trazabilidad si el CORS ya la permite; sólo documentaría el motivo para evitar regresiones.

4. **Versionado y changelog**
   - Subir `APP_VERSION`.
   - Agregar entrada en `CHANGELOG.md` explicando que en `librecarga.com` el navegador cancelaba el POST después del OPTIONS porque el preflight no autorizaba `sentry-trace`/`baggage`.

5. **Verificación**
   - Validar el preflight real contra `parse-cfdi-xml` desde `https://librecarga.com` con `sentry-trace,baggage`.
   - Ejecutar pruebas relevantes de CORS/edge function si están disponibles.

## Diagnóstico breve

El preview no fallaba porque ahí Sentry/tracing no se comporta igual. En `librecarga.com`, Sentry agrega dos “etiquetas de rastreo” al paquete (`sentry-trace` y `baggage`), pero el backend no las tenía en la lista de invitados de CORS. Analogía: el mensajero llegaba a recepción, pero traía dos gafetes extra no registrados; seguridad lo detenía antes de entregar el paquete real.