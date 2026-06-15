## Objetivo
Hacer que el botón **Ejecutar backfill** vuelva a correr correctamente en `/admin/auditoria` sin cambiar el alcance funcional.

## Diagnóstico
El backfill fallaba en cadena por tres causas reales:

1. `backfill_conceptos_venta_facturados()` intentaba escribir en `conceptos_venta.factura_id`, columna inexistente.
2. Después, `conceptos_venta.estado_facturacion` no permitía el valor `facturado`; sólo aceptaba `pendiente` y `en_proforma`.
3. Finalmente, el trigger de protección de embarques `Cerrado` bloqueaba el cambio administrativo aunque fuera sólo para marcar conceptos legacy como facturados.

## Plan de implementación
1. Reemplazar `public.backfill_conceptos_venta_facturados()` para que sólo actualice `estado_facturacion = 'facturado'`, sin tocar `factura_id`.
2. Ampliar el constraint de `conceptos_venta.estado_facturacion` para aceptar `facturado`.
3. Ajustar `bloquear_conceptos_en_embarque_cerrado()` con una excepción estrecha: sólo permite el cambio `pendiente` → `facturado` cuando corre el backfill legacy de auditoría.
4. Re-publicar `GRANT EXECUTE` de las funciones del backfill.
5. Actualizar `APP_VERSION` y `CHANGELOG.md`.

## Validación
Ejecutado en transacción reversible con la identidad del usuario `super_admin` de la sesión: `run_auditoria_backfill_legacy()` devuelve correctamente `113` conceptos actualizados, `22` embarques afectados y `151` proformas actualizadas, sin persistir cambios durante la prueba.

## Fuera de alcance
- No cambiar UI.
- No ampliar reglas de auditoría.
- No hacer backfill de documentos, fechas ni otros módulos.