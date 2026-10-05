# Corregir las 4 fallas reales de Sentry

## 1. Filtro "Emitida" en Notas de crédito de compras (JAVASCRIPT-REACT-7D)
- Causa confirmada: un enlace guardado o una versión anterior mandaba `estado=Emitida` en la dirección de la página. El filtro actual ya ofrece solo Borrador/Aprobada/Aplicada/Cancelada, pero un valor viejo en la dirección todavía puede llegar a la consulta.
- Corrección: antes de consultar, revisar que el estado del filtro esté en la lista permitida. Si no está, usar "todos". Así un enlace viejo deja de romper la pantalla.
- Prueba: agregar un caso en la prueba del controlador para revisar que "Emitida" se cambia a "todos".

## 2. Registro de errores del navegador (JAVASCRIPT-REACT-79)
- Causa confirmada: la función `client-error-log` lee `body.message`. Si recibe JSON válido que no es un objeto (por ejemplo `null`), falla con un 500.
- Corrección: después de leer el JSON, si el contenido no es un objeto, responder 400 `invalid_payload` sin enviar nada a Sentry.
- Después hay que desplegar solo `client-error-log`.

## 3. Tipo de cambio en 0 al cerrar una factura sin pago (JAVASCRIPT-REACT-7F)
- Causa confirmada en la base: la función `cerrar_factura_proveedor_sin_pago` guarda el ajuste con `tipo_cambio_usd = 0`. La regla `pagos_proveedor_tc_pos` acepta un valor vacío o mayor que 0, nunca 0. Por eso el cierre "Condonación" de una factura en MXN falló.
- Corrección: guardar el ajuste con tipo de cambio vacío en lugar de 0. Así queda igual que un pago normal en MXN. No cambia importes ni saldos.
- Esto requiere **una migración nueva** que redefine solo esa función, con el mismo cuerpo y los mismos permisos, más su copia canónica en `supabase/schema/cxp/`. Al terminar, `db:postcheck` y la baseline.
- Antes de aplicar, reviso si ya hay ajustes guardados con 0. No los cambio: solo los reporto.

## 4. "Documento no encontrado" al retirar del buzón del embarque (JAVASCRIPT-REACT-7G)
- Causa probable, sin confirmar del todo: el usuario intentó retirar un documento que ya estaba retirado. Pudo ser por una lista desactualizada o por dar doble clic. La base responde bien. La falla está en la pantalla, que lo trata como un error real.
- Corrección en la pantalla:
  - Si al retirar o reactivar llega `LC_NOT_FOUND`, mostrar el aviso "Este documento ya no está en el buzón" y refrescar la lista.
  - Desactivar el botón mientras se confirma.
  - No reportar ese caso a Sentry como falla.
- Primero confirmo la causa revisando el registro del documento.

## Cierre
- Marcar 7D, 79, 7F y 7G como resueltos en Sentry y anotar sus IDs en CHANGELOG. No cambio la versión sin tu permiso, así que te lo pregunto al final.
- Solo hago revisiones rápidas: pruebas de los archivos tocados y la prueba Deno de `client-error-log`. CI y RLS completos quedan para GitHub Actions.
- No publico la app.

## Detalles técnicos
- Archivos: `useComprasNotasCreditoController.ts`, `supabase/functions/client-error-log/index.ts`, `TabFacturasEntrantes.tsx` y su hook de retiro, la migración nueva y `supabase/schema/cxp/cerrar_factura_proveedor_sin_pago.sql`.
