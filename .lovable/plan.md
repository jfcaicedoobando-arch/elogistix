## Plan: corregir prueba de conexión FacturApi

### Problema
El evento de Sentry en `13.141.12` muestra un error visible como timeout/red, pero los logs del backend indican la causa real:

- `facturapi-test-conexion` intenta cargar el SDK con un specifier inválido: `npm:[email protected]`.
- Deno responde: `Could not find constraint '[email protected]' in the list of packages.`
- Al fallar el arranque/carga del SDK, el frontend sólo recibe un error genérico: “No fue posible contactar al servidor de FacturApi”.

Analogía: no es que FacturApi necesariamente esté caído; es como marcarle a un proveedor usando un número guardado con caracteres raros. La llamada falla antes de salir correctamente.

### Cambios propuestos

1. **Quitar dependencia del SDK en la prueba de conexión**
   - En `supabase/functions/facturapi-test-conexion/index.ts`, dejar de importar `getFacturapiClient` desde `_shared/facturapiClient.ts`.
   - Para este endpoint sólo necesitamos validar la API key y leer `organizations/me`; eso se puede hacer con `fetch` directo a FacturApi usando `FACTURAPI_BASE` + `basicAuthHeader`.
   - Esto reduce el riesgo de cold-start, errores de npm/Deno y timeouts causados por carga del paquete.

2. **Mantener el SDK para operaciones reales de timbrado**
   - No tocar `facturapi-emitir-nota-credito` ni otras funciones que sí usan el SDK para crear CFDIs.
   - Sólo aislar la prueba de conexión, que debe ser ligera y confiable.

3. **Corregir el specifier del SDK compartido**
   - En `supabase/functions/_shared/facturapiClient.ts`, corregir el specifier a una forma válida y exacta: `npm:facturapi@4.18.0`.
   - Actualizar comentarios que todavía dicen `facturapi-node` / `v5+` para que reflejen la realidad: paquete `facturapi`, versión `4.18.0`.
   - Mantener el `.catch()` defensivo para que, si el SDK falla en el futuro, no tire el worker completo.

4. **Mejorar el error que vuelve al frontend**
   - Si FacturApi responde 401/403, devolver mensaje claro: API key inválida o ambiente incorrecto.
   - Si responde 404 al usar un `facturapi_org_id` guardado, reintentar con `me` o devolver mensaje accionable.
   - Si hay timeout real, conservar el mensaje en español pero con detalle técnico útil en logs.

5. **Actualizar versión y changelog**
   - Bump a `13.141.13`.
   - Agregar entrada en `CHANGELOG.md` explicando que la prueba de conexión ya no depende del SDK y que se corrigió el specifier inválido.

6. **Validación**
   - Verificar lint sobre los archivos tocados.
   - Probar la edge function: debe responder con JSON controlado, no con fallo de red/worker.
   - Revisar logs: debe desaparecer `Could not find constraint '[email protected]'`.

### Resultado esperado
El botón “Probar conexión” en `/configuracion` debe dejar de fallar por arranque del SDK. Si la key está mal, el usuario verá un error claro; si la key está bien, verá conexión exitosa.