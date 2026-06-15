## Objetivo
Hacer que el botón **Ejecutar backfill** vuelva a correr correctamente en `/admin/auditoria` sin cambiar el alcance funcional.

## Diagnóstico
El error actual viene de la función `backfill_conceptos_venta_facturados()`: intenta actualizar `conceptos_venta.factura_id`, pero esa columna **no existe** en `conceptos_venta`. La columna `factura_id` existe en `proformas`, no en conceptos de venta.

Además, al validar la consulta de proformas apareció una señal de permisos en lectura directa, por lo que conviene dejar explícitos los `GRANT EXECUTE` de las funciones RPC en la nueva migración.

## Plan de implementación
1. Crear una migración SQL que reemplace `public.backfill_conceptos_venta_facturados()` para que sólo actualice:
   - `estado_facturacion = 'facturado'`
   - sin tocar `factura_id`.
2. Mantener el criterio de candidatos:
   - conceptos pendientes,
   - embarques `Entregado` o `Cerrado`,
   - con factura existente en estado `Emitida`, `Pagada` o `Parcialmente pagada`.
3. Re-publicar `GRANT EXECUTE` para:
   - `run_auditoria_backfill_legacy()`
   - `backfill_conceptos_venta_facturados()`
   - `backfill_proformas_aceptadas()`
4. Actualizar `APP_VERSION` y `CHANGELOG.md` como requiere el proyecto.
5. Validar sin modificar datos que la nueva definición ya no referencia columnas inexistentes, y luego podrás volver a ejecutar el botón.

## Fuera de alcance
- No cambiar UI.
- No ampliar reglas de auditoría.
- No hacer backfill de documentos, fechas ni otros módulos.